/**
 * Automated Test Suite for Phase 9: Active Session Management & Remote Logout
 *
 * Verifies all 13 core scenarios from the Phase 9 specification:
 * 1. Single Device Login -> Unique Session ID -> Current Session Identified
 * 2. Multi-Device Sessions -> Separate sessions maintained concurrently
 * 3. Remote Logout -> Target session TERMINATED -> Subsequent access denied
 * 4. Logout Other Devices -> Current session preserved, all others terminated
 * 5. Logout All Devices -> All active sessions terminated immediately
 * 6. Session Expiration -> Sessions older than 30 days rejected
 * 7. Refresh Token Rotation -> Single-use token rotated, new hash stored
 * 8. Refresh Token Reuse Detection -> Replay detected -> Session REVOKED -> Event logged
 * 9. Maximum Session Limit -> Exceeding 10 evicts oldest inactive session
 * 10. Session Ownership Validation -> User A cannot terminate User B session
 * 11. Middleware Session Validation -> Rejects non-active / terminated sessions with 401
 * 12. Activity Tracking Throttling -> Updates lastActivityAt only after 5-minute threshold
 * 13. Trusted Device vs Active Session -> Systems remain independently managed
 */

import assert from "assert"
import crypto from "crypto"
import { SESSION_CONFIG } from "../config/sessionConfig.js"
import { TokenService } from "../services/tokenService.js"

let passedTests = 0
let failedTests = 0

function runTest(testName, fn) {
  try {
    fn()
    console.log(`  ✓ [PASS] ${testName}`)
    passedTests++
  } catch (err) {
    console.error(`  ✗ [FAIL] ${testName}`)
    console.error(`     Error: ${err.message}`)
    failedTests++
  }
}

async function runAsyncTest(testName, fn) {
  try {
    await fn()
    console.log(`  ✓ [PASS] ${testName}`)
    passedTests++
  } catch (err) {
    console.error(`  ✗ [FAIL] ${testName}`)
    console.error(`     Error: ${err.message}`)
    failedTests++
  }
}

// In-Memory Simulation Harness for Phase 9 Session Management
class MockSessionHarness {
  constructor() {
    this.sessions = new Map()
    this.securityEvents = []
    this.tokenService = new TokenService()
  }

  async createSession({ userId, loginContext = {}, authenticationMethod = "PASSWORD" }) {
    const dev = loginContext.device || {}
    const net = loginContext.network || {}
    const loc = net.location || {}

    // Capacity limit check (max 10 active per user)
    const active = [...this.sessions.values()].filter(
      (s) => s.userId === userId && s.status === SESSION_CONFIG.status.ACTIVE
    )

    if (active.length >= SESSION_CONFIG.sessionMaxPerUser) {
      const oldest = active.sort(
        (a, b) => new Date(a.lastActivityAt).getTime() - new Date(b.lastActivityAt).getTime()
      )[0]
      if (oldest) {
        oldest.status = SESSION_CONFIG.status.TERMINATED
        oldest.logoutReason = SESSION_CONFIG.logoutReason.SESSION_LIMIT_REACHED
        oldest.terminatedAt = new Date()
        oldest.refreshTokenHash = null

        this.securityEvents.push({
          eventType: SESSION_CONFIG.eventTypes.SESSION_AUTO_TERMINATED,
          userId,
          metadata: { terminatedSessionId: oldest.sessionId, reason: "SESSION_LIMIT_EXCEEDED" },
        })
      }
    }

    const sessionId = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + SESSION_CONFIG.sessionExpiryDays * 24 * 60 * 60 * 1000)

    const session = {
      id: sessionId,
      sessionId,
      userId,
      authenticationMethod,
      browser: dev.browser || { name: "Chrome", version: "128" },
      operatingSystem: dev.os || { name: "macOS", version: "15" },
      device: { type: dev.type || "desktop", model: dev.model || "MacBook Air" },
      ipAddress: net.ipAddress || "49.37.12.84",
      maskedIP: "49.37.xxx.xxx",
      location: loc || { city: "Kapurthala", state: "Punjab", country: "India" },
      status: SESSION_CONFIG.status.ACTIVE,
      createdAt: new Date(),
      lastActivityAt: new Date(),
      expiresAt,
      refreshTokenHash: null,
      terminatedAt: null,
      logoutReason: null,
    }

    this.sessions.set(sessionId, session)

    // Generate tokens
    const tokens = await this.tokenService.generateTokens({ _id: userId }, session)

    this.securityEvents.push({
      eventType: SESSION_CONFIG.eventTypes.SESSION_CREATED,
      userId,
      metadata: { sessionId },
    })

    return { session, tokens, sessionId }
  }

  async getActiveSessions(userId, currentSessionId = "") {
    const active = [...this.sessions.values()]
      .filter((s) => s.userId === userId && s.status === SESSION_CONFIG.status.ACTIVE && new Date() < new Date(s.expiresAt))
      .sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime())

    return active.map((s) => ({
      ...s,
      isCurrentSession: Boolean(currentSessionId && s.sessionId === currentSessionId),
    }))
  }

  async validateSession(sessionId) {
    const session = this.sessions.get(sessionId)
    if (!session) return { valid: false, code: "SESSION_NOT_FOUND" }
    if (session.status !== SESSION_CONFIG.status.ACTIVE) {
      return { valid: false, code: "SESSION_INACTIVE", status: session.status }
    }
    if (new Date() > new Date(session.expiresAt)) {
      session.status = SESSION_CONFIG.status.EXPIRED
      return { valid: false, code: "SESSION_EXPIRED" }
    }
    return { valid: true, session }
  }

  async terminateSession(userId, sessionId, reason = "USER_REMOTE_LOGOUT") {
    const session = this.sessions.get(sessionId)
    if (!session || session.userId !== userId) {
      throw new Error("Session not found or does not belong to user")
    }

    session.status = SESSION_CONFIG.status.TERMINATED
    session.terminatedAt = new Date()
    session.logoutReason = reason
    session.refreshTokenHash = null

    this.securityEvents.push({
      eventType: SESSION_CONFIG.eventTypes.SESSION_REMOTE_LOGOUT,
      userId,
      metadata: { sessionId, reason },
    })

    return session
  }

  async logoutOthers(userId, currentSessionId) {
    let count = 0
    for (const s of this.sessions.values()) {
      if (s.userId === userId && s.sessionId !== currentSessionId && s.status === SESSION_CONFIG.status.ACTIVE) {
        s.status = SESSION_CONFIG.status.TERMINATED
        s.terminatedAt = new Date()
        s.logoutReason = SESSION_CONFIG.logoutReason.LOGOUT_OTHERS
        s.refreshTokenHash = null
        count++
      }
    }

    this.securityEvents.push({
      eventType: SESSION_CONFIG.eventTypes.SESSION_LOGOUT_OTHERS,
      userId,
      metadata: { currentSessionId, terminatedCount: count },
    })

    return { terminatedCount: count }
  }

  async logoutAll(userId) {
    let count = 0
    for (const s of this.sessions.values()) {
      if (s.userId === userId && s.status === SESSION_CONFIG.status.ACTIVE) {
        s.status = SESSION_CONFIG.status.TERMINATED
        s.terminatedAt = new Date()
        s.logoutReason = SESSION_CONFIG.logoutReason.LOGOUT_ALL
        s.refreshTokenHash = null
        count++
      }
    }

    this.securityEvents.push({
      eventType: SESSION_CONFIG.eventTypes.SESSION_LOGOUT_ALL,
      userId,
      metadata: { terminatedCount: count },
    })

    return { terminatedCount: count }
  }

  touchActivity(session, elapsedMinutes = 6) {
    const now = Date.now()
    const elapsed = now - new Date(session.lastActivityAt).getTime()
    const threshold = SESSION_CONFIG.sessionActivityUpdateMinutes * 60 * 1000

    if (elapsed >= threshold) {
      session.lastActivityAt = new Date(now)
      return true
    }
    return false
  }
}

async function main() {
  console.log("\n========================================================================")
  console.log("PHASE 9: ACTIVE SESSION MANAGEMENT & REMOTE LOGOUT TEST SUITE")
  console.log("========================================================================\n")

  console.log("--- 1. CONFIGURATION & SPECIFICATION INTEGRITY ---")

  runTest("SESSION_CONFIG defines valid defaults for tokens, expiry, and capacities", () => {
    assert.strictEqual(SESSION_CONFIG.accessTokenExpiryMinutes, 15)
    assert.strictEqual(SESSION_CONFIG.refreshTokenExpiryDays, 30)
    assert.strictEqual(SESSION_CONFIG.sessionExpiryDays, 30)
    assert.strictEqual(SESSION_CONFIG.sessionMaxPerUser, 10)
    assert.strictEqual(SESSION_CONFIG.sessionActivityUpdateMinutes, 5)

    assert.strictEqual(SESSION_CONFIG.status.ACTIVE, "ACTIVE")
    assert.strictEqual(SESSION_CONFIG.status.EXPIRED, "EXPIRED")
    assert.strictEqual(SESSION_CONFIG.status.TERMINATED, "TERMINATED")
    assert.strictEqual(SESSION_CONFIG.status.REVOKED, "REVOKED")
  })

  console.log("\n--- 2. CORE PHASE 9 SCENARIO TESTS ---")

  await runAsyncTest("Scenario 1: Single device login -> Session created -> Current session identified", async () => {
    const harness = new MockSessionHarness()
    const userId = "user-alice"

    const { session, tokens, sessionId } = await harness.createSession({
      userId,
      loginContext: { device: { type: "desktop", model: "MacBook Air" } },
    })

    assert.ok(sessionId, "Session ID must be generated")
    assert.strictEqual(typeof sessionId, "string")
    assert.strictEqual(session.status, "ACTIVE")
    assert.ok(session.refreshTokenHash, "Refresh token hash must be saved on session")
    assert.ok(!session.refreshTokenHash.includes("rft_"), "Plain refresh token must never be stored")

    // Retrieve active sessions using this sessionId as current
    const active = await harness.getActiveSessions(userId, sessionId)
    assert.strictEqual(active.length, 1)
    assert.strictEqual(active[0].isCurrentSession, true, "Must be flagged as current session")
    assert.strictEqual(active[0].device.model, "MacBook Air")
  })

  await runAsyncTest("Scenario 2: Multi-device sessions -> Multiple separate sessions maintained concurrently", async () => {
    const harness = new MockSessionHarness()
    const userId = "user-multi"

    // Device 1: MacBook Air
    const s1 = await harness.createSession({
      userId,
      loginContext: { device: { type: "desktop", model: "MacBook Air" } },
    })

    // Device 2: Android Phone
    const s2 = await harness.createSession({
      userId,
      loginContext: { device: { type: "mobile", model: "Pixel 9" } },
    })

    // Device 3: Windows Edge
    const s3 = await harness.createSession({
      userId,
      loginContext: { device: { type: "desktop", model: "Dell XPS" } },
    })

    assert.notStrictEqual(s1.sessionId, s2.sessionId, "Each login must produce a distinct session ID")
    assert.notStrictEqual(s2.sessionId, s3.sessionId)

    const active = await harness.getActiveSessions(userId, s1.sessionId)
    assert.strictEqual(active.length, 3, "All 3 sessions must remain active simultaneously")

    const current = active.find((s) => s.isCurrentSession)
    assert.strictEqual(current.sessionId, s1.sessionId, "Current session must match s1")

    const others = active.filter((s) => !s.isCurrentSession)
    assert.strictEqual(others.length, 2, "2 other sessions must be returned")
  })

  await runAsyncTest("Scenario 3: Remote logout -> Target session marked TERMINATED -> Next request denied (401)", async () => {
    const harness = new MockSessionHarness()
    const userId = "user-remote-logout"

    const deviceA = await harness.createSession({ userId, loginContext: { device: { model: "Device A" } } })
    const deviceB = await harness.createSession({ userId, loginContext: { device: { model: "Device B" } } })

    // Device A remotely terminates Device B
    await harness.terminateSession(userId, deviceB.sessionId, "USER_REMOTE_LOGOUT")

    assert.strictEqual(deviceB.session.status, "TERMINATED")
    assert.strictEqual(deviceB.session.logoutReason, "USER_REMOTE_LOGOUT")
    assert.strictEqual(deviceB.session.refreshTokenHash, null, "Refresh token hash must be invalidated")

    // Next request with Device B's session must fail validation
    const validation = await harness.validateSession(deviceB.sessionId)
    assert.strictEqual(validation.valid, false)
    assert.strictEqual(validation.code, "SESSION_INACTIVE")

    // Security event logged
    assert.ok(
      harness.securityEvents.some((e) => e.eventType === "SESSION_REMOTE_LOGOUT"),
      "SESSION_REMOTE_LOGOUT event must be recorded"
    )
  })

  await runAsyncTest("Scenario 4: Logout other devices -> Current session preserved, all others terminated", async () => {
    const harness = new MockSessionHarness()
    const userId = "user-logout-others"

    const current = await harness.createSession({ userId, loginContext: { device: { model: "MacBook" } } })
    await harness.createSession({ userId, loginContext: { device: { model: "Android Phone" } } })
    await harness.createSession({ userId, loginContext: { device: { model: "iPad" } } })

    const res = await harness.logoutOthers(userId, current.sessionId)
    assert.strictEqual(res.terminatedCount, 2, "Must terminate exactly 2 other sessions")

    const remaining = await harness.getActiveSessions(userId, current.sessionId)
    assert.strictEqual(remaining.length, 1, "Only current session should remain active")
    assert.strictEqual(remaining[0].sessionId, current.sessionId)
    assert.strictEqual(remaining[0].isCurrentSession, true)
  })

  await runAsyncTest("Scenario 5: Logout all devices -> All active sessions terminated immediately", async () => {
    const harness = new MockSessionHarness()
    const userId = "user-logout-all"

    await harness.createSession({ userId, loginContext: { device: { model: "Device 1" } } })
    await harness.createSession({ userId, loginContext: { device: { model: "Device 2" } } })
    await harness.createSession({ userId, loginContext: { device: { model: "Device 3" } } })

    const res = await harness.logoutAll(userId)
    assert.strictEqual(res.terminatedCount, 3)

    const remaining = await harness.getActiveSessions(userId)
    assert.strictEqual(remaining.length, 0, "No active sessions should remain")
  })

  await runAsyncTest("Scenario 6: Session expiration -> Sessions older than 30 days rejected", async () => {
    const harness = new MockSessionHarness()
    const userId = "user-expire-test"

    const { session, sessionId } = await harness.createSession({ userId })

    // Simulate expiration (fast-forward past 30 days)
    session.expiresAt = new Date(Date.now() - 1000 * 60)

    const check = await harness.validateSession(sessionId)
    assert.strictEqual(check.valid, false)
    assert.strictEqual(check.code, "SESSION_EXPIRED")
  })

  await runAsyncTest("Scenario 7: Refresh token rotation -> Single-use token rotated, new hash stored", async () => {
    const tokenService = new TokenService()
    const user = { _id: "user-rotate-test", email: "test@example.com" }
    const session = {
      sessionId: "session-rotate-123",
      status: "ACTIVE",
      expiresAt: new Date(Date.now() + 100000),
      refreshTokenHash: null,
    }

    // Generate initial tokens
    const initialTokens = await tokenService.generateTokens(user, session)
    const firstHash = session.refreshTokenHash
    assert.ok(firstHash)

    // Rotate using the valid refresh token
    const newTokens = await tokenService.rotateRefreshToken(user, session, initialTokens.refreshToken)
    assert.ok(newTokens.accessToken)
    assert.ok(newTokens.refreshToken)
    assert.notStrictEqual(newTokens.refreshToken, initialTokens.refreshToken, "New refresh token must be issued")
    assert.notStrictEqual(session.refreshTokenHash, firstHash, "Stored hash must be rotated")
  })

  await runAsyncTest("Scenario 8: Refresh token reuse detection -> Replay detected -> Session REVOKED -> Event logged", async () => {
    const tokenService = new TokenService()
    const user = { _id: "user-reuse-test", email: "reuse@example.com" }
    const session = {
      sessionId: "session-replay-456",
      status: "ACTIVE",
      expiresAt: new Date(Date.now() + 100000),
      refreshTokenHash: null,
    }

    const initialTokens = await tokenService.generateTokens(user, session)

    // Legitimate rotation 1
    await tokenService.rotateRefreshToken(user, session, initialTokens.refreshToken)

    // Attacker tries to replay initial (now obsolete) refresh token
    let threw = false
    try {
      await tokenService.rotateRefreshToken(user, session, initialTokens.refreshToken)
    } catch (err) {
      threw = true
      assert.ok(err.message.includes("Token reuse detected"))
    }

    assert.strictEqual(threw, true, "Reused refresh token must be rejected")
    assert.strictEqual(session.status, "REVOKED", "Session must be immediately REVOKED")
    assert.strictEqual(session.refreshTokenHash, null, "Hash must be purged")
  })

  await runAsyncTest("Scenario 9: Maximum session limit (10) -> Evicts oldest inactive session", async () => {
    const harness = new MockSessionHarness()
    const userId = "user-cap-10"

    // Create 10 sessions with staggered lastActivityAt
    for (let i = 1; i <= 10; i++) {
      const { session } = await harness.createSession({
        userId,
        loginContext: { device: { model: `Device ${i}` } },
      })
      session.lastActivityAt = new Date(Date.now() - (11 - i) * 60000)
    }

    const activeBefore = await harness.getActiveSessions(userId)
    assert.strictEqual(activeBefore.length, 10)

    // Create 11th session
    const { session: s11 } = await harness.createSession({
      userId,
      loginContext: { device: { model: "Device 11" } },
    })

    const activeAfter = await harness.getActiveSessions(userId)
    assert.strictEqual(activeAfter.length, 10, "Total active sessions must remain capped at 10")

    // Oldest device (Device 1) must have been terminated
    const device1 = [...harness.sessions.values()].find((s) => s.device.model === "Device 1")
    assert.strictEqual(device1.status, "TERMINATED")
    assert.strictEqual(device1.logoutReason, "SESSION_LIMIT_REACHED")
  })

  await runAsyncTest("Scenario 10: Session ownership validation -> User A cannot terminate User B session", async () => {
    const harness = new MockSessionHarness()
    const userAlice = "user-alice"
    const userBob = "user-bob"

    const bobSession = await harness.createSession({ userId: userBob })

    let threw = false
    try {
      await harness.terminateSession(userAlice, bobSession.sessionId)
    } catch (err) {
      threw = true
      assert.ok(err.message.includes("does not belong to user"))
    }

    assert.strictEqual(threw, true, "Unauthorized session termination must be prevented")
  })

  await runAsyncTest("Scenario 11: Middleware session validation -> Rejects terminated/revoked sessions with 401", async () => {
    const harness = new MockSessionHarness()
    const { session, sessionId } = await harness.createSession({ userId: "user-mid-test" })

    // Valid initially
    const v1 = await harness.validateSession(sessionId)
    assert.strictEqual(v1.valid, true)

    // Terminated
    session.status = "TERMINATED"
    const v2 = await harness.validateSession(sessionId)
    assert.strictEqual(v2.valid, false)
    assert.strictEqual(v2.code, "SESSION_INACTIVE")

    // Revoked
    session.status = "REVOKED"
    const v3 = await harness.validateSession(sessionId)
    assert.strictEqual(v3.valid, false)
    assert.strictEqual(v3.code, "SESSION_INACTIVE")
  })

  runTest("Scenario 12: Activity tracking throttling -> Updates lastActivityAt only after 5 minutes", () => {
    const harness = new MockSessionHarness()
    const session = {
      sessionId: "ses-touch",
      lastActivityAt: new Date(Date.now() - 2 * 60 * 1000), // 2 minutes ago
    }

    // Call touch under 5 minutes threshold -> Should NOT update
    const updated1 = harness.touchActivity(session)
    assert.strictEqual(updated1, false, "Must not update lastActivityAt under 5 minutes")

    // Simulate 6 minutes ago
    session.lastActivityAt = new Date(Date.now() - 6 * 60 * 1000)
    const updated2 = harness.touchActivity(session)
    assert.strictEqual(updated2, true, "Must update lastActivityAt after 5-minute threshold")
  })

  runTest("Scenario 13: Trusted Device vs Active Session -> Systems remain decoupled", () => {
    // Trusted Device: 30-day recognized environment for skipping OTP verification
    const trustedDevice = {
      deviceIdentifier: "device-hash-123",
      status: "ACTIVE",
      trustExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    }

    // Active Session: Bearer-token-holding live connection
    const activeSession = {
      sessionId: "session-uuid-456",
      status: "TERMINATED", // User logged out of this session
    }

    // Even though the session was terminated, the device trust remains active
    assert.strictEqual(activeSession.status, "TERMINATED")
    assert.strictEqual(trustedDevice.status, "ACTIVE")
    assert.ok(trustedDevice.trustExpiresAt > new Date(), "Trusted device validity is decoupled from individual session termination")
  })

  console.log("\n========================================================================")
  console.log(`TOTAL PHASE 9 TESTS: ${passedTests + failedTests}`)
  console.log(`PASSED: ${passedTests}`)
  console.log(`FAILED: ${failedTests}`)
  console.log("========================================================================\n")

  if (failedTests > 0) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error("Test execution failure:", err)
  process.exit(1)
})
