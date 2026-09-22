/**
 * Phase 9: Advanced Download Security, Abuse Prevention, Fraud Detection & Admin Download Monitoring
 *
 * Validates:
 * 1. Normal Download: Normal user, valid device, valid subscription -> Allowed, Risk LOW (0 pts)
 * 2. Download Rate Limit: 22 requests in 1 minute -> RATE_LIMIT_EXCEEDED (429)
 * 3. Invalid Token Abuse: Repeated invalid token -> Security Event Created, Risk Increased
 * 4. Token Replay: Used token attempted again -> Denied (409/403), TOKEN_REPLAY_ATTEMPT recorded
 * 5. Cross-Device Token: Token from Device A presented on Device B -> Denied with DOWNLOAD_DEVICE_MISMATCH (403)
 * 6. Rapid Device Switch: 3 devices used within short time -> RAPID_DEVICE_SWITCH flagged, download flagged
 * 7. Rapid IP Change: 3 IPs used within short time -> RAPID_IP_CHANGE flagged, risk increased (no auto-ban)
 * 8. High Risk Restriction: Multiple abuse events push risk score > 75 -> Auto temporary restriction (DOWNLOAD_RESTRICTED 403)
 * 9. Restricted User: Active DownloadRestriction blocks subsequent download with 403 DOWNLOAD_RESTRICTED
 * 10. Blocked Device: Blocked device download attempt denied with 403 (DEVICE_BLOCKED or DOWNLOAD_RESTRICTED)
 * 11. Admin Security Access: Normal user calling /api/admin/security/events rejected with 403 FORBIDDEN; Admin allowed (200)
 * 12. Admin Event Review: Admin updates event status, adds investigation notes, and resolves event
 * 13. Event Deduplication: Repetitive events aggregated into single document with event_count, preventing DB flood
 * 14. Risk Score Decay: Security event risk points decay over time, reducing effective risk score
 * 15. Admin Download Monitoring: Admin queries /api/admin/security/downloads with risk filtering and pagination
 */

import assert from "assert"
import http from "http"
import jwt from "jsonwebtoken"
import mongoose from "mongoose"
import { authConfig, dbConfig, downloadConfig, downloadSecurityConfig } from "../config/index.js"
import User from "../Modals/Auth.js"
import Video from "../Modals/video.js"
import Subscription from "../Modals/Subscription.js"
import Device from "../Modals/Device.js"
import DownloadRecord from "../Modals/DownloadRecord.js"
import DownloadToken from "../Modals/DownloadToken.js"
import DownloadSecurityEvent from "../Modals/DownloadSecurityEvent.js"
import DownloadRestriction from "../Modals/DownloadRestriction.js"
import DownloadAuditLog from "../Modals/DownloadAuditLog.js"
import { downloadAbuseService } from "../services/downloadAbuseService.js"
import { securityEventService } from "../services/securityEventService.js"
import { riskAssessmentService } from "../services/riskAssessmentService.js"
import { restrictionService } from "../services/restrictionService.js"

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
  console.log("PHASE 9: ADVANCED SECURITY, ABUSE PREVENTION & ADMIN MONITORING")
  console.log("==================================================================")

  // Start ephemeral HTTP test server
  const server = http.createServer(app)
  await new Promise((resolve) => {
    server.listen(0, () => {
      const port = server.address().port
      API_BASE = `http://127.0.0.1:${port}`
      console.log(`Phase 9 Test Server listening on port ${port}`)
      resolve()
    })
  })

  // Ensure DB connection
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(dbConfig.url)
  }

  const runId = `test_p9_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

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

  // Helper to create test subscription
  const createSubscription = async (userId, plan = "bronze") => {
    const cfg = downloadConfig.plans[plan] || downloadConfig.plans.bronze
    return await Subscription.create({
      userId,
      user_id: userId,
      plan,
      status: "active",
      download_limit: cfg.quotaLimit,
      download_quota_type: cfg.quotaType,
      max_devices: cfg.maxRegisteredDevices || 2,
      max_quality: cfg.maxQuality,
      startDate: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    })
  }

  // Helper to create test video
  const createTestVideo = async (overrides = {}) => {
    return await Video.create({
      videotitle: `Security Video ${runId}_${Math.random().toString(36).slice(2, 6)}`,
      videodescription: "Protected video test file",
      filepath: "public/video/vdo.mp4",
      videochanel: "Security Channel",
      uploader: "Test Admin",
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
    // Test 1: Normal Download Flow
    // -------------------------------------------------------------
    await test("1. Normal Download: Legitimate request succeeds with low risk (0 pts)", async () => {
      const { user, token } = await createTestUser()
      await createSubscription(user._id, "bronze")
      const video = await createTestVideo()
      const deviceId = `dev_normal_${runId}`

      const res = await request({
        path: "/api/downloads/authorize",
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Device-ID": deviceId,
        },
        body: {
          videoId: video._id.toString(),
          deviceId,
        },
      })

      assert.strictEqual(res.statusCode, 200)
      assert.strictEqual(res.body.success, true)
      assert.ok(res.body.data.authorizationToken)

      const record = await DownloadRecord.findById(res.body.data.downloadId)
      assert.ok(record)
      assert.strictEqual(record.securityFlagged, false)
      assert.strictEqual(record.riskLevel, "low")
    })

    // -------------------------------------------------------------
    // Test 2: Download Request Rate Limiting
    // -------------------------------------------------------------
    await test("2. Download Rate Limit: Excessive requests in short time triggers RATE_LIMIT_EXCEEDED (429)", async () => {
      const { user, token } = await createTestUser()
      await createSubscription(user._id, "gold")
      const video = await createTestVideo()
      const deviceId = `dev_rate_${runId}`

      downloadAbuseService.reset()

      let hitRateLimit = false
      // Fire 22 requests (limit is 20 per minute)
      for (let i = 0; i < 22; i++) {
        const res = await request({
          path: "/api/downloads/authorize",
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "X-Device-ID": deviceId,
          },
          body: {
            videoId: video._id.toString(),
            deviceId,
          },
        })

        if (res.statusCode === 429) {
          hitRateLimit = true
          assert.strictEqual(res.body.code, "RATE_LIMIT_EXCEEDED")
          break
        }
      }

      assert.strictEqual(hitRateLimit, true, "Rate limit must be triggered after exceeding threshold")

      // Verify security event created
      const event = await DownloadSecurityEvent.findOne({
        userId: user._id,
        eventType: "RATE_LIMIT_EXCEEDED",
      })
      assert.ok(event, "RATE_LIMIT_EXCEEDED security event must be recorded")
    })

    // -------------------------------------------------------------
    // Test 3: Invalid Token Abuse Detection
    // -------------------------------------------------------------
    await test("3. Invalid Token Abuse: Repeated invalid token requests create security event & increase risk", async () => {
      const { user, token } = await createTestUser()
      await createSubscription(user._id, "bronze")
      const video = await createTestVideo()
      const deviceId = `dev_token_abuse_${runId}`

      // Authorize legitimate download first so downloadId exists
      const authRes = await request({
        path: "/api/downloads/authorize",
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "X-Device-ID": deviceId },
        body: { videoId: video._id.toString(), deviceId },
      })
      assert.strictEqual(authRes.statusCode, 200)
      const downloadId = authRes.body.data.downloadId

      const res = await request({
        path: "/api/downloads/deliver",
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Device-ID": deviceId,
        },
        body: {
          token: "dl_invalid_bogus_token_12345",
          downloadId,
        },
      })

      assert.strictEqual(res.statusCode, 404)
      assert.strictEqual(res.body.code, "TOKEN_NOT_FOUND")

      const event = await DownloadSecurityEvent.findOne({
        eventType: "INVALID_DOWNLOAD_TOKEN",
        deviceId,
      })
      assert.ok(event, "INVALID_DOWNLOAD_TOKEN security event must be logged")
      assert.ok(event.riskPoints > 0)
    })

    // -------------------------------------------------------------
    // Test 4: Token Replay Abuse
    // -------------------------------------------------------------
    await test("4. Token Replay Abuse: Used token presented again is rejected and logs TOKEN_REPLAY_ATTEMPT", async () => {
      const { user, token } = await createTestUser()
      await createSubscription(user._id, "bronze")
      const video = await createTestVideo()
      const deviceId = `dev_replay_${runId}`

      // 1. Authorize download
      const authRes = await request({
        path: "/api/downloads/authorize",
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "X-Device-ID": deviceId },
        body: { videoId: video._id.toString(), deviceId },
      })
      assert.strictEqual(authRes.statusCode, 200)
      const downloadId = authRes.body.data.downloadId
      const dlToken = authRes.body.data.authorizationToken

      // 2. First delivery succeeds
      const delRes1 = await request({
        path: "/api/downloads/deliver",
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "X-Device-ID": deviceId },
        body: { downloadId, token: dlToken },
      })
      assert.strictEqual(delRes1.statusCode, 200)

      // 3. Second delivery attempt with same token fails (replay attack)
      const delRes2 = await request({
        path: "/api/downloads/deliver",
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "X-Device-ID": deviceId },
        body: { downloadId, token: dlToken },
      })
      assert.strictEqual(delRes2.statusCode, 409)
      assert.strictEqual(delRes2.body.code, "TOKEN_ALREADY_USED")

      // 4. Verify TOKEN_REPLAY_ATTEMPT security event
      const replayEvent = await DownloadSecurityEvent.findOne({
        userId: user._id,
        eventType: "TOKEN_REPLAY_ATTEMPT",
      })
      assert.ok(replayEvent, "TOKEN_REPLAY_ATTEMPT event must be stored")
      assert.strictEqual(replayEvent.riskPoints, 25)
    })

    // -------------------------------------------------------------
    // Test 5: Cross-Device Token Abuse
    // -------------------------------------------------------------
    await test("5. Cross-Device Token: Token issued to Device A presented by Device B is rejected (DOWNLOAD_DEVICE_MISMATCH)", async () => {
      const { user, token } = await createTestUser()
      await createSubscription(user._id, "silver")
      const video = await createTestVideo()

      const devA = `dev_A_${runId}`
      const devB = `dev_B_${runId}`

      const authRes = await request({
        path: "/api/downloads/authorize",
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "X-Device-ID": devA },
        body: { videoId: video._id.toString(), deviceId: devA },
      })
      assert.strictEqual(authRes.statusCode, 200)

      // Present on devB
      const delRes = await request({
        path: "/api/downloads/deliver",
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "X-Device-ID": devB },
        body: {
          downloadId: authRes.body.data.downloadId,
          token: authRes.body.data.authorizationToken,
        },
      })

      assert.strictEqual(delRes.statusCode, 403)
      assert.strictEqual(delRes.body.code, "DOWNLOAD_DEVICE_MISMATCH")

      const devEvent = await DownloadSecurityEvent.findOne({
        userId: user._id,
        eventType: "TOKEN_DEVICE_MISMATCH",
      })
      assert.ok(devEvent, "TOKEN_DEVICE_MISMATCH security event must be logged")
    })

    // -------------------------------------------------------------
    // Test 6: Rapid Device Switching Detection
    // -------------------------------------------------------------
    await test("6. Rapid Device Switching: 3 devices within 10 minutes triggers RAPID_DEVICE_SWITCH flag", async () => {
      const { user, token } = await createTestUser()
      await createSubscription(user._id, "gold") // Gold allows up to 10 devices
      const video1 = await createTestVideo()
      const video2 = await createTestVideo()
      const video3 = await createTestVideo()

      const dev1 = `dev_rapid_1_${runId}`
      const dev2 = `dev_rapid_2_${runId}`
      const dev3 = `dev_rapid_3_${runId}`

      // Download on dev1
      await request({
        path: "/api/downloads/authorize",
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "X-Device-ID": dev1 },
        body: { videoId: video1._id.toString(), deviceId: dev1 },
      })

      // Download on dev2
      await request({
        path: "/api/downloads/authorize",
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "X-Device-ID": dev2 },
        body: { videoId: video2._id.toString(), deviceId: dev2 },
      })

      // Download on dev3: triggers rapid switch detector (3 devices in window)
      const res3 = await request({
        path: "/api/downloads/authorize",
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "X-Device-ID": dev3 },
        body: { videoId: video3._id.toString(), deviceId: dev3 },
      })

      assert.strictEqual(res3.statusCode, 200)

      const record3 = await DownloadRecord.findById(res3.body.data.downloadId)
      assert.ok(record3)
      assert.strictEqual(record3.securityFlagged, true, "Download must be flagged for security review")
      assert.ok(record3.security_flags.includes("RAPID_DEVICE_SWITCH"))

      const event = await DownloadSecurityEvent.findOne({
        userId: user._id,
        eventType: "RAPID_DEVICE_SWITCH",
      })
      assert.ok(event, "RAPID_DEVICE_SWITCH security event must be recorded")
    })

    // -------------------------------------------------------------
    // Test 7: Rapid IP Address Switching
    // -------------------------------------------------------------
    await test("7. Rapid IP Switching: 3 IPs within 10 minutes triggers RAPID_IP_CHANGE and increases risk score", async () => {
      const { user, token } = await createTestUser()
      await createSubscription(user._id, "gold")
      const video1 = await createTestVideo()
      const video2 = await createTestVideo()
      const video3 = await createTestVideo()
      const deviceId = `dev_ip_switch_${runId}`

      // Request 1 on IP 1
      await request({
        path: "/api/downloads/authorize",
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Device-ID": deviceId,
          "X-Forwarded-For": "203.0.113.1",
        },
        body: { videoId: video1._id.toString(), deviceId },
      })

      // Request 2 on IP 2
      await request({
        path: "/api/downloads/authorize",
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Device-ID": deviceId,
          "X-Forwarded-For": "203.0.113.2",
        },
        body: { videoId: video2._id.toString(), deviceId },
      })

      // Request 3 on IP 3 -> Rapid IP change triggered
      const res3 = await request({
        path: "/api/downloads/authorize",
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Device-ID": deviceId,
          "X-Forwarded-For": "203.0.113.3",
        },
        body: { videoId: video3._id.toString(), deviceId },
      })

      assert.strictEqual(res3.statusCode, 200)

      const event = await DownloadSecurityEvent.findOne({
        userId: user._id,
        eventType: "RAPID_IP_CHANGE",
      })
      assert.ok(event, "RAPID_IP_CHANGE security event must be stored")
    })

    // -------------------------------------------------------------
    // Test 8: High Risk User Automated Temporary Restriction
    // -------------------------------------------------------------
    await test("8. High Risk Restriction: User exceeding risk threshold (>75) triggers automatic temporary restriction", async () => {
      const { user, token } = await createTestUser()
      await createSubscription(user._id, "gold")
      const video = await createTestVideo()
      const deviceId = `dev_high_risk_${runId}`

      // Artificially record 4 high-severity events pushing risk points to 100 (> 75)
      for (let i = 0; i < 4; i++) {
        await DownloadSecurityEvent.create({
          userId: user._id,
          user_id: user._id,
          deviceId: `dev_dummy_${i}_${runId}`,
          eventType: "TOKEN_REPLAY_ATTEMPT",
          riskLevel: "critical",
          riskPoints: 25,
          status: "open",
        })
      }

      // Next download attempt should be automatically restricted
      const res = await request({
        path: "/api/downloads/authorize",
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "X-Device-ID": deviceId },
        body: { videoId: video._id.toString(), deviceId },
      })

      assert.strictEqual(res.statusCode, 403)
      assert.strictEqual(res.body.code, "DOWNLOAD_RESTRICTED")

      // Verify automated restriction document exists
      const restriction = await DownloadRestriction.findOne({
        userId: user._id,
        status: "active",
      })
      assert.ok(restriction, "Automatic DownloadRestriction must be active")
      assert.strictEqual(restriction.createdBy, "system")
      assert.ok(restriction.expiresAt > new Date())
    })

    // -------------------------------------------------------------
    // Test 9: Restricted User Download Denied
    // -------------------------------------------------------------
    await test("9. Restricted User: Active restriction strictly rejects download with 403 DOWNLOAD_RESTRICTED", async () => {
      const { user, token } = await createTestUser()
      await createSubscription(user._id, "bronze")
      const video = await createTestVideo()

      // Manually apply download restriction
      await restrictionService.createRestriction({
        userId: user._id,
        reason: "Account suspended for terms violation",
        durationMinutes: 60,
        createdBy: "admin",
      })

      const res = await request({
        path: "/api/downloads/authorize",
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: { videoId: video._id.toString() },
      })

      assert.strictEqual(res.statusCode, 403)
      assert.strictEqual(res.body.code, "DOWNLOAD_RESTRICTED")
    })

    // -------------------------------------------------------------
    // Test 10: Blocked Device Download Denied
    // -------------------------------------------------------------
    await test("10. Blocked Device: Device blocked via admin API cannot perform downloads (DEVICE_BLOCKED / DOWNLOAD_RESTRICTED)", async () => {
      const { user, token } = await createTestUser()
      const { token: adminToken } = await createTestUser("admin")
      await createSubscription(user._id, "bronze")
      const video = await createTestVideo()
      const devBad = `dev_bad_${runId}`

      // Admin blocks device
      const blockRes = await request({
        path: `/api/admin/security/devices/${devBad}/block`,
        method: "POST",
        headers: { Authorization: `Bearer ${adminToken}` },
        body: { reason: "Known abusive emulator device" },
      })
      assert.strictEqual(blockRes.statusCode, 200)

      // User attempts download on blocked device
      const res = await request({
        path: "/api/downloads/authorize",
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "X-Device-ID": devBad },
        body: { videoId: video._id.toString(), deviceId: devBad },
      })

      assert.strictEqual(res.statusCode, 403)
      assert.ok(
        res.body.code === "DEVICE_BLOCKED" || res.body.code === "DOWNLOAD_RESTRICTED",
        "Must be blocked with DEVICE_BLOCKED or DOWNLOAD_RESTRICTED"
      )
    })

    // -------------------------------------------------------------
    // Test 11: Admin Security Authorization
    // -------------------------------------------------------------
    await test("11. Admin Security Access: Normal users rejected with 403 FORBIDDEN; Admin allowed (200)", async () => {
      const { token: userToken } = await createTestUser("user")
      const { token: adminToken } = await createTestUser("admin")

      // Normal user attempts to view security events
      const resForbidden = await request({
        path: "/api/admin/security/events",
        method: "GET",
        headers: { Authorization: `Bearer ${userToken}` },
      })
      assert.strictEqual(resForbidden.statusCode, 403)
      assert.strictEqual(resForbidden.body.code, "FORBIDDEN")

      // Admin accesses successfully
      const resOk = await request({
        path: "/api/admin/security/events",
        method: "GET",
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      assert.strictEqual(resOk.statusCode, 200)
      assert.strictEqual(resOk.body.success, true)
    })

    // -------------------------------------------------------------
    // Test 12: Admin Security Event Review & Resolution
    // -------------------------------------------------------------
    await test("12. Admin Event Review: Admin updates status, resolution, and investigation notes with audit logging", async () => {
      const { user } = await createTestUser()
      const { user: admin, token: adminToken } = await createTestUser("admin")

      const event = await DownloadSecurityEvent.create({
        userId: user._id,
        eventType: "UNUSUAL_DOWNLOAD_VOLUME",
        riskLevel: "medium",
        riskPoints: 15,
        status: "open",
      })

      const patchRes = await request({
        path: `/api/admin/security/events/${event._id}`,
        method: "PATCH",
        headers: { Authorization: `Bearer ${adminToken}` },
        body: {
          status: "resolved",
          resolution: "FALSE_POSITIVE",
          note: "User was transferring offline archive with valid subscription",
        },
      })

      assert.strictEqual(patchRes.statusCode, 200)

      const updated = await DownloadSecurityEvent.findById(event._id)
      assert.strictEqual(updated.status, "resolved")
      assert.strictEqual(updated.resolution, "FALSE_POSITIVE")
      assert.strictEqual(updated.adminNotes.length, 1)
      assert.strictEqual(updated.adminNotes[0].note, "User was transferring offline archive with valid subscription")
    })

    // -------------------------------------------------------------
    // Test 13: Security Event Deduplication & Anti-Flooding
    // -------------------------------------------------------------
    await test("13. Event Deduplication: Repetitive identical events within window aggregate into single document", async () => {
      const { user } = await createTestUser()
      const deviceId = `dev_dedup_${runId}`

      // Simulate 25 identical burst events
      for (let i = 0; i < 25; i++) {
        await securityEventService.recordEvent({
          userId: user._id,
          deviceId,
          eventType: "INVALID_DOWNLOAD_TOKEN",
          ipAddress: "192.0.2.1",
        })
      }

      // Exactly ONE document should exist with event_count >= 25
      const events = await DownloadSecurityEvent.find({
        userId: user._id,
        eventType: "INVALID_DOWNLOAD_TOKEN",
      })

      assert.strictEqual(events.length, 1, "Must aggregate burst into a single event document")
      assert.strictEqual(events[0].event_count, 25)
    })

    // -------------------------------------------------------------
    // Test 14: Risk Score Time Decay
    // -------------------------------------------------------------
    await test("14. Risk Score Decay: Risk points decay over time reducing effective user risk score", async () => {
      const { user } = await createTestUser()

      // Create event with 60 points and backdate createdAt to 12 hours ago
      const event = await DownloadSecurityEvent.create({
        userId: user._id,
        eventType: "DEVICE_LIMIT_ABUSE",
        riskPoints: 60,
        riskLevel: "high",
        status: "open",
      })

      // Backdate to 12 hours ago (out of 24-hour decay window) using native collection
      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000)
      await DownloadSecurityEvent.collection.updateOne(
        { _id: event._id },
        { $set: { createdAt: twelveHoursAgo } }
      )

      // Over 24-hour window, 12h elapsed means 50% decay -> ~30 points
      const decayed = await riskAssessmentService.calculateRiskScore({
        userId: user._id,
        windowHours: 24,
      })
      assert.strictEqual(decayed.riskScore, 30)
      assert.strictEqual(decayed.riskLevel, "medium")

      // Over 6-hour window, 12h-old event is older than cutoff -> excluded (0 points)
      const expired = await riskAssessmentService.calculateRiskScore({
        userId: user._id,
        windowHours: 6,
      })
      assert.strictEqual(expired.riskScore, 0)
      assert.strictEqual(expired.riskLevel, "low")
    })

    // -------------------------------------------------------------
    // Test 15: Admin Download Monitoring & Filtering
    // -------------------------------------------------------------
    await test("15. Admin Download Monitoring: GET /api/admin/security/downloads returns paginated records with risk filters", async () => {
      const { token: adminToken } = await createTestUser("admin")
      const { user: userA } = await createTestUser()
      const video = await createTestVideo()

      // Create flagged download record
      await DownloadRecord.create({
        userId: userA._id,
        videoId: video._id,
        videoTitle: video.videotitle,
        subscription_plan: "bronze",
        download_status: "completed",
        securityFlagged: true,
        riskLevel: "medium",
        security_flags: ["RAPID_DEVICE_SWITCH"],
      })

      // Query flagged downloads
      const res = await request({
        path: "/api/admin/security/downloads?securityFlagged=true&riskLevel=medium&page=1&limit=10",
        method: "GET",
        headers: { Authorization: `Bearer ${adminToken}` },
      })

      assert.strictEqual(res.statusCode, 200)
      assert.strictEqual(res.body.success, true)
      assert.ok(Array.isArray(res.body.data.downloads))
      assert.ok(res.body.data.downloads.length >= 1)
      assert.strictEqual(res.body.data.downloads[0].securityFlagged, true)
      assert.strictEqual(res.body.data.downloads[0].riskLevel, "medium")
      assert.ok(res.body.data.pagination)

      // Query summary dashboard
      const summaryRes = await request({
        path: "/api/admin/security/summary?timeRange=30d",
        method: "GET",
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      assert.strictEqual(summaryRes.statusCode, 200)
      assert.ok(summaryRes.body.data.downloads)
      assert.ok(summaryRes.body.data.securityEvents)
    })

  } finally {
    server.close()
  }

  console.log("==================================================================")
  console.log(`PHASE 9 MASTER SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`)
  console.log("==================================================================")

  if (failed > 0) {
    process.exit(1)
  }
}

runMasterSuite().catch((err) => {
  console.error("Master Suite Uncaught Error:", err)
  process.exit(1)
})
