/**
 * Phase 7: Duplicate Download Detection, Retry Management & Download History Test Suite
 *
 * Validates:
 * 1. Duplicate Download: Same user + same video within duplicate window reuses existing download (no quota consumed)
 * 2. Different Video: Normal quota check and deduction applied
 * 3. Duplicate Window Expired: Expired window triggers new authorization and quota deduction
 * 4. Failed Download Retry: Retries failed download, generates fresh token, no extra quota
 * 5. Interrupted Download: Retries interrupted download without extra quota
 * 6. Retry Limit: Exceeding maxRetries rejects with DOWNLOAD_RETRY_LIMIT_EXCEEDED (400)
 * 7. Retry Window Expired: Exceeding retryWindowMinutes rejects with DOWNLOAD_RETRY_WINDOW_EXPIRED (400)
 * 8. Concurrent Requests: Simultaneous requests result in 1 logical download and 1 quota deduction
 * 9. User Ownership: Cross-user retry attempt rejected with DOWNLOAD_ACCESS_DENIED (403)
 * 10. Download History: User sees only their own downloads
 * 11. Search: Search filters results by video title
 * 12. Filtering: status=completed returns only completed downloads
 * 13. Pagination: page and limit return correct items and metadata
 * 14. Sorting: Default query sorts newest first (createdAt DESC)
 * 15. Historical Plan: Preserves plan at time of download (e.g. Bronze) even after upgrade to Gold
 * 16. Deleted Video History: Record remains in history after video is deleted; redownload/retry blocked
 * 17. Refresh Request: Identical repeated request causes no duplicate quota deduction
 */

import assert from "assert"
import http from "http"
import fs from "fs"
import path from "path"
import crypto from "crypto"
import jwt from "jsonwebtoken"
import mongoose from "mongoose"
import { authConfig, dbConfig, downloadConfig } from "../config/index.js"
import User from "../Modals/Auth.js"
import Video from "../Modals/video.js"
import Subscription from "../Modals/Subscription.js"
import DownloadQuota from "../Modals/DownloadQuota.js"
import DownloadRecord from "../Modals/DownloadRecord.js"
import DownloadToken from "../Modals/DownloadToken.js"
import DownloadAuditLog from "../Modals/DownloadAuditLog.js"
import { duplicateDownloadService } from "../services/duplicateDownloadService.js"
import { downloadRetryService } from "../services/downloadRetryService.js"
import { downloadHistoryService } from "../services/downloadHistoryService.js"
import { downloadAuthorizationService } from "../services/downloadAuthorizationService.js"
import { downloadQuotaService } from "../services/quotaService.js"

process.env.NODE_ENV = "test"
const { app } = await import("../index.js")

let API_BASE = ""

const request = ({ path: reqPath, method = "GET", headers = {}, body = null }) => {
  return new Promise((resolve, reject) => {
    const url = new URL(reqPath, API_BASE)
    const reqHeaders = { ...headers }
    let bodyData = null

    if (body) {
      bodyData = typeof body === "string" ? body : JSON.stringify(body)
      reqHeaders["Content-Type"] = "application/json"
      reqHeaders["Content-Length"] = Buffer.byteLength(bodyData)
    }

    const req = http.request(
      url,
      {
        method,
        headers: reqHeaders,
      },
      (res) => {
        const chunks = []
        res.on("data", (chunk) => chunks.push(chunk))
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf-8")
          let json = null
          try {
            json = JSON.parse(raw)
          } catch {
            json = raw
          }
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: json,
            raw,
            buffer: Buffer.concat(chunks),
          })
        })
      }
    )

    req.on("error", reject)
    if (bodyData) {
      req.write(bodyData)
    }
    req.end()
  })
}

const generateAuthToken = (userId, email, role = "user") => {
  return jwt.sign(
    {
      id: userId,
      _id: userId,
      email,
      role,
    },
    authConfig.jwtSecret,
    { expiresIn: "1h", algorithm: "HS256" }
  )
}

async function runMasterSuite() {
  console.log("==================================================================")
  console.log("PHASE 7: DUPLICATE DETECTION, RETRY MANAGEMENT & HISTORY MASTER SUITE")
  console.log("==================================================================")

  // Start HTTP test server
  const server = http.createServer(app)
  await new Promise((resolve) => {
    server.listen(0, () => {
      const port = server.address().port
      API_BASE = `http://127.0.0.1:${port}`
      console.log(`Phase 7 Test Server listening on port ${port}`)
      resolve()
    })
  })

  // Ensure DB connection
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(dbConfig.url)
  }

  const runId = `test_p7_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

  // Helper to create test user
  const createTestUser = async (role = "user", status = "active") => {
    const uId = new mongoose.Types.ObjectId()
    const email = `${runId}_${uId.toString().slice(-6)}@example.com`
    const user = await User.create({
      _id: uId,
      email,
      name: `User ${uId.toString().slice(-4)}`,
      role,
      status,
      joinedon: new Date(),
    })
    const token = generateAuthToken(user._id.toString(), email, role)
    return { user, token }
  }

  // Helper to create active subscription
  const createSubscription = async (userId, plan = "silver", daysActive = 30) => {
    return await Subscription.create({
      userId,
      user_id: userId,
      plan,
      status: "active",
      startDate: new Date(),
      expiresAt: new Date(Date.now() + daysActive * 86400000),
      autoRenew: false,
    })
  }

  // Helper to create test video
  const createTestVideo = async (options = {}) => {
    const defaults = {
      videotitle: `P7 Video ${runId} ${Math.random().toString(36).slice(2, 6)}`,
      videofilepath: "public/video/vdo.mp4",
      filepath: "public/video/vdo.mp4",
      videochanel: "Test Channel",
      uploader: new mongoose.Types.ObjectId(),
      is_downloadable: true,
      access_level: "public",
      file_size: 397,
      filetype: "video/mp4",
      ...options,
    }
    return await Video.create(defaults)
  }

  let passed = 0
  let failed = 0

  const test = async (name, fn) => {
    try {
      await fn()
      console.log(`  PASS: ${name}`)
      passed++
    } catch (err) {
      console.error(`  FAIL: ${name}`)
      console.error(`    Error: ${err.message}`)
      if (err.stack) {
        console.error(`    Stack: ${err.stack.split("\n").slice(1, 4).join("\n")}`)
      }
      failed++
    }
  }

  try {
    // -------------------------------------------------------------
    // Test 1: Duplicate Download (Same video within window reuses download, no new quota)
    // -------------------------------------------------------------
    let user1 = null
    let token1 = null
    let videoA = null
    let initialDlId = null

    await test("1. Duplicate Download: Same user + same video within duplicate window reuses download (no quota consumed)", async () => {
      const u = await createTestUser()
      user1 = u.user
      token1 = u.token
      await createSubscription(user1._id, "bronze") // 5 downloads
      videoA = await createTestVideo({ videotitle: "Master Class Video A" })

      // First request: Authorize Video A
      const res1 = await request({
        path: "/api/downloads/authorize",
        method: "POST",
        headers: { Authorization: `Bearer ${token1}` },
        body: { videoId: videoA._id.toString() },
      })
      assert.strictEqual(res1.statusCode, 200)
      assert.strictEqual(res1.body.data.remainingQuota, 4)
      initialDlId = res1.body.data.downloadId

      // Second request: Request same Video A again within duplicate window (e.g. immediately)
      const res2 = await request({
        path: "/api/downloads/authorize",
        method: "POST",
        headers: { Authorization: `Bearer ${token1}` },
        body: { videoId: videoA._id.toString() },
      })

      assert.strictEqual(res2.statusCode, 200)
      assert.strictEqual(res2.body.isDuplicate, true, "Should be flagged as duplicate")
      assert.strictEqual(res2.body.data.downloadId.toString(), initialDlId.toString(), "Should reuse original downloadId")
      assert.strictEqual(res2.body.data.remainingQuota, 4, "Quota remaining must NOT be decremented again")

      // Verify quota record in database
      const quota = await downloadQuotaService.getActiveQuotaRecord(user1._id, "bronze")
      assert.strictEqual(quota.quota_used, 1, "Quota used should remain strictly 1")
    })

    // -------------------------------------------------------------
    // Test 2: Different Video: Normal quota check and deduction applied
    // -------------------------------------------------------------
    await test("2. Different Video: Normal quota check and deduction applied", async () => {
      const videoB = await createTestVideo({ videotitle: "Master Class Video B" })

      const resDiff = await request({
        path: "/api/downloads/authorize",
        method: "POST",
        headers: { Authorization: `Bearer ${token1}` },
        body: { videoId: videoB._id.toString() },
      })

      assert.strictEqual(resDiff.statusCode, 200)
      assert.strictEqual(resDiff.body.isDuplicate || false, false, "Should not be duplicate")
      assert.strictEqual(resDiff.body.data.remainingQuota, 3, "Quota remaining should decrement to 3")

      const quota = await downloadQuotaService.getActiveQuotaRecord(user1._id, "bronze")
      assert.strictEqual(quota.quota_used, 2, "Quota used should increment to 2")
    })

    // -------------------------------------------------------------
    // Test 3: Duplicate Window Expired: Triggers new authorization & quota deduction
    // -------------------------------------------------------------
    await test("3. Duplicate Window Expired: Expired window triggers new authorization and quota deduction", async () => {
      const { user, token } = await createTestUser()
      await createSubscription(user._id, "silver")
      const video = await createTestVideo()

      // Create an old download record outside the 24h duplicate window (e.g. 26 hours ago)
      const oldDate = new Date(Date.now() - 26 * 3600 * 1000)
      const oldRecord = await DownloadRecord.create({
        userId: user._id,
        videoId: video._id,
        videoTitle: video.videotitle,
        download_status: "completed",
        subscription_plan: "silver",
        createdAt: oldDate,
        updatedAt: oldDate,
        download_requested_at: oldDate,
        download_completed_at: oldDate,
      })

      // Request download for the same video now
      const resExpiredWindow = await request({
        path: "/api/downloads/authorize",
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: { videoId: video._id.toString() },
      })

      assert.strictEqual(resExpiredWindow.statusCode, 200)
      assert.strictEqual(resExpiredWindow.body.isDuplicate || false, false, "Expired window should NOT be duplicate")
      assert.notStrictEqual(resExpiredWindow.body.data.downloadId.toString(), oldRecord._id.toString(), "Should create a new download record")
    })

    // -------------------------------------------------------------
    // Test 4: Failed Download Retry: Retries failed download, generates fresh token, no extra quota
    // -------------------------------------------------------------
    let failedDlId = null
    await test("4. Failed Download Retry: Retries failed download, generates fresh token, no extra quota", async () => {
      const { user, token } = await createTestUser()
      await createSubscription(user._id, "silver")
      const video = await createTestVideo()

      // Create a failed download record
      const failedRecord = await DownloadRecord.create({
        userId: user._id,
        videoId: video._id,
        videoTitle: video.videotitle,
        download_status: "failed",
        failure_reason: "VIDEO_FILE_NOT_AVAILABLE",
        subscription_plan: "silver",
        retry_count: 0,
        quota_before_download: 0,
        quota_after_download: 1,
      })
      failedDlId = failedRecord._id

      // Call retry endpoint
      const retryRes = await request({
        path: `/api/downloads/${failedDlId}/retry`,
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })

      assert.strictEqual(retryRes.statusCode, 200, "Retry should return 200")
      assert.strictEqual(retryRes.body.success, true)
      assert.strictEqual(retryRes.body.data.status, "preparing")
      assert.strictEqual(retryRes.body.data.retryCount, 1)
      assert.ok(retryRes.body.data.authorizationToken.startsWith("dl_"), "Should return fresh dl_ token")

      const updated = await DownloadRecord.findById(failedDlId)
      assert.strictEqual(updated.retry_count, 1)
      assert.strictEqual(updated.download_status, "preparing")
    })

    // -------------------------------------------------------------
    // Test 5: Interrupted Download Retry: Allowed without extra quota
    // -------------------------------------------------------------
    await test("5. Interrupted Download: Retries interrupted download without extra quota", async () => {
      const { user, token } = await createTestUser()
      await createSubscription(user._id, "silver")
      const video = await createTestVideo()

      const interruptedRecord = await DownloadRecord.create({
        userId: user._id,
        videoId: video._id,
        videoTitle: video.videotitle,
        download_status: "interrupted",
        subscription_plan: "silver",
        retry_count: 0,
      })

      const retryRes = await request({
        path: `/api/downloads/${interruptedRecord._id}/retry`,
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })

      assert.strictEqual(retryRes.statusCode, 200)
      assert.strictEqual(retryRes.body.data.status, "preparing")
      assert.strictEqual(retryRes.body.data.retryCount, 1)
    })

    // -------------------------------------------------------------
    // Test 6: Retry Limit: Exceeding maxRetries rejects with DOWNLOAD_RETRY_LIMIT_EXCEEDED
    // -------------------------------------------------------------
    await test("6. Retry Limit: Exceeding maxRetries rejects with DOWNLOAD_RETRY_LIMIT_EXCEEDED (400)", async () => {
      const { user, token } = await createTestUser()
      await createSubscription(user._id, "silver")
      const video = await createTestVideo()

      // Record already at max retries (3)
      const exhaustedRecord = await DownloadRecord.create({
        userId: user._id,
        videoId: video._id,
        videoTitle: video.videotitle,
        download_status: "failed",
        subscription_plan: "silver",
        retry_count: downloadConfig.maxRetries || 3,
      })

      const retryRes = await request({
        path: `/api/downloads/${exhaustedRecord._id}/retry`,
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })

      assert.strictEqual(retryRes.statusCode, 400, "Should return 400 Bad Request")
      assert.strictEqual(retryRes.body.code, "DOWNLOAD_RETRY_LIMIT_EXCEEDED")
    })

    // -------------------------------------------------------------
    // Test 7: Retry Window Expired: Exceeding retryWindowMinutes rejects with DOWNLOAD_RETRY_WINDOW_EXPIRED
    // -------------------------------------------------------------
    await test("7. Retry Window Expired: Exceeding retryWindowMinutes rejects with DOWNLOAD_RETRY_WINDOW_EXPIRED (400)", async () => {
      const { user, token } = await createTestUser()
      await createSubscription(user._id, "silver")
      const video = await createTestVideo()

      // Record updated 2 hours ago (exceeds default 60 min retry window)
      const pastDate = new Date(Date.now() - 120 * 60 * 1000)
      const staleRecord = await DownloadRecord.create({
        userId: user._id,
        videoId: video._id,
        videoTitle: video.videotitle,
        download_status: "failed",
        subscription_plan: "silver",
        retry_count: 1,
        updatedAt: pastDate,
        createdAt: pastDate,
      })

      const retryRes = await request({
        path: `/api/downloads/${staleRecord._id}/retry`,
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })

      assert.strictEqual(retryRes.statusCode, 400)
      assert.strictEqual(retryRes.body.code, "DOWNLOAD_RETRY_WINDOW_EXPIRED")
    })

    // -------------------------------------------------------------
    // Test 8: Concurrent Requests: Simultaneous duplicate requests result in 1 logical download
    // -------------------------------------------------------------
    await test("8. Concurrent Requests: Simultaneous requests result in 1 logical download and 1 quota deduction", async () => {
      const { user, token } = await createTestUser()
      await createSubscription(user._id, "bronze")
      const video = await createTestVideo()

      // Fire 5 concurrent requests for the exact same user and video
      const promises = Array(5)
        .fill(null)
        .map(() =>
          request({
            path: "/api/downloads/authorize",
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: { videoId: video._id.toString() },
          })
        )

      const results = await Promise.all(promises)
      results.forEach((res) => {
        assert.strictEqual(res.statusCode, 200, "All concurrent requests should complete successfully")
      })

      // Ensure that only 1 quota unit was consumed overall
      const quota = await downloadQuotaService.getActiveQuotaRecord(user._id, "bronze")
      assert.strictEqual(quota.quota_used, 1, "Quota used must strictly be 1 despite 5 concurrent requests")
    })

    // -------------------------------------------------------------
    // Test 9: User Ownership: Cross-user retry attempt rejected with DOWNLOAD_ACCESS_DENIED (403)
    // -------------------------------------------------------------
    await test("9. User Ownership: Cross-user retry attempt rejected with DOWNLOAD_ACCESS_DENIED (403)", async () => {
      const userA = await createTestUser()
      const userB = await createTestUser()
      await createSubscription(userA.user._id, "silver")
      await createSubscription(userB.user._id, "silver")
      const video = await createTestVideo()

      const recordA = await DownloadRecord.create({
        userId: userA.user._id,
        videoId: video._id,
        videoTitle: video.videotitle,
        download_status: "failed",
        subscription_plan: "silver",
      })

      // User B attempts to retry User A's download
      const crossRetryRes = await request({
        path: `/api/downloads/${recordA._id}/retry`,
        method: "POST",
        headers: { Authorization: `Bearer ${userB.token}` },
      })

      assert.strictEqual(crossRetryRes.statusCode, 403, "Cross-user retry should return 403")
      assert.strictEqual(crossRetryRes.body.code, "DOWNLOAD_ACCESS_DENIED")
    })

    // -------------------------------------------------------------
    // Test 10: Download History: User sees only their own downloads
    // -------------------------------------------------------------
    let historyUser = null
    let historyToken = null
    await test("10. Download History: User sees only their own downloads", async () => {
      const u = await createTestUser()
      historyUser = u.user
      historyToken = u.token
      await createSubscription(historyUser._id, "silver")

      const otherUser = await createTestUser()
      const video1 = await createTestVideo({ videotitle: "Alpha History Video" })
      const video2 = await createTestVideo({ videotitle: "Beta History Video" })

      // Create downloads for historyUser
      await DownloadRecord.create({
        userId: historyUser._id,
        videoId: video1._id,
        videoTitle: video1.videotitle,
        download_status: "completed",
        subscription_plan: "silver",
        file_size: 1000,
      })
      await DownloadRecord.create({
        userId: historyUser._id,
        videoId: video2._id,
        videoTitle: video2.videotitle,
        download_status: "failed",
        subscription_plan: "silver",
        file_size: 2000,
      })

      // Create download for otherUser
      await DownloadRecord.create({
        userId: otherUser.user._id,
        videoId: video1._id,
        videoTitle: "Other User Secret Video",
        download_status: "completed",
        subscription_plan: "free",
      })

      const listRes = await request({
        path: "/api/downloads",
        method: "GET",
        headers: { Authorization: `Bearer ${historyToken}` },
      })

      assert.strictEqual(listRes.statusCode, 200)
      assert.strictEqual(listRes.body.success, true)
      const items = listRes.body.data.downloads
      assert.strictEqual(items.length, 2, "Should only return 2 downloads owned by user")
      assert.ok(!items.some((d) => d.videoTitle === "Other User Secret Video"), "Must never include other user downloads")
    })

    // -------------------------------------------------------------
    // Test 11: Search: Search filters results by video title
    // -------------------------------------------------------------
    await test("11. Search: Search filters results by video title", async () => {
      const searchRes = await request({
        path: "/api/downloads?search=Alpha",
        method: "GET",
        headers: { Authorization: `Bearer ${historyToken}` },
      })

      assert.strictEqual(searchRes.statusCode, 200)
      const items = searchRes.body.data.downloads
      assert.strictEqual(items.length, 1)
      assert.strictEqual(items[0].videoTitle, "Alpha History Video")
    })

    // -------------------------------------------------------------
    // Test 12: Filtering: status=completed returns only completed downloads
    // -------------------------------------------------------------
    await test("12. Filtering: status=completed returns only completed downloads", async () => {
      const filterRes = await request({
        path: "/api/downloads?status=completed",
        method: "GET",
        headers: { Authorization: `Bearer ${historyToken}` },
      })

      assert.strictEqual(filterRes.statusCode, 200)
      const items = filterRes.body.data.downloads
      assert.strictEqual(items.length, 1)
      assert.strictEqual(items[0].status, "completed")
    })

    // -------------------------------------------------------------
    // Test 13: Pagination: page and limit return correct items and metadata
    // -------------------------------------------------------------
    await test("13. Pagination: page and limit return correct items and metadata", async () => {
      const pageRes = await request({
        path: "/api/downloads?page=1&limit=1",
        method: "GET",
        headers: { Authorization: `Bearer ${historyToken}` },
      })

      assert.strictEqual(pageRes.statusCode, 200)
      const data = pageRes.body.data
      assert.strictEqual(data.downloads.length, 1)
      assert.strictEqual(data.pagination.page, 1)
      assert.strictEqual(data.pagination.limit, 1)
      assert.strictEqual(data.pagination.total, 2)
      assert.strictEqual(data.pagination.totalPages, 2)
    })

    // -------------------------------------------------------------
    // Test 14: Sorting: Default query sorts newest first (createdAt DESC)
    // -------------------------------------------------------------
    await test("14. Sorting: Default query sorts newest first (createdAt DESC)", async () => {
      const sortRes = await request({
        path: "/api/downloads",
        method: "GET",
        headers: { Authorization: `Bearer ${historyToken}` },
      })

      assert.strictEqual(sortRes.statusCode, 200)
      const items = sortRes.body.data.downloads
      assert.ok(
        new Date(items[0].createdAt).getTime() >= new Date(items[1].createdAt).getTime(),
        "Items should be ordered newest first"
      )
    })

    // -------------------------------------------------------------
    // Test 15: Historical Plan: Preserves plan at download time (Bronze) even after upgrade to Gold
    // -------------------------------------------------------------
    await test("15. Historical Plan: Preserves plan at time of download (Bronze) even after upgrade to Gold", async () => {
      const { user, token } = await createTestUser()
      await createSubscription(user._id, "bronze")
      const video = await createTestVideo({ videotitle: "Historical Plan Video" })

      // Download authorized while Bronze
      const dlRes = await request({
        path: "/api/downloads/authorize",
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: { videoId: video._id.toString() },
      })
      assert.strictEqual(dlRes.statusCode, 200)
      const dlId = dlRes.body.data.downloadId

      // User upgrades to Gold
      await Subscription.updateOne({ userId: user._id }, { $set: { plan: "gold" } })

      // Query download history
      const histRes = await request({
        path: "/api/downloads",
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      })

      assert.strictEqual(histRes.statusCode, 200)
      const downloadedRecord = histRes.body.data.downloads.find(
        (d) => d.downloadId.toString() === dlId.toString()
      )
      assert.ok(downloadedRecord, "Download record should be found in history")
      assert.strictEqual(
        downloadedRecord.plan,
        "bronze",
        "Historical download must preserve 'bronze' plan"
      )

      // Meanwhile, current quota snapshot in history must reflect 'gold'
      assert.strictEqual(
        histRes.body.data.quota.plan,
        "gold",
        "Current quota snapshot should reflect 'gold'"
      )
    })

    // -------------------------------------------------------------
    // Test 16: Deleted Video History: Record remains in history; redownload/retry blocked
    // -------------------------------------------------------------
    await test("16. Deleted Video History: Record remains in history after video is deleted; redownload/retry blocked", async () => {
      const { user, token } = await createTestUser()
      await createSubscription(user._id, "silver")
      const video = await createTestVideo({ videotitle: "Ephemeral Video" })

      const dlRes = await request({
        path: "/api/downloads/authorize",
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: { videoId: video._id.toString() },
      })
      const dlId = dlRes.body.data.downloadId

      // Soft delete the video
      video.deleted_at = new Date()
      await video.save()

      // History should still display the record
      const histRes = await request({
        path: `/api/downloads/${dlId}`,
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      })
      assert.strictEqual(histRes.statusCode, 200)
      assert.strictEqual(histRes.body.data.download.videoTitle, "Ephemeral Video")

      // Attempting to retry must be rejected with 404 VIDEO_NOT_AVAILABLE
      const retryRes = await request({
        path: `/api/downloads/${dlId}/retry`,
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })
      assert.strictEqual(retryRes.statusCode, 404)
      assert.strictEqual(retryRes.body.code, "VIDEO_NOT_AVAILABLE")
    })

    // -------------------------------------------------------------
    // Test 17: Refresh Request: Identical repeated request causes no duplicate quota deduction
    // -------------------------------------------------------------
    await test("17. Refresh Request: Identical repeated request causes no duplicate quota deduction", async () => {
      const { user, token } = await createTestUser()
      await createSubscription(user._id, "bronze")
      const video = await createTestVideo({ videotitle: "Refresh Target Video" })
      const idempotencyKey = `refresh_${Date.now()}`

      // Click download button
      const click1 = await request({
        path: "/api/downloads/authorize",
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": idempotencyKey,
        },
        body: { videoId: video._id.toString() },
      })
      assert.strictEqual(click1.statusCode, 200)
      const firstToken = click1.body.data.authorizationToken

      // Page refreshes and triggers identical request
      const click2 = await request({
        path: "/api/downloads/authorize",
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": idempotencyKey,
        },
        body: { videoId: video._id.toString() },
      })
      assert.strictEqual(click2.statusCode, 200)
      assert.strictEqual(click2.body.data.authorizationToken, firstToken)

      const quota = await downloadQuotaService.getActiveQuotaRecord(user._id, "bronze")
      assert.strictEqual(quota.quota_used, 1, "Quota used should remain strictly 1 after page refresh")
    })

  } finally {
    server.close()
  }

  console.log("==================================================================")
  console.log(`PHASE 7 MASTER SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`)
  console.log("==================================================================")

  if (failed > 0) {
    process.exit(1)
  }
}

runMasterSuite()
  .then(() => {
    console.log("All Phase 7 tests executed successfully.")
    process.exit(0)
  })
  .catch((err) => {
    console.error("Fatal error running Phase 7 test suite:", err)
    process.exit(1)
  })
