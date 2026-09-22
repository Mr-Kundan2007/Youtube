import PaymentTransaction from "../../Modals/PaymentTransaction.js"
import SubscriptionHistory from "../../Modals/SubscriptionHistory.js"
import securityAlertService from "./securityAlertService.js"
import { logger } from "../../utils/logger.js"

export class AnomalyDetectionService {
  /**
   * Detects abnormal spikes in payment processing failures across the platform.
   * Default threshold: > 15% failures with at least 5 transactions in the lookback window.
   */
  async checkPaymentFailureSpike(lookbackMinutes = 60, thresholdPercent = 15, minAttempts = 5) {
    const windowStart = new Date(Date.now() - lookbackMinutes * 60 * 1000)

    const [totalAttempts, failedAttempts] = await Promise.all([
      PaymentTransaction.countDocuments({
        createdAt: { $gte: windowStart },
      }).catch(() => 0),
      PaymentTransaction.countDocuments({
        createdAt: { $gte: windowStart },
        status: { $in: ["failed", "verification_failed", "cancelled"] },
      }).catch(() => 0),
    ])

    const failureRate =
      totalAttempts > 0 ? Number(((failedAttempts / totalAttempts) * 100).toFixed(2)) : 0
    const isAnomaly = totalAttempts >= minAttempts && failureRate >= thresholdPercent

    if (isAnomaly) {
      logger.warn(
        `[AnomalyDetection] Payment failure spike detected: ${failureRate}% (${failedAttempts}/${totalAttempts}) in last ${lookbackMinutes}m`
      )

      await securityAlertService.dispatchAlert({
        alertType: "PAYMENT_ANOMALY_DETECTED",
        title: "High Payment Failure Rate Spike",
        message: `Payment failure rate reached ${failureRate}% (${failedAttempts} failures out of ${totalAttempts} attempts in last ${lookbackMinutes} minutes).`,
        severity: failureRate >= 40 ? "CRITICAL" : "HIGH",
        metadata: {
          totalAttempts,
          failedAttempts,
          failureRate,
          lookbackMinutes,
          thresholdPercent,
        },
        dedupeKey: "payment_failure_spike",
      }).catch(() => {})
    }

    return {
      isAnomaly,
      totalAttempts,
      failedAttempts,
      failureRate,
      thresholdPercent,
      lookbackMinutes,
    }
  }

  /**
   * Detects rapid subscription plan flapping or oscillating upgrades/cancellations.
   */
  async checkSubscriptionFlapping(userId, lookbackHours = 24, maxChanges = 3) {
    if (!userId) {
      return { isFlapping: false, changeCount: 0 }
    }

    const windowStart = new Date(Date.now() - lookbackHours * 60 * 60 * 1000)
    const changeCount = await SubscriptionHistory.countDocuments({
      userId,
      performedAt: { $gte: windowStart },
      action: {
        $in: [
          "plan_upgraded",
          "plan_downgraded",
          "subscription_cancelled",
          "cancellation_scheduled",
          "cancellation_restored",
          "subscription_created",
        ],
      },
    }).catch(() => 0)

    const isFlapping = changeCount >= maxChanges

    if (isFlapping) {
      logger.warn(
        `[AnomalyDetection] User ${userId} exceeded subscription change threshold: ${changeCount} events in ${lookbackHours}h`
      )

      await securityAlertService.dispatchAlert({
        alertType: "SUSPICIOUS_SUBSCRIPTION_CHANGE",
        title: "Rapid Subscription Plan Flapping",
        message: `User initiated ${changeCount} subscription plan changes in ${lookbackHours} hours.`,
        severity: changeCount >= 6 ? "HIGH" : "MEDIUM",
        metadata: {
          userId: String(userId),
          changeCount,
          maxChanges,
          lookbackHours,
        },
        dedupeKey: `flapping_${userId}`,
      }).catch(() => {})
    }

    return {
      isFlapping,
      changeCount,
      maxChanges,
      lookbackHours,
    }
  }

  /**
   * Executes a comprehensive telemetry scan across platform metrics.
   */
  async runAnomalyScan() {
    const paymentSpike = await this.checkPaymentFailureSpike()
    return {
      scannedAt: new Date(),
      paymentSpike,
    }
  }
}

const anomalyDetectionService = new AnomalyDetectionService()
export default anomalyDetectionService
