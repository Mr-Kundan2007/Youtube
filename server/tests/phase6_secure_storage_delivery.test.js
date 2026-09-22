/**
 * Phase 6: Secure Video Storage, Signed URLs & Protected File Delivery Test Suite
 *
 * Validates:
 * 1. Direct storage access blocked (path traversal attempts blocked, file outside safe storage blocked)
 * 2. Storage provider file validation succeeds for available video
 * 3. Storage provider file validation handles missing physical file (VIDEO_FILE_NOT_AVAILABLE)
 * 4. Delivery request with valid download token succeeds (POST /api/downloads/deliver)
 * 5. Delivery request returns signed URL with short TTL (SIGNED_URL_TTL)
 * 6. Single-use download token is consumed upon successful delivery request
 * 7. Replaying consumed download token at delivery endpoint fails (TOKEN_ALREADY_USED)
 * 8. Expired download token rejected at delivery endpoint (TOKEN_EXPIRED)
 * 9. Revoked download token rejected at delivery endpoint (TOKEN_REVOKED)
 * 10. Delivery request for non-existent storage file releases quota reservation and records failure (VIDEO_FILE_NOT_AVAILABLE)
 * 11. Delivery request fails when user account is blocked / suspended (ACCOUNT_DOWNLOAD_RESTRICTED)
 * 12. Delivery request fails when video is deleted / unavailable (VIDEO_NOT_AVAILABLE)
 * 13. Streaming endpoint streams protected file with HTTP 200 via valid signed token without buffering
 * 14. Streaming endpoint supports HTTP 206 Partial Content (Range requests: bytes=0-100)
 * 15. Tampered or expired signed URL token is rejected (INVALID_SIGNED_URL / SIGNED_URL_EXPIRED)
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
import { storageService } from "../services/storageService.js"
import { downloadDeliveryService } from "../services/downloadDeliveryService.js"
import { downloadAuthorizationService } from "../services/downloadAuthorizationService.js"
import { downloadTokenService } from "../services/downloadTokenService.js"
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
  console.log("PHASE 6: SECURE VIDEO STORAGE, SIGNED URLs & PROTECTED DELIVERY TEST SUITE")
  console.log("==================================================================")

  // Start HTTP test server
  const server = http.createServer(app)
  await new Promise((resolve) => {
    server.listen(0, () => {
      const port = server.address().port
      API_BASE = `http://127.0.0.1:${port}`
      console.log(`Phase 6 Test Server listening on port ${port}`)
      resolve()
    })
  })

  // Ensure DB connection
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(dbConfig.url)
  } else if (mongoose.connection.readyState === 2) {
    await new Promise((resolve) => mongoose.connection.once("connected", resolve))
  }

  const runId = `test_p6_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

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

  // Ensure a valid sample video file exists for testing
  const sampleVideoRelative = "public/video/vdo.mp4"
  const sampleVideoAbsolute = path.resolve(process.cwd(), sampleVideoRelative)
  if (!fs.existsSync(sampleVideoAbsolute)) {
    const sampleDir = path.dirname(sampleVideoAbsolute)
    if (!fs.existsSync(sampleDir)) fs.mkdirSync(sampleDir, { recursive: true })
    fs.writeFileSync(sampleVideoAbsolute, Buffer.from("AAAAHGZ0eXBpc29tAAAAAGlzb21tcDQxAAAACHZlcmlmaWVk", "base64"))
  }
  const sampleStat = fs.statSync(sampleVideoAbsolute)

  // Helper to create test video
  const createTestVideo = async (options = {}) => {
    const defaults = {
      videotitle: `P6 Video ${runId}`,
      videofilepath: sampleVideoRelative,
      filepath: sampleVideoRelative,
      videochanel: "Test Channel",
      uploader: new mongoose.Types.ObjectId(),
      is_downloadable: true,
      access_level: "public",
      file_size: sampleStat.size,
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
    // Test 1: Direct storage access blocked (path traversal attempts)
    // -------------------------------------------------------------
    await test("1. Direct storage access blocked (path traversal attempts blocked)", async () => {
      const traversalPath = "../../../../../../../etc/passwd"
      const isSafe = storageService.isSafePath(traversalPath)
      assert.strictEqual(isSafe, false, "Path traversal path should not be marked safe")

      let caught = false
      try {
        storageService.createReadStream(traversalPath)
      } catch (err) {
        caught = true
        assert.strictEqual(err.statusCode || err.status, 403, "Should return 403 Forbidden")
      }
      assert.strictEqual(caught, true, "Should block traversal in createReadStream")
    })

    // -------------------------------------------------------------
    // Test 2: Storage provider file validation succeeds for available video
    // -------------------------------------------------------------
    await test("2. Storage provider file validation succeeds for available video", async () => {
      const video = await createTestVideo()
      const validation = storageService.validateFile(video)

      assert.strictEqual(validation.isAvailable, true, "File should be available")
      assert.strictEqual(validation.exists, true, "File should exist")
      assert.strictEqual(validation.size, sampleStat.size, "File size should match")
      assert.strictEqual(validation.mimeType, "video/mp4", "MIME type should be video/mp4")
      assert.ok(validation.filePath, "Should resolve file path")
    })

    // -------------------------------------------------------------
    // Test 3: Storage provider file validation handles missing physical file
    // -------------------------------------------------------------
    await test("3. Storage provider file validation handles missing physical file (VIDEO_FILE_NOT_AVAILABLE)", async () => {
      const missingVideo = await createTestVideo({
        videofilepath: "uploads/missing_file_xyz_12345.mp4",
        filepath: "uploads/missing_file_xyz_12345.mp4",
        filename: "missing_file_xyz_12345.mp4",
      })

      const validation = storageService.validateFile(missingVideo)
      assert.strictEqual(validation.isAvailable, false, "Missing file should not be available")
      assert.strictEqual(validation.exists, false, "Missing file should not exist")
      assert.strictEqual(validation.size, 0, "Missing file size should be 0")
    })

    // -------------------------------------------------------------
    // Test 4: Delivery request with valid download token succeeds
    // -------------------------------------------------------------
    let test4Data = null
    await test("4. Delivery request with valid download token succeeds (POST /api/downloads/deliver)", async () => {
      const { user, token } = await createTestUser()
      await createSubscription(user._id, "silver")
      const video = await createTestVideo()

      // Step 1: Authorize download
      const authRes = await request({
        path: "/api/downloads/authorize",
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: { videoId: video._id.toString() },
      })
      assert.strictEqual(authRes.statusCode, 200, "Authorization should succeed")
      const dlId = authRes.body.data.downloadId
      const rawToken = authRes.body.data.authorizationToken

      // Step 2: Request Delivery
      const delivRes = await request({
        path: "/api/downloads/deliver",
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: { downloadId: dlId, token: rawToken },
      })

      assert.strictEqual(delivRes.statusCode, 200, "Delivery request should return 200")
      assert.strictEqual(delivRes.body.success, true)
      assert.strictEqual(delivRes.body.data.status, "ready")
      assert.ok(delivRes.body.data.signedUrl, "Should return signedUrl")
      assert.ok(delivRes.body.data.signedToken, "Should return signedToken")
      assert.strictEqual(delivRes.body.data.fileSize, sampleStat.size)

      test4Data = { user, token, video, dlId, rawToken, delivData: delivRes.body.data }
    })

    // -------------------------------------------------------------
    // Test 5: Delivery request returns signed URL with short TTL (SIGNED_URL_TTL)
    // -------------------------------------------------------------
    await test("5. Delivery request returns signed URL with short TTL (SIGNED_URL_TTL)", async () => {
      assert.ok(test4Data?.delivData, "Test 4 data required")
      const { signedUrl, expiresInSeconds, expiresAt } = test4Data.delivData

      assert.ok(signedUrl.includes("/api/downloads/stream?token="), "Signed URL should point to stream endpoint")
      assert.strictEqual(expiresInSeconds, downloadConfig.signedUrlTtlSeconds || 300)
      const expDate = new Date(expiresAt)
      const now = new Date()
      const diffSec = (expDate.getTime() - now.getTime()) / 1000
      assert.ok(diffSec > 0 && diffSec <= 305, "Expiry should be ~300s in the future")
    })

    // -------------------------------------------------------------
    // Test 6: Single-use download token is consumed upon successful delivery request
    // -------------------------------------------------------------
    await test("6. Single-use download token is consumed upon successful delivery request", async () => {
      assert.ok(test4Data?.rawToken, "Test 4 data required")
      const tokenHash = downloadTokenService.hashToken(test4Data.rawToken)
      const tokenDoc = await DownloadToken.findOne({ token_hash: tokenHash })

      assert.ok(tokenDoc, "Token document should exist in MongoDB")
      assert.strictEqual(tokenDoc.status, "used", "Token status should transition to 'used'")
      assert.strictEqual(tokenDoc.use_count, 1, "Token use_count should be incremented to 1")
    })

    // -------------------------------------------------------------
    // Test 7: Replaying consumed download token at delivery endpoint fails (TOKEN_ALREADY_USED)
    // -------------------------------------------------------------
    await test("7. Replaying consumed download token at delivery endpoint fails (TOKEN_ALREADY_USED)", async () => {
      assert.ok(test4Data, "Test 4 data required")
      const replayRes = await request({
        path: "/api/downloads/deliver",
        method: "POST",
        headers: { Authorization: `Bearer ${test4Data.token}` },
        body: { downloadId: test4Data.dlId, token: test4Data.rawToken },
      })

      assert.strictEqual(replayRes.statusCode, 409, "Replay should return 409 Conflict")
      assert.strictEqual(replayRes.body.code, "TOKEN_ALREADY_USED")
    })

    // -------------------------------------------------------------
    // Test 8: Expired download token rejected at delivery endpoint (TOKEN_EXPIRED)
    // -------------------------------------------------------------
    await test("8. Expired download token rejected at delivery endpoint (TOKEN_EXPIRED)", async () => {
      const { user, token } = await createTestUser()
      await createSubscription(user._id, "silver")
      const video = await createTestVideo()

      const authRes = await request({
        path: "/api/downloads/authorize",
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: { videoId: video._id.toString() },
      })
      const dlId = authRes.body.data.downloadId
      const rawToken = authRes.body.data.authorizationToken

      // Force expire token in database
      const tokenHash = downloadTokenService.hashToken(rawToken)
      await DownloadToken.updateOne(
        { token_hash: tokenHash },
        { $set: { expires_at: new Date(Date.now() - 5000), status: "expired" } }
      )

      const delivRes = await request({
        path: "/api/downloads/deliver",
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: { downloadId: dlId, token: rawToken },
      })

      assert.strictEqual(delivRes.statusCode, 401, "Expired token should return 401 Unauthorized")
      assert.strictEqual(delivRes.body.code, "TOKEN_EXPIRED")
    })

    // -------------------------------------------------------------
    // Test 9: Revoked download token rejected at delivery endpoint (TOKEN_REVOKED)
    // -------------------------------------------------------------
    await test("9. Revoked download token rejected at delivery endpoint (TOKEN_REVOKED)", async () => {
      const { user, token } = await createTestUser()
      await createSubscription(user._id, "silver")
      const video = await createTestVideo()

      const authRes = await request({
        path: "/api/downloads/authorize",
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: { videoId: video._id.toString() },
      })
      const dlId = authRes.body.data.downloadId
      const rawToken = authRes.body.data.authorizationToken

      // Revoke the token via service
      await downloadTokenService.revokeDownloadToken(rawToken, "TEST_SECURITY_REVOCATION")

      const delivRes = await request({
        path: "/api/downloads/deliver",
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: { downloadId: dlId, token: rawToken },
      })

      assert.strictEqual(delivRes.statusCode, 403, "Revoked token should return 403 Forbidden")
      assert.strictEqual(delivRes.body.code, "TOKEN_REVOKED")
    })

    // -------------------------------------------------------------
    // Test 10: Delivery request for non-existent storage file releases quota reservation
    // -------------------------------------------------------------
    await test("10. Delivery request for non-existent storage file releases quota reservation and records failure (VIDEO_FILE_NOT_AVAILABLE)", async () => {
      const { user, token } = await createTestUser()
      await createSubscription(user._id, "silver")
      const missingVideo = await createTestVideo({
        videofilepath: "uploads/non_existent_ghost_file.mp4",
        filepath: "uploads/non_existent_ghost_file.mp4",
        filename: "non_existent_ghost_file.mp4",
      })

      // Check quota before
      const quotaBefore = await downloadQuotaService.getActiveQuotaRecord(user._id, "silver")
      const usedBeforeAuth = quotaBefore.quota_used

      // Authorize download (reserves 1 quota unit)
      const authRes = await request({
        path: "/api/downloads/authorize",
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: { videoId: missingVideo._id.toString() },
      })
      assert.strictEqual(authRes.statusCode, 200)
      const dlId = authRes.body.data.downloadId
      const rawToken = authRes.body.data.authorizationToken

      const quotaAfterAuth = await DownloadQuota.findById(quotaBefore._id)
      assert.strictEqual(quotaAfterAuth.quota_used, usedBeforeAuth + 1, "Quota should be reserved")

      // Request Delivery for missing file
      const delivRes = await request({
        path: "/api/downloads/deliver",
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: { downloadId: dlId, token: rawToken },
      })

      assert.strictEqual(delivRes.statusCode, 404, "Missing file should return 404")
      assert.strictEqual(delivRes.body.code, "VIDEO_FILE_NOT_AVAILABLE")

      // Check that quota reservation was automatically rolled back
      const quotaAfterFail = await DownloadQuota.findById(quotaBefore._id)
      assert.strictEqual(quotaAfterFail.quota_used, usedBeforeAuth, "Quota reservation should be released")

      // Check download record marked failed
      const record = await DownloadRecord.findById(dlId)
      assert.strictEqual(record.download_status, "failed")
      assert.strictEqual(record.failure_reason, "VIDEO_FILE_NOT_AVAILABLE")

      // Check token was NOT consumed so user didn't lose authorization token
      const tokenHash = downloadTokenService.hashToken(rawToken)
      const tokenDoc = await DownloadToken.findOne({ token_hash: tokenHash })
      assert.notStrictEqual(tokenDoc.status, "used", "Token should not be marked used on storage failure")
    })

    // -------------------------------------------------------------
    // Test 11: Delivery request fails when user account is blocked / suspended
    // -------------------------------------------------------------
    await test("11. Delivery request fails when user account is blocked / suspended (ACCOUNT_DOWNLOAD_RESTRICTED)", async () => {
      const { user, token } = await createTestUser()
      await createSubscription(user._id, "silver")
      const video = await createTestVideo()

      const authRes = await request({
        path: "/api/downloads/authorize",
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: { videoId: video._id.toString() },
      })
      const dlId = authRes.body.data.downloadId
      const rawToken = authRes.body.data.authorizationToken

      // Block user account
      user.status = "blocked"
      await user.save()

      const delivRes = await request({
        path: "/api/downloads/deliver",
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: { downloadId: dlId, token: rawToken },
      })

      assert.strictEqual(delivRes.statusCode, 403, "Blocked user should return 403 Forbidden")
      assert.strictEqual(delivRes.body.code, "ACCOUNT_DOWNLOAD_RESTRICTED")
    })

    // -------------------------------------------------------------
    // Test 12: Delivery request fails when video is deleted / unavailable
    // -------------------------------------------------------------
    await test("12. Delivery request fails when video is deleted / unavailable (VIDEO_NOT_AVAILABLE)", async () => {
      const { user, token } = await createTestUser()
      await createSubscription(user._id, "silver")
      const video = await createTestVideo()

      const authRes = await request({
        path: "/api/downloads/authorize",
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: { videoId: video._id.toString() },
      })
      const dlId = authRes.body.data.downloadId
      const rawToken = authRes.body.data.authorizationToken

      // Soft delete video
      video.deleted_at = new Date()
      await video.save()

      const delivRes = await request({
        path: "/api/downloads/deliver",
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: { downloadId: dlId, token: rawToken },
      })

      assert.strictEqual(delivRes.statusCode, 404, "Deleted video should return 404")
      assert.strictEqual(delivRes.body.code, "VIDEO_NOT_AVAILABLE")
    })

    // -------------------------------------------------------------
    // Test 13: Streaming endpoint streams protected file with HTTP 200 via valid signed token
    // -------------------------------------------------------------
    let streamTestSignedToken = null
    await test("13. Streaming endpoint streams protected file with HTTP 200 via valid signed token without buffering", async () => {
      const { user, token } = await createTestUser()
      await createSubscription(user._id, "silver")
      const video = await createTestVideo()

      const authRes = await request({
        path: "/api/downloads/authorize",
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: { videoId: video._id.toString() },
      })
      const dlId = authRes.body.data.downloadId
      const rawToken = authRes.body.data.authorizationToken

      const delivRes = await request({
        path: "/api/downloads/deliver",
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: { downloadId: dlId, token: rawToken },
      })
      assert.strictEqual(delivRes.statusCode, 200)
      const signedToken = delivRes.body.data.signedToken
      streamTestSignedToken = signedToken

      // Connect to stream endpoint using signed URL token
      const streamRes = await request({
        path: `/api/downloads/stream?token=${signedToken}`,
        method: "GET",
      })

      assert.strictEqual(streamRes.statusCode, 200, "Should return HTTP 200 OK")
      assert.strictEqual(streamRes.headers["accept-ranges"], "bytes", "Should advertise Accept-Ranges: bytes")
      assert.strictEqual(parseInt(streamRes.headers["content-length"], 10), sampleStat.size)
      assert.ok(streamRes.headers["content-disposition"].includes("attachment; filename="), "Should set Content-Disposition attachment")
      assert.strictEqual(streamRes.buffer.length, sampleStat.size, "Received byte count should equal file size")

      // Allow background finish handler to update record
      await new Promise((r) => setTimeout(r, 100))
      const updatedRecord = await DownloadRecord.findById(dlId)
      assert.strictEqual(updatedRecord.download_status, "completed", "Status should transition to completed")
      assert.ok(updatedRecord.download_completed_at, "download_completed_at should be populated")
    })

    // -------------------------------------------------------------
    // Test 14: Streaming endpoint supports HTTP 206 Partial Content (Range requests)
    // -------------------------------------------------------------
    await test("14. Streaming endpoint supports HTTP 206 Partial Content (Range requests: bytes=0-100)", async () => {
      assert.ok(streamTestSignedToken, "Signed token required from test 13")

      const rangeRes = await request({
        path: `/api/downloads/stream?token=${streamTestSignedToken}`,
        method: "GET",
        headers: {
          Range: "bytes=0-100",
        },
      })

      assert.strictEqual(rangeRes.statusCode, 206, "Should return HTTP 206 Partial Content")
      assert.strictEqual(rangeRes.headers["content-range"], `bytes 0-100/${sampleStat.size}`)
      assert.strictEqual(parseInt(rangeRes.headers["content-length"], 10), 101)
      assert.strictEqual(rangeRes.buffer.length, 101, "Should stream exactly 101 bytes")
    })

    // -------------------------------------------------------------
    // Test 15: Tampered or expired signed URL token is rejected (INVALID_SIGNED_URL / SIGNED_URL_EXPIRED)
    // -------------------------------------------------------------
    await test("15. Tampered or expired signed URL token is rejected (INVALID_SIGNED_URL / SIGNED_URL_EXPIRED)", async () => {
      assert.ok(streamTestSignedToken, "Signed token required")

      // Tamper signature by altering the last character
      const tampered = streamTestSignedToken.slice(0, -1) + (streamTestSignedToken.endsWith("a") ? "b" : "a")
      const tamperedRes = await request({
        path: `/api/downloads/stream?token=${tampered}`,
        method: "GET",
      })

      assert.strictEqual(tamperedRes.statusCode, 401, "Tampered signature should return 401")
      assert.strictEqual(tamperedRes.body.code, "INVALID_SIGNED_URL")

      // Test expired signed URL
      const expiredSigned = storageService.generateSignedUrl({
        downloadId: new mongoose.Types.ObjectId(),
        videoId: new mongoose.Types.ObjectId(),
        userId: "test_user",
        expiresInSeconds: -10, // already expired
      })

      const expiredRes = await request({
        path: `/api/downloads/stream?token=${expiredSigned.signedToken}`,
        method: "GET",
      })

      assert.strictEqual(expiredRes.statusCode, 401, "Expired signed URL should return 401")
      assert.strictEqual(expiredRes.body.code, "SIGNED_URL_EXPIRED")
    })

  } finally {
    server.close()
  }

  console.log("==================================================================")
  console.log(`PHASE 6 MASTER SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`)
  console.log("==================================================================")

  if (failed > 0) {
    process.exit(1)
  }
}

runMasterSuite()
  .then(() => {
    console.log("All Phase 6 tests executed successfully.")
    process.exit(0)
  })
  .catch((err) => {
    console.error("Fatal error running Phase 6 test suite:", err)
    process.exit(1)
  })
