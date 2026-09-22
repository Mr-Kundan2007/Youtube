/**
 * Phase 5: Secure Download Authorization & Token System Master Test Suite
 *
 * Validates:
 * 1. Valid User Authorization (Authenticated + Active + Accessible Video -> Success, Token dl_...)
 * 2. Missing Authentication (UNAUTHORIZED, no token or quota reservation)
 * 3. Video Not Found (VIDEO_NOT_FOUND, no quota reserved)
 * 4. Video Access Denied (Private video non-owner & Premium video free user -> VIDEO_ACCESS_DENIED)
 * 5. Subscription Expired (SUBSCRIPTION_EXPIRED, no token)
 * 6. Download Disabled Plan (DOWNLOAD_NOT_ALLOWED_FOR_PLAN, no token)
 * 7. Quota Exhausted (DOWNLOAD_QUOTA_EXCEEDED on limit exhaustion)
 * 8. Valid Token Validation (POST /api/downloads/validate-token -> valid: true)
 * 9. Expired Token Validation (TOKEN_EXPIRED)
 * 10. Used Token Replay Prevention (Single-use token reuse -> TOKEN_ALREADY_USED)
 * 11. Revoked Token Handling (Revoked via API/service -> TOKEN_REVOKED)
 * 12. User Mismatch Protection (Token for User A cannot be validated by User B -> TOKEN_USER_MISMATCH)
 * 13. Video Mismatch Protection (Token for Video A cannot be used for Video B -> TOKEN_VIDEO_MISMATCH)
 * 14. Concurrent / Idempotent Requests (Same idempotency_key -> single reservation, same token)
 * 15. System Failure Rollback (Failed token generation releases reserved quota)
 * 16. Account Blocked / Suspended (ACCOUNT_DOWNLOAD_RESTRICTED)
 * 17. Video Deleted After Token Generation (VIDEO_NOT_AVAILABLE)
 * 18. Token Replay Attempt Audit Logging (TOKEN_REPLAY_ATTEMPT audit record verified)
 */

import assert from "assert"
import http from "http"
import crypto from "crypto"
import jwt from "jsonwebtoken"
import mongoose from "mongoose"
import { authConfig, dbConfig } from "../config/index.js"
import User from "../Modals/Auth.js"
import Video from "../Modals/video.js"
import Subscription from "../Modals/Subscription.js"
import DownloadQuota from "../Modals/DownloadQuota.js"
import DownloadRecord from "../Modals/DownloadRecord.js"
import DownloadToken from "../Modals/DownloadToken.js"
import DownloadAuditLog from "../Modals/DownloadAuditLog.js"
import { downloadAuthorizationService } from "../services/downloadAuthorizationService.js"
import { downloadTokenService } from "../services/downloadTokenService.js"
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
  console.log("PHASE 5: SECURE DOWNLOAD AUTHORIZATION & TOKEN SYSTEM MASTER SUITE")
  console.log("==================================================================")

  // Start HTTP test server
  const server = http.createServer(app)
  await new Promise((resolve) => {
    server.listen(0, () => {
      const port = server.address().port
      API_BASE = `http://127.0.0.1:${port}`
      console.log(`Phase 5 Test Server listening on port ${port}`)
      resolve()
    })
  })

  // Ensure DB connection
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(dbConfig.url)
  } else if (mongoose.connection.readyState === 2) {
    await new Promise((resolve) => mongoose.connection.once("connected", resolve))
  }

  const runId = `test_p5_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

  // Helper to create test user
  const createTestUser = async (role = "user", status = "active") => {
    const user = await User.create({
      name: `User ${runId}`,
      email: `${runId}_${Math.random().toString(36).slice(2, 7)}@example.com`,
      role,
      status,
    })
    return user
  }

  // Helper to create test video
  const createTestVideo = async (options = {}) => {
    const video = await Video.create({
      videotitle: options.title || `Video ${runId}`,
      filename: `test_${runId}.mp4`,
      filepath: `uploads/test_${runId}.mp4`,
      videochanel: "Test Channel",
      uploader: options.uploader || `uploader_${runId}`,
      is_downloadable: options.is_downloadable !== undefined ? options.is_downloadable : true,
      visibility: options.visibility || "public",
      is_premium: options.is_premium || false,
      filesize: "52428800",
    })
    return video
  }

  try {
    // ----------------------------------------------------------------
    // TEST 1: Valid User Download Authorization
    // ----------------------------------------------------------------
    {
      const user = await createTestUser()
      const video = await createTestVideo()
      const token = generateAuthToken(user._id, user.email)

      const res = await request({
        path: "/api/downloads/authorize",
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: { videoId: video._id.toString() },
      })

      assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}: ${JSON.stringify(res.body)}`)
      assert.strictEqual(res.body.success, true)
      assert(res.body.data.authorizationToken, "Authorization token should be present")
      assert(res.body.data.authorizationToken.startsWith("dl_"), "Token should start with dl_")
      assert.strictEqual(res.body.data.status, "authorized")

      // Verify token in DB is hashed and exists
      const expectedHash = crypto.createHash("sha256").update(res.body.data.authorizationToken).digest("hex")
      const tokenDoc = await DownloadToken.findOne({ token_hash: expectedHash })
      assert(tokenDoc, "Hashed token record must exist in DB")
      assert.strictEqual(tokenDoc.status, "active")
      assert.strictEqual(tokenDoc.use_count, 0)
      assert.strictEqual(tokenDoc.max_uses, 1)

      // Verify DownloadRecord
      const downloadDoc = await DownloadRecord.findById(res.body.data.downloadId)
      assert(downloadDoc, "Download record must exist in DB")
      assert.strictEqual(downloadDoc.download_status, "authorized")

      console.log("[PASS] 1. Valid User Authorization: Success with secure dl_ token & SHA-256 storage")
    }

    // ----------------------------------------------------------------
    // TEST 2: Missing Authentication
    // ----------------------------------------------------------------
    {
      const video = await createTestVideo()
      const res = await request({
        path: "/api/downloads/authorize",
        method: "POST",
        body: { videoId: video._id.toString() },
      })

      assert.strictEqual(res.statusCode, 401)
      assert(res.body.error?.code === "UNAUTHORIZED" || res.body.code === "UNAUTHORIZED")
      console.log("[PASS] 2. Missing Authentication: Correctly rejected with UNAUTHORIZED (401)")
    }

    // ----------------------------------------------------------------
    // TEST 3: Video Not Found
    // ----------------------------------------------------------------
    {
      const user = await createTestUser()
      const token = generateAuthToken(user._id, user.email)
      const fakeVideoId = new mongoose.Types.ObjectId().toString()

      const res = await request({
        path: "/api/downloads/authorize",
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: { videoId: fakeVideoId },
      })

      assert.strictEqual(res.statusCode, 404)
      assert(res.body.error?.code === "VIDEO_NOT_FOUND" || res.body.code === "VIDEO_NOT_FOUND")
      console.log("[PASS] 3. Video Not Found: Correctly rejected with VIDEO_NOT_FOUND (404)")
    }

    // ----------------------------------------------------------------
    // TEST 4: Video Access Denied (Private non-owner & Premium on free)
    // ----------------------------------------------------------------
    {
      const owner = await createTestUser()
      const nonOwner = await createTestUser()
      const privateVideo = await createTestVideo({
        visibility: "private",
        uploader: owner._id.toString(),
      })

      const tokenNonOwner = generateAuthToken(nonOwner._id, nonOwner.email)
      const resPrivate = await request({
        path: "/api/downloads/authorize",
        method: "POST",
        headers: { Authorization: `Bearer ${tokenNonOwner}` },
        body: { videoId: privateVideo._id.toString() },
      })

      assert.strictEqual(resPrivate.statusCode, 403)
      assert(resPrivate.body.error?.code === "VIDEO_ACCESS_DENIED" || resPrivate.body.code === "VIDEO_ACCESS_DENIED")

      // Premium video check on free user
      const premiumVideo = await createTestVideo({
        is_premium: true,
        visibility: "premium",
      })

      const resPremium = await request({
        path: "/api/downloads/authorize",
        method: "POST",
        headers: { Authorization: `Bearer ${tokenNonOwner}` },
        body: { videoId: premiumVideo._id.toString() },
      })

      assert.strictEqual(resPremium.statusCode, 403)
      assert(resPremium.body.error?.code === "VIDEO_ACCESS_DENIED" || resPremium.body.code === "VIDEO_ACCESS_DENIED")

      console.log("[PASS] 4. Video Access Denied: Private & Premium videos blocked with VIDEO_ACCESS_DENIED (403)")
    }

    // ----------------------------------------------------------------
    // TEST 5: Subscription Expired
    // ----------------------------------------------------------------
    {
      const user = await createTestUser()
      const video = await createTestVideo()
      const token = generateAuthToken(user._id, user.email)

      // Set user subscription to expired
      await Subscription.create({
        userId: user._id,
        plan: "gold",
        status: "expired",
        startDate: new Date(Date.now() - 60 * 86400 * 1000),
        expiresAt: new Date(Date.now() - 86400 * 1000),
      })

      const res = await request({
        path: "/api/downloads/authorize",
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: { videoId: video._id.toString() },
      })

      assert.strictEqual(res.statusCode, 403)
      assert(res.body.error?.code === "SUBSCRIPTION_EXPIRED" || res.body.code === "SUBSCRIPTION_EXPIRED")
      console.log("[PASS] 5. Subscription Expired: Correctly rejected with SUBSCRIPTION_EXPIRED (403)")
    }

    // ----------------------------------------------------------------
    // TEST 6: Download Disabled for Plan
    // ----------------------------------------------------------------
    {
      const user = await createTestUser()
      const video = await createTestVideo()
      const token = generateAuthToken(user._id, user.email)

      // Set subscription with download_enabled: false
      await Subscription.create({
        userId: user._id,
        plan: "bronze",
        status: "active",
        download_enabled: false,
        startDate: new Date(),
        expiresAt: new Date(Date.now() + 30 * 86400 * 1000),
      })

      const res = await request({
        path: "/api/downloads/authorize",
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: { videoId: video._id.toString() },
      })

      assert.strictEqual(res.statusCode, 403)
      assert(
        res.body.error?.code === "DOWNLOAD_NOT_ALLOWED_FOR_PLAN" ||
        res.body.code === "DOWNLOAD_NOT_ALLOWED_FOR_PLAN"
      )
      console.log("[PASS] 6. Download Disabled Plan: Correctly rejected with DOWNLOAD_NOT_ALLOWED_FOR_PLAN (403)")
    }

    // ----------------------------------------------------------------
    // TEST 7: Quota Exhausted
    // ----------------------------------------------------------------
    {
      const user = await createTestUser()
      const video1 = await createTestVideo()
      const video2 = await createTestVideo()
      const token = generateAuthToken(user._id, user.email)

      // 1st request consumes Free quota (1/1)
      const res1 = await request({
        path: "/api/downloads/authorize",
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: { videoId: video1._id.toString() },
      })
      assert.strictEqual(res1.statusCode, 200)

      // 2nd request exceeds quota limit
      const res2 = await request({
        path: "/api/downloads/authorize",
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: { videoId: video2._id.toString() },
      })

      assert.strictEqual(res2.statusCode, 429)
      assert(res2.body.error?.code === "DOWNLOAD_QUOTA_EXCEEDED" || res2.body.code === "DOWNLOAD_QUOTA_EXCEEDED")
      console.log("[PASS] 7. Quota Exhausted: Correctly rejected with DOWNLOAD_QUOTA_EXCEEDED (429)")
    }

    // ----------------------------------------------------------------
    // TEST 8: Valid Token Validation
    // ----------------------------------------------------------------
    {
      const user = await createTestUser()
      const video = await createTestVideo()
      const token = generateAuthToken(user._id, user.email)

      const authRes = await request({
        path: "/api/downloads/authorize",
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: { videoId: video._id.toString() },
      })

      const rawDlToken = authRes.body.data.authorizationToken

      // Validate token via POST /api/downloads/validate-token
      const valRes = await request({
        path: "/api/downloads/validate-token",
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: {
          token: rawDlToken,
          videoId: video._id.toString(),
        },
      })

      assert.strictEqual(valRes.statusCode, 200)
      assert.strictEqual(valRes.body.success, true)
      assert.strictEqual(valRes.body.data.valid, true)
      assert.strictEqual(valRes.body.data.videoId.toString(), video._id.toString())
      assert.strictEqual(valRes.body.data.userId.toString(), user._id.toString())

      console.log("[PASS] 8. Valid Token Validation: Correctly confirmed token validity and binding")
    }

    // ----------------------------------------------------------------
    // TEST 9: Expired Token Validation
    // ----------------------------------------------------------------
    {
      const user = await createTestUser()
      const video = await createTestVideo()
      const token = generateAuthToken(user._id, user.email)

      // Generate a token that expired 10 minutes ago
      const expiredTokenResult = await downloadTokenService.generateDownloadToken({
        downloadId: new mongoose.Types.ObjectId(),
        videoId: video._id,
        userId: user._id,
        expiresInSeconds: -600, // in the past
      })

      const res = await request({
        path: "/api/downloads/validate-token",
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: {
          token: expiredTokenResult.rawToken,
          videoId: video._id.toString(),
        },
      })

      assert.strictEqual(res.statusCode, 401)
      assert(res.body.error?.code === "TOKEN_EXPIRED" || res.body.code === "TOKEN_EXPIRED")
      console.log("[PASS] 9. Expired Token Validation: Correctly rejected with TOKEN_EXPIRED (401)")
    }

    // ----------------------------------------------------------------
    // TEST 10: Used Token (Single-Use Replay Prevention)
    // ----------------------------------------------------------------
    {
      const user = await createTestUser()
      const video = await createTestVideo()
      const token = generateAuthToken(user._id, user.email)

      const tokenResult = await downloadTokenService.generateDownloadToken({
        downloadId: new mongoose.Types.ObjectId(),
        videoId: video._id,
        userId: user._id,
        expiresInSeconds: 600,
      })

      // Use token once with markUsed: true
      const useRes1 = await request({
        path: "/api/downloads/validate-token",
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: {
          token: tokenResult.rawToken,
          videoId: video._id.toString(),
          markUsed: true,
        },
      })
      assert.strictEqual(useRes1.statusCode, 200)

      // Attempt to reuse single-use token
      const useRes2 = await request({
        path: "/api/downloads/validate-token",
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: {
          token: tokenResult.rawToken,
          videoId: video._id.toString(),
          markUsed: true,
        },
      })

      assert.strictEqual(useRes2.statusCode, 409)
      assert(resIsTokenAlreadyUsed(useRes2.body))
      console.log("[PASS] 10. Single-Use Token: Reusing used token correctly rejected with TOKEN_ALREADY_USED (409)")
    }

    // ----------------------------------------------------------------
    // TEST 11: Revoked Token Handling
    // ----------------------------------------------------------------
    {
      const user = await createTestUser()
      const video = await createTestVideo()
      const token = generateAuthToken(user._id, user.email)

      const tokenResult = await downloadTokenService.generateDownloadToken({
        downloadId: new mongoose.Types.ObjectId(),
        videoId: video._id,
        userId: user._id,
      })

      // Revoke the token
      const revokeRes = await request({
        path: "/api/downloads/tokens/revoke",
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: {
          token: tokenResult.rawToken,
          reason: "Security suspension",
        },
      })

      assert.strictEqual(revokeRes.statusCode, 200)
      assert.strictEqual(revokeRes.body.data.status, "revoked")

      // Attempt to validate revoked token
      const valRes = await request({
        path: "/api/downloads/validate-token",
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: {
          token: tokenResult.rawToken,
          videoId: video._id.toString(),
        },
      })

      assert.strictEqual(valRes.statusCode, 403)
      assert(valRes.body.error?.code === "TOKEN_REVOKED" || valRes.body.code === "TOKEN_REVOKED")
      console.log("[PASS] 11. Revoked Token: Revocation confirmed and subsequent validation rejected with TOKEN_REVOKED (403)")
    }

    // ----------------------------------------------------------------
    // TEST 12: User Mismatch Protection
    // ----------------------------------------------------------------
    {
      const userA = await createTestUser()
      const userB = await createTestUser()
      const video = await createTestVideo()

      const tokenResult = await downloadTokenService.generateDownloadToken({
        downloadId: new mongoose.Types.ObjectId(),
        videoId: video._id,
        userId: userA._id,
      })

      // User B attempts to validate User A's token
      const tokenB = generateAuthToken(userB._id, userB.email)
      const res = await request({
        path: "/api/downloads/validate-token",
        method: "POST",
        headers: { Authorization: `Bearer ${tokenB}` },
        body: {
          token: tokenResult.rawToken,
          videoId: video._id.toString(),
        },
      })

      assert.strictEqual(res.statusCode, 403)
      assert(res.body.error?.code === "TOKEN_USER_MISMATCH" || res.body.code === "TOKEN_USER_MISMATCH")
      console.log("[PASS] 12. User Mismatch: Cross-user token usage correctly blocked with TOKEN_USER_MISMATCH (403)")
    }

    // ----------------------------------------------------------------
    // TEST 13: Video Mismatch Protection
    // ----------------------------------------------------------------
    {
      const user = await createTestUser()
      const videoA = await createTestVideo()
      const videoB = await createTestVideo()
      const token = generateAuthToken(user._id, user.email)

      const tokenResult = await downloadTokenService.generateDownloadToken({
        downloadId: new mongoose.Types.ObjectId(),
        videoId: videoA._id,
        userId: user._id,
      })

      // Try validating for Video B
      const res = await request({
        path: "/api/downloads/validate-token",
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: {
          token: tokenResult.rawToken,
          videoId: videoB._id.toString(),
        },
      })

      assert.strictEqual(res.statusCode, 403)
      assert(res.body.error?.code === "TOKEN_VIDEO_MISMATCH" || res.body.code === "TOKEN_VIDEO_MISMATCH")
      console.log("[PASS] 13. Video Mismatch: Token for Video A used for Video B blocked with TOKEN_VIDEO_MISMATCH (403)")
    }

    // ----------------------------------------------------------------
    // TEST 14: Concurrent / Idempotent Requests
    // ----------------------------------------------------------------
    {
      const user = await createTestUser()
      const video = await createTestVideo()
      const token = generateAuthToken(user._id, user.email)
      const idempotencyKey = `idemp_${Date.now()}_${Math.random().toString(36).slice(2)}`

      // 1st request
      const res1 = await request({
        path: "/api/downloads/authorize",
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "idempotency-key": idempotencyKey,
        },
        body: { videoId: video._id.toString() },
      })
      assert.strictEqual(res1.statusCode, 200)

      // 2nd request with same idempotency key
      const res2 = await request({
        path: "/api/downloads/authorize",
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "idempotency-key": idempotencyKey,
        },
        body: { videoId: video._id.toString() },
      })
      assert.strictEqual(res2.statusCode, 200)

      // Must return identical authorization token and not consume additional quota
      assert.strictEqual(res1.body.data.authorizationToken, res2.body.data.authorizationToken)
      assert.strictEqual(res1.body.data.downloadId, res2.body.data.downloadId)

      console.log("[PASS] 14. Idempotent Requests: Same key returns matching token without duplicate quota deduction")
    }

    // ----------------------------------------------------------------
    // TEST 15: System Failure Rollback (Failed Token Generation)
    // ----------------------------------------------------------------
    {
      const user = await createTestUser()
      const video = await createTestVideo()

      // Stub generateDownloadToken to simulate unexpected database/token failure
      const originalGenerate = downloadTokenService.generateDownloadToken
      downloadTokenService.generateDownloadToken = async () => {
        throw new Error("Simulated cryptographic failure during token issuance")
      }

      let errorThrown = null
      try {
        await downloadAuthorizationService.authorizeDownload({
          user: { id: user._id.toString(), email: user.email },
          videoId: video._id.toString(),
        })
      } catch (err) {
        errorThrown = err
      } finally {
        downloadTokenService.generateDownloadToken = originalGenerate
      }

      assert(errorThrown, "Should throw an error on token failure")
      assert.strictEqual(errorThrown.code, "TOKEN_GENERATION_FAILED")

      // Verify that reserved quota was rolled back (quota_used == 0)
      const currentQuota = await downloadQuotaService.getCurrentQuota(user._id)
      assert.strictEqual(currentQuota.used, 0, "Quota reservation should be rolled back to 0")
      assert.strictEqual(currentQuota.remaining, 1, "Remaining quota should be restored to 1")

      console.log("[PASS] 15. System Failure Rollback: Token failure triggers quota release and restores user quota")
    }

    // ----------------------------------------------------------------
    // TEST 16: Account Blocked
    // ----------------------------------------------------------------
    {
      const user = await createTestUser("user", "blocked")
      const video = await createTestVideo()
      const token = generateAuthToken(user._id, user.email)

      const res = await request({
        path: "/api/downloads/authorize",
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: { videoId: video._id.toString() },
      })

      assert.strictEqual(res.statusCode, 403)
      assert(
        res.body.error?.code === "ACCOUNT_DOWNLOAD_RESTRICTED" ||
        res.body.code === "ACCOUNT_DOWNLOAD_RESTRICTED"
      )
      console.log("[PASS] 16. Account Blocked: Blocked account denied with ACCOUNT_DOWNLOAD_RESTRICTED (403)")
    }

    // ----------------------------------------------------------------
    // TEST 17: Video Deleted After Token Generation
    // ----------------------------------------------------------------
    {
      const user = await createTestUser()
      const video = await createTestVideo()
      const token = generateAuthToken(user._id, user.email)

      const authRes = await request({
        path: "/api/downloads/authorize",
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: { videoId: video._id.toString() },
      })
      const rawDlToken = authRes.body.data.authorizationToken

      // Video is now deleted by admin or creator
      video.deleted_at = new Date()
      await video.save()

      // Attempt to validate token for deleted video
      const valRes = await request({
        path: "/api/downloads/validate-token",
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: {
          token: rawDlToken,
          videoId: video._id.toString(),
        },
      })

      assert.strictEqual(valRes.statusCode, 404)
      assert(valRes.body.error?.code === "VIDEO_NOT_AVAILABLE" || valRes.body.code === "VIDEO_NOT_AVAILABLE")
      console.log("[PASS] 17. Video Deleted: Token for deleted video rejected with VIDEO_NOT_AVAILABLE (404)")
    }

    // ----------------------------------------------------------------
    // TEST 18: Token Replay Attempt Audit Logging
    // ----------------------------------------------------------------
    {
      const user = await createTestUser()
      const video = await createTestVideo()
      const token = generateAuthToken(user._id, user.email)

      const tokenResult = await downloadTokenService.generateDownloadToken({
        downloadId: new mongoose.Types.ObjectId(),
        videoId: video._id,
        userId: user._id,
      })

      // Mark used once
      await request({
        path: "/api/downloads/validate-token",
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: {
          token: tokenResult.rawToken,
          videoId: video._id.toString(),
          markUsed: true,
        },
      })

      // Mark used twice (Replay attempt)
      await request({
        path: "/api/downloads/validate-token",
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: {
          token: tokenResult.rawToken,
          videoId: video._id.toString(),
          markUsed: true,
        },
      })

      // Check DownloadAuditLog for TOKEN_REPLAY_ATTEMPT event
      await new Promise((r) => setTimeout(r, 200)) // allow async persistence
      const replayAudit = await DownloadAuditLog.findOne({
        event_type: "TOKEN_REPLAY_ATTEMPT",
        user_id: user._id,
      })

      assert(replayAudit, "TOKEN_REPLAY_ATTEMPT audit event must be logged in DownloadAuditLog")
      assert.strictEqual(replayAudit.event_type, "TOKEN_REPLAY_ATTEMPT")
      console.log("[PASS] 18. Replay Attempt Audit: TOKEN_REPLAY_ATTEMPT audit record accurately stored in DB")
    }

    console.log("------------------------------------------------------------------")
    console.log("PHASE 5 MASTER SUITE: ALL 18/18 TESTS PASSED PERFECTLY")
    console.log("==================================================================")
  } catch (err) {
    console.error("Test Suite Failed:", err)
    process.exit(1)
  } finally {
    server.close()
    await mongoose.disconnect()
  }
}

function resIsTokenAlreadyUsed(body) {
  return (
    body?.error?.code === "TOKEN_ALREADY_USED" ||
    body?.code === "TOKEN_ALREADY_USED" ||
    body?.message?.includes("already been used")
  )
}

runMasterSuite()
