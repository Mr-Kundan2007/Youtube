/**
 * Phase 8: Registered Device Management, Multi-Device Control & Download Restrictions Test Suite
 *
 * Validates:
 * 1. Register First Device: New device under limit is registered successfully (201)
 * 2. Device Limit Reached: Exceeding plan device limit rejected with DEVICE_LIMIT_REACHED (403)
 * 3. Existing Device Recognition: Subsequent request from known device recognizes it without duplicates
 * 4. Revoked Device Blocked: Download attempt on revoked device rejected with DEVICE_REVOKED (403)
 * 5. Blocked Device Blocked: Download attempt on blocked device rejected with DEVICE_BLOCKED (403)
 * 6. Cross-User Ownership: Cross-user device access or revocation rejected with DEVICE_OWNERSHIP_DENIED (403)
 * 7. Token Device Binding: Token generated for Device A used on Device B rejected with DOWNLOAD_DEVICE_MISMATCH (403)
 * 8. Concurrent Device Downloads: Account exceeding maxConcurrentDeviceDownloads rejected with CONCURRENT_DOWNLOAD_LIMIT_REACHED (429)
 * 9. Same-Device Concurrent Download Limit: Same device exceeding maxConcurrentDownloadsPerDevice rejected with DEVICE_CONCURRENT_DOWNLOAD_LIMIT_REACHED (429)
 * 10. Simultaneous Device Requests: Simultaneous requests across devices enforce limits without race conditions
 * 11. Device Revocation Lifecycle: User revokes device; status becomes revoked, tokens invalidated, downloads blocked
 * 12. Device Activity Tracking: lastSeenAt and lastDownloadAt updated on activity and download
 * 13. Device History Reference: DownloadRecord accurately stores device_id reference
 * 14. Device List Privacy: GET /api/devices returns only authenticated user's devices with plan limits
 * 15. Device Replacement: Revoking old device frees up slot allowing new device registration
 */

import assert from "assert"
import http from "http"
import jwt from "jsonwebtoken"
import mongoose from "mongoose"
import { authConfig, dbConfig, downloadConfig } from "../config/index.js"
import User from "../Modals/Auth.js"
import Video from "../Modals/video.js"
import Subscription from "../Modals/Subscription.js"
import Device from "../Modals/Device.js"
import DownloadRecord from "../Modals/DownloadRecord.js"
import DownloadToken from "../Modals/DownloadToken.js"
import DownloadAuditLog from "../Modals/DownloadAuditLog.js"
import { deviceService } from "../services/deviceService.js"
import { deviceAuthorizationService } from "../services/deviceAuthorizationService.js"

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
  console.log("PHASE 8: REGISTERED DEVICE MANAGEMENT & MULTI-DEVICE RESTRICTIONS")
  console.log("==================================================================")

  // Start HTTP test server
  const server = http.createServer(app)
  await new Promise((resolve) => {
    server.listen(0, () => {
      const port = server.address().port
      API_BASE = `http://127.0.0.1:${port}`
      console.log(`Phase 8 Test Server listening on port ${port}`)
      resolve()
    })
  })

  // Ensure DB connection
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(dbConfig.url)
  }

  const runId = `test_p8_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

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
      videotitle: `P8 Video ${runId} ${Math.random().toString(36).slice(2, 6)}`,
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
    // Test 1: Register First Device
    // -------------------------------------------------------------
    let user1 = null
    let token1 = null
    const dev1 = `dev_mac_${runId}_1`

    await test("1. Register First Device: New device under limit is registered successfully (201)", async () => {
      const u = await createTestUser()
      user1 = u.user
      token1 = u.token

      const res = await request({
        path: "/api/devices/register",
        method: "POST",
        headers: {
          Authorization: `Bearer ${token1}`,
          "X-Device-ID": dev1,
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        body: {
          deviceId: dev1,
          deviceName: "My MacBook Pro",
          deviceType: "desktop",
        },
      })

      assert.strictEqual(res.statusCode, 201)
      assert.strictEqual(res.body.success, true)
      assert.strictEqual(res.body.data.isNew, true)
      assert.strictEqual(res.body.data.device.deviceId, dev1)
      assert.strictEqual(res.body.data.device.status, "active")

      const dbDev = await Device.findOne({ userId: user1._id, device_identifier: dev1 })
      assert.ok(dbDev, "Device should exist in MongoDB")
      assert.strictEqual(dbDev.status, "active")
    })

    // -------------------------------------------------------------
    // Test 2: Device Limit Reached
    // -------------------------------------------------------------
    await test("2. Device Limit Reached: Exceeding plan device limit rejected with DEVICE_LIMIT_REACHED (403)", async () => {
      // User 1 is on Free plan (limit 1 device) and already has dev1 registered.
      const dev2 = `dev_phone_${runId}_2`

      const res = await request({
        path: "/api/devices/register",
        method: "POST",
        headers: {
          Authorization: `Bearer ${token1}`,
          "X-Device-ID": dev2,
        },
        body: {
          deviceId: dev2,
          deviceName: "My iPhone",
          deviceType: "mobile",
        },
      })

      assert.strictEqual(res.statusCode, 403)
      assert.strictEqual(res.body.code, "DEVICE_LIMIT_REACHED")
    })

    // -------------------------------------------------------------
    // Test 3: Existing Device Recognition
    // -------------------------------------------------------------
    await test("3. Existing Device Recognition: Subsequent request from known device recognizes it without duplicates", async () => {
      const res = await request({
        path: "/api/devices/register",
        method: "POST",
        headers: {
          Authorization: `Bearer ${token1}`,
          "X-Device-ID": dev1,
        },
        body: {
          deviceId: dev1,
        },
      })

      assert.strictEqual(res.statusCode, 200)
      assert.strictEqual(res.body.data.isNew, false)
      assert.strictEqual(res.body.data.device.deviceId, dev1)

      const count = await Device.countDocuments({ userId: user1._id, device_identifier: dev1 })
      assert.strictEqual(count, 1, "Should not create duplicate device documents")
    })

    // -------------------------------------------------------------
    // Test 4: Revoked Device Blocked
    // -------------------------------------------------------------
    await test("4. Revoked Device Blocked: Download attempt on revoked device rejected with DEVICE_REVOKED (403)", async () => {
      const { user, token } = await createTestUser()
      await createSubscription(user._id, "bronze")
      const video = await createTestVideo()
      const revokedDev = `dev_revoked_${runId}`

      // Create a revoked device for this user
      await Device.create({
        userId: user._id,
        user_id: user._id,
        device_identifier: revokedDev,
        status: "revoked",
      })

      const res = await request({
        path: "/api/downloads/authorize",
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Device-ID": revokedDev,
        },
        body: {
          videoId: video._id.toString(),
          deviceId: revokedDev,
        },
      })

      assert.strictEqual(res.statusCode, 403)
      assert.strictEqual(res.body.code, "DEVICE_REVOKED")
    })

    // -------------------------------------------------------------
    // Test 5: Blocked Device Blocked
    // -------------------------------------------------------------
    await test("5. Blocked Device Blocked: Download attempt on blocked device rejected with DEVICE_BLOCKED (403)", async () => {
      const { user, token } = await createTestUser()
      await createSubscription(user._id, "bronze")
      const video = await createTestVideo()
      const blockedDev = `dev_blocked_${runId}`

      await Device.create({
        userId: user._id,
        user_id: user._id,
        device_identifier: blockedDev,
        status: "blocked",
      })

      const res = await request({
        path: "/api/downloads/authorize",
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Device-ID": blockedDev,
        },
        body: {
          videoId: video._id.toString(),
          deviceId: blockedDev,
        },
      })

      assert.strictEqual(res.statusCode, 403)
      assert.strictEqual(res.body.code, "DEVICE_BLOCKED")
    })

    // -------------------------------------------------------------
    // Test 6: Cross-User Ownership
    // -------------------------------------------------------------
    await test("6. Cross-User Ownership: Cross-user device access or revocation rejected with DEVICE_OWNERSHIP_DENIED (403)", async () => {
      const { user: userA } = await createTestUser()
      const { token: tokenB } = await createTestUser()

      const devA = await Device.create({
        userId: userA._id,
        user_id: userA._id,
        device_identifier: `dev_userA_${runId}`,
        status: "active",
      })

      // User B attempts to get details of User A's device
      const resGet = await request({
        path: `/api/devices/${devA.device_identifier}`,
        method: "GET",
        headers: { Authorization: `Bearer ${tokenB}` },
      })
      assert.strictEqual(resGet.statusCode, 403)
      assert.strictEqual(resGet.body.code, "DEVICE_OWNERSHIP_DENIED")

      // User B attempts to revoke User A's device
      const resRevoke = await request({
        path: `/api/devices/${devA.device_identifier}`,
        method: "DELETE",
        headers: { Authorization: `Bearer ${tokenB}` },
      })
      assert.strictEqual(resRevoke.statusCode, 403)
      assert.strictEqual(resRevoke.body.code, "DEVICE_OWNERSHIP_DENIED")
    })

    // -------------------------------------------------------------
    // Test 7: Token Device Binding
    // -------------------------------------------------------------
    await test("7. Token Device Binding: Token generated for Device A used on Device B rejected with DOWNLOAD_DEVICE_MISMATCH (403)", async () => {
      const { user, token } = await createTestUser()
      await createSubscription(user._id, "bronze")
      const video = await createTestVideo()
      const devA = `dev_deviceA_${runId}`
      const devB = `dev_deviceB_${runId}`

      // 1. Authorize on Device A
      const authRes = await request({
        path: "/api/downloads/authorize",
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Device-ID": devA,
        },
        body: { videoId: video._id.toString() },
      })
      assert.strictEqual(authRes.statusCode, 200)
      const dlToken = authRes.body.data.authorizationToken
      const dlId = authRes.body.data.downloadId

      // 2. Request delivery using Device B
      const deliverRes = await request({
        path: "/api/downloads/deliver",
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Device-ID": devB,
        },
        body: {
          downloadId: dlId,
          token: dlToken,
        },
      })
      assert.strictEqual(deliverRes.statusCode, 403)
      assert.strictEqual(deliverRes.body.code, "DOWNLOAD_DEVICE_MISMATCH")
    })

    // -------------------------------------------------------------
    // Test 8: Concurrent Device Downloads Limit
    // -------------------------------------------------------------
    await test("8. Concurrent Device Downloads: Exceeding maxConcurrentDeviceDownloads rejected with CONCURRENT_DOWNLOAD_LIMIT_REACHED (429)", async () => {
      const { user, token } = await createTestUser()
      await createSubscription(user._id, "bronze") // Bronze maxConcurrentDeviceDownloads = 2
      const video1 = await createTestVideo()
      const video2 = await createTestVideo()
      const video3 = await createTestVideo()

      const devA = `dev_concA_${runId}`
      const devB = `dev_concB_${runId}`

      // Create 2 active downloads in progress for this user
      await DownloadRecord.create({
        userId: user._id,
        videoId: video1._id,
        videoTitle: video1.videotitle,
        device_id: devA,
        download_status: "downloading",
        subscription_plan: "bronze",
      })

      await DownloadRecord.create({
        userId: user._id,
        videoId: video2._id,
        videoTitle: video2.videotitle,
        device_id: devB,
        download_status: "downloading",
        subscription_plan: "bronze",
      })

      // Attempt 3rd download
      const res = await request({
        path: "/api/downloads/authorize",
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Device-ID": devA,
        },
        body: { videoId: video3._id.toString() },
      })

      assert.strictEqual(res.statusCode, 429)
      assert.strictEqual(res.body.code, "CONCURRENT_DOWNLOAD_LIMIT_REACHED")
    })

    // -------------------------------------------------------------
    // Test 9: Same-Device Concurrent Download Limit
    // -------------------------------------------------------------
    await test("9. Same-Device Limit: Same device exceeding maxConcurrentDownloadsPerDevice rejected with DEVICE_CONCURRENT_DOWNLOAD_LIMIT_REACHED (429)", async () => {
      const { user, token } = await createTestUser()
      await createSubscription(user._id, "silver") // Silver allows 3 concurrent overall, but maxConcurrentDownloadsPerDevice = 2
      const video1 = await createTestVideo()
      const video2 = await createTestVideo()
      const video3 = await createTestVideo()

      const devSingle = `dev_single_${runId}`

      // Create 2 active downloads on devSingle
      await DownloadRecord.create({
        userId: user._id,
        videoId: video1._id,
        videoTitle: video1.videotitle,
        device_id: devSingle,
        download_status: "downloading",
        subscription_plan: "silver",
      })

      await DownloadRecord.create({
        userId: user._id,
        videoId: video2._id,
        videoTitle: video2.videotitle,
        device_id: devSingle,
        download_status: "downloading",
        subscription_plan: "silver",
      })

      // Attempt 3rd download on the exact same device
      const res = await request({
        path: "/api/downloads/authorize",
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Device-ID": devSingle,
        },
        body: { videoId: video3._id.toString() },
      })

      assert.strictEqual(res.statusCode, 429)
      assert.strictEqual(res.body.code, "DEVICE_CONCURRENT_DOWNLOAD_LIMIT_REACHED")
    })

    // -------------------------------------------------------------
    // Test 10: Simultaneous Device Requests
    // -------------------------------------------------------------
    await test("10. Simultaneous Requests: Simultaneous requests across devices enforce limits without race conditions", async () => {
      const { user, token } = await createTestUser()
      await createSubscription(user._id, "bronze") // Bronze limit = 2 concurrent
      const video = await createTestVideo()

      const devX = `dev_simX_${runId}`
      const devY = `dev_simY_${runId}`

      // Authorize on Dev X and Dev Y simultaneously
      const [resX, resY] = await Promise.all([
        request({
          path: "/api/downloads/authorize",
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "X-Device-ID": devX },
          body: { videoId: video._id.toString() },
        }),
        request({
          path: "/api/downloads/authorize",
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "X-Device-ID": devY },
          body: { videoId: video._id.toString() },
        }),
      ])

      assert.strictEqual(resX.statusCode, 200)
      assert.strictEqual(resY.statusCode, 200)
    })

    // -------------------------------------------------------------
    // Test 11: Device Revocation Lifecycle
    // -------------------------------------------------------------
    await test("11. Device Revocation Lifecycle: User revokes device; status becomes revoked, tokens invalidated, downloads blocked", async () => {
      const { user, token } = await createTestUser()
      await createSubscription(user._id, "bronze")
      const video = await createTestVideo()
      const devTarget = `dev_to_revoke_${runId}`

      // 1. Authorize download on devTarget
      const authRes = await request({
        path: "/api/downloads/authorize",
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "X-Device-ID": devTarget },
        body: { videoId: video._id.toString() },
      })
      assert.strictEqual(authRes.statusCode, 200)
      const dlToken = authRes.body.data.authorizationToken

      // 2. Revoke the device
      const revokeRes = await request({
        path: `/api/devices/${devTarget}`,
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      assert.strictEqual(revokeRes.statusCode, 200)
      assert.strictEqual(revokeRes.body.data.status, "revoked")

      // Verify token is marked revoked
      const tokenDoc = await DownloadToken.findOne({
        download_id: authRes.body.data.downloadId,
      })
      assert.ok(tokenDoc, "Token document should exist")
      assert.strictEqual(tokenDoc.status, "revoked")

      // 3. Attempting delivery with revoked token fails
      const deliverRes = await request({
        path: "/api/downloads/deliver",
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "X-Device-ID": devTarget },
        body: { downloadId: authRes.body.data.downloadId, token: dlToken },
      })
      assert.strictEqual(deliverRes.statusCode, 403)
      assert.strictEqual(deliverRes.body.code, "TOKEN_REVOKED")

      // 4. Future download attempt on revoked device fails
      const futureAuth = await request({
        path: "/api/downloads/authorize",
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "X-Device-ID": devTarget },
        body: { videoId: video._id.toString() },
      })
      assert.strictEqual(futureAuth.statusCode, 403)
      assert.strictEqual(futureAuth.body.code, "DEVICE_REVOKED")
    })

    // -------------------------------------------------------------
    // Test 12: Device Activity Tracking
    // -------------------------------------------------------------
    await test("12. Device Activity Tracking: lastSeenAt and lastDownloadAt updated on activity and download", async () => {
      const { user, token } = await createTestUser()
      await createSubscription(user._id, "bronze")
      const video = await createTestVideo()
      const devAct = `dev_act_${runId}`

      const authRes = await request({
        path: "/api/downloads/authorize",
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "X-Device-ID": devAct },
        body: { videoId: video._id.toString() },
      })
      assert.strictEqual(authRes.statusCode, 200)

      const dbDev = await Device.findOne({ userId: user._id, device_identifier: devAct })
      assert.ok(dbDev.last_seen_at, "last_seen_at should be set")
      assert.ok(dbDev.last_download_at, "last_download_at should be updated")
    })

    // -------------------------------------------------------------
    // Test 13: Download History Device Reference
    // -------------------------------------------------------------
    await test("13. Device History Reference: DownloadRecord accurately stores device_id reference", async () => {
      const { user, token } = await createTestUser()
      await createSubscription(user._id, "bronze")
      const video = await createTestVideo()
      const devRef = `dev_ref_${runId}`

      const authRes = await request({
        path: "/api/downloads/authorize",
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "X-Device-ID": devRef },
        body: { videoId: video._id.toString() },
      })
      assert.strictEqual(authRes.statusCode, 200)

      const record = await DownloadRecord.findById(authRes.body.data.downloadId)
      assert.strictEqual(record.device_id, devRef)
    })

    // -------------------------------------------------------------
    // Test 14: Device List Scoping & Privacy
    // -------------------------------------------------------------
    await test("14. Device List Privacy: GET /api/devices returns only authenticated user's devices with plan limits", async () => {
      const { user: uA, token: tA } = await createTestUser()
      const { user: uB, token: tB } = await createTestUser()
      await createSubscription(uA._id, "bronze") // limit = 2

      await Device.create({
        userId: uA._id,
        user_id: uA._id,
        device_identifier: `dev_uA_1_${runId}`,
        device_name: "User A Phone",
        status: "active",
      })

      await Device.create({
        userId: uB._id,
        user_id: uB._id,
        device_identifier: `dev_uB_1_${runId}`,
        device_name: "User B Laptop",
        status: "active",
      })

      const res = await request({
        path: "/api/devices",
        method: "GET",
        headers: { Authorization: `Bearer ${tA}` },
      })

      assert.strictEqual(res.statusCode, 200)
      assert.strictEqual(res.body.success, true)
      assert.strictEqual(res.body.data.devices.length, 1)
      assert.strictEqual(res.body.data.devices[0].deviceId, `dev_uA_1_${runId}`)
      assert.strictEqual(res.body.data.limits.maximum, 2)
      assert.strictEqual(res.body.data.limits.active, 1)
      assert.strictEqual(res.body.data.limits.remaining, 1)
    })

    // -------------------------------------------------------------
    // Test 15: Device Replacement
    // -------------------------------------------------------------
    await test("15. Device Replacement: Revoking old device frees up slot allowing new device registration", async () => {
      const { user, token } = await createTestUser() // Free plan: limit 1 device
      const devOld = `dev_old_${runId}`
      const devNew = `dev_new_${runId}`

      // 1. Register old device
      const regOld = await request({
        path: "/api/devices/register",
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "X-Device-ID": devOld },
        body: { deviceId: devOld },
      })
      assert.strictEqual(regOld.statusCode, 201)

      // 2. Attempting new device should fail (limit 1 reached)
      const regFail = await request({
        path: "/api/devices/register",
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "X-Device-ID": devNew },
        body: { deviceId: devNew },
      })
      assert.strictEqual(regFail.statusCode, 403)
      assert.strictEqual(regFail.body.code, "DEVICE_LIMIT_REACHED")

      // 3. Revoke old device
      const revokeRes = await request({
        path: `/api/devices/${devOld}`,
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      assert.strictEqual(revokeRes.statusCode, 200)

      // 4. Now registering new device succeeds!
      const regSuccess = await request({
        path: "/api/devices/register",
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "X-Device-ID": devNew },
        body: { deviceId: devNew },
      })
      assert.strictEqual(regSuccess.statusCode, 201)
      assert.strictEqual(regSuccess.body.data.device.deviceId, devNew)
    })

  } finally {
    server.close()
  }

  console.log("==================================================================")
  console.log(`PHASE 8 MASTER SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`)
  console.log("==================================================================")

  if (failed > 0) {
    process.exit(1)
  }
}

runMasterSuite().catch((err) => {
  console.error("Fatal test runner error:", err)
  process.exit(1)
})
