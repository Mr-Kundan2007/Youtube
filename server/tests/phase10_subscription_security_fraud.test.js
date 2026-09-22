/**
 * PHASE 10: ADVANCED SUBSCRIPTION SECURITY, FRAUD PREVENTION,
 * PAYMENT ANOMALY DETECTION, MONITORING & PRODUCTION READINESS TEST SUITE
 */

import mongoose from "mongoose"
import dotenv from "dotenv"
import crypto from "crypto"
import jwt from "jsonwebtoken"
import http from "http"

dotenv.config()

// Models
import User from "../Modals/Auth.js"
import Subscription from "../Modals/Subscription.js"
import PaymentTransaction from "../Modals/PaymentTransaction.js"
import SubscriptionSecurityEvent from "../Modals/SubscriptionSecurityEvent.js"
import IdempotencyKey from "../Modals/IdempotencyKey.js"
import JobLock from "../Modals/JobLock.js"
import SubscriptionHistory from "../Modals/SubscriptionHistory.js"

// Security Services & Utilities
import securityAuditService from "../security/services/securityAuditService.js"
import idempotencyService from "../security/services/idempotencyService.js"
import paymentSecurityService from "../security/services/paymentSecurityService.js"
import fraudDetectionService from "../security/services/fraudDetectionService.js"
import anomalyDetectionService from "../security/services/anomalyDetectionService.js"
import securityAlertService from "../security/services/securityAlertService.js"
import backgroundJobMonitorService from "../security/services/backgroundJobMonitorService.js"
import { sanitizeMetadata, constantTimeCompare } from "../security/utils/securityUtils.js"
import { getClientIp, hashIp } from "../security/utils/ipUtils.js"
import { generateCorrelationId } from "../security/utils/requestFingerprint.js"
import { createRateLimiter } from "../security/middleware/rateLimitMiddleware.js"
import {
  validateObjectId,
  validatePagination,
  validatePositiveAmount,
  validatePlanTier,
  validateDateRange,
} from "../security/middleware/requestValidationMiddleware.js"
import { authConfig } from "../config/index.js"

const DB_URI =
  process.env.DB_URL ||
  "mongodb+srv://admin:admin@cluster0.pwh5n.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0"

async function runPhase10TestSuite() {
  console.log("=========================================================================")
  console.log("  PHASE 10: SUBSCRIPTION SECURITY, FRAUD PREVENTION & MONITORING SUITE")
  console.log("=========================================================================\n")

  let passed = 0
  let failed = 0

  const assert = (condition, description) => {
    if (condition) {
      console.log(`  ✓ ${description}`)
      passed++
    } else {
      console.error(`  ✗ FAILED: ${description}`)
      failed++
    }
  }

  try {
    await mongoose.connect(DB_URI)
    console.log("Connected to MongoDB successfully.\n")

    // Test fixtures
    const testAdminId = new mongoose.Types.ObjectId()
    const testUserId = new mongoose.Types.ObjectId()
    const attackerId = new mongoose.Types.ObjectId()

    await User.create([
      {
        _id: testAdminId,
        name: "Security Admin",
        email: `secadmin_${Date.now()}@example.com`,
        password: "hashedpassword123",
        role: "admin",
      },
      {
        _id: testUserId,
        name: "Legit Subscriber",
        email: `subscriber_${Date.now()}@example.com`,
        password: "hashedpassword123",
        role: "user",
      },
      {
        _id: attackerId,
        name: "Suspicious User",
        email: `attacker_${Date.now()}@example.com`,
        password: "hashedpassword123",
        role: "user",
      },
    ])

    // =========================================================================
    // TEST SECTION 1: CONSTANT-TIME COMPARISON & SECRETS SANITIZATION
    // =========================================================================
    console.log("--- Test Section 1: Constant-Time Comparison & Secret Sanitization ---")

    const sigA = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    const sigB = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    const sigC = "0000000000000000000000000000000000000000000000000000000000000000"

    assert(constantTimeCompare(sigA, sigB) === true, "constantTimeCompare confirms matching signatures")
    assert(constantTimeCompare(sigA, sigC) === false, "constantTimeCompare rejects mismatched signatures")
    assert(constantTimeCompare(sigA, "") === false, "constantTimeCompare rejects empty string without error")

    const dirtyMetadata = {
      userId: "usr_123",
      password: "SuperSecretPassword123!",
      apiKey: "rzp_live_abc123secretkey",
      nested: {
        jwtToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy",
        signature: "raw_signature_hex_data",
        validItem: "safe_display_value",
      },
    }

    const clean = sanitizeMetadata(dirtyMetadata)
    assert(clean.password === "[REDACTED]", "sanitizeMetadata redacts plain password")
    assert(clean.apiKey === "[REDACTED]", "sanitizeMetadata redacts apiKey")
    assert(clean.nested.jwtToken === "[REDACTED]", "sanitizeMetadata redacts nested jwtToken")
    assert(clean.nested.signature === "[REDACTED]", "sanitizeMetadata redacts nested signature")
    assert(clean.nested.validItem === "safe_display_value", "sanitizeMetadata preserves non-sensitive keys")

    // =========================================================================
    // TEST SECTION 2: REQUEST CORRELATION ID & IP HASHING
    // =========================================================================
    console.log("\n--- Test Section 2: Request Correlation & Privacy IP Hashing ---")

    const corrId = generateCorrelationId()
    assert(corrId.startsWith("REQ-"), "generateCorrelationId returns REQ- prefixed UUID")
    assert(corrId.length > 20, "generateCorrelationId produces strong entropy correlation ID")

    const rawIp = "192.168.1.105"
    const ipHash = hashIp(rawIp)
    assert(ipHash.length === 64, "hashIp generates 64-char SHA256 hashed representation")
    assert(ipHash !== rawIp, "hashIp never exposes raw IP address")
    assert(hashIp(rawIp) === ipHash, "hashIp is deterministic for identical client IP")

    // =========================================================================
    // TEST SECTION 3: REQUEST VALIDATION MIDDLEWARE
    // =========================================================================
    console.log("\n--- Test Section 3: Server-Side Request Validation Middleware ---")

    // 3.1 Object ID Validation
    let objectIdError = null
    const mockReqValidId = { params: { id: "60d5ec49f1b2c8b1f8e4e1a1" } }
    const mockRes = {
      status: (code) => ({
        json: (data) => {
          objectIdError = { code, data }
        },
      }),
    }
    validateObjectId("id")(mockReqValidId, mockRes, () => {
      objectIdError = null
    })
    assert(objectIdError === null, "validateObjectId passes valid 24-char hex MongoDB ObjectId")

    const mockReqInvalidId = { params: { id: "invalid-not-an-id" } }
    validateObjectId("id")(mockReqInvalidId, mockRes, () => {})
    assert(objectIdError?.code === 400, "validateObjectId rejects malformed ObjectId with HTTP 400")

    // 3.2 Plan Tier Validation
    let planError = null
    const mockResPlan = {
      status: (code) => ({
        json: (data) => {
          planError = { code, data }
        },
      }),
    }
    validatePlanTier({ body: { planKey: "gold" } }, mockResPlan, () => {
      planError = null
    })
    assert(planError === null, "validatePlanTier permits valid plan tier ('gold')")

    validatePlanTier({ body: { planKey: "super_platinum_unlimited" } }, mockResPlan, () => {})
    assert(planError?.code === 400, "validatePlanTier rejects invalid plan tier with HTTP 400")

    // 3.3 Positive Amount Validation
    let amountError = null
    const mockResAmount = {
      status: (code) => ({
        json: (data) => {
          amountError = { code, data }
        },
      }),
    }
    validatePositiveAmount("price")({ body: { price: 1499 } }, mockResAmount, () => {
      amountError = null
    })
    assert(amountError === null, "validatePositiveAmount allows positive prices")

    validatePositiveAmount("price")({ body: { price: -500 } }, mockResAmount, () => {})
    assert(amountError?.code === 400, "validatePositiveAmount rejects negative prices with HTTP 400")

    // 3.4 Date Range Validation
    let dateError = null
    const mockResDate = {
      status: (code) => ({
        json: (data) => {
          dateError = { code, data }
        },
      }),
    }
    validateDateRange(
      { query: { startDate: "2026-09-01", endDate: "2026-09-07" } },
      mockResDate,
      () => {
        dateError = null
      }
    )
    assert(dateError === null, "validateDateRange permits chronological date ranges")

    validateDateRange(
      { query: { startDate: "2026-09-10", endDate: "2026-09-01" } },
      mockResDate,
      () => {}
    )
    assert(dateError?.code === 400, "validateDateRange rejects inverted date ranges (start > end)")

    // =========================================================================
    // TEST SECTION 4: SLIDING-WINDOW RATE LIMITING
    // =========================================================================
    console.log("\n--- Test Section 4: Sliding-Window Memory Rate Limiting ---")

    const testLimiter = createRateLimiter({
      windowMs: 5000,
      max: 3,
      category: "TEST_SUITE",
      message: "Rate limit reached in test.",
      enforceInTest: true,
    })

    const headersSet = {}
    let lastStatusCode = 200
    let lastJson = null

    const rateLimitTestUserId = new mongoose.Types.ObjectId()
    const makeLimiterReq = async () => {
      return new Promise((resolve) => {
        const req = {
          user: { id: rateLimitTestUserId },
          originalUrl: "/api/test",
          method: "GET",
          headers: {},
        }
        const res = {
          setHeader: (k, v) => {
            headersSet[k] = v
          },
          status: (c) => {
            lastStatusCode = c
            return {
              json: (d) => {
                lastJson = d
                resolve()
              },
            }
          },
        }
        testLimiter(req, res, () => {
          lastStatusCode = 200
          resolve()
        })
      })
    }

    // Call 1, 2, 3 should pass
    await makeLimiterReq()
    assert(lastStatusCode === 200, "Rate limiter passes request 1 (within limit)")
    await makeLimiterReq()
    assert(lastStatusCode === 200, "Rate limiter passes request 2 (within limit)")
    await makeLimiterReq()
    assert(lastStatusCode === 200, "Rate limiter passes request 3 (reaches max limit)")

    // Call 4 should trigger 429
    await makeLimiterReq()
    assert(lastStatusCode === 429, "Rate limiter returns HTTP 429 when threshold exceeded")
    assert(headersSet["Retry-After"] !== undefined, "Rate limiter attaches 'Retry-After' header")
    assert(lastJson?.code === "RATE_LIMIT_EXCEEDED", "Rate limiter returns structured error payload")

    // =========================================================================
    // TEST SECTION 5: AUTHORITATIVE PAYMENT AMOUNT VALIDATION
    // =========================================================================
    console.log("\n--- Test Section 5: Authoritative Server-Side Price Calculation ---")

    // Silver plan monthly: ₹499 -> 49900 paise
    const validMonthlySilver = await paymentSecurityService.validatePaymentAmount("silver", "monthly", 49900)
    assert(validMonthlySilver.isValid === true, "Authoritative calculation validates genuine Silver monthly price (49900 paise)")

    // Client tampered amount: 100 paise instead of 49900 paise
    const tamperedCheck = await paymentSecurityService.validatePaymentAmount("silver", "monthly", 100)
    assert(tamperedCheck.isValid === false, "Server authoritatively rejects tampered price (100 paise vs 49900)")
    assert(tamperedCheck.expectedAmountPaise === 49900, "Validation identifies expected server price")

    // Yearly Silver: 499 * 12 * 0.8 = 4790.4 -> rounded to 4790 -> 479000 paise
    const validYearlySilver = await paymentSecurityService.validatePaymentAmount("silver", "yearly", 479000)
    assert(validYearlySilver.isValid === true, "Authoritative calculation validates discounted yearly Silver price")

    // =========================================================================
    // TEST SECTION 6: PAYMENT STATE MACHINE TRANSITIONS
    // =========================================================================
    console.log("\n--- Test Section 6: Payment State Machine Matrix Enforcement ---")

    assert(
      paymentSecurityService.enforcePaymentStateMachine("pending", "processing").allowed === true,
      "State Machine allows pending -> processing transition"
    )
    assert(
      paymentSecurityService.enforcePaymentStateMachine("processing", "success").allowed === true,
      "State Machine allows processing -> success transition"
    )
    assert(
      paymentSecurityService.enforcePaymentStateMachine("failed", "success").allowed === false,
      "State Machine strictly blocks failed -> success transition"
    )
    assert(
      paymentSecurityService.enforcePaymentStateMachine("verification_failed", "success").allowed === false,
      "State Machine strictly blocks verification_failed -> success transition"
    )
    assert(
      paymentSecurityService.enforcePaymentStateMachine("success", "pending").allowed === false,
      "State Machine blocks transition out of terminal success state"
    )

    // =========================================================================
    // TEST SECTION 7: REPLAY ATTACK & DUPLICATE PAYMENT PREVENTION
    // =========================================================================
    console.log("\n--- Test Section 7: Replay Attack & Duplicate Payment Prevention ---")

    const orderIdA = `order_${Date.now()}_A`
    const paymentIdA = `pay_${Date.now()}_A`

    // Create an established successful payment
    const existingSuccessfulTx = await PaymentTransaction.create({
      userId: testUserId,
      orderId: orderIdA,
      paymentId: paymentIdA,
      amount: 49900,
      currency: "INR",
      status: "success",
      planKey: "silver",
      billingCycle: "monthly",
    })

    // Attacker attempts to reuse paymentIdA in a second checkout
    const replayByPaymentId = await paymentSecurityService.detectReplayAttempt(
      `order_different_${Date.now()}`,
      paymentIdA
    )
    assert(replayByPaymentId.isReplay === true, "detectReplayAttempt flags reuse of existing successful payment ID")
    assert(replayByPaymentId.type === "PAYMENT_ID_REUSE", "Flags correct replay violation type")

    // Attacker attempts to re-verify existing orderIdA
    const replayByOrderId = await paymentSecurityService.detectReplayAttempt(orderIdA, `pay_different_${Date.now()}`)
    assert(replayByOrderId.isReplay === true, "detectReplayAttempt flags re-verification of completed order ID")

    // Fresh, never-before-seen IDs pass
    const freshCheck = await paymentSecurityService.detectReplayAttempt(
      `order_fresh_${Date.now()}`,
      `pay_fresh_${Date.now()}`
    )
    assert(freshCheck.isReplay === false, "Fresh non-replayed order & payment passes replay check")

    // =========================================================================
    // TEST SECTION 8: WEBHOOK & ACTION IDEMPOTENCY LOCKING
    // =========================================================================
    console.log("\n--- Test Section 8: Webhook & Transaction Idempotency ---")

    const webhookEventId = `evt_test_${Date.now()}`

    // 1st request acquires lock
    const lock1 = await idempotencyService.checkOrAcquire({ key: webhookEventId, action: "razorpay_webhook" })
    assert(lock1.status === "processing", "First incoming webhook event acquires 'processing' idempotency lock")

    // Complete the idempotency key with cached response
    await idempotencyService.complete(webhookEventId, { status: "processed", event: "payment.captured" })

    // 2nd duplicate replayed request hits idempotency check
    const lock2 = await idempotencyService.checkOrAcquire({ key: webhookEventId, action: "razorpay_webhook" })
    assert(lock2.status === "completed", "Second replayed webhook event returns 'completed' status")
    assert((lock2.responsePayload || lock2.payload)?.status === "processed", "Replayed event retrieves cached completed response payload")

    // =========================================================================
    // TEST SECTION 9: ALGORITHMIC FRAUD RISK SCORING
    // =========================================================================
    console.log("\n--- Test Section 9: Algorithmic Fraud Risk Scoring Engine ---")

    // Base score for clean attempt
    const cleanScore = fraudDetectionService.calculateRiskScore({})
    assert(cleanScore.score === 0 && cleanScore.level === "LOW", "Clean payment attempt yields 0 risk score (LOW)")

    // High risk: Price tampering
    const priceTamperScore = fraudDetectionService.calculateRiskScore({ amountMismatch: true })
    assert(priceTamperScore.score === 50 && priceTamperScore.level === "MEDIUM", "Price tampering awards 50 risk points (MEDIUM)")

    // Critical risk: Invalid cryptographic signature
    const sigForgeryScore = fraudDetectionService.calculateRiskScore({ invalidSignature: true })
    assert(sigForgeryScore.score === 100 && sigForgeryScore.level === "CRITICAL", "Invalid signature attempt awards 100 risk points (CRITICAL)")

    // Combined indicators: Replay + Multiple failures
    const compositeScore = fraudDetectionService.calculateRiskScore({
      replayAttempt: true, // +30
      failedAttemptsInWindow: 3, // +20
    })
    assert(compositeScore.score === 50 && compositeScore.level === "MEDIUM", "Replay + 3 recent failures correctly awards 50 points")

    // Blocked check: Critical score >= 80 blocks transaction
    const analysis = await fraudDetectionService.analyzePaymentAttempt({
      userId: attackerId,
      orderId: "ord_tampered",
      invalidSignature: true,
    })
    assert(analysis.isBlocked === true, "analyzePaymentAttempt marks CRITICAL threat as isBlocked = true")

    // =========================================================================
    // TEST SECTION 10: SECURITY AUDIT LOGGING & FRAUD REVIEW QUEUE
    // =========================================================================
    console.log("\n--- Test Section 10: Security Audit Trail & Fraud Review Queue ---")

    const recordedEvent = await securityAuditService.recordEvent({
      eventType: "INVALID_SIGNATURE",
      severity: "CRITICAL",
      userId: attackerId,
      riskScore: 100,
      orderId: "ord_suspicious_123",
      safeMetadata: {
        reason: "Cryptographic HMAC mismatch detected",
        attemptedAmount: 1,
      },
    })

    assert(recordedEvent?._id !== undefined, "securityAuditService writes event to SubscriptionSecurityEvent collection")
    assert(recordedEvent.status === "OPEN", "New critical security event defaults to 'OPEN' review status")

    // Admin reviews and resolves event with required notes
    let noteRequiredError = false
    try {
      await securityAuditService.updateEventStatus({
        eventId: recordedEvent._id,
        status: "RESOLVED",
        adminNotes: "", // Empty notes should fail
        reviewedBy: testAdminId,
      })
    } catch {
      noteRequiredError = true
    }
    assert(noteRequiredError === true, "updateEventStatus rejects resolution without mandatory admin notes")

    // Successfully resolve event
    const resolvedEvent = await securityAuditService.updateEventStatus({
      eventId: recordedEvent._id,
      status: "RESOLVED",
      adminNotes: "Investigated client logs. Confirmed card testing attempt; account flagged.",
      reviewedBy: testAdminId,
    })

    assert(resolvedEvent.status === "RESOLVED", "Event status successfully updated to 'RESOLVED'")
    assert(resolvedEvent.reviewedBy.toString() === testAdminId.toString(), "Audit record captures reviewing admin ID")
    assert(resolvedEvent.reviewedAt !== null, "Audit record captures review timestamp")

    // =========================================================================
    // TEST SECTION 11: TELEMETRY ANOMALY DETECTION
    // =========================================================================
    console.log("\n--- Test Section 11: Telemetry Anomaly Detection Engine ---")

    // Seed rapid failed payment attempts
    await PaymentTransaction.create([
      { userId: attackerId, orderId: `ord_fail_1_${Date.now()}`, status: "failed", amount: 49900, currency: "INR", planKey: "silver" },
      { userId: attackerId, orderId: `ord_fail_2_${Date.now()}`, status: "failed", amount: 49900, currency: "INR", planKey: "silver" },
      { userId: attackerId, orderId: `ord_fail_3_${Date.now()}`, status: "failed", amount: 49900, currency: "INR", planKey: "silver" },
      { userId: attackerId, orderId: `ord_fail_4_${Date.now()}`, status: "failed", amount: 49900, currency: "INR", planKey: "silver" },
      { userId: attackerId, orderId: `ord_fail_5_${Date.now()}`, status: "failed", amount: 49900, currency: "INR", planKey: "silver" },
      { userId: testUserId, orderId: `ord_succ_1_${Date.now()}`, status: "success", amount: 49900, currency: "INR", planKey: "silver" },
    ])

    const spikeCheck = await anomalyDetectionService.checkPaymentFailureSpike(60, 15, 5)
    assert(spikeCheck.isAnomaly === true, "checkPaymentFailureSpike flags anomaly when failure rate exceeds 15% threshold")
    assert(spikeCheck.failedAttempts >= 5, "Accurately tallies failed attempts in lookback window")

    // Seed rapid subscription plan changes for flapping detection
    const subDoc = await Subscription.create({
      userId: attackerId,
      plan: "silver",
      status: "active",
      startDate: new Date(),
    })

    await SubscriptionHistory.create([
      { userId: attackerId, subscriptionId: subDoc._id, action: "plan_upgraded" },
      { userId: attackerId, subscriptionId: subDoc._id, action: "plan_downgraded" },
      { userId: attackerId, subscriptionId: subDoc._id, action: "plan_upgraded" },
      { userId: attackerId, subscriptionId: subDoc._id, action: "subscription_cancelled" },
    ])

    const flappingCheck = await anomalyDetectionService.checkSubscriptionFlapping(attackerId, 24, 3)
    assert(flappingCheck.isFlapping === true, "checkSubscriptionFlapping flags user with >3 plan changes in 24 hours")

    // =========================================================================
    // TEST SECTION 12: DEDUPLICATED SECURITY ALERTS
    // =========================================================================
    console.log("\n--- Test Section 12: Deduplicated Security Alert Dispatcher ---")

    securityAlertService.clear()

    // 1st alert dispatches
    const alert1 = await securityAlertService.dispatchAlert({
      alertType: "PAYMENT_ANOMALY_DETECTED",
      title: "Spike Alert",
      message: "First incident",
      severity: "HIGH",
      dedupeKey: "unique_spike_key",
    })
    assert(alert1.dispatched === true, "First alert dispatches immediately")

    // 2nd alert within 15m cooldown is suppressed
    const alert2 = await securityAlertService.dispatchAlert({
      alertType: "PAYMENT_ANOMALY_DETECTED",
      title: "Spike Alert Again",
      message: "Second incident",
      severity: "HIGH",
      dedupeKey: "unique_spike_key",
    })
    assert(alert2.dispatched === false && alert2.suppressed === true, "Duplicate alert within 15-minute cooldown is suppressed")

    // =========================================================================
    // TEST SECTION 13: BACKGROUND JOB MONITOR & STALE LOCK CLEANER
    // =========================================================================
    console.log("\n--- Test Section 13: Background Job Health & Lock Monitor ---")

    const jobName = `test_worker_${Date.now()}`
    await JobLock.create({
      jobName,
      isLocked: true,
      lockedAt: new Date(Date.now() - 40 * 60 * 1000), // 40 minutes old (stale)
      lastStatus: "running",
      consecutiveFailures: 0,
    })

    const reportBefore = await backgroundJobMonitorService.getJobHealthReport()
    assert(reportBefore.totalJobs > 0, "getJobHealthReport finds registered job locks")

    // Clear stale locks
    const cleanResult = await backgroundJobMonitorService.cleanStaleLocks(30)
    assert(cleanResult.clearedCount >= 1, "cleanStaleLocks automatically unlocks jobs stalled for >30 minutes")

    // =========================================================================
    // TEST SECTION 14: HTTP ENDPOINTS & ROLE GATING INTEGRATION
    // =========================================================================
    console.log("\n--- Test Section 14: HTTP Security Endpoints & Role Gating ---")

    const makeHttpRequest = (path, headers = {}, method = "GET", body = null) => {
      return new Promise((resolve) => {
        const req = http.request(
          {
            hostname: "127.0.0.1",
            port: 5004,
            path,
            method,
            headers: {
              "Content-Type": "application/json",
              ...headers,
            },
          },
          (res) => {
            let data = ""
            res.on("data", (chunk) => (data += chunk))
            res.on("end", () => {
              try {
                resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(data) })
              } catch {
                resolve({ status: res.statusCode, headers: res.headers, data })
              }
            })
          }
        )
        req.on("error", (err) => resolve({ status: 500, error: err.message }))
        if (body) req.write(JSON.stringify(body))
        req.end()
      })
    }

    const adminToken = jwt.sign(
      { id: testAdminId.toString(), email: "secadmin@example.com", role: "admin" },
      authConfig.jwtSecret,
      { algorithm: "HS256" }
    )
    const userToken = jwt.sign(
      { id: testUserId.toString(), email: "user@example.com", role: "user" },
      authConfig.jwtSecret,
      { algorithm: "HS256" }
    )

    // 14.1 Public Health endpoint
    const healthRes = await makeHttpRequest("/api/security/health")
    assert(healthRes.status === 200, "GET /api/security/health returns HTTP 200")
    assert(healthRes.data?.status === "ok", "Health endpoint reports status 'ok'")
    assert(healthRes.headers["x-content-type-options"] === "nosniff", "HTTP response includes 'X-Content-Type-Options: nosniff'")
    assert(healthRes.headers["x-frame-options"] === "SAMEORIGIN", "HTTP response includes 'X-Frame-Options: SAMEORIGIN'")
    assert(healthRes.headers["x-request-id"] !== undefined, "HTTP response includes correlation 'X-Request-Id'")

    // 14.2 Container Readiness probe
    const readyRes = await makeHttpRequest("/api/security/ready")
    assert(readyRes.status === 200, "GET /api/security/ready returns HTTP 200")
    assert(readyRes.data?.status === "ready", "Readiness endpoint reports status 'ready'")

    // 14.3 Unauthenticated access to /api/security/summary is rejected
    const unauthRes = await makeHttpRequest("/api/security/summary")
    assert(unauthRes.status === 401, "GET /api/security/summary without Bearer token returns HTTP 401 Unauthorized")

    // 14.4 Non-admin user access to /api/security/summary is forbidden
    const forbiddenRes = await makeHttpRequest("/api/security/summary", {
      Authorization: `Bearer ${userToken}`,
    })
    assert(forbiddenRes.status === 403, "GET /api/security/summary as normal subscriber returns HTTP 403 Forbidden")

    // 14.5 Administrator access to /api/security/summary succeeds
    const adminRes = await makeHttpRequest("/api/security/summary", {
      Authorization: `Bearer ${adminToken}`,
    })
    assert(adminRes.status === 200, "GET /api/security/summary as Administrator returns HTTP 200 OK")
    assert(adminRes.data?.data?.jobs !== undefined, "Security summary returns background job telemetry")

    // 14.6 Administrator access to /api/security/events succeeds
    const eventsRes = await makeHttpRequest("/api/security/events?limit=5", {
      Authorization: `Bearer ${adminToken}`,
    })
    assert(eventsRes.status === 200, "GET /api/security/events as Administrator returns HTTP 200 OK")
    assert(Array.isArray(eventsRes.data?.data?.events), "Security events endpoint returns paginated array")

    // =========================================================================
    // TEST SECTION 15: CLEANUP & SUMMARY
    // =========================================================================
    console.log("\n--- Cleaning up Phase 10 test fixtures ---")
    await User.deleteMany({ _id: { $in: [testAdminId, testUserId, attackerId] } })
    await Subscription.deleteMany({ userId: attackerId })
    await SubscriptionHistory.deleteMany({ userId: attackerId })
    await PaymentTransaction.deleteMany({ userId: { $in: [testUserId, attackerId] } })
    await SubscriptionSecurityEvent.deleteMany({ userId: attackerId })
    await IdempotencyKey.deleteMany({ key: webhookEventId })
    await JobLock.deleteMany({ jobName })

    console.log("\n=========================================================================")
    console.log(`  PHASE 10 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`)
    console.log("=========================================================================\n")

    await mongoose.disconnect()
    process.exit(failed > 0 ? 1 : 0)
  } catch (error) {
    console.error("Test execution failed with exception:", error)
    await mongoose.disconnect().catch(() => {})
    process.exit(1)
  }
}

runPhase10TestSuite()
