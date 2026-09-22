/**
 * Automated Test Suite for Phase 7: Secure OTP Generation, Delivery & Verification
 *
 * Verifies all 12 core scenarios from the Phase 7 specification:
 * 1. New Device Login -> Pending Login Created -> OTP Sent -> Correct OTP -> Verified -> Session Created
 * 2. Incorrect OTP -> Attempt count incremented -> No session created
 * 3. Maximum Attempts -> 5 consecutive failures -> OTP Locked
 * 4. Expired OTP -> Verification Denied -> Resend Available
 * 5. Resend OTP -> Cooldown checked -> Old OTP Invalidated -> New OTP Created & Sent
 * 6. Multiple OTPs -> Only latest OTP active
 * 7. OTP Reuse -> Verified OTP cannot be reused (Single use)
 * 8. Pending Login Expired -> OTP Verification Denied -> Re-login Required
 * 9. Email Delivery Failure -> Safe rollback, OTP Invalidated, safe error returned
 * 10. SMS Not Configured -> Email OTP remains available & SMS gracefully disabled
 * 11. Concurrent Verification -> Atomic single-use prevents replay / race conditions
 * 12. Frontend Manipulation -> Fake verification cannot bypass backend gate
 *
 * Plus unit checks for Cryptographic Generation, Timing-Safe Hash Verification, and Masking.
 */

import assert from "assert"
import crypto from "crypto"
import {
  generateSecureOTP,
  maskEmail,
  maskPhoneNumber,
  isValidNumericOTP,
} from "../utils/otpUtils.js"
import { hashOTP, verifyOTPHash } from "../utils/otpHashUtils.js"
import { OTP_CONFIG } from "../config/otpConfig.js"
import { EmailService } from "../services/emailService.js"
import { SMSService } from "../services/smsService.js"

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

console.log("\n==================================================================")
console.log("PHASE 7: SECURE OTP GENERATION, DELIVERY & VERIFICATION TEST SUITE")
console.log("==================================================================\n")

// -------------------------------------------------------------
// 1. CRYPTOGRAPHIC GENERATION & FORMAT VALIDATION
// -------------------------------------------------------------
console.log("--- 1. CRYPTOGRAPHIC GENERATION & UTILITIES ---")

runTest("generateSecureOTP produces 6-digit zero-padded numeric string", () => {
  for (let i = 0; i < 50; i++) {
    const otp = generateSecureOTP(6)
    assert.strictEqual(typeof otp, "string")
    assert.strictEqual(otp.length, 6)
    assert.ok(/^\d{6}$/.test(otp), `OTP ${otp} must be strictly 6 digits`)
  }
})

runTest("isValidNumericOTP strictly rejects non-numeric or malformed strings", () => {
  assert.strictEqual(isValidNumericOTP("123456"), true)
  assert.strictEqual(isValidNumericOTP("000123"), true)
  assert.strictEqual(isValidNumericOTP("12345"), false) // Too short
  assert.strictEqual(isValidNumericOTP("1234567"), false) // Too long
  assert.strictEqual(isValidNumericOTP("12345a"), false) // Contains letter
  assert.strictEqual(isValidNumericOTP(" 123456 "), true) // Trimmed
  assert.strictEqual(isValidNumericOTP(""), false)
  assert.strictEqual(isValidNumericOTP(null), false)
})

runTest("maskEmail correctly masks local parts while preserving domains", () => {
  assert.strictEqual(maskEmail("kundank82522@gmail.com"), "kun***@gmail.com")
  assert.strictEqual(maskEmail("alex@example.org"), "ale***@example.org")
  assert.strictEqual(maskEmail("me@test.com"), "m***@test.com")
  assert.strictEqual(maskEmail(""), "***@***.com")
})

runTest("maskPhoneNumber masks middle digits while preserving prefix and last 4", () => {
  assert.strictEqual(maskPhoneNumber("+919876543210"), "+91 ******3210")
  assert.strictEqual(maskPhoneNumber("+1 4155552671"), "+1 ******2671")
  assert.strictEqual(maskPhoneNumber("9876543210"), "******3210")
  assert.strictEqual(maskPhoneNumber(""), "******0000")
})

// -------------------------------------------------------------
// 2. TIMING-SAFE HMAC HASHING & ZERO PLAINTEXT STORAGE
// -------------------------------------------------------------
console.log("\n--- 2. TIMING-SAFE HMAC HASHING & COMPARISON ---")

runTest("hashOTP produces deterministic HMAC-SHA256 hex string", () => {
  const otp = "482913"
  const hash1 = hashOTP(otp)
  const hash2 = hashOTP(otp)
  assert.strictEqual(hash1, hash2)
  assert.strictEqual(hash1.length, 64) // 256 bits = 64 hex chars
  assert.notStrictEqual(hash1, otp) // Plaintext is never stored
})

runTest("verifyOTPHash verifies matching OTP in constant time", () => {
  const otp = "591024"
  const storedHash = hashOTP(otp)

  assert.strictEqual(verifyOTPHash(otp, storedHash), true)
  assert.strictEqual(verifyOTPHash("591025", storedHash), false)
  assert.strictEqual(verifyOTPHash("000000", storedHash), false)
  assert.strictEqual(verifyOTPHash("", storedHash), false)
})

// -------------------------------------------------------------
// 3. IN-MEMORY SIMULATION HARNESS FOR THE 12 SPECIFIED SCENARIOS
// -------------------------------------------------------------
console.log("\n--- 3. SPECIFIED PHASE 7 SCENARIOS (1 THROUGH 12) ---")

/**
 * Lightweight testable OTP engine simulating database state and operations.
 */
class TestableOTPEngine {
  constructor() {
    this.pendingLogins = new Map()
    this.otpRecords = new Map()
    this.verifiedLogins = []
    this.securityEvents = []
    this.emailService = new EmailService()
    this.smsService = new SMSService()
  }

  createPendingLogin(id, userEmail = "test@example.com", expiresAtOffsetMs = 10 * 60 * 1000) {
    const record = {
      pendingLoginId: id,
      userId: "user-test-123",
      userEmail,
      status: "PENDING",
      expiresAt: new Date(Date.now() + expiresAtOffsetMs),
      loginContext: {
        device: { type: "Desktop", browser: { name: "Chrome 140" } },
        network: { location: { city: "Kapurthala", country: "India" } },
        maskedIP: "203.0.xxx.xxx",
      },
    }
    this.pendingLogins.set(id, record)
    return record
  }

  async sendOTP(pendingLoginId, deliveryMethod = "EMAIL", shouldFailDelivery = false) {
    const pending = this.pendingLogins.get(pendingLoginId)
    if (!pending) throw new Error("Pending login not found")
    if (new Date() > pending.expiresAt || pending.status !== "PENDING") {
      throw new Error("Pending login expired or invalid")
    }

    // Cooldown check
    const existing = [...this.otpRecords.values()]
      .filter((o) => o.pendingLoginId === pendingLoginId)
      .sort((a, b) => b.createdAt - a.createdAt)[0]

    if (existing) {
      if (existing.resendCount >= OTP_CONFIG.maxResends) {
        throw new Error("Maximum verification code requests exceeded")
      }
      const elapsed = Math.floor((Date.now() - existing.lastResentAt) / 1000)
      if (elapsed < OTP_CONFIG.resendCooldownSeconds) {
        throw new Error(`Cooldown active. Wait ${OTP_CONFIG.resendCooldownSeconds - elapsed}s`)
      }
    }

    // Invalidate existing active OTPs
    for (const otp of this.otpRecords.values()) {
      if (otp.pendingLoginId === pendingLoginId && otp.status === "ACTIVE") {
        otp.status = "INVALIDATED"
      }
    }

    const plainOtp = generateSecureOTP(6)
    const otpHash = hashOTP(plainOtp)
    const expiresAt = new Date(Date.now() + OTP_CONFIG.expirySeconds * 1000)

    // Delivery
    if (shouldFailDelivery) {
      this.securityEvents.push({ type: "OTP_SEND_FAILED", pendingLoginId })
      throw new Error("Delivery provider error")
    }

    if (deliveryMethod === "EMAIL") {
      await this.emailService.sendLoginOTP({
        email: pending.userEmail,
        otp: plainOtp,
        expiresInMinutes: 5,
      })
    } else if (deliveryMethod === "SMS") {
      await this.smsService.sendLoginOTP({
        phone: "+919876543210",
        otp: plainOtp,
        expiresInMinutes: 5,
      })
    }

    const resendCount = existing ? existing.resendCount + 1 : 0
    const otpId = `otp-${Date.now()}-${Math.random()}`
    const record = {
      id: otpId,
      pendingLoginId,
      plainOtpForTest: plainOtp, // Exposed strictly for unit test assertions
      otpHash,
      status: "ACTIVE",
      attemptCount: 0,
      maxAttempts: OTP_CONFIG.maxAttempts,
      resendCount,
      lastResentAt: Date.now(),
      createdAt: Date.now(),
      expiresAt,
    }
    this.otpRecords.set(otpId, record)
    this.securityEvents.push({ type: resendCount > 0 ? "OTP_RESENT" : "OTP_SENT", pendingLoginId })

    return record
  }

  async verifyOTP(pendingLoginId, candidateOtp) {
    if (!isValidNumericOTP(candidateOtp, 6)) {
      throw new Error("OTP must be 6 numeric digits")
    }

    const pending = this.pendingLogins.get(pendingLoginId)
    if (!pending) throw new Error("Pending login not found")
    if (new Date() > pending.expiresAt || pending.status !== "PENDING") {
      throw new Error("Pending login expired")
    }

    // Find active OTP
    const active = [...this.otpRecords.values()].find(
      (o) => o.pendingLoginId === pendingLoginId && o.status === "ACTIVE"
    )

    if (!active) {
      const latest = [...this.otpRecords.values()]
        .filter((o) => o.pendingLoginId === pendingLoginId)
        .sort((a, b) => b.createdAt - a.createdAt)[0]

      if (latest?.status === "LOCKED") {
        throw new Error("This verification code is locked due to too many failed attempts. Please request a new code.")
      }
      if (latest?.status === "USED") {
        throw new Error("This verification code has already been used.")
      }
      if (latest?.status === "EXPIRED" || (latest && new Date() > latest.expiresAt)) {
        throw new Error("The verification code has expired. Please request a new code.")
      }
      throw new Error("No active verification code found")
    }

    if (new Date() > active.expiresAt) {
      active.status = "EXPIRED"
      this.securityEvents.push({ type: "OTP_EXPIRED", pendingLoginId })
      throw new Error("Verification code has expired")
    }

    if (active.attemptCount >= active.maxAttempts) {
      active.status = "LOCKED"
      this.securityEvents.push({ type: "OTP_LOCKED", pendingLoginId })
      throw new Error("Too many failed attempts. Code locked")
    }

    const match = verifyOTPHash(candidateOtp, active.otpHash)
    if (!match) {
      active.attemptCount += 1
      if (active.attemptCount >= active.maxAttempts) {
        active.status = "LOCKED"
        this.securityEvents.push({ type: "OTP_LOCKED", pendingLoginId })
        throw new Error("Too many failed attempts. Code locked")
      }
      this.securityEvents.push({ type: "OTP_VERIFY_FAILED", pendingLoginId })
      throw new Error(`Invalid code. ${active.maxAttempts - active.attemptCount} attempts left`)
    }

    // Atomic Consumption
    active.status = "USED"
    active.usedAt = new Date()
    pending.status = "VERIFIED"

    this.verifiedLogins.push({
      userId: pending.userId,
      pendingLoginId,
      verifiedAt: new Date(),
    })

    this.securityEvents.push({ type: "OTP_VERIFY_SUCCESS", pendingLoginId })
    this.securityEvents.push({ type: "LOGIN_VERIFIED", pendingLoginId })

    return {
      status: "ALLOWED",
      token: "mock-jwt-token-12345",
      sessionId: "session-abc-xyz",
    }
  }
}

// SCENARIO 1: New Device Login -> Full OTP Success Flow
await runAsyncTest("Scenario 1: New Device Login -> OTP Sent -> Correct OTP -> Verified & Session Created", async () => {
  const engine = new TestableOTPEngine()
  const pending = engine.createPendingLogin("pending-1")

  const sent = await engine.sendOTP(pending.pendingLoginId, "EMAIL")
  assert.strictEqual(sent.status, "ACTIVE")
  assert.ok(sent.otpHash)

  const verifyRes = await engine.verifyOTP(pending.pendingLoginId, sent.plainOtpForTest)
  assert.strictEqual(verifyRes.status, "ALLOWED")
  assert.ok(verifyRes.token)
  assert.strictEqual(pending.status, "VERIFIED")
  assert.strictEqual(sent.status, "USED")
})

// SCENARIO 2: Incorrect OTP -> Attempt Count Increments
await runAsyncTest("Scenario 2: Incorrect OTP -> Attempt count increments & denies session", async () => {
  const engine = new TestableOTPEngine()
  const pending = engine.createPendingLogin("pending-2")
  const sent = await engine.sendOTP(pending.pendingLoginId, "EMAIL")

  await assert.rejects(
    async () => engine.verifyOTP(pending.pendingLoginId, "000000"),
    /Invalid code. 4 attempts left/
  )

  assert.strictEqual(sent.attemptCount, 1)
  assert.strictEqual(sent.status, "ACTIVE")
  assert.strictEqual(pending.status, "PENDING")
})

// SCENARIO 3: Maximum Attempts -> Lockout after 5 failures
await runAsyncTest("Scenario 3: Maximum Attempts -> 5 consecutive failures locks OTP", async () => {
  const engine = new TestableOTPEngine()
  const pending = engine.createPendingLogin("pending-3")
  const sent = await engine.sendOTP(pending.pendingLoginId, "EMAIL")

  for (let i = 1; i <= 4; i++) {
    await assert.rejects(async () => engine.verifyOTP(pending.pendingLoginId, "111111"))
  }

  // 5th failed attempt locks code
  await assert.rejects(
    async () => engine.verifyOTP(pending.pendingLoginId, "111111"),
    /Too many failed attempts. Code locked/
  )

  assert.strictEqual(sent.status, "LOCKED")
  assert.strictEqual(sent.attemptCount, 5)

  // Subsequent attempt is rejected as locked
  await assert.rejects(
    async () => engine.verifyOTP(pending.pendingLoginId, sent.plainOtpForTest),
    /locked/i
  )
})

// SCENARIO 4: Expired OTP Denied
await runAsyncTest("Scenario 4: Expired OTP -> Verification Denied", async () => {
  const engine = new TestableOTPEngine()
  const pending = engine.createPendingLogin("pending-4")
  const sent = await engine.sendOTP(pending.pendingLoginId, "EMAIL")

  // Simulate expiration
  sent.expiresAt = new Date(Date.now() - 1000)

  await assert.rejects(
    async () => engine.verifyOTP(pending.pendingLoginId, sent.plainOtpForTest),
    /Verification code has expired/
  )
  assert.strictEqual(sent.status, "EXPIRED")
})

// SCENARIO 5: Resend OTP with Cooldown & Invalidation
await runAsyncTest("Scenario 5: Resend OTP -> Cooldown check & old OTP invalidated", async () => {
  const engine = new TestableOTPEngine()
  const pending = engine.createPendingLogin("pending-5")

  const otp1 = await engine.sendOTP(pending.pendingLoginId, "EMAIL")

  // Immediate resend must fail cooldown
  await assert.rejects(
    async () => engine.sendOTP(pending.pendingLoginId, "EMAIL"),
    /Cooldown active/
  )

  // Fast forward cooldown (61 seconds)
  otp1.lastResentAt = Date.now() - 61 * 1000

  const otp2 = await engine.sendOTP(pending.pendingLoginId, "EMAIL")
  assert.strictEqual(otp1.status, "INVALIDATED")
  assert.strictEqual(otp2.status, "ACTIVE")
  assert.strictEqual(otp2.resendCount, 1)

  // Old OTP1 must not verify anymore
  await assert.rejects(
    async () => engine.verifyOTP(pending.pendingLoginId, otp1.plainOtpForTest),
    /Invalid code/
  )

  // New OTP2 verifies successfully
  const res = await engine.verifyOTP(pending.pendingLoginId, otp2.plainOtpForTest)
  assert.strictEqual(res.status, "ALLOWED")
})

// SCENARIO 6: Multiple OTPs -> Only latest OTP active
await runAsyncTest("Scenario 6: Multiple OTPs -> Only latest OTP active", async () => {
  const engine = new TestableOTPEngine()
  const pending = engine.createPendingLogin("pending-6")

  const otp1 = await engine.sendOTP(pending.pendingLoginId, "EMAIL")
  otp1.lastResentAt = Date.now() - 61 * 1000
  const otp2 = await engine.sendOTP(pending.pendingLoginId, "EMAIL")

  const activeOtps = [...engine.otpRecords.values()].filter(
    (o) => o.pendingLoginId === pending.pendingLoginId && o.status === "ACTIVE"
  )
  assert.strictEqual(activeOtps.length, 1)
  assert.strictEqual(activeOtps[0].id, otp2.id)
})

// SCENARIO 7: OTP Single-Use Enforcement
await runAsyncTest("Scenario 7: OTP Reuse -> Verified OTP cannot be used twice", async () => {
  const engine = new TestableOTPEngine()
  const pending = engine.createPendingLogin("pending-7")
  const sent = await engine.sendOTP(pending.pendingLoginId, "EMAIL")

  const firstSuccess = await engine.verifyOTP(pending.pendingLoginId, sent.plainOtpForTest)
  assert.strictEqual(firstSuccess.status, "ALLOWED")

  // Second try with same OTP must fail
  await assert.rejects(
    async () => engine.verifyOTP(pending.pendingLoginId, sent.plainOtpForTest),
    /Pending login expired|No active verification code found/
  )
})

// SCENARIO 8: Pending Login Expired
await runAsyncTest("Scenario 8: Pending Login Expired -> Verification Denied", async () => {
  const engine = new TestableOTPEngine()
  // Create pending login that expired 1 second ago
  const pending = engine.createPendingLogin("pending-8", "user@test.com", -1000)

  await assert.rejects(
    async () => engine.sendOTP(pending.pendingLoginId, "EMAIL"),
    /Pending login expired/
  )
})

// SCENARIO 9: Email Delivery Failure Handling
await runAsyncTest("Scenario 9: Email Delivery Failure -> Safe error & event recorded", async () => {
  const engine = new TestableOTPEngine()
  const pending = engine.createPendingLogin("pending-9")

  await assert.rejects(
    async () => engine.sendOTP(pending.pendingLoginId, "EMAIL", true),
    /Delivery provider error/
  )

  const failureEvent = engine.securityEvents.find((e) => e.type === "OTP_SEND_FAILED")
  assert.ok(failureEvent)
})

// SCENARIO 10: SMS Unconfigured Handling
await runAsyncTest("Scenario 10: SMS Unconfigured -> Safely disabled while Email remains available", async () => {
  const engine = new TestableOTPEngine()
  const pending = engine.createPendingLogin("pending-10")

  // SMSService without provider configured must throw safe error
  await assert.rejects(
    async () => engine.sendOTP(pending.pendingLoginId, "SMS"),
    /SMS delivery service is currently not configured/
  )

  // Email still works flawlessly
  const emailOtp = await engine.sendOTP(pending.pendingLoginId, "EMAIL")
  assert.strictEqual(emailOtp.status, "ACTIVE")
})

// SCENARIO 11: Concurrent Verification Protection
await runAsyncTest("Scenario 11: Concurrent Verification -> Single-use atomic consumption prevents race condition", async () => {
  const engine = new TestableOTPEngine()
  const pending = engine.createPendingLogin("pending-11")
  const sent = await engine.sendOTP(pending.pendingLoginId, "EMAIL")

  // Simulate two concurrent requests hitting at once
  const results = await Promise.allSettled([
    engine.verifyOTP(pending.pendingLoginId, sent.plainOtpForTest),
    engine.verifyOTP(pending.pendingLoginId, sent.plainOtpForTest),
  ])

  const fulfilled = results.filter((r) => r.status === "fulfilled")
  const rejected = results.filter((r) => r.status === "rejected")

  assert.strictEqual(fulfilled.length, 1, "Exactly one verification request must succeed")
  assert.strictEqual(rejected.length, 1, "Concurrent duplicate request must be rejected")
})

// SCENARIO 12: Frontend Manipulation Prevention
await runAsyncTest("Scenario 12: Frontend Manipulation -> Arbitrary or forged verification rejected by backend", async () => {
  const engine = new TestableOTPEngine()
  const pending = engine.createPendingLogin("pending-12")

  // Attacker tries guessing or submitting fake code without sending
  await assert.rejects(
    async () => engine.verifyOTP(pending.pendingLoginId, "999999"),
    /No active verification code found/
  )

  // Attacker submits letters
  await assert.rejects(
    async () => engine.verifyOTP(pending.pendingLoginId, "ABCDEF"),
    /OTP must be 6 numeric digits/
  )

  assert.strictEqual(pending.status, "PENDING")
})

// -------------------------------------------------------------
// SUMMARY
// -------------------------------------------------------------
console.log("\n==================================================================")
console.log(`RESULTS: ${passedTests} PASSED | ${failedTests} FAILED`)
console.log("==================================================================\n")

if (failedTests > 0) {
  process.exit(1)
} else {
  process.exit(0)
}
