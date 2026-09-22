import Subscription from "../Modals/Subscription.js"
import DownloadQuota from "../Modals/DownloadQuota.js"
import { getSubscriptionPlan } from "../config/subscriptionPlans.js"
import downloadAuditService, { DownloadEvents } from "./downloadAuditService.js"
import { logger } from "../utils/logger.js"

export class SubscriptionExpiryService {
  /**
   * Sweeps and expires all past-due subscriptions, executing scheduled downgrades or reverting to Free.
   */
  async processExpiries() {
    const now = new Date()

    // Find all active paid subscriptions past their expiration date
    const expiredSubscriptions = await Subscription.find({
      plan: { $ne: "free" },
      status: "active",
      expiresAt: { $lte: now },
    })

    const results = {
      processedCount: expiredSubscriptions.length,
      downgradedToFree: 0,
      scheduledDowngradesExecuted: 0,
    }

    for (const sub of expiredSubscriptions) {
      try {
        const previousPlan = sub.plan
        const targetPlanKey = sub.downgradeToPlan || "free"
        const targetPlan = getSubscriptionPlan(targetPlanKey)

        if (targetPlanKey === "free") {
          sub.plan = "free"
          sub.status = "expired"
          sub.downgradeToPlan = null
          sub.cancelAtPeriodEnd = false
          sub.download_limit = targetPlan.features.downloadLimitPerDay
          results.downgradedToFree++
        } else {
          // Scheduled downgrade to lower paid plan
          sub.plan = targetPlanKey
          sub.downgradeToPlan = null
          sub.download_limit = targetPlan.features.downloadLimitPerDay
          results.scheduledDowngradesExecuted++
        }

        await sub.save()

        // Reset active quota record
        await DownloadQuota.updateMany(
          { $or: [{ userId: sub.userId }, { user_id: sub.userId }], status: "active" },
          {
            $set: {
              plan: sub.plan,
              quota_limit: targetPlan.features.downloadLimitPerDay,
              quota_remaining: Math.min(targetPlan.features.downloadLimitPerDay, 1),
            },
          }
        )

        downloadAuditService.logEvent(DownloadEvents.SUBSCRIPTION_EXPIRED, {
          userId: sub.userId,
          plan: previousPlan,
          reason: `Subscription period ended. Transitioned to ${sub.plan.toUpperCase()}.`,
        })
      } catch (err) {
        logger.error(`Failed processing expiry for subscription ${sub._id}:`, err)
      }
    }

    return results
  }

  /**
   * Lazy evaluation for a single user during request processing.
   */
  async checkUserExpiry(userId) {
    if (!userId) return null

    const now = new Date()
    const sub = await Subscription.findOne({
      $or: [{ userId }, { user_id: userId }],
      plan: { $ne: "free" },
      status: "active",
      expiresAt: { $lte: now },
    })

    if (!sub) return null

    const previousPlan = sub.plan
    const targetPlanKey = sub.downgradeToPlan || "free"
    const targetPlan = getSubscriptionPlan(targetPlanKey)

    sub.plan = targetPlanKey
    sub.status = targetPlanKey === "free" ? "expired" : "active"
    sub.downgradeToPlan = null
    sub.download_limit = targetPlan.features.downloadLimitPerDay
    await sub.save()

    // Sync quota
    await DownloadQuota.updateMany(
      { $or: [{ userId }, { user_id: userId }], status: "active" },
      {
        $set: {
          plan: targetPlanKey,
          quota_limit: targetPlan.features.downloadLimitPerDay,
          quota_remaining: Math.min(targetPlan.features.downloadLimitPerDay, 1),
        },
      }
    )

    downloadAuditService.logEvent(DownloadEvents.SUBSCRIPTION_EXPIRED, {
      userId,
      plan: previousPlan,
      reason: `Lazy evaluation: subscription ended, downgraded to ${targetPlanKey.toUpperCase()}`,
    })

    return sub
  }
}

export const subscriptionExpiryService = new SubscriptionExpiryService()
export default subscriptionExpiryService
