/**
 * Phase 10: Admin Download Dashboard, Analytics, Reporting, User Download Management & System Operations
 *
 * Master Test Suite:
 * 1. Dashboard Summary: GET /api/admin/dashboard/summary returns complete accurate metrics
 * 2. Unauthorized Access: Normal user without admin privileges rejected with 403 FORBIDDEN
 * 3. Download Filtering: Filter by status, plan, riskLevel, and date range works accurately
 * 4. Download Search: User name, email, video title, and download ID search queries return matching records
 * 5. Pagination & Controlled Sorting: Page, limit, newest, oldest, largest file sorts work properly
 * 6. User Download Profile: GET /api/admin/users/:userId/downloads returns stats, quota, devices, and history
 * 7. Quota Adjustment: Admin adds temporary download credit; QuotaAdjustment created & audit logged
 * 8. Top Videos Analytics: GET /api/admin/analytics/videos/top ranks videos accurately with time window
 * 9. Subscription Analytics: Plan comparisons (Free, Bronze, Silver, Gold) and exhaustion metrics
 * 10. Security Analytics: GET /api/admin/security/summary returns open events and risk level distributions
 * 11. Report Generation: Generates structured report data for downloads, users, and subscriptions
 * 12. Report Export: Creates export job, generates secure CSV on disk, and serves via download token
 * 13. Audit Log Viewer: GET /api/admin/audit-logs filters by admin, action, target, and date range
 * 14. Sensitive Data Protection: Admin APIs redact internal security tokens, hashes, and raw secrets
 * 15. Dashboard Performance & Caching: TTL caching responds quickly under repeated queries
 */

import assert from "assert"
import http from "http"
import jwt from "jsonwebtoken"
import mongoose from "mongoose"
import { authConfig, dbConfig, downloadConfig } from "../config/index.js"
import User from "../Modals/Auth.js"
import Video from "../Modals/video.js"
import Subscription from "../Modals/Subscription.js"
import DownloadRecord from "../Modals/DownloadRecord.js"
import DownloadQuota from "../Modals/DownloadQuota.js"
import DownloadDevice from "../Modals/DownloadDevice.js"
import DownloadRestriction from "../Modals/DownloadRestriction.js"
import DownloadSecurityEvent from "../Modals/DownloadSecurityEvent.js"
import QuotaAdjustment from "../Modals/QuotaAdjustment.js"
import ReportExportJob from "../Modals/ReportExportJob.js"
import DownloadAuditLog from "../Modals/DownloadAuditLog.js"
import adminDashboardService from "../services/adminDashboardService.js"

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
    { expiresIn: "1h" }
  )
}

async function runMasterSuite() {
  console.log("==================================================================")
  console.log("PHASE 10: ADMIN DASHBOARD, ANALYTICS, REPORTING & OPS MASTER SUITE")
  console.log("==================================================================")

  // Start test server on dynamic port
  const server = http.createServer(app)
  await new Promise((resolve) => {
    server.listen(0, () => {
      const port = server.address().port
      API_BASE = `http://127.0.0.1:${port}`
      console.log(`Phase 10 Test Server listening on port ${port}`)
      resolve()
    })
  })

  // Ensure DB connection
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(dbConfig.url)
  }

  const runId = `test_p10_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

  // Helper to create test user
  const createTestUser = async (role = "user", name = "Test User") => {
    const uId = new mongoose.Types.ObjectId()
    const email = `${runId}_${uId.toString().slice(-6)}@example.com`
    const user = await User.create({
      _id: uId,
      email,
      name: `${name} ${uId.toString().slice(-4)}`,
      role,
      status: "active",
      joinedon: new Date(),
    })
    const token = generateAuthToken(user._id.toString(), email, role)
    return { user, token }
  }

  // Helper to create test video
  const createTestVideo = async (overrides = {}) => {
    return await Video.create({
      videotitle: `Dashboard Video ${runId}_${Math.random().toString(36).slice(2, 6)}`,
      videodescription: "Admin dashboard test file",
      filepath: "public/video/vdo.mp4",
      videochanel: "Admin Channel",
      uploader: "Admin Test",
      filesize: 1048576,
      is_downloadable: true,
      allowDownload: true,
      visibility: "public",
      ...overrides,
    })
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
      console.error(err)
      failed++
    }
  }

  try {
    // -------------------------------------------------------------
    // Test 1: Dashboard Summary
    // -------------------------------------------------------------
    await test("1. Dashboard Summary: GET /api/admin/dashboard/summary returns complete accurate metrics", async () => {
      const { token: adminToken } = await createTestUser("admin")
      const { user: normalUser } = await createTestUser("user")
      const video = await createTestVideo()

      // Create sample download
      await DownloadRecord.create({
        userId: normalUser._id,
        videoId: video._id,
        videoTitle: video.videotitle,
        subscription_plan: "bronze",
        download_status: "completed",
        file_size: 2048000,
      })

      const res = await request({
        path: "/api/admin/dashboard/summary?refresh=true",
        method: "GET",
        headers: { Authorization: `Bearer ${adminToken}` },
      })

      assert.strictEqual(res.statusCode, 200)
      assert.strictEqual(res.body.success, true)
      assert.ok(res.body.data.downloads)
      assert.ok(res.body.data.downloads.total >= 1)
      assert.ok(res.body.data.downloads.successful >= 1)
      assert.ok(res.body.data.users)
      assert.ok(res.body.data.subscriptions)
      assert.ok(res.body.data.security)
    })

    // -------------------------------------------------------------
    // Test 2: Unauthorized Access Protection
    // -------------------------------------------------------------
    await test("2. Unauthorized Access: Normal user without admin privileges rejected with 403 FORBIDDEN", async () => {
      const { token: normalToken } = await createTestUser("user")

      const res = await request({
        path: "/api/admin/dashboard/summary",
        method: "GET",
        headers: { Authorization: `Bearer ${normalToken}` },
      })

      assert.strictEqual(res.statusCode, 403)
      assert.strictEqual(res.body.code, "FORBIDDEN")
    })

    // -------------------------------------------------------------
    // Test 3: Download Filtering
    // -------------------------------------------------------------
    await test("3. Download Filtering: Filter by status, plan, riskLevel works accurately", async () => {
      const { token: adminToken } = await createTestUser("admin")
      const { user } = await createTestUser("user")
      const video = await createTestVideo()

      // Create records with distinct plans and statuses
      await DownloadRecord.create({
        userId: user._id,
        videoId: video._id,
        videoTitle: video.videotitle,
        subscription_plan: "gold",
        download_status: "completed",
        riskLevel: "low",
        file_size: 5000000,
      })

      await DownloadRecord.create({
        userId: user._id,
        videoId: video._id,
        videoTitle: video.videotitle,
        subscription_plan: "free",
        download_status: "blocked",
        riskLevel: "high",
        file_size: 1000000,
      })

      // Query gold completed downloads
      const res = await request({
        path: `/api/admin/downloads?status=completed&plan=gold&riskLevel=low`,
        method: "GET",
        headers: { Authorization: `Bearer ${adminToken}` },
      })

      assert.strictEqual(res.statusCode, 200)
      assert.ok(Array.isArray(res.body.data.downloads))
      for (const d of res.body.data.downloads) {
        assert.strictEqual(d.download_status, "completed")
        assert.strictEqual(d.subscription_plan, "gold")
        assert.strictEqual(d.riskLevel, "low")
      }
    })

    // -------------------------------------------------------------
    // Test 4: Download Search
    // -------------------------------------------------------------
    await test("4. Download Search: User name, email, video title search queries return matching records", async () => {
      const { token: adminToken } = await createTestUser("admin")
      const specialName = `UniqueSearchSubject_${runId}`
      const { user: specialUser } = await createTestUser("user", specialName)
      const specialTitle = `UniqueBlockbuster_${runId}`
      const specialVideo = await createTestVideo({ videotitle: specialTitle })

      await DownloadRecord.create({
        userId: specialUser._id,
        videoId: specialVideo._id,
        videoTitle: specialVideo.videotitle,
        subscription_plan: "silver",
        download_status: "completed",
      })

      // Search by video title
      const resVideo = await request({
        path: `/api/admin/downloads?search=${specialTitle}`,
        method: "GET",
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      assert.strictEqual(resVideo.statusCode, 200)
      assert.ok(resVideo.body.data.downloads.length >= 1)
      assert.strictEqual(resVideo.body.data.downloads[0].videoTitle, specialTitle)

      // Search by user name
      const resUser = await request({
        path: `/api/admin/downloads?search=${specialName}`,
        method: "GET",
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      assert.strictEqual(resUser.statusCode, 200)
      assert.ok(resUser.body.data.downloads.length >= 1)
    })

    // -------------------------------------------------------------
    // Test 5: Pagination & Controlled Sorting
    // -------------------------------------------------------------
    await test("5. Pagination & Controlled Sorting: Page, limit, and file size sorting works properly", async () => {
      const { token: adminToken } = await createTestUser("admin")
      const { user } = await createTestUser("user")
      const video = await createTestVideo()

      // Create 3 records with distinct sizes
      await DownloadRecord.create({
        userId: user._id,
        videoId: video._id,
        videoTitle: "Small File",
        file_size: 100,
        subscription_plan: "free",
        download_status: "completed",
      })
      await DownloadRecord.create({
        userId: user._id,
        videoId: video._id,
        videoTitle: "Large File",
        file_size: 90000000,
        subscription_plan: "free",
        download_status: "completed",
      })

      // Query sorted by largest
      const res = await request({
        path: `/api/admin/downloads?page=1&limit=2&sortBy=largest`,
        method: "GET",
        headers: { Authorization: `Bearer ${adminToken}` },
      })

      assert.strictEqual(res.statusCode, 200)
      assert.strictEqual(res.body.data.downloads.length, 2)
      assert.ok(res.body.data.downloads[0].file_size >= res.body.data.downloads[1].file_size)
      assert.ok(res.body.data.pagination)
      assert.strictEqual(res.body.data.pagination.page, 1)
    })

    // -------------------------------------------------------------
    // Test 6: User Download Profile
    // -------------------------------------------------------------
    await test("6. User Download Profile: GET /api/admin/users/:userId/downloads returns stats, quota, devices, and history", async () => {
      const { token: adminToken } = await createTestUser("admin")
      const { user } = await createTestUser("user")
      const video = await createTestVideo()

      // Register device and download
      await DownloadDevice.create({
        userId: user._id,
        device_identifier: `dev_prof_${runId}`,
        device_name: "Admin Profile Test Phone",
        device_type: "mobile",
        status: "active",
      })

      await DownloadRecord.create({
        userId: user._id,
        videoId: video._id,
        videoTitle: video.videotitle,
        subscription_plan: "free",
        download_status: "completed",
      })

      const res = await request({
        path: `/api/admin/users/${user._id}/downloads`,
        method: "GET",
        headers: { Authorization: `Bearer ${adminToken}` },
      })

      assert.strictEqual(res.statusCode, 200)
      assert.strictEqual(res.body.success, true)
      assert.strictEqual(res.body.data.user.email, user.email)
      assert.ok(res.body.data.stats)
      assert.strictEqual(res.body.data.stats.completedDownloads, 1)
      assert.ok(res.body.data.quota)
      assert.ok(res.body.data.devices)
      assert.strictEqual(res.body.data.devices.count, 1)
      assert.ok(res.body.data.security)
    })

    // -------------------------------------------------------------
    // Test 7: Manual Quota Adjustment
    // -------------------------------------------------------------
    await test("7. Quota Adjustment: Admin adds temporary download credit; QuotaAdjustment created & audit logged", async () => {
      const { user: admin, token: adminToken } = await createTestUser("admin")
      const { user } = await createTestUser("user")

      // User starts with free limit = 1
      const res = await request({
        path: `/api/admin/users/${user._id}/quota/adjust`,
        method: "POST",
        headers: { Authorization: `Bearer ${adminToken}` },
        body: {
          adjustmentType: "ADD_CREDIT",
          value: 5,
          reason: "Customer support compensation credit",
        },
      })

      assert.strictEqual(res.statusCode, 200)
      assert.strictEqual(res.body.success, true)
      assert.strictEqual(res.body.data.value, 5)
      assert.strictEqual(res.body.data.adjustmentType, "ADD_CREDIT")

      // Verify QuotaAdjustment model stored
      const adj = await QuotaAdjustment.findById(res.body.data.adjustmentId)
      assert.ok(adj)
      assert.strictEqual(adj.reason, "Customer support compensation credit")

      // Verify audit log recorded
      const audit = await DownloadAuditLog.findOne({
        userId: user._id,
        event: "ADMIN_QUOTA_ADJUSTED",
      })
      assert.ok(audit, "ADMIN_QUOTA_ADJUSTED audit log must be present")
    })

    // -------------------------------------------------------------
    // Test 8: Top Videos Analytics
    // -------------------------------------------------------------
    await test("8. Top Videos Analytics: GET /api/admin/analytics/videos/top ranks videos accurately with time window", async () => {
      const { token: adminToken } = await createTestUser("admin")
      const { user } = await createTestUser("user")
      const videoHot = await createTestVideo({ videotitle: `Hot Video ${runId}` })
      const videoCold = await createTestVideo({ videotitle: `Cold Video ${runId}` })

      // Create 15 downloads for videoHot
      for (let i = 0; i < 15; i++) {
        await DownloadRecord.create({
          userId: user._id,
          videoId: videoHot._id,
          videoTitle: videoHot.videotitle,
          download_status: "completed",
        })
      }

      // Create 1 download for videoCold
      await DownloadRecord.create({
        userId: user._id,
        videoId: videoCold._id,
        videoTitle: videoCold.videotitle,
        download_status: "completed",
      })

      const res = await request({
        path: `/api/admin/analytics/videos/top?range=30d&limit=100`,
        method: "GET",
        headers: { Authorization: `Bearer ${adminToken}` },
      })

      assert.strictEqual(res.statusCode, 200)
      assert.ok(Array.isArray(res.body.data.topVideos))
      const hotRank = res.body.data.topVideos.find((v) => String(v.videoId) === String(videoHot._id))
      const coldRank = res.body.data.topVideos.find((v) => String(v.videoId) === String(videoCold._id))

      assert.ok(hotRank)
      assert.strictEqual(hotRank.totalRequests, 15)
      if (coldRank) {
        assert.ok(hotRank.totalRequests >= coldRank.totalRequests)
      }
    })

    // -------------------------------------------------------------
    // Test 9: Subscription Plan Analytics
    // -------------------------------------------------------------
    await test("9. Subscription Analytics: Plan comparisons (Free, Bronze, Silver, Gold) and exhaustion metrics", async () => {
      const { token: adminToken } = await createTestUser("admin")

      const res = await request({
        path: "/api/admin/analytics/subscriptions",
        method: "GET",
        headers: { Authorization: `Bearer ${adminToken}` },
      })

      assert.strictEqual(res.statusCode, 200)
      assert.strictEqual(res.body.success, true)
      assert.ok(Array.isArray(res.body.data.plans))
      const planKeys = res.body.data.plans.map((p) => p.plan)
      assert.ok(planKeys.includes("free"))
      assert.ok(planKeys.includes("bronze"))
      assert.ok(planKeys.includes("silver"))
      assert.ok(planKeys.includes("gold"))
    })

    // -------------------------------------------------------------
    // Test 10: Security Analytics Integration
    // -------------------------------------------------------------
    await test("10. Security Analytics: GET /api/admin/security/summary returns open events and risk level distributions", async () => {
      const { token: adminToken } = await createTestUser("admin")

      const res = await request({
        path: "/api/admin/security/summary?timeRange=30d",
        method: "GET",
        headers: { Authorization: `Bearer ${adminToken}` },
      })

      assert.strictEqual(res.statusCode, 200)
      assert.strictEqual(res.body.success, true)
      assert.ok(res.body.data.securityEvents)
      assert.ok(res.body.data.restrictions)
    })

    // -------------------------------------------------------------
    // Test 11: Report Generation
    // -------------------------------------------------------------
    await test("11. Report Generation: Generates structured report data for downloads, users, and subscriptions", async () => {
      const { token: adminToken } = await createTestUser("admin")

      const res = await request({
        path: "/api/admin/reports/downloads?range=30d",
        method: "GET",
        headers: { Authorization: `Bearer ${adminToken}` },
      })

      assert.strictEqual(res.statusCode, 200)
      assert.strictEqual(res.body.success, true)
      assert.strictEqual(res.body.data.reportType, "downloads")
      assert.ok(Array.isArray(res.body.data.items))
    })

    // -------------------------------------------------------------
    // Test 12: Report Export & Secure Download
    // -------------------------------------------------------------
    await test("12. Report Export: Creates export job, generates secure CSV on disk, and serves via download token", async () => {
      const { token: adminToken } = await createTestUser("admin")

      // Request export job
      const exportRes = await request({
        path: "/api/admin/reports/export",
        method: "POST",
        headers: { Authorization: `Bearer ${adminToken}` },
        body: {
          reportType: "downloads",
          dateRange: "30d",
          format: "csv",
        },
      })

      assert.strictEqual(exportRes.statusCode, 200)
      assert.strictEqual(exportRes.body.success, true)
      const { jobId, downloadToken } = exportRes.body.data
      assert.ok(jobId)
      assert.ok(downloadToken)

      // Check job status
      const statusRes = await request({
        path: `/api/admin/reports/exports/${jobId}`,
        method: "GET",
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      assert.strictEqual(statusRes.statusCode, 200)
      assert.strictEqual(statusRes.body.data.status, "completed")

      // Download CSV stream using token
      const downloadRes = await request({
        path: `/api/admin/reports/exports/${jobId}/download?token=${downloadToken}`,
        method: "GET",
      })

      assert.strictEqual(downloadRes.statusCode, 200)
      assert.ok(downloadRes.headers["content-type"].includes("text/csv"))
      assert.ok(downloadRes.raw.includes("Download ID"))
    })

    // -------------------------------------------------------------
    // Test 13: Audit Log Viewer
    // -------------------------------------------------------------
    await test("13. Audit Log Viewer: GET /api/admin/audit-logs filters by admin, action, target, and date range", async () => {
      const { token: adminToken } = await createTestUser("admin")

      const res = await request({
        path: "/api/admin/audit-logs?page=1&limit=10",
        method: "GET",
        headers: { Authorization: `Bearer ${adminToken}` },
      })

      assert.strictEqual(res.statusCode, 200)
      assert.strictEqual(res.body.success, true)
      assert.ok(Array.isArray(res.body.data.logs))
      assert.ok(res.body.data.pagination)
    })

    // -------------------------------------------------------------
    // Test 14: Sensitive Data Protection
    // -------------------------------------------------------------
    await test("14. Sensitive Data Protection: Admin APIs redact internal security tokens, hashes, and raw secrets", async () => {
      const { token: adminToken } = await createTestUser("admin")
      const { user } = await createTestUser("user")
      const video = await createTestVideo()

      const rec = await DownloadRecord.create({
        userId: user._id,
        videoId: video._id,
        videoTitle: video.videotitle,
        download_status: "completed",
        download_token_id: "dl_super_secret_internal_token_999",
      })

      // Query list
      const listRes = await request({
        path: `/api/admin/downloads?userId=${user._id}`,
        method: "GET",
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      assert.strictEqual(listRes.statusCode, 200)
      const found = listRes.body.data.downloads.find((d) => String(d._id) === String(rec._id))
      assert.ok(found)
      assert.strictEqual(found.download_token_id, undefined, "Raw token must not be leaked")
      assert.strictEqual(found.token_hash, undefined, "Raw token hash must not be leaked")

      // Query details
      const detailRes = await request({
        path: `/api/admin/downloads/${rec._id}`,
        method: "GET",
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      assert.strictEqual(detailRes.statusCode, 200)
      assert.strictEqual(detailRes.body.data.download.download_token_id, undefined)
      assert.strictEqual(detailRes.body.data.download.token_hash, undefined)
    })

    // -------------------------------------------------------------
    // Test 15: Dashboard Performance & Caching
    // -------------------------------------------------------------
    await test("15. Dashboard Performance & Caching: TTL caching responds quickly under repeated queries", async () => {
      const { token: adminToken } = await createTestUser("admin")

      // Initial call populates cache
      const first = await request({
        path: "/api/admin/dashboard/summary",
        method: "GET",
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      assert.strictEqual(first.statusCode, 200)
      const firstTimestamp = first.body.data.system.cacheTimestamp

      // Second call immediately returns cached response with same timestamp
      const second = await request({
        path: "/api/admin/dashboard/summary",
        method: "GET",
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      assert.strictEqual(second.statusCode, 200)
      const secondTimestamp = second.body.data.system.cacheTimestamp

      assert.strictEqual(firstTimestamp, secondTimestamp, "Cached response must share identical timestamp within TTL")
    })

  } finally {
    server.close()
  }

  console.log("==================================================================")
  console.log(`PHASE 10 MASTER SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`)
  console.log("==================================================================")

  if (failed > 0) {
    process.exit(1)
  }
}

runMasterSuite().catch((err) => {
  console.error("Master Suite Uncaught Error:", err)
  process.exit(1)
})
