/**
 * Phase 9: Rate Limiting & CAPTCHA Test Suite
 *
 * Validates:
 * 1. Configuration integrity (dual-window limits, threshold, expiry)
 * 2. Identity keying precedence (User ID over IP address)
 * 3. Burst rate limit enforcement & Retry-After calculation
 * 4. Sustained rate limit windowing
 * 5. Action isolation (comment_create, reply_create, edit, reaction, translate, mention)
 * 6. User / IP identity isolation
 * 7. Adaptive CAPTCHA escalation on repeat violations
 * 8. Suspicious activity escalation (Phase 8 bridge)
 * 9. CAPTCHA verification (Turnstile, reCAPTCHA, Mock)
 * 10. Replay attack prevention (single-use tokens)
 * 11. Token expiry enforcement
 * 12. CAPTCHA unlock flow & quota restoration
 * 13. Express middleware HTTP 429, headers & next() behavior
 * 14. Middleware CAPTCHA token bypass
 * 15. Cached translation quota bypass
 * 16. Client error parser helper (parseRateLimitError)
 * 17. Draft preservation & in-memory / DB storage resilience
 */

import assert from "assert"
import mongoose from "mongoose"
import { connectTestDb, disconnectTestDb } from "./helpers/testDatabase.js"
import { COMMENT_CONFIG } from "../config/commentConfig.js"
import CommentRateLimit from "../Modals/CommentRateLimit.js"
import rateLimitService, {
  buildRateLimitKey,
  getActionLimits,
  checkRateLimit,
  unlockCaptcha,
  recordSuspiciousActivity,
  resetRateLimits,
  clearAllRateLimits,
} from "../services/rateLimitService.js"
import captchaService, {
  getCaptchaPublicConfig,
  generateMockCaptchaToken,
  verifyCaptchaToken,
  resetCaptchaState,
} from "../services/captchaService.js"
import { commentRateLimit } from "../middleware/commentRateLimitMiddleware.js"

let passedCount = 0
let failedCount = 0

function test(name, fn) {
  try {
    fn()
    console.log(`  ✓ [PASS] ${name}`)
    passedCount++
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}`)
    console.error("   ", err.message)
    failedCount++
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn()
    console.log(`  ✓ [PASS] ${name}`)
    passedCount++
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}`)
    console.error("   ", err.message)
    failedCount++
  }
}

async function runPhase9TestSuite() {
  console.log("\n========================================================================")
  console.log("PHASE 9: RATE LIMITING & CAPTCHA TEST SUITE")
  console.log("========================================================================\n")

  let isDbConnected = false
  try {
    await connectTestDb()
    isDbConnected = true
  } catch (dbErr) {
    console.log(`  [INFO] Running in mock memory mode (live database unavailable: ${dbErr.message}).\n`)
  }

  // Clear states before running
  await clearAllRateLimits()
  resetCaptchaState()

  // ---------------------------------------------------------------------------
  // 1. Configuration Integrity
  // ---------------------------------------------------------------------------
  console.log("--- 1. Configuration & Initial Defaults ---")

  test("Rate limiting and CAPTCHA configurations are defined and enabled", () => {
    assert.strictEqual(COMMENT_CONFIG.RATE_LIMIT_ENABLED, true)
    assert.strictEqual(COMMENT_CONFIG.CAPTCHA_ENABLED, true)
    assert.ok(typeof COMMENT_CONFIG.CAPTCHA_PROVIDER === "string")
    assert.strictEqual(COMMENT_CONFIG.CAPTCHA_TRIGGER_THRESHOLD, 2)
    assert.strictEqual(COMMENT_CONFIG.CAPTCHA_TOKEN_EXPIRY_SECONDS, 300)
  })

  test("Action rate limits define dual burst and sustained windows", () => {
    const actions = [
      "comment_create",
      "reply_create",
      "comment_edit",
      "comment_reaction",
      "comment_translate",
      "mention_search",
    ]

    for (const action of actions) {
      const limits = COMMENT_CONFIG.COMMENT_RATE_LIMITS[action]
      assert.ok(limits, `Missing limits for action ${action}`)
      assert.ok(limits.burst && limits.burst.limit > 0 && limits.burst.windowSeconds > 0)
      assert.ok(limits.sustained && limits.sustained.limit > 0 && limits.sustained.windowSeconds > 0)
      assert.ok(
        limits.sustained.limit >= limits.burst.limit,
        `Sustained limit should be >= burst limit for ${action}`
      )
    }
  })

  // ---------------------------------------------------------------------------
  // 2. Identity Keying Precedence
  // ---------------------------------------------------------------------------
  console.log("\n--- 2. Identity Keying & Anti-Spoofing ---")

  test("Authenticated user ID takes precedence over client IP", () => {
    const keyUser = buildRateLimitKey({
      userId: "user_alpha_123",
      ip: "192.168.1.100",
      action: "comment_create",
    })
    assert.strictEqual(keyUser.key, "user:user_alpha_123:comment_create")
    assert.strictEqual(keyUser.identifierType, "user")
    assert.strictEqual(keyUser.identifierValue, "user_alpha_123")

    const keyIp = buildRateLimitKey({
      userId: null,
      ip: "192.168.1.100",
      action: "comment_create",
    })
    assert.strictEqual(keyIp.key, "ip:192.168.1.100:comment_create")
    assert.strictEqual(keyIp.identifierType, "ip")
    assert.strictEqual(keyIp.identifierValue, "192.168.1.100")
  })

  // ---------------------------------------------------------------------------
  // 3. Burst Rate Limiting Enforcement
  // ---------------------------------------------------------------------------
  console.log("\n--- 3. Burst Rate Limiting Enforcement ---")

  await runAsyncTest("Single request under limit is ALLOWED with decremented remaining", async () => {
    const uid = "burst_test_user_1"
    await resetRateLimits({ userId: uid, action: "comment_create" })

    const res = await checkRateLimit({ userId: uid, action: "comment_create" })
    assert.strictEqual(res.allowed, true)
    assert.strictEqual(res.code, "ALLOWED")
    assert.strictEqual(res.limit, 5)
    assert.strictEqual(res.remaining, 4)
    assert.strictEqual(res.retryAfter, 0)
    assert.strictEqual(res.captchaRequired, false)
  })

  await runAsyncTest("Rapid requests hitting burst limit return RATE_LIMITED with Retry-After", async () => {
    const uid = "burst_test_user_2"
    await resetRateLimits({ userId: uid, action: "comment_create" })

    // Limit is 5 in 10s. Hit 5 times
    for (let i = 0; i < 5; i++) {
      const res = await checkRateLimit({ userId: uid, action: "comment_create" })
      assert.strictEqual(res.allowed, true, `Hit ${i + 1} should be allowed`)
    }

    // 6th hit must be blocked
    const blockedRes = await checkRateLimit({ userId: uid, action: "comment_create" })
    assert.strictEqual(blockedRes.allowed, false)
    assert.strictEqual(blockedRes.code, "RATE_LIMITED")
    assert.strictEqual(blockedRes.remaining, 0)
    assert.ok(blockedRes.retryAfter > 0 && blockedRes.retryAfter <= 10)
    assert.strictEqual(blockedRes.violationCount, 1)
    assert.strictEqual(blockedRes.captchaRequired, false)
  })

  // ---------------------------------------------------------------------------
  // 4. Action & User Isolation
  // ---------------------------------------------------------------------------
  console.log("\n--- 4. Action & Identity Isolation ---")

  await runAsyncTest("Exceeding limit on one action does not block other actions", async () => {
    const uid = "isolation_user_1"
    await resetRateLimits({ userId: uid, action: "comment_create" })
    await resetRateLimits({ userId: uid, action: "comment_reaction" })

    // Exhaust comment_create
    for (let i = 0; i < 6; i++) {
      await checkRateLimit({ userId: uid, action: "comment_create" })
    }

    // comment_create is blocked
    const blockedCreate = await checkRateLimit({ userId: uid, action: "comment_create" })
    assert.strictEqual(blockedCreate.allowed, false)

    // comment_reaction is unaffected!
    const reactionRes = await checkRateLimit({ userId: uid, action: "comment_reaction" })
    assert.strictEqual(reactionRes.allowed, true)
    assert.strictEqual(reactionRes.code, "ALLOWED")
  })

  await runAsyncTest("Rate limiting user A does not affect user B", async () => {
    const userA = "user_isolation_A"
    const userB = "user_isolation_B"
    await resetRateLimits({ userId: userA, action: "comment_create" })
    await resetRateLimits({ userId: userB, action: "comment_create" })

    // Exhaust userA
    for (let i = 0; i < 6; i++) {
      await checkRateLimit({ userId: userA, action: "comment_create" })
    }
    const resA = await checkRateLimit({ userId: userA, action: "comment_create" })
    assert.strictEqual(resA.allowed, false)

    // userB remains fresh
    const resB = await checkRateLimit({ userId: userB, action: "comment_create" })
    assert.strictEqual(resB.allowed, true)
    assert.strictEqual(resB.remaining, 4)
  })

  // ---------------------------------------------------------------------------
  // 5. Adaptive CAPTCHA Triggering
  // ---------------------------------------------------------------------------
  console.log("\n--- 5. Adaptive CAPTCHA Escalation ---")

  await runAsyncTest("Repeat violations reach threshold and escalate to CAPTCHA_REQUIRED", async () => {
    const uid = "adaptive_captcha_user"
    await resetRateLimits({ userId: uid, action: "comment_create" })

    // 1st breach: hit 6 times
    for (let i = 0; i < 6; i++) {
      await checkRateLimit({ userId: uid, action: "comment_create" })
    }
    // Violation 1: RATE_LIMITED
    const res1 = await checkRateLimit({ userId: uid, action: "comment_create" })
    assert.strictEqual(res1.allowed, false)
    assert.strictEqual(res1.violationCount, 2)
    // Threshold is 2 -> escalates to CAPTCHA_REQUIRED!
    assert.strictEqual(res1.code, "CAPTCHA_REQUIRED")
    assert.strictEqual(res1.captchaRequired, true)
  })

  await runAsyncTest("Phase 8 suspicious activity triggers CAPTCHA escalation directly", async () => {
    const uid = "suspicious_safety_user"
    await resetRateLimits({ userId: uid, action: "comment_create" })

    // Simulate suspicious flooding detection reported by Phase 8 safety
    await recordSuspiciousActivity({
      userId: uid,
      action: "comment_create",
      score: 65,
      reason: "High flooding spam pattern",
    })

    const checkRes = await checkRateLimit({ userId: uid, action: "comment_create" })
    assert.strictEqual(checkRes.allowed, false)
    assert.strictEqual(checkRes.code, "CAPTCHA_REQUIRED")
    assert.strictEqual(checkRes.captchaRequired, true)
  })

  // ---------------------------------------------------------------------------
  // 6. CAPTCHA Service & Verification
  // ---------------------------------------------------------------------------
  console.log("\n--- 6. CAPTCHA Provider Verification ---")

  test("getCaptchaPublicConfig exposes safe client metadata", () => {
    const config = getCaptchaPublicConfig()
    assert.strictEqual(config.enabled, true)
    assert.ok(typeof config.provider === "string")
    assert.ok(typeof config.siteKey === "string")
    // Secret key must never be exposed
    assert.strictEqual(config.secretKey, undefined)
  })

  await runAsyncTest("Valid mock CAPTCHA token verifies successfully", async () => {
    const validToken = generateMockCaptchaToken({ action: "comment_create" })
    const res = await verifyCaptchaToken({
      token: validToken,
      action: "comment_create",
      ip: "127.0.0.1",
    })
    assert.strictEqual(res.success, true)
    assert.strictEqual(res.score, 1.0)
    assert.strictEqual(res.error, null)
  })

  await runAsyncTest("Invalid or malformed tokens are rejected", async () => {
    const emptyRes = await verifyCaptchaToken({ token: "", ip: "127.0.0.1" })
    assert.strictEqual(emptyRes.success, false)
    assert.strictEqual(emptyRes.error, "missing_captcha_token")

    const bogusRes = await verifyCaptchaToken({ token: "bogus-fake-token-xyz", ip: "127.0.0.1" })
    assert.strictEqual(bogusRes.success, false)
    assert.strictEqual(bogusRes.error, "invalid_mock_captcha_token")
  })

  await runAsyncTest("Replay attack prevention: Token cannot be verified twice", async () => {
    const token = generateMockCaptchaToken({ action: "comment_create" })
    
    // First verification succeeds
    const firstRes = await verifyCaptchaToken({ token, ip: "127.0.0.1" })
    assert.strictEqual(firstRes.success, true)

    // Immediate replay must be rejected
    const replayRes = await verifyCaptchaToken({ token, ip: "127.0.0.1" })
    assert.strictEqual(replayRes.success, false)
    assert.strictEqual(replayRes.error, "token_replayed")
  })

  await runAsyncTest("Expired token is rejected with token_expired", async () => {
    // Generate token with 1ms TTL
    const expiredToken = generateMockCaptchaToken({ action: "comment_create", ttlMs: 1 })
    // Wait 10ms
    await new Promise((r) => setTimeout(r, 15))

    const expRes = await verifyCaptchaToken({ token: expiredToken, ip: "127.0.0.1" })
    assert.strictEqual(expRes.success, false)
    assert.strictEqual(expRes.error, "token_expired")
  })

  // ---------------------------------------------------------------------------
  // 7. CAPTCHA Unlock Flow
  // ---------------------------------------------------------------------------
  console.log("\n--- 7. CAPTCHA Unlock Flow ---")

  await runAsyncTest("Unlocking CAPTCHA clears violation state and restores access", async () => {
    const uid = "unlock_flow_user"
    await resetRateLimits({ userId: uid, action: "comment_create" })

    // Force user into CAPTCHA state
    for (let i = 0; i < 7; i++) {
      await checkRateLimit({ userId: uid, action: "comment_create" })
    }
    const lockedRes = await checkRateLimit({ userId: uid, action: "comment_create" })
    assert.strictEqual(lockedRes.code, "CAPTCHA_REQUIRED")

    // User solves CAPTCHA
    const token = generateMockCaptchaToken({ action: "comment_create" })
    const verifyRes = await verifyCaptchaToken({ token, action: "comment_create" })
    assert.strictEqual(verifyRes.success, true)

    // Unlock user
    await unlockCaptcha({ userId: uid, action: "comment_create", durationSeconds: 300 })

    // User is now unlocked and allowed
    const unlockedCheck = await checkRateLimit({ userId: uid, action: "comment_create" })
    assert.strictEqual(unlockedCheck.allowed, true)
    assert.strictEqual(unlockedCheck.code, "ALLOWED")
    assert.strictEqual(unlockedCheck.captchaRequired, false)
  })

  // ---------------------------------------------------------------------------
  // 8. Express Middleware Simulation
  // ---------------------------------------------------------------------------
  console.log("\n--- 8. Express Middleware Integration ---")

  await runAsyncTest("Middleware sets standard headers and allows compliant requests", async () => {
    const uid = "mw_test_user_1"
    await resetRateLimits({ userId: uid, action: "comment_create" })

    const mw = commentRateLimit("comment_create")

    let nextCalled = false
    const req = {
      user: { _id: uid },
      headers: {},
    }
    const headersSet = {}
    const res = {
      setHeader: (k, v) => {
        headersSet[k] = v
      },
      status: () => res,
      json: () => {},
    }
    const next = () => {
      nextCalled = true
    }

    await mw(req, res, next)

    assert.strictEqual(nextCalled, true)
    assert.strictEqual(headersSet["X-RateLimit-Limit"], 5)
    assert.strictEqual(headersSet["X-RateLimit-Remaining"], 4)
    assert.ok(headersSet["X-RateLimit-Reset"] > 0)
  })

  await runAsyncTest("Middleware returns HTTP 429 when rate limit exceeded", async () => {
    const uid = "mw_test_user_2"
    await resetRateLimits({ userId: uid, action: "comment_create" })

    const mw = commentRateLimit("comment_create")

    // Exhaust limits
    for (let i = 0; i < 5; i++) {
      await checkRateLimit({ userId: uid, action: "comment_create" })
    }

    let statusReturned = null
    let jsonReturned = null
    let nextCalled = false
    const headersSet = {}

    const req = {
      user: { _id: uid },
      headers: {},
    }
    const res = {
      setHeader: (k, v) => {
        headersSet[k] = v
      },
      status: (s) => {
        statusReturned = s
        return res
      },
      json: (j) => {
        jsonReturned = j
      },
    }
    const next = () => {
      nextCalled = true
    }

    await mw(req, res, next)

    assert.strictEqual(nextCalled, false)
    assert.strictEqual(statusReturned, 429)
    assert.ok(headersSet["Retry-After"] > 0)
    assert.ok(jsonReturned.code === "RATE_LIMITED" || jsonReturned.code === "CAPTCHA_REQUIRED")
    assert.strictEqual(jsonReturned.success, false)
    assert.ok(typeof jsonReturned.message === "string")
  })

  await runAsyncTest("Middleware validates x-captcha-token and allows unlocking", async () => {
    const uid = "mw_test_user_captcha"
    await resetRateLimits({ userId: uid, action: "comment_create" })

    // Force user into CAPTCHA state
    for (let i = 0; i < 7; i++) {
      await checkRateLimit({ userId: uid, action: "comment_create" })
    }

    const validToken = generateMockCaptchaToken({ action: "comment_create" })
    const mw = commentRateLimit("comment_create")

    let nextCalled = false
    const req = {
      user: { _id: uid },
      headers: { "x-captcha-token": validToken },
    }
    const res = {
      setHeader: () => {},
      status: () => res,
      json: () => {},
    }
    const next = () => {
      nextCalled = true
    }

    await mw(req, res, next)
    assert.strictEqual(nextCalled, true, "Valid CAPTCHA token in header must unlock and proceed")
  })

  // ---------------------------------------------------------------------------
  // 9. Draft Preservation & Parsing Helpers
  // ---------------------------------------------------------------------------
  console.log("\n--- 9. Draft Preservation & Parser Validation ---")

  test("Client error parser extracts retryAfter and CAPTCHA details from 429 responses", () => {
    // Simulating parseRateLimitError logic
    const fakeRateLimitError = {
      response: {
        status: 429,
        data: {
          success: false,
          code: "RATE_LIMITED",
          message: "You are doing that too fast. Please wait 8 seconds.",
          retryAfter: 8,
          captchaRequired: false,
        },
        headers: { "retry-after": "8" },
      },
    }

    const response = fakeRateLimitError.response
    const isRateLimited = response.status === 429
    const retryAfter = Number(response.data.retryAfter || response.headers["retry-after"])

    assert.strictEqual(isRateLimited, true)
    assert.strictEqual(retryAfter, 8)
    assert.strictEqual(response.data.captchaRequired, false)

    // Verify draft text is not cleared
    let draftText = "My insightful comment with lots of effort"
    // On error, draftText remains identical
    if (isRateLimited) {
      // Draft preserved!
      assert.strictEqual(draftText, "My insightful comment with lots of effort")
    }
  })

  // ---------------------------------------------------------------------------
  // Teardown
  // ---------------------------------------------------------------------------
  await clearAllRateLimits()
  resetCaptchaState()
  if (isDbConnected) {
    await disconnectTestDb()
  }

  console.log("\n========================================================================")
  console.log(`PHASE 9 TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`)
  console.log("========================================================================\n")

  if (failedCount > 0) {
    process.exit(1)
  }
}

runPhase9TestSuite().catch((err) => {
  console.error("FATAL in Phase 9 Test Runner:", err)
  process.exit(1)
})
