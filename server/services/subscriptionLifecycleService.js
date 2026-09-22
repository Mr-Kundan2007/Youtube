import Subscription from "../Modals/Subscription.js"
import SubscriptionHistory from "../Modals/SubscriptionHistory.js"
import SubscriptionPlan from "../Modals/SubscriptionPlan.js"
import DownloadQuota from "../Modals/DownloadQuota.js"
import { getSubscriptionPlan } from "../config/subscriptionPlans.js"
import subscriptionNotificationService from "./subscriptionNotificationService.js"
import downloadAuditService, { DownloadEvents } from "./downloadAuditService.js"
import { ApiError } from "../utils/apiError.js"
import { logger } from "../utils/logger.js"

export class SubscriptionLifecycleService {
  /**
   * Evaluates upgrade vs downgrade vs renewal.
   */
  async requestPlanChange({ userId, targetPlanKey }) {
    if (!userId) throw ApiError.unauthorized("UNAUTHORIZED", "User required")

    const sub = await Subscription.findOne({
      $or: [{ userId }, { user_id: userId }],
    })
    const currentPlanKey = sub?.plan || "free"
    const targetPlan = getSubscriptionPlan(targetPlanKey)

    const hierarchy = { free: 0, bronze: 1, silver: 2, gold: 3 }
    const currentRank = hierarchy[currentPlanKey] || 0
    const targetRank = hierarchy[targetPlanKey] || 0

    if (currentRank === targetRank) {
      throw ApiError.badRequest("SAME_PLAN", "You are already on this subscription plan")
    }

    // 1. Upgrade workflow: User moves to a higher tier
    if (targetRank > currentRank) {
      return {
        action: "UPGRADE",
        currentPlan: currentPlanKey,
        targetPlan: targetPlan.key,
        requiresPayment: true,
        message: `Upgrading from ${currentPlanKey.toUpperCase()} to ${targetPlan.name}.`,
      }
    }

    // 2. Downgrade workflow: User moves to a lower tier
    if (sub) {
      sub.downgradeToPlan = targetPlan.key
      await sub.save()
    }

    return {
      action: "DOWNGRADE_SCHEDULED",
      currentPlan: currentPlanKey,
      targetPlan: targetPlan.key,
      requiresPayment: false,
      effectiveDate: sub?.expiresAt || new Date(),
      message: `Your downgrade to ${targetPlan.name} is scheduled and will take effect at the end of your current billing period.`,
    }
  }

  /**
   * Schedules user subscription cancellation while preserving all paid benefits until current expiry date.
   */
  async scheduleCancellation(userId, { reason = "User requested cancellation", cancelledBy = "user" } = {}) {
    const sub = await Subscription.findOne({
      $or: [{ userId }, { user_id: userId }],
    })

    if (!sub || sub.plan === "free") {
      throw ApiError.badRequest("NO_PAID_SUBSCRIPTION", "You do not have an active paid subscription to cancel")
    }

    if (sub.status === "expired") {
      throw ApiError.badRequest("SUBSCRIPTION_EXPIRED", "Your subscription is already expired")
    }

    const now = new Date()
    const effectiveAt = sub.expiresAt && new Date(sub.expiresAt) > now ? sub.expiresAt : now

    sub.cancelScheduled = true
    sub.cancelAtPeriodEnd = true
    sub.status = "cancel_scheduled"
    sub.autoRenew = false
    sub.cancelledAt = now
    sub.cancelRequestedAt = now
    sub.cancelEffectiveAt = effectiveAt
    sub.cancellationReason = reason
    sub.cancelledBy = cancelledBy
    await sub.save()

    // Log in immutable audit trail
    await SubscriptionHistory.create({
      userId: sub.userId,
      subscriptionId: sub._id,
      previousPlanId: sub.planId,
      newPlanId: sub.planId,
      action: "cancellation_scheduled",
      reason: `Cancellation scheduled: ${reason}. Access preserved until ${effectiveAt.toISOString()}`,
      metadata: {
        effectiveAt,
        cancelledBy,
        plan: sub.plan,
      },
    }).catch((err) => logger.warn("Error logging cancellation history:", err.message))

    downloadAuditService.logEvent(DownloadEvents.SUBSCRIPTION_CANCELLED, {
      userId,
      plan: sub.plan,
      reason,
      metadata: {
        expiresAt: effectiveAt,
        cancelAtPeriodEnd: true,
      },
    })

    // Send in-app notification
    const planConfig = getSubscriptionPlan(sub.plan)
    await subscriptionNotificationService.notifyCancellationScheduled({
      userId: sub.userId,
      planName: planConfig.name,
      accessUntilDate: effectiveAt,
    })

    return {
      success: true,
      status: "cancel_scheduled",
      cancelScheduled: true,
      cancelAtPeriodEnd: true,
      plan: sub.plan,
      expiresAt: effectiveAt,
      cancelEffectiveAt: effectiveAt,
      message: `Subscription cancellation scheduled. You will retain full premium access until ${effectiveAt.toLocaleDateString("en-IN")}.`,
    }
  }

  /**
   * Backward-compatible alias for scheduleCancellation.
   */
  async cancelSubscription(userId, reason = "User requested cancellation") {
    return this.scheduleCancellation(userId, { reason })
  }

  /**
   * Restores/reverses a scheduled cancellation before it reaches expiry.
   */
  async restoreCancelledSubscription(userId) {
    const sub = await Subscription.findOne({
      $or: [{ userId }, { user_id: userId }],
    })

    if (!sub || (!sub.cancelScheduled && !sub.cancelAtPeriodEnd)) {
      throw ApiError.badRequest("NOT_CANCELLED", "Subscription is not scheduled for cancellation")
    }

    if (sub.status === "expired" || (sub.expiresAt && new Date(sub.expiresAt) <= new Date())) {
      throw ApiError.badRequest("SUBSCRIPTION_EXPIRED", "Subscription has already expired and cannot be restored. Please renew.")
    }

    sub.cancelScheduled = false
    sub.cancelAtPeriodEnd = false
    sub.status = "active"
    sub.autoRenew = true
    sub.cancelledAt = null
    sub.cancelRequestedAt = null
    sub.cancelEffectiveAt = null
    sub.cancellationReason = null
    sub.downgradeToPlan = null
    await sub.save()

    // Log in immutable audit trail
    await SubscriptionHistory.create({
      userId: sub.userId,
      subscriptionId: sub._id,
      previousPlanId: sub.planId,
      newPlanId: sub.planId,
      action: "cancellation_restored",
      reason: "Cancellation reversed by user. Auto-renewal restored.",
      metadata: {
        plan: sub.plan,
        expiresAt: sub.expiresAt,
      },
    }).catch((err) => logger.warn("Error logging restoration history:", err.message))

    const planConfig = getSubscriptionPlan(sub.plan)
    await subscriptionNotificationService.notifyCancellationRestored({
      userId: sub.userId,
      planName: planConfig.name,
      expiryDate: sub.expiresAt,
    })

    return {
      success: true,
      status: "active",
      cancelScheduled: false,
      cancelAtPeriodEnd: false,
      plan: sub.plan,
      expiresAt: sub.expiresAt,
      message: "Subscription cancellation reversed. Auto-renewal and benefits remain active.",
    }
  }

  /**
   * Backward-compatible alias for restoreCancelledSubscription.
   */
  async reactivateSubscription(userId) {
    return this.restoreCancelledSubscription(userId)
  }

  /**
   * Idempotently expires a subscription, transitions it to Free, updates quota, and writes audit records.
   */
  async expireSubscription(sub, { reason = "Subscription period ended" } = {}) {
    if (!sub) return null

    // Already expired free plan - idempotent early exit
    if (sub.plan === "free" && sub.status === "expired") {
      return sub
    }

    const previousPlan = sub.plan
    const targetPlanKey = sub.downgradeToPlan || "free"
    const targetPlan = getSubscriptionPlan(targetPlanKey)
    const targetPlanDoc = await SubscriptionPlan.findOne({ slug: targetPlanKey.toLowerCase() })
    const resolvedPlanId = targetPlanDoc?._id || sub.planId || sub._id

    sub.plan = targetPlanKey
    sub.planId = targetPlanDoc?._id || sub.planId
    sub.status = targetPlanKey === "free" ? "expired" : "active"
    sub.downgradeToPlan = null
    sub.cancelScheduled = false
    sub.cancelAtPeriodEnd = false
    sub.cancelEffectiveAt = null
    sub.gracePeriodStart = null
    sub.gracePeriodEnd = null
    sub.download_limit = targetPlan.features.downloadLimitPerDay
    sub.lastLifecycleProcessedAt = new Date()
    await sub.save()

    // Synchronize download quota immediately
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

    // Audit logs
    await SubscriptionHistory.create({
      userId: sub.userId,
      subscriptionId: sub._id,
      previousPlanId: sub.planId,
      newPlanId: resolvedPlanId,
      action: "subscription_expired",
      reason: `${reason}. Transitioned from ${previousPlan.toUpperCase()} to ${sub.plan.toUpperCase()}.`,
      metadata: {
        previousPlan,
        downgradedTo: sub.plan,
        expiredAt: new Date(),
      },
    }).catch((err) => logger.warn("Error logging expiry history:", err.message))

    if (targetPlanKey === "free") {
      await SubscriptionHistory.create({
        userId: sub.userId,
        subscriptionId: sub._id,
        newPlanId: resolvedPlanId,
        action: "downgraded_to_free",
        reason: "Automatic downgrade to Free tier after expiration.",
      }).catch(() => {})
    }

    downloadAuditService.logEvent(DownloadEvents.SUBSCRIPTION_EXPIRED, {
      userId: sub.userId,
      plan: previousPlan,
      reason: `Subscription period ended. Transitioned to ${sub.plan.toUpperCase()}.`,
    })

    // Send in-app notification
    const prevPlanConfig = getSubscriptionPlan(previousPlan)
    await subscriptionNotificationService.notifySubscriptionExpired({
      userId: sub.userId,
      planName: prevPlanConfig.name,
    })

    return sub
  }

  /**
   * Convenience wrapper to downgrade a specific user to Free.
   */
  async downgradeToFree(userId, reason = "Manual or administrative downgrade to Free") {
    const sub = await Subscription.findOne({
      $or: [{ userId }, { user_id: userId }],
    })
    if (!sub) return null
    return this.expireSubscription(sub, { reason })
  }

  /**
   * Sends an expiry reminder if not already sent for the specified days remaining.
   */
  async sendExpiryReminder(sub, daysRemaining) {
    if (!sub || sub.plan === "free") return { sent: false, reason: "FREE_PLAN" }

    const key = String(daysRemaining)
    const remindersSent = sub.remindersSent || {}

    if (remindersSent[key]) {
      return { sent: false, reason: "ALREADY_SENT" }
    }

    const planConfig = getSubscriptionPlan(sub.plan)
    await subscriptionNotificationService.notifyExpiryReminder({
      userId: sub.userId,
      planName: planConfig.name,
      daysRemaining,
      expiryDate: sub.expiresAt,
    })

    // Update reminder tracking map
    sub.remindersSent = {
      ...remindersSent,
      [key]: true,
    }
    await sub.save()

    await SubscriptionHistory.create({
      userId: sub.userId,
      subscriptionId: sub._id,
      newPlanId: sub.planId,
      action: "expiry_reminder_sent",
      reason: `Automatic ${daysRemaining}-day expiry reminder dispatched to user.`,
      metadata: {
        daysRemaining,
        plan: sub.plan,
        expiryDate: sub.expiresAt,
      },
    }).catch(() => {})

    return { sent: true, daysRemaining }
  }

  /**
   * Master background lifecycle processing sweep.
   * Checks expired subscriptions, grace period transitions, and sends upcoming expiry reminders.
   */
  async processSubscriptionLifecycle({ gracePeriodDays = 0, reminderDays = [7, 3, 1, 0] } = {}) {
    const now = new Date()
    const stats = {
      processed: 0,
      expired: 0,
      gracePeriodEntered: 0,
      remindersDispatched: 0,
      errors: 0,
    }

    // Find all paid subscriptions in an active, cancel_scheduled, expiring_soon, or grace_period state
    const candidates = await Subscription.find({
      plan: { $ne: "free" },
      status: { $in: ["active", "cancel_scheduled", "expiring_soon", "grace_period"] },
    })

    stats.processed = candidates.length

    for (const sub of candidates) {
      try {
        if (!sub.expiresAt) continue

        const expiry = new Date(sub.expiresAt)
        const msRemaining = expiry.getTime() - now.getTime()
        const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24))

        // 1. Subscription has reached or passed its expiration date
        if (now >= expiry) {
          if (gracePeriodDays > 0 && sub.status !== "grace_period") {
            // Enter Grace Period
            const graceEnd = new Date(expiry.getTime() + gracePeriodDays * 24 * 60 * 60 * 1000)
            sub.status = "grace_period"
            sub.gracePeriodStart = now
            sub.gracePeriodEnd = graceEnd
            await sub.save()

            await SubscriptionHistory.create({
              userId: sub.userId,
              subscriptionId: sub._id,
              newPlanId: sub.planId,
              action: "grace_period_started",
              reason: `Entered ${gracePeriodDays}-day grace period until ${graceEnd.toISOString()}`,
              metadata: { gracePeriodEnd: graceEnd },
            }).catch(() => {})

            const planConfig = getSubscriptionPlan(sub.plan)
            await subscriptionNotificationService.notifyGracePeriodStarted({
              userId: sub.userId,
              planName: planConfig.name,
              graceEndDate: graceEnd,
            })

            stats.gracePeriodEntered++
          } else if (sub.status === "grace_period" && sub.gracePeriodEnd && now < new Date(sub.gracePeriodEnd)) {
            // Still safely inside grace period window
            continue
          } else {
            // Expire immediately and transition to Free
            await this.expireSubscription(sub, {
              reason: sub.cancelScheduled
                ? "Scheduled cancellation effective date reached"
                : "Subscription validity concluded",
            })
            stats.expired++
          }
        } else {
          // 2. Subscription is still active: evaluate reminder stages
          for (const targetDay of reminderDays) {
            if (daysRemaining === targetDay) {
              const res = await this.sendExpiryReminder(sub, targetDay)
              if (res.sent) stats.remindersDispatched++
            }
          }
        }
      } catch (subErr) {
        stats.errors++
        logger.error(`Error processing lifecycle for subscription ${sub._id}:`, subErr)
      }
    }

    return stats
  }

  /**
   * Renews or extends an active subscription by given days.
   */
  async renewSubscription(userId, durationDays = 30) {
    const sub = await Subscription.findOne({
      $or: [{ userId }, { user_id: userId }],
    })

    if (!sub || sub.plan === "free") {
      throw ApiError.badRequest("CANNOT_RENEW_FREE", "Free plan cannot be renewed")
    }

    const currentExpiry = sub.expiresAt && new Date(sub.expiresAt) > new Date()
      ? new Date(sub.expiresAt)
      : new Date()

    const newExpiry = new Date(currentExpiry.getTime() + durationDays * 24 * 60 * 60 * 1000)
    sub.status = "active"
    sub.expiresAt = newExpiry
    sub.endDate = newExpiry
    sub.cancelScheduled = false
    sub.cancelAtPeriodEnd = false
    sub.autoRenew = true
    sub.remindersSent = {} // Reset reminder trackers for the new cycle
    await sub.save()

    await SubscriptionHistory.create({
      userId: sub.userId,
      subscriptionId: sub._id,
      newPlanId: sub.planId,
      action: "subscription_renewed",
      reason: `Subscription renewed and extended by ${durationDays} days.`,
      metadata: {
        newExpiry,
        durationDays,
      },
    }).catch(() => {})

    return {
      success: true,
      plan: sub.plan,
      expiresAt: newExpiry,
      message: `Subscription successfully extended until ${newExpiry.toLocaleDateString("en-IN")}.`,
    }
  }

  /**
   * Retrieves aggregated lifecycle statistics for admin monitoring.
   */
  async getLifecycleStatusSummary() {
    const now = new Date()
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)

    const [
      activeCount,
      cancelScheduledCount,
      gracePeriodCount,
      expiringSoonCount,
      expiredTodayCount,
    ] = await Promise.all([
      Subscription.countDocuments({ plan: { $ne: "free" }, status: "active" }),
      Subscription.countDocuments({ plan: { $ne: "free" }, status: "cancel_scheduled" }),
      Subscription.countDocuments({ status: "grace_period" }),
      Subscription.countDocuments({
        plan: { $ne: "free" },
        status: { $in: ["active", "cancel_scheduled"] },
        expiresAt: { $gt: now, $lte: threeDaysFromNow },
      }),
      Subscription.countDocuments({
        status: "expired",
        updatedAt: { $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) },
      }),
    ])

    return {
      activeSubscriptions: activeCount,
      cancelScheduled: cancelScheduledCount,
      gracePeriod: gracePeriodCount,
      expiringSoon: expiringSoonCount,
      expiredToday: expiredTodayCount,
      timestamp: now,
    }
  }
}

export const subscriptionLifecycleService = new SubscriptionLifecycleService()
export default subscriptionLifecycleService
