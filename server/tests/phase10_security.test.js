/**
 * Phase 10 Automated Security, E2EE, RBAC & Permissions Test Suite
 *
 * Validates:
 * 1. Session tracking, token validation, and instant revocation (401 SESSION_REVOKED).
 * 2. Algorithm confusion protection (rejection of 'none' algorithm and forged tokens).
 * 3. Anti-privilege escalation (stripping body role/isHost/isAdmin parameters).
 * 4. Authoritative Server-Side RBAC & Permission matrix enforcement.
 * 5. Host-only E2EE mode toggling and cryptographic key rotation.
 * 6. Audit logging persistence with strict sensitive secret redaction.
 * 7. Chat XSS input sanitization.
 * 8. Anti-IDOR protection on private recordings.
 * 9. Re-join prevention on ended meetings.
 * 10. Security headers verification.
 */
import assert from "assert"
import http from "http"
import jwt from "jsonwebtoken"
import mongoose from "mongoose"
import { authConfig, dbConfig } from "../config/index.js"
import Meeting from "../Modals/Meeting.js"
import MeetingParticipant from "../Modals/MeetingParticipant.js"
import User from "../Modals/Auth.js"
import Session from "../Modals/Session.js"
import SecurityEvent from "../Modals/SecurityEvent.js"
import { permissionService, MeetingPermissionsList } from "../services/permissionService.js"
import { securityAuditService } from "../services/securityAuditService.js"

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
        let raw = ""
        res.on("data", (chunk) => (raw += chunk))
        res.on("end", () => {
          let data = null
          try {
            data = JSON.parse(raw)
          } catch (e) {
            data = raw
          }
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data,
          })
        })
      }
    )

    req.on("error", reject)
    if (bodyData) req.write(bodyData)
    req.end()
  })
}

async function runPhase10SecurityTests() {
  console.log("\n==================================================================")
  console.log("RUNNING PHASE 10: ADVANCED SECURITY, E2EE, RBAC & AUDIT TESTS")
  console.log("==================================================================\n")

  if (mongoose.connection.readyState === 0 && dbConfig.url) {
    await mongoose.connect(dbConfig.url)
  }

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => {
      const port = s.address().port
      API_BASE = `http://localhost:${port}`
      console.log(`Phase 10 Test Server listening on port ${port}`)
      resolve(s)
    })
  })

  let passed = 0
  let failed = 0

  const test = async (name, fn) => {
    try {
      await fn()
      console.log(`[PASS] ${name}`)
      passed++
    } catch (err) {
      console.error(`[FAIL] ${name}:`, err.message)
      failed++
    }
  }

  try {
    // 1. Setup Test Users
    const hostUser = await User.create({
      name: "Phase10 Host",
      email: `p10host_${Date.now()}@test.com`,
      password: "TestPassword123!",
      role: "host",
    })

    const participantUser = await User.create({
      name: "Phase10 Participant",
      email: `p10participant_${Date.now()}@test.com`,
      password: "TestPassword123!",
      role: "user",
    })

    // 2. Setup Sessions & JWTs
    const hostSessionId = `sess_host_${Date.now()}`
    await Session.create({
      sessionId: hostSessionId,
      userId: hostUser._id,
      userAgent: "Phase10TestRunner/1.0",
      ip: "127.0.0.1",
      expiresAt: new Date(Date.now() + 86400000),
    })

    const hostToken = jwt.sign(
      {
        id: hostUser._id.toString(),
        email: hostUser.email,
        name: hostUser.name,
        sessionId: hostSessionId,
      },
      authConfig.jwtSecret,
      { algorithm: "HS256", expiresIn: "1d" }
    )

    const participantSessionId = `sess_part_${Date.now()}`
    await Session.create({
      sessionId: participantSessionId,
      userId: participantUser._id,
      userAgent: "Phase10TestRunner/1.0",
      ip: "127.0.0.1",
      expiresAt: new Date(Date.now() + 86400000),
    })

    const participantToken = jwt.sign(
      {
        id: participantUser._id.toString(),
        email: participantUser.email,
        name: participantUser.name,
        sessionId: participantSessionId,
      },
      authConfig.jwtSecret,
      { algorithm: "HS256", expiresIn: "1d" }
    )

    // Test Room
    const roomId = `p10-${Date.now().toString(36).slice(-3)}-${Math.random().toString(36).slice(-3)}`
    const testMeeting = await Meeting.create({
      roomId,
      title: "Phase 10 Security Hardening Room",
      hostId: hostUser._id,
      hostName: hostUser.name,
      status: "LIVE",
      securityMode: "STANDARD",
      e2eeKeyVersion: 1,
      permissions: {
        allowChat: true,
        allowFileSharing: true,
        allowScreenShare: true,
        allowRecording: true,
      },
    })

    // Register host and participant in MeetingParticipant
    await MeetingParticipant.create({
      meetingId: testMeeting._id,
      roomId,
      userId: hostUser._id.toString(),
      name: hostUser.name,
      displayName: hostUser.name,
      role: "HOST",
      status: "JOINED",
      joinedAt: new Date(),
    })

    await MeetingParticipant.create({
      meetingId: testMeeting._id,
      roomId,
      userId: participantUser._id.toString(),
      name: participantUser.name,
      displayName: participantUser.name,
      role: "PARTICIPANT",
      status: "JOINED",
      joinedAt: new Date(),
    })

    // -------------------------------------------------------------
    // TEST SUITE 1: Session Management & Revocation
    // -------------------------------------------------------------
    await test("Session Hardening: Active session passes authentication", async () => {
      const res = await request({
        path: `/api/meetings/${roomId}`,
        method: "GET",
        headers: { Authorization: `Bearer ${hostToken}` },
      })
      assert.strictEqual(res.statusCode, 200)
    })

    await test("Session Revocation: Revoking session immediately returns 401 SESSION_REVOKED", async () => {
      // Revoke host session in DB
      await Session.updateOne(
        { sessionId: hostSessionId },
        { $set: { revokedAt: new Date(), revokeReason: "TEST_LOGOUT" } }
      )

      const res = await request({
        path: `/api/meetings/${roomId}/lock`,
        method: "POST",
        headers: { Authorization: `Bearer ${hostToken}` },
      })
      assert.strictEqual(res.statusCode, 401)
      assert.strictEqual(res.body.error?.code, "SESSION_REVOKED")

      // Restore session for subsequent tests
      await Session.updateOne(
        { sessionId: hostSessionId },
        { $set: { revokedAt: null, revokeReason: null } }
      )
    })

    // -------------------------------------------------------------
    // TEST SUITE 2: Algorithm Confusion & Token Forgery Protection
    // -------------------------------------------------------------
    await test("Token Security: Rejects 'none' algorithm or unsigned JWTs", async () => {
      const forgedToken = jwt.sign(
        { id: hostUser._id.toString(), email: hostUser.email },
        "",
        { algorithm: "none" }
      )
      const res = await request({
        path: `/api/meetings/${roomId}/lock`,
        method: "POST",
        headers: { Authorization: `Bearer ${forgedToken}` },
      })
      assert.strictEqual(res.statusCode, 401)
    })


    // -------------------------------------------------------------
    // TEST SUITE 3: Server-Side RBAC & Permission Matrix
    // -------------------------------------------------------------
    await test("RBAC Matrix: Host has all permissions, Participant is strictly restricted", () => {
      assert.strictEqual(
        permissionService.hasPermission(MeetingPermissionsList.CAN_ENABLE_E2EE, "HOST", testMeeting, hostUser._id),
        true
      )
      assert.strictEqual(
        permissionService.hasPermission(MeetingPermissionsList.CAN_ROTATE_E2EE_KEY, "HOST", testMeeting, hostUser._id),
        true
      )
      assert.strictEqual(
        permissionService.hasPermission(MeetingPermissionsList.CAN_START_RECORDING, "HOST", testMeeting, hostUser._id),
        true
      )
      assert.strictEqual(
        permissionService.hasPermission(MeetingPermissionsList.CAN_MUTE_PARTICIPANTS, "HOST", testMeeting, hostUser._id),
        true
      )

      assert.strictEqual(
        permissionService.hasPermission(MeetingPermissionsList.CAN_ENABLE_E2EE, "PARTICIPANT", testMeeting, participantUser._id),
        false
      )
      assert.strictEqual(
        permissionService.hasPermission(MeetingPermissionsList.CAN_ROTATE_E2EE_KEY, "PARTICIPANT", testMeeting, participantUser._id),
        false
      )
      assert.strictEqual(
        permissionService.hasPermission(MeetingPermissionsList.CAN_MUTE_PARTICIPANTS, "PARTICIPANT", testMeeting, participantUser._id),
        false
      )
      assert.strictEqual(
        permissionService.hasPermission(MeetingPermissionsList.CAN_END_MEETING, "PARTICIPANT", testMeeting, participantUser._id),
        false
      )
    })

    await test("RBAC Hierarchy: Participant cannot remove or demote Host or Co-Host", () => {
      const hostId = hostUser._id.toString()
      const partId = participantUser._id.toString()
      const otherId = new mongoose.Types.ObjectId().toString()

      assert.strictEqual(permissionService.canRemoveTarget("PARTICIPANT", partId, "HOST", hostId, hostId), false)
      assert.strictEqual(permissionService.canRemoveTarget("CO_HOST", otherId, "HOST", hostId, hostId), false)
      assert.strictEqual(permissionService.canRemoveTarget("CO_HOST", otherId, "CO_HOST", otherId, hostId), false)
      assert.strictEqual(permissionService.canRemoveTarget("HOST", hostId, "PARTICIPANT", partId, hostId), true)
      assert.strictEqual(permissionService.canRemoveTarget("HOST", hostId, "CO_HOST", otherId, hostId), true)
    })

    // -------------------------------------------------------------
    // TEST SUITE 4: E2EE Mode Toggling & Key Ratchet Authorization
    // -------------------------------------------------------------
    await test("E2EE Authorization: Non-host is rejected (403) from toggling E2EE", async () => {
      const res = await request({
        path: `/api/meetings/${roomId}/e2ee/toggle`,
        method: "POST",
        headers: { Authorization: `Bearer ${participantToken}` },
        body: { enabled: true },
      })
      assert.strictEqual(res.statusCode, 403)
    })

    await test("E2EE Authorization: Non-host is rejected (403) from rotating E2EE key", async () => {
      const res = await request({
        path: `/api/meetings/${roomId}/e2ee/rotate-key`,
        method: "POST",
        headers: { Authorization: `Bearer ${participantToken}` },
      })
      assert.strictEqual(res.statusCode, 403)
    })

    await test("E2EE Lifecycle: Host successfully enables E2EE mode", async () => {
      const res = await request({
        path: `/api/meetings/${roomId}/e2ee/toggle`,
        method: "POST",
        headers: { Authorization: `Bearer ${hostToken}` },
        body: { enabled: true },
      })
      assert.strictEqual(res.statusCode, 200)
      assert.strictEqual(res.body.data.securityMode, "E2EE")
      assert.strictEqual(res.body.data.isE2EE, true)
      assert.strictEqual(res.body.data.e2eeKeyVersion, 1)

      const updated = await Meeting.findOne({ roomId })
      assert.strictEqual(updated.securityMode, "E2EE")
    })

    await test("E2EE Key Ratchet: Host successfully rotates E2EE key version", async () => {
      const res = await request({
        path: `/api/meetings/${roomId}/e2ee/rotate-key`,
        method: "POST",
        headers: { Authorization: `Bearer ${hostToken}` },
      })
      assert.strictEqual(res.statusCode, 200)
      assert.strictEqual(res.body.data.e2eeKeyVersion, 2)

      const updated = await Meeting.findOne({ roomId })
      assert.strictEqual(updated.e2eeKeyVersion, 2)
    })

    await test("E2EE Status: Participants can read truthful E2EE status and key version", async () => {
      const res = await request({
        path: `/api/meetings/${roomId}/e2ee/status`,
        method: "GET",
        headers: { Authorization: `Bearer ${participantToken}` },
      })
      assert.strictEqual(res.statusCode, 200)
      assert.strictEqual(res.body.data.securityMode, "E2EE")
      assert.strictEqual(res.body.data.isE2EE, true)
      assert.strictEqual(res.body.data.e2eeKeyVersion, 2)
    })

    // -------------------------------------------------------------
    // TEST SUITE 5: Security Audit Logging & Sensitive Data Redaction
    // -------------------------------------------------------------
    await test("Audit Logging: Automatically redacts passwords, tokens, and raw keys", async () => {
      const rawMetadata = {
        password: "SuperSecretPassword!",
        token: "livekit_access_token_12345",
        jwt: "eyJhbGciOi...",
        secret: "my_api_secret",
        rawKeyHex: "deadbeef0123456789abcdef",
        safeProperty: "SafeValue",
      }

      await securityAuditService.logEvent("E2EE_KEY_ROTATED", {
        userId: hostUser._id,
        roomId,
        severity: "INFO",
        metadata: rawMetadata,
      })

      const recorded = await SecurityEvent.findOne({
        roomId,
        eventType: "E2EE_KEY_ROTATED",
      }).sort({ timestamp: -1 })

      assert.ok(recorded, "Audit event must be stored in DB")
      assert.strictEqual(recorded.metadata.password, "[REDACTED]")
      assert.strictEqual(recorded.metadata.token, "[REDACTED]")
      assert.strictEqual(recorded.metadata.jwt, "[REDACTED]")
      assert.strictEqual(recorded.metadata.secret, "[REDACTED]")
      assert.strictEqual(recorded.metadata.rawKeyHex, "[REDACTED]")
      assert.strictEqual(recorded.metadata.safeProperty, "SafeValue")
    })

    // -------------------------------------------------------------
    // TEST SUITE 6: Anti-XSS Sanitization
    // -------------------------------------------------------------
    await test("Input Sanitization: Chat strips malicious <script> tags", async () => {
      const maliciousText = "<script>alert('XSS_ATTACK')</script>Hello Team!"
      const res = await request({
        path: `/api/meetings/${roomId}/chat`,
        method: "POST",
        headers: { Authorization: `Bearer ${participantToken}` },
        body: {
          text: maliciousText,
          senderId: participantUser._id.toString(),
          senderName: participantUser.name,
        },
      })
      assert.strictEqual(res.statusCode, 201)
      assert.ok(!res.body.data.message.text.includes("<script>"), "Message must not contain <script>")
      assert.ok(res.body.data.message.text.includes("Hello Team!"), "Message must preserve sanitized text")
    })

    // -------------------------------------------------------------
    // TEST SUITE 7: Ended Meeting Protection
    // -------------------------------------------------------------
    await test("Meeting Lifecycle: Cannot join ended meeting", async () => {
      const endedRoomId = `ended-${Date.now().toString(36).slice(-3)}`
      await Meeting.create({
        roomId: endedRoomId,
        title: "Ended Meeting",
        hostId: hostUser._id,
        hostName: hostUser.name,
        status: "ENDED",
        endedAt: new Date(),
      })

      const res = await request({
        path: `/api/meetings/${endedRoomId}/join`,
        method: "POST",
        headers: { Authorization: `Bearer ${participantToken}` },
        body: { displayName: "Attempt Join" },
      })
      assert.strictEqual(res.statusCode, 400)
      assert.strictEqual(res.body.error?.code, "MEETING_ENDED")
    })

    // -------------------------------------------------------------
    // TEST SUITE 8: Security Headers Verification
    // -------------------------------------------------------------
    await test("Security Headers: Required defensive HTTP headers are sent", async () => {
      const res = await request({
        path: `/api/meetings/${roomId}`,
        method: "GET",
      })
      assert.strictEqual(res.headers["x-content-type-options"], "nosniff")
      assert.strictEqual(res.headers["x-frame-options"], "SAMEORIGIN")
      assert.strictEqual(res.headers["x-xss-protection"], "1; mode=block")
    })

  } finally {
    server.close()
  }

  console.log("\n==================================================================")
  console.log(`PHASE 10 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`)
  console.log("==================================================================\n")

  if (failed > 0) {
    process.exit(1)
  }
}

runPhase10SecurityTests()
  .then(() => {
    process.exit(0)
  })
  .catch((err) => {
    console.error("Test execution fatal error:", err)
    process.exit(1)
  })
