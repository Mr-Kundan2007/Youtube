import assert from "assert"
import http from "http"
import jwt from "jsonwebtoken"
import mongoose from "mongoose"
import { authConfig, dbConfig } from "../config/index.js"
import User from "../Modals/Auth.js"
import Video from "../Modals/video.js"
import Subscription from "../Modals/Subscription.js"
import DownloadQuota from "../Modals/DownloadQuota.js"
import DownloadRecord from "../Modals/DownloadRecord.js"
import DownloadDevice from "../Modals/DownloadDevice.js"
import DownloadSecurityEvent from "../Modals/DownloadSecurityEvent.js"
import DownloadNotification from "../Modals/DownloadNotification.js"
import SupportTicket from "../Modals/SupportTicket.js"
import DownloadPreference from "../Modals/DownloadPreference.js"
import { userDownloadCenterService } from "../services/userDownloadCenterService.js"
import { userNotificationService } from "../services/userNotificationService.js"
import { userSupportService } from "../services/userSupportService.js"
import { downloadQuotaService } from "../services/quotaService.js"

process.env.NODE_ENV = "test"
const { app } = await import("../index.js")

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
    { expiresIn: "1h", algorithm: "HS256" }
  )
}

async function runMasterSuite() {
  console.log("==================================================================")
  console.log("PHASE 11: USER DOWNLOAD CENTER & SELF-SERVICE MASTER SUITE")
  console.log("==================================================================")

  const server = http.createServer(app)
  await new Promise((resolve) => {
    server.listen(0, () => {
      const port = server.address().port
      API_BASE = `http://127.0.0.1:${port}`
      console.log(`Phase 11 Test Server listening on port ${port}`)
      resolve()
    })
  })

  let passedCount = 0
  const timestamp = Date.now()

  try {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(dbConfig.url)
    }

    // Helper to create test user
    const createTestUser = async (prefix = "user") => {
      const u = await User.create({
        name: `${prefix} ${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        email: `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}@example.com`,
      })
      return u
    }

    // Helper to create test video
    const createTestVideo = async (title = "Test Video") => {
      return await Video.create({
        videotitle: `${title} ${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        filepath: "public/video/vdo.mp4",
        videochanel: "Test Channel",
      })
    }

    // -------------------------------------------------------------
    // TEST 1: Download Dashboard (GET /api/downloads/dashboard)
    // -------------------------------------------------------------
    const user1 = await createTestUser("p11_user1")
    const token1 = generateAuthToken(user1._id, user1.email)
    const video1 = await createTestVideo("Dashboard Video")

    // Seed some download records
    await DownloadRecord.create([
      {
        userId: user1._id,
        videoId: video1._id,
        videoTitle: video1.videotitle,
        download_status: "completed",
        subscription_plan: "free",
        file_size: 15000000,
      },
      {
        userId: user1._id,
        videoId: video1._id,
        videoTitle: video1.videotitle,
        download_status: "failed",
        failure_reason: "INTERRUPTED",
        subscription_plan: "free",
        file_size: 15000000,
      },
    ])

    const dashRes = await request({
      path: "/api/downloads/dashboard",
      method: "GET",
      headers: { Authorization: `Bearer ${token1}` },
    })

    assert.strictEqual(dashRes.statusCode, 200)
    assert.strictEqual(dashRes.body.success, true)
    assert.strictEqual(dashRes.body.data.totalDownloads >= 2, true)
    assert.strictEqual(dashRes.body.data.completedDownloads >= 1, true)
    assert.strictEqual(dashRes.body.data.failedDownloads >= 1, true)
    assert(dashRes.body.data.quota)
    assert(dashRes.body.data.subscription)
    console.log("  PASS: 1. Download Dashboard: Returns correct stats, quota snapshot & subscription")
    passedCount++

    // -------------------------------------------------------------
    // TEST 2: Download Ownership (User A cannot access User B's download)
    // -------------------------------------------------------------
    const user2 = await createTestUser("p11_user2")
    const token2 = generateAuthToken(user2._id, user2.email)
    const user1Download = await DownloadRecord.findOne({ userId: user1._id })

    const deniedDetail = await request({
      path: `/api/downloads/${user1Download._id}`,
      method: "GET",
      headers: { Authorization: `Bearer ${token2}` },
    })

    assert([403, 404].includes(deniedDetail.statusCode))
    assert.strictEqual(deniedDetail.body.success, false)
    console.log("  PASS: 2. Download Ownership: Cross-user download detail inspection strictly denied")
    passedCount++

    // -------------------------------------------------------------
    // TEST 3: Download List (Returns only authenticated user's records)
    // -------------------------------------------------------------
    const listRes = await request({
      path: "/api/downloads",
      method: "GET",
      headers: { Authorization: `Bearer ${token1}` },
    })

    assert.strictEqual(listRes.statusCode, 200)
    const returnedItems = listRes.body.data?.downloads || listRes.body.data || []
    assert(Array.isArray(returnedItems))
    for (const item of returnedItems) {
      const recordInDb = await DownloadRecord.findById(item.downloadId || item._id)
      assert.strictEqual(recordInDb.userId.toString(), user1._id.toString())
    }
    console.log("  PASS: 3. Download List: Only authenticated user's own downloads are returned")
    passedCount++

    // -------------------------------------------------------------
    // TEST 4: Download Search (Search by video title)
    // -------------------------------------------------------------
    const uniqueTitleVideo = await createTestVideo("UniqueSpecialTitleXYZ")
    await DownloadRecord.create({
      userId: user1._id,
      videoId: uniqueTitleVideo._id,
      videoTitle: uniqueTitleVideo.videotitle,
      download_status: "completed",
      subscription_plan: "free",
    })

    const searchRes = await request({
      path: `/api/downloads?search=UniqueSpecialTitleXYZ`,
      method: "GET",
      headers: { Authorization: `Bearer ${token1}` },
    })

    assert.strictEqual(searchRes.statusCode, 200)
    const searchDownloads = searchRes.body.data?.downloads || []
    assert(searchDownloads.length >= 1)
    assert(searchDownloads[0].videoTitle.includes("UniqueSpecialTitleXYZ"))
    console.log("  PASS: 4. Download Search: Title search returns accurate matching downloads")
    passedCount++

    // -------------------------------------------------------------
    // TEST 5: Download Filter (Filter by failed status)
    // -------------------------------------------------------------
    const filterRes = await request({
      path: `/api/downloads?status=failed`,
      method: "GET",
      headers: { Authorization: `Bearer ${token1}` },
    })

    assert.strictEqual(filterRes.statusCode, 200)
    const filtered = filterRes.body.data?.downloads || []
    assert(filtered.length >= 1)
    for (const f of filtered) {
      assert.strictEqual(f.status, "failed")
    }
    console.log("  PASS: 5. Download Filter: Status filtering returns only matching status records")
    passedCount++

    // -------------------------------------------------------------
    // TEST 6: Retry Download (Revalidates quota & returns new token)
    // -------------------------------------------------------------
    const failedRecord = await DownloadRecord.create({
      userId: user1._id,
      videoId: video1._id,
      videoTitle: video1.videotitle,
      download_status: "failed",
      failure_reason: "INTERRUPTED",
      subscription_plan: "free",
      retry_count: 0,
    })

    const retryRes = await request({
      path: `/api/downloads/${failedRecord._id}/retry`,
      method: "POST",
      headers: { Authorization: `Bearer ${token1}` },
      body: { deviceId: "dev_p11_test_retry" },
    })

    assert.strictEqual(retryRes.statusCode, 200)
    assert.strictEqual(retryRes.body.success, true)
    assert(retryRes.body.data?.downloadToken || retryRes.body.downloadToken)
    console.log("  PASS: 6. Retry Download: Valid retry request reauthorizes download and issues token")
    passedCount++

    // -------------------------------------------------------------
    // TEST 7: Quota Page (GET /api/downloads/quota)
    // -------------------------------------------------------------
    const quotaRes = await request({
      path: "/api/downloads/quota",
      method: "GET",
      headers: { Authorization: `Bearer ${token1}` },
    })

    assert.strictEqual(quotaRes.statusCode, 200)
    assert.strictEqual(quotaRes.body.success, true)
    assert(quotaRes.body.data.planKey || quotaRes.body.data.plan)
    assert(quotaRes.body.data.quotaLimit !== undefined)
    assert(quotaRes.body.data.quotaUsed !== undefined)
    assert(quotaRes.body.data.quotaRemaining !== undefined)
    assert(quotaRes.body.data.resetAt !== undefined)
    console.log("  PASS: 7. Quota Page: Correctly returns used, remaining, limit, and reset timestamps")
    passedCount++

    // -------------------------------------------------------------
    // TEST 8: Quota Exhaustion (Download blocked when remaining is 0)
    // -------------------------------------------------------------
    const exhaustedUser = await createTestUser("p11_exhausted")
    const exhaustedToken = generateAuthToken(exhaustedUser._id, exhaustedUser.email)
    const exhaustedVideo1 = await createTestVideo("Exhaust Video 1")
    const exhaustedVideo2 = await createTestVideo("Exhaust Video 2")

    // First download consumes the free daily quota (limit: 1)
    const firstAuth = await request({
      path: "/api/downloads/authorize",
      method: "POST",
      headers: { Authorization: `Bearer ${exhaustedToken}` },
      body: { videoId: exhaustedVideo1._id.toString() },
    })
    assert.strictEqual(firstAuth.statusCode, 200)

    // Second download must be blocked with 429 quota exceeded
    const secondAuth = await request({
      path: "/api/downloads/authorize",
      method: "POST",
      headers: { Authorization: `Bearer ${exhaustedToken}` },
      body: { videoId: exhaustedVideo2._id.toString() },
    })
    assert.strictEqual(secondAuth.statusCode, 429)
    assert.strictEqual(secondAuth.body.success, false)
    console.log("  PASS: 8. Quota Exhaustion: Download request strictly blocked when remaining quota is 0")
    passedCount++

    // -------------------------------------------------------------
    // TEST 9: Notification Creation (Event triggers notification)
    // -------------------------------------------------------------
    const notif = await userNotificationService.createNotification({
      userId: user1._id,
      type: "DOWNLOAD_COMPLETED",
      title: "Download Complete",
      message: 'Your download for "Dashboard Video" is ready.',
      metadata: { videoId: video1._id },
    })

    assert(notif)
    assert.strictEqual(notif.title, "Download Complete")
    assert.strictEqual(notif.read, false)

    const notifListRes = await request({
      path: "/api/notifications",
      method: "GET",
      headers: { Authorization: `Bearer ${token1}` },
    })

    assert.strictEqual(notifListRes.statusCode, 200)
    assert.strictEqual(notifListRes.body.success, true)
    assert(notifListRes.body.data.notifications.length >= 1)
    console.log("  PASS: 9. Notification Creation: System events automatically create user notifications")
    passedCount++

    // -------------------------------------------------------------
    // TEST 10: Notification Ownership (User A cannot mark User B's notification read)
    // -------------------------------------------------------------
    const notifDenied = await request({
      path: `/api/notifications/${notif._id}/read`,
      method: "PATCH",
      headers: { Authorization: `Bearer ${token2}` },
    })

    assert.strictEqual(notifDenied.statusCode, 404)
    assert.strictEqual(notifDenied.body.success, false)

    // Owner can mark read
    const notifAllowed = await request({
      path: `/api/notifications/${notif._id}/read`,
      method: "PATCH",
      headers: { Authorization: `Bearer ${token1}` },
    })
    assert.strictEqual(notifAllowed.statusCode, 200)
    assert.strictEqual(notifAllowed.body.data.read, true)
    console.log("  PASS: 10. Notification Ownership: Cross-user notification manipulation denied")
    passedCount++

    // -------------------------------------------------------------
    // TEST 11: Device Management (GET /api/devices returns user's devices)
    // -------------------------------------------------------------
    const devIdentifier = `p11_dev_${timestamp}`
    await DownloadDevice.create({
      userId: user1._id,
      user_id: user1._id,
      device_identifier: devIdentifier,
      device_name: "Chrome on macOS",
      device_type: "desktop",
      browser: "Chrome",
      operating_system: "macOS",
      status: "active",
    })

    const devicesRes = await request({
      path: "/api/devices",
      method: "GET",
      headers: { Authorization: `Bearer ${token1}` },
    })

    assert.strictEqual(devicesRes.statusCode, 200)
    const userDevices = devicesRes.body.data?.devices || []
    assert(userDevices.length >= 1)
    assert(userDevices.some((d) => d.deviceId === devIdentifier || d.name === "Chrome on macOS"))
    console.log("  PASS: 11. Device Management: GET /api/devices returns authenticated user's devices")
    passedCount++

    // -------------------------------------------------------------
    // TEST 12: Remove Device (DELETE /api/devices/:id revokes device)
    // -------------------------------------------------------------
    const removeRes = await request({
      path: `/api/devices/${devIdentifier}`,
      method: "DELETE",
      headers: { Authorization: `Bearer ${token1}` },
    })

    assert.strictEqual(removeRes.statusCode, 200)
    const revokedDevice = await DownloadDevice.findOne({ device_identifier: devIdentifier })
    assert.strictEqual(revokedDevice.status, "revoked")
    console.log("  PASS: 12. Remove Device: User device removal revokes device and updates status")
    passedCount++

    // -------------------------------------------------------------
    // TEST 13: Support Ticket Creation (POST /api/support/download)
    // -------------------------------------------------------------
    const ticketRes = await request({
      path: "/api/support/download",
      method: "POST",
      headers: { Authorization: `Bearer ${token1}` },
      body: {
        downloadId: user1Download._id.toString(),
        issueType: "DOWNLOAD_INTERRUPTED",
        description: "The video stopped downloading at 50% and failed to resume.",
      },
    })

    assert.strictEqual(ticketRes.statusCode, 201)
    assert.strictEqual(ticketRes.body.success, true)
    assert(ticketRes.body.data.ticketId)
    const ticketId = ticketRes.body.data.ticketId
    console.log("  PASS: 13. Support Ticket: User can submit problem report and obtain ticket ID")
    passedCount++

    // -------------------------------------------------------------
    // TEST 14: Support Ownership (User A cannot access User B's ticket)
    // -------------------------------------------------------------
    const ticketDenied = await request({
      path: `/api/support/tickets/${ticketId}`,
      method: "GET",
      headers: { Authorization: `Bearer ${token2}` },
    })

    assert.strictEqual(ticketDenied.statusCode, 404)
    assert.strictEqual(ticketDenied.body.success, false)

    // Owner can access
    const ticketAllowed = await request({
      path: `/api/support/tickets/${ticketId}`,
      method: "GET",
      headers: { Authorization: `Bearer ${token1}` },
    })

    assert.strictEqual(ticketAllowed.statusCode, 200)
    assert.strictEqual(ticketAllowed.body.data.ticketId, ticketId)
    console.log("  PASS: 14. Support Ownership: Support ticket details restricted strictly to creator")
    passedCount++

    // -------------------------------------------------------------
    // TEST 15: Suspicious Activity Reporting (POST /api/downloads/report-suspicious)
    // -------------------------------------------------------------
    const reportSuspiciousRes = await request({
      path: "/api/downloads/report-suspicious",
      method: "POST",
      headers: { Authorization: `Bearer ${token1}` },
      body: {
        downloadId: user1Download._id.toString(),
        reason: "I was sleeping when this video was downloaded.",
      },
    })

    assert.strictEqual(reportSuspiciousRes.statusCode, 201)
    assert.strictEqual(reportSuspiciousRes.body.success, true)
    const secEvent = await DownloadSecurityEvent.findById(reportSuspiciousRes.body.data.eventId)
    assert(secEvent)
    assert.strictEqual(secEvent.eventType, "SUSPICIOUS_DOWNLOAD_REPORTED")
    console.log("  PASS: 15. Suspicious Activity: Reporting creates security event and alerts user")
    passedCount++

    // -------------------------------------------------------------
    // TEST 16: Duplicate / Idempotent Request Protection (Double Click)
    // -------------------------------------------------------------
    const idempKey = `p11_idem_${timestamp}`
    const p1 = downloadQuotaService.reserveQuota({
      userId: user1._id,
      videoId: video1._id,
      planKey: "silver",
      idempotencyKey: idempKey,
    })
    const p2 = downloadQuotaService.reserveQuota({
      userId: user1._id,
      videoId: video1._id,
      planKey: "silver",
      idempotencyKey: idempKey,
    })

    const [r1, r2] = await Promise.all([p1, p2])
    assert.strictEqual(r1.success, true)
    assert.strictEqual(r2.success, true)
    assert.strictEqual(r1.quotaRecord._id.toString(), r2.quotaRecord._id.toString())
    console.log("  PASS: 16. Duplicate Request Safety: Idempotency keys prevent duplicate deductions")
    passedCount++

    // -------------------------------------------------------------
    // TEST 17: Multi-Device Quota Enforcement (Concurrent cross-device)
    // -------------------------------------------------------------
    const multiUser = await createTestUser("p11_multi")
    const multiVideo1 = await createTestVideo("Multi Video 1")
    const multiVideo2 = await createTestVideo("Multi Video 2")

    // Free user has limit of 1. Simultaneous cross-device downloads: exactly 1 must succeed
    const cross1 = downloadQuotaService.reserveQuota({
      userId: multiUser._id,
      videoId: multiVideo1._id,
      planKey: "free",
      deviceId: "dev_A_concurrent",
    })
    const cross2 = downloadQuotaService.reserveQuota({
      userId: multiUser._id,
      videoId: multiVideo2._id,
      planKey: "free",
      deviceId: "dev_B_concurrent",
    })

    const [cr1, cr2] = await Promise.all([cross1, cross2])
    const wins = [cr1, cr2].filter((c) => c.success === true).length
    const fails = [cr1, cr2].filter((c) => c.success === false).length
    assert.strictEqual(wins, 1)
    assert.strictEqual(fails, 1)
    console.log("  PASS: 17. Multi-Device Quota: Concurrent cross-device requests strictly enforce limits")
    passedCount++

    // -------------------------------------------------------------
    // TEST 18: User Download Preferences & CSV Export
    // -------------------------------------------------------------
    const prefUpdate = await request({
      path: "/api/downloads/preferences",
      method: "PUT",
      headers: { Authorization: `Bearer ${token1}` },
      body: {
        preferredQuality: "1080p",
        notifyOnComplete: false,
      },
    })
    assert.strictEqual(prefUpdate.statusCode, 200)
    assert.strictEqual(prefUpdate.body.data.preferredQuality, "1080p")
    assert.strictEqual(prefUpdate.body.data.notifyOnComplete, false)

    const exportRes = await request({
      path: "/api/downloads/export",
      method: "GET",
      headers: { Authorization: `Bearer ${token1}` },
    })
    assert.strictEqual(exportRes.statusCode, 200)
    assert(exportRes.headers["content-type"].includes("text/csv"))
    assert(exportRes.raw.includes("Download Date,Video Title,Status,Plan,File Size (Bytes)"))
    console.log("  PASS: 18. User Preferences & Export: Settings persisted and CSV history exported cleanly")
    passedCount++

    console.log("==================================================================")
    console.log(`PHASE 11 MASTER SUITE RESULTS: ${passedCount} PASSED, 0 FAILED`)
    console.log("==================================================================")
  } catch (err) {
    console.error("Test Suite Failed:", err)
    process.exit(1)
  } finally {
    server.close()
    await mongoose.disconnect()
    process.exit(0)
  }
}

runMasterSuite()
