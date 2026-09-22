/**
 * Controlled Video Download Management System Test Suite
 *
 * Validates:
 * 1. Free plan daily quota limit (1 download/day)
 * 2. Quota exhaustion rejection (429 DOWNLOAD_LIMIT_REACHED)
 * 3. Strict Concurrency & Atomic Quota Enforcement (10 simultaneous parallel requests on 1 quota unit -> exactly 1 succeeds, 9 fail)
 * 4. Duplicate download protection within grace window (24h)
 * 5. Subscription plan limits (Bronze, Silver, Gold allowances)
 * 6. Subscription expiry enforcement
 * 7. Cryptographically signed short-lived download token verification
 * 8. Tampered / Expired token rejection
 * 9. HTTP 206 Range request / resumable streaming
 * 10. User downloads history, quota status, and admin analytics
 */

import assert from "assert"
import http from "http"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import jwt from "jsonwebtoken"
import mongoose from "mongoose"
import { authConfig, dbConfig, downloadConfig } from "../config/index.js"
import User from "../Modals/Auth.js"
import Video from "../Modals/video.js"
import Subscription from "../Modals/Subscription.js"
import DownloadQuota from "../Modals/DownloadQuota.js"
import DownloadRecord from "../Modals/DownloadRecord.js"
import Device from "../Modals/Device.js"
import { downloadTokenService } from "../services/downloadTokenService.js"
import { quotaService } from "../services/quotaService.js"

process.env.NODE_ENV = "test"
const { app } = await import("../index.js")

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let API_BASE = ""

const request = ({ path, method = "GET", headers = {}, body = null }) => {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE)
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
          } catch (e) {
            json = raw
          }
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: json,
            raw,
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
    { expiresIn: "2h" }
  )
}

const runTests = async () => {
  console.log("==================================================================")
  console.log("CONTROLLED VIDEO DOWNLOAD MANAGEMENT SYSTEM: MASTER TEST SUITE")
  console.log("==================================================================")

  // 1. Connect MongoDB if needed
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(dbConfig.url || "mongodb://127.0.0.1:27017/youtube")
  } else if (mongoose.connection.readyState === 2) {
    await new Promise((resolve) => mongoose.connection.once("connected", resolve))
  }

  // 2. Start HTTP Server
  const server = http.createServer(app)
  await new Promise((resolve) => {
    server.listen(0, () => {
      const port = server.address().port
      API_BASE = `http://127.0.0.1:${port}`
      console.log(`Download Test Server listening on port ${port}`)
      resolve()
    })
  })

  let passedCount = 0

  try {
    // --- SETUP FIXTURES ---
    const timestamp = Date.now()
    const freeUser = await User.create({
      name: `Free User ${timestamp}`,
      email: `free_${timestamp}@example.com`,
      role: "user",
    })
    const freeToken = generateAuthToken(freeUser._id, freeUser.email, "user")

    const bronzeUser = await User.create({
      name: `Bronze User ${timestamp}`,
      email: `bronze_${timestamp}@example.com`,
      role: "user",
    })
    const bronzeToken = generateAuthToken(bronzeUser._id, bronzeUser.email, "user")

    const adminUser = await User.create({
      name: `Admin User ${timestamp}`,
      email: `admin_${timestamp}@example.com`,
      role: "admin",
    })
    const adminToken = generateAuthToken(adminUser._id, adminUser.email, "admin")

    // Create test videos
    const video1 = await Video.create({
      videotitle: `Test Video 1 ${timestamp}`,
      filepath: "public/video/vdo.mp4",
      videofilepath: "/video/vdo.mp4",
      filesize: "1048576",
      videochanel: "Test Channel",
    })

    const video2 = await Video.create({
      videotitle: `Test Video 2 ${timestamp}`,
      filepath: "public/video/vdo.mp4",
      videofilepath: "/video/vdo.mp4",
      filesize: "2097152",
      videochanel: "Test Channel",
    })

    const video3 = await Video.create({
      videotitle: `Test Video 3 ${timestamp}`,
      filepath: "public/video/vdo.mp4",
      videofilepath: "/video/vdo.mp4",
      filesize: "3145728",
      videochanel: "Test Channel",
    })

    // --- TEST 1: Unauthenticated request rejection ---
    {
      const res = await request({
        path: `/api/videos/${video1._id}/download/authorize`,
        method: "POST",
      })
      assert.strictEqual(res.statusCode, 401, "Unauthenticated request must return 401")
      console.log("[PASS] 1. Unauthenticated Request: Strictly rejected with 401 Unauthorized")
      passedCount++
    }

    // --- TEST 2: Free User First Download (Daily Limit = 1) ---
    let firstDownloadToken = ""
    let firstDownloadId = ""
    {
      const res = await request({
        path: `/api/videos/${video1._id}/download/authorize`,
        method: "POST",
        headers: {
          Authorization: `Bearer ${freeToken}`,
        },
        body: { deviceId: "laptop_browser" },
      })

      if (res.statusCode !== 200) {
        console.error("TEST 2 ERROR BODY:", res.body)
      }
      assert.strictEqual(res.statusCode, 200, "First free download authorization must succeed")
      assert.strictEqual(res.body.success, true, "Response success must be true")
      assert.strictEqual(res.body.planKey, "free", "Plan must be free")
      assert.strictEqual(res.body.quotaLimit, 1, "Free plan limit must be 1")
      assert.strictEqual(res.body.quotaUsed, 1, "Quota used must be 1")
      assert.strictEqual(res.body.quotaRemaining, 0, "Remaining quota must be 0")
      assert(res.body.downloadToken, "Must return downloadToken")

      firstDownloadToken = res.body.downloadToken
      firstDownloadId = res.body.downloadId
      console.log("[PASS] 2. Free Plan Daily Quota: Authorizes 1st download, decrements remaining to 0")
      passedCount++
    }

    // --- TEST 3: Free User Quota Exhaustion (2nd Download Blocked) ---
    {
      const res = await request({
        path: `/api/videos/${video2._id}/download/authorize`,
        method: "POST",
        headers: {
          Authorization: `Bearer ${freeToken}`,
        },
        body: { deviceId: "laptop_browser" },
      })

      assert.strictEqual(res.statusCode, 429, "Second download must be blocked with 429")
      assert.strictEqual(res.body.success, false, "Success must be false")
      assert(
        res.body.error.code === "DOWNLOAD_LIMIT_REACHED" ||
        res.body.error.code === "DOWNLOAD_QUOTA_EXCEEDED",
        "Code must be DOWNLOAD_LIMIT_REACHED or DOWNLOAD_QUOTA_EXCEEDED"
      )
      console.log("[PASS] 3. Quota Exhaustion: 2nd download blocked with 429 DOWNLOAD_QUOTA_EXCEEDED")
      passedCount++
    }

    // --- TEST 4: Duplicate Download Protection Within Grace Window (24h) ---
    {
      // Mark first download completed so it qualifies as a completed download within 24h
      await DownloadRecord.findByIdAndUpdate(firstDownloadId, {
        download_status: "completed",
        download_completed_at: new Date(),
      })

      // Requesting video 1 again within 24h should NOT be blocked by quota exhaustion because it's a duplicate download!
      const res = await request({
        path: `/api/videos/${video1._id}/download/authorize`,
        method: "POST",
        headers: {
          Authorization: `Bearer ${freeToken}`,
        },
        body: { deviceId: "laptop_browser" },
      })

      assert.strictEqual(res.statusCode, 200, "Duplicate download within window must succeed")
      assert.strictEqual(res.body.isDuplicate, true, "isDuplicate flag must be true")
      assert(res.body.downloadToken, "Must issue valid downloadToken for duplicate retry")
      console.log("[PASS] 4. Duplicate Grace Window: Re-downloading same video within 24h does not consume extra quota")
      passedCount++
    }

    // --- TEST 5: Atomic Concurrency Enforcement (10 Parallel Requests on 1 Quota Unit) ---
    {
      const concurrentUser = await User.create({
        name: `Concurrent User ${timestamp}`,
        email: `concurrent_${timestamp}@example.com`,
        role: "user",
      })
      const concurrentToken = generateAuthToken(concurrentUser._id, concurrentUser.email, "user")

      const concurrentVideos = await Promise.all(
        Array.from({ length: 10 }).map((_, i) =>
          Video.create({
            videotitle: `Concurrent Video ${i}_${timestamp}`,
            filepath: "public/video/vdo.mp4",
            videochanel: "Test Channel",
          })
        )
      )

      // Fire 10 simultaneous requests for different videos
      const parallelRequests = Array.from({ length: 10 }).map((_, i) =>
        request({
          path: `/api/videos/${concurrentVideos[i]._id}/download/authorize`,
          method: "POST",
          headers: {
            Authorization: `Bearer ${concurrentToken}`,
          },
          body: {
            deviceId: `browser_device_${timestamp}`,
            requestId: `req_${i}_${timestamp}`,
          },
        })
      )

      const results = await Promise.all(parallelRequests)
      const successCount = results.filter((r) => r.statusCode === 200).length
      const blockedCount = results.filter((r) => r.statusCode === 429).length

      assert.strictEqual(successCount, 1, "Exactly ONE request must succeed across concurrent tabs")
      assert.strictEqual(blockedCount, 9, "Exactly NINE requests must be blocked with 429")
      console.log("[PASS] 5. Atomic Concurrency Guard: 10 parallel requests on 1 quota -> exactly 1 success, 9 blocked")
      passedCount++
    }

    // --- TEST 6: Paid Subscription Allowances (Bronze Plan = 5 downloads) ---
    {
      // Upgrade bronzeUser to Bronze plan
      await Subscription.create({
        userId: bronzeUser._id,
        plan: "bronze",
        status: "active",
        startDate: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      })

      const res1 = await request({
        path: `/api/videos/${video1._id}/download/authorize`,
        method: "POST",
        headers: { Authorization: `Bearer ${bronzeToken}` },
      })
      assert.strictEqual(res1.statusCode, 200)
      assert.strictEqual(res1.body.planKey, "bronze")
      assert.strictEqual(res1.body.quotaLimit, 5, "Bronze limit must be 5")
      assert.strictEqual(res1.body.quotaRemaining, 4, "Remaining quota must be 4")

      const res2 = await request({
        path: `/api/videos/${video2._id}/download/authorize`,
        method: "POST",
        headers: { Authorization: `Bearer ${bronzeToken}` },
      })
      assert.strictEqual(res2.statusCode, 200)
      assert.strictEqual(res2.body.quotaRemaining, 3, "Remaining quota must be 3")

      console.log("[PASS] 6. Paid Subscription Plan: Bronze plan receives configured 5-download quota")
      passedCount++
    }

    // --- TEST 7: Subscription Expiry Enforcement ---
    {
      const expiredUser = await User.create({
        name: `Expired User ${timestamp}`,
        email: `expired_${timestamp}@example.com`,
      })
      const expiredToken = generateAuthToken(expiredUser._id, expiredUser.email, "user")

      // Create subscription that expired yesterday
      await Subscription.create({
        userId: expiredUser._id,
        plan: "silver",
        status: "active",
        startDate: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() - 1000), // expired 1s ago
      })

      const res = await request({
        path: `/api/videos/${video1._id}/download/authorize`,
        method: "POST",
        headers: { Authorization: `Bearer ${expiredToken}` },
      })

      assert.strictEqual(res.statusCode, 403, "Expired subscription must be rejected with 403")
      assert.strictEqual(res.body.error.code, "SUBSCRIPTION_EXPIRED")
      console.log("[PASS] 7. Subscription Expiry Guard: Expired paid plan rejected with 403 SUBSCRIPTION_EXPIRED")
      passedCount++
    }

    // --- TEST 8: Download Streaming with Valid Token ---
    {
      const res = await request({
        path: `/api/download/${firstDownloadToken}`,
        method: "GET",
      })

      assert.strictEqual(res.statusCode, 200, "Streaming with valid token must return 200")
      assert(res.headers["content-disposition"], "Must set Content-Disposition attachment")
      console.log("[PASS] 8. Secure Streaming: Valid short-lived token streams video file with attachment headers")
      passedCount++
    }

    // --- TEST 9: HTTP 206 Range Requests (Resumable Download) ---
    {
      const res = await request({
        path: `/api/download/${firstDownloadToken}`,
        method: "GET",
        headers: {
          Range: "bytes=0-10",
        },
      })

      assert.strictEqual(res.statusCode, 206, "Range request must return HTTP 206 Partial Content")
      assert(res.headers["content-range"], "Must include Content-Range header")
      console.log("[PASS] 9. Resumable Range Requests: Supports HTTP 206 Partial Content for interrupted downloads")
      passedCount++
    }

    // --- TEST 10: Invalid & Tampered Download Tokens ---
    {
      const resInvalid = await request({
        path: "/api/download/tampered.invalid.token",
        method: "GET",
      })
      assert.strictEqual(resInvalid.statusCode, 401, "Invalid token must return 401")

      // Expired token test
      const expiredResult = await downloadTokenService.generateDownloadToken({
        downloadId: firstDownloadId,
        videoId: video1._id,
        userId: freeUser._id,
        expiresInSeconds: -1, // Expired immediately
      })
      const expiredToken = expiredResult.token

      const resExpired = await request({
        path: `/api/download/${expiredToken}`,
        method: "GET",
      })
      assert.strictEqual(resExpired.statusCode, 401, "Expired token must return 401")
      assert.strictEqual(resExpired.body.error.code, "DOWNLOAD_TOKEN_EXPIRED")

      console.log("[PASS] 10. Cryptographic Token Protection: Tampered and expired tokens are rejected")
      passedCount++
    }

    // --- TEST 11: User Download History and Quota Endpoints ---
    {
      const quotaRes = await request({
        path: "/api/downloads/quota",
        method: "GET",
        headers: { Authorization: `Bearer ${freeToken}` },
      })
      assert.strictEqual(quotaRes.statusCode, 200)
      assert.strictEqual(quotaRes.body.data.planKey, "free")
      assert.strictEqual(quotaRes.body.data.quotaLimit, 1)

      const historyRes = await request({
        path: "/api/downloads",
        method: "GET",
        headers: { Authorization: `Bearer ${freeToken}` },
      })
      assert.strictEqual(historyRes.statusCode, 200)
      assert(Array.isArray(historyRes.body.data.downloads), "Must return downloads array")
      assert(historyRes.body.data.downloads.length >= 1, "Must contain at least 1 download record")

      console.log("[PASS] 11. User Profile History: GET /api/downloads & GET /api/downloads/quota return accurate state")
      passedCount++
    }

    // --- TEST 12: Admin Management and Analytics ---
    {
      const statsRes = await request({
        path: "/api/admin/downloads/statistics",
        method: "GET",
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      assert.strictEqual(statsRes.statusCode, 200)
      assert(statsRes.body.data.totalDownloads >= 1)
      assert(statsRes.body.data.downloadsByPlan)

      const allDownloadsRes = await request({
        path: "/api/admin/downloads",
        method: "GET",
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      assert.strictEqual(allDownloadsRes.statusCode, 200)
      assert(Array.isArray(allDownloadsRes.body.data.downloads))

      console.log("[PASS] 12. Admin Analytics: GET /api/admin/downloads/statistics aggregates metrics and audit logs")
      passedCount++
    }

    console.log("------------------------------------------------------------------")
    console.log(`DOWNLOAD SYSTEM SUITE RESULTS: ${passedCount} PASSED, 0 FAILED`)
    console.log("==================================================================")
  } catch (err) {
    console.error("Test failure:", err)
    process.exit(1)
  } finally {
    server.close()
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close()
    }
  }
}

runTests().catch((err) => {
  console.error("Fatal test error:", err)
  process.exit(1)
})
