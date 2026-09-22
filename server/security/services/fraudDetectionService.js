import PaymentTransaction from "../../Modals/PaymentTransaction.js"
import securityAuditService from "./securityAuditService.js"
import { logger } from "../../utils/logger.js"

export class FraudDetectionService {
  /**
   * Returns a categorized risk level based on the computed numeric score (0-100).
   */
  getRiskLevel(score) {
    const num = Math.max(0, Math.min(100, Number(score) || 0))
    if (num >= 81) return "CRITICAL"
    if (num >= 51) return "HIGH"
    if (num >= 21) return "MEDIUM"
    return "LOW"
  }

  /**
   * Computes an algorithmic risk score based on observed security signals.
   */
  calculateRiskScore(factors = {}) {
    let score = 0
    const triggers = []

    // 1. Cryptographic signature invalidation (Indicates forgery/tampering attempt)
    if (factors.invalidSignature) {
      score += 100
      triggers.push({ factor: "INVALID_SIGNATURE", points: 100, reason: "Cryptographic signature validation failed" })
    }

    // 2. Amount tampering / mismatch
    if (factors.amountMismatch) {
      score += 50
      triggers.push({ factor: "AMOUNT_MISMATCH", points: 50, reason: "Client attempted to purchase with manipulated pricing" })
    }

    // 3. Replay attack attempt
    if (factors.replayAttempt) {
      score += 30
      triggers.push({ factor: "REPLAY_ATTEMPT", points: 30, reason: "Payment ID or completed order reused" })
    }

    // 4. Repeated payment failures in short time window (e.g. card testing / brute force)
    const failureCount = Number(factors.failedAttemptsInWindow) || 0
    if (failureCount >= 5) {
      score += 35
      triggers.push({ factor: "EXCESSIVE_FAILURES", points: 35, reason: `${failureCount} failed payment attempts in 10 minutes` })
    } else if (failureCount >= 3) {
      score += 20
      triggers.push({ factor: "MULTIPLE_FAILURES", points: 20, reason: `${failureCount} failed payment attempts in 10 minutes` })
    }

    // 5. Subscription plan flapping / rapid changes
    const rapidChanges = Number(factors.rapidPlanChanges) || 0
    if (rapidChanges >= 3) {
      score += 25
      triggers.push({ factor: "PLAN_FLAPPING", points: 25, reason: `${rapidChanges} subscription status changes in 24 hours` })
    }

    // 6. Rapid checkout attempts across multiple IPs or devices
    if (factors.multipleIpSpike) {
      score += 15
      triggers.push({ factor: "MULTIPLE_IPS", points: 15, reason: "Rapid transactions across divergent IP locations" })
    }

    const finalScore = Math.min(100, Math.max(0, score))
    return {
      score: finalScore,
      level: this.getRiskLevel(finalScore),
      triggers,
    }
  }

  /**
   * Analyzes an ongoing payment verification attempt in real time.
   */
  async analyzePaymentAttempt({
    userId,
    orderId,
    paymentId,
    invalidSignature = false,
    amountMismatch = false,
    replayAttempt = false,
    ipHash = null,
    userAgent = null,
    requestId = null,
  }) {
    // Check recent failures for this user in last 10 minutes
    let failedAttemptsInWindow = 0
    if (userId) {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)
      failedAttemptsInWindow = await PaymentTransaction.countDocuments({
        userId,
        status: { $in: ["failed", "verification_failed"] },
        createdAt: { $gte: tenMinutesAgo },
      }).catch(() => 0)
    }

    const assessment = this.calculateRiskScore({
      invalidSignature,
      amountMismatch,
      replayAttempt,
      failedAttemptsInWindow,
    })

    // If medium or higher risk, log to Security Audit Log
    if (assessment.score >= 21) {
      let eventType = "PAYMENT_ANOMALY_DETECTED"
      if (invalidSignature) eventType = "INVALID_SIGNATURE"
      else if (replayAttempt) eventType = "PAYMENT_REPLAY_ATTEMPT"
      else if (amountMismatch) eventType = "INVALID_PAYMENT_AMOUNT"
      else if (failedAttemptsInWindow >= 3) eventType = "API_ABUSE_DETECTED"

      await securityAuditService.recordEvent({
        eventType,
        severity: assessment.level,
        userId: userId || null,
        riskScore: assessment.score,
        orderId: orderId || null,
        ipHash: ipHash || null,
        userAgent: userAgent || null,
        requestId: requestId || null,
        safeMetadata: {
          triggers: assessment.triggers,
          failedAttemptsInWindow,
          paymentIdPrefix: paymentId ? String(paymentId).slice(0, 8) + "..." : null,
        },
      }).catch((err) => logger.warn("[FraudDetectionService] Audit logging failed:", err.message))
    }

    return {
      ...assessment,
      isBlocked: assessment.score >= 80,
    }
  }
}

const fraudDetectionService = new FraudDetectionService()
export default fraudDetectionService
