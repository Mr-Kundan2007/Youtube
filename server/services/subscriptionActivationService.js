import Subscription from "../Modals/Subscription.js"
import SubscriptionPlan from "../Modals/SubscriptionPlan.js"
import SubscriptionHistory from "../Modals/SubscriptionHistory.js"
import DownloadQuota from "../Modals/DownloadQuota.js"
import {
  PLAN_CONFIGURATIONS,
  PLAN_HIERARCHY,
  BILLING_CYCLES,
} from "../config/subscriptionConfig.js"
import { getSubscriptionPlan } from "../config/subscriptionPlans.js"
import downloadAuditService, { DownloadEvents } from "./downloadAuditService.js"
import { quotaService } from "./quotaService.js"
import { logger } from "../utils/logger.js"

export class SubscriptionActivationService {
  /**
   * Activates, upgrades, or renews a user's subscription, calculates authoritative validity,
   * creates immutable subscription history, and synchronizes feature and download allowances.
   */
  async activateSubscription({
    userId,
    planKey,
    planId = null,
    billingCycle = "monthly",
    validityType,
    paymentId = "",
    transactionId = null,
    amountPaid = 0,
    actionType = "new_subscription",
    customerName = "",
    customerEmail = "",
  }) {
    const normalizedPlanKey = String(planKey || "bronze").toLowerCase()

    // 1. Resolve Plan Definition from Database or Centralized Config
    let planModel = null
    if (planId) {
      planModel = await SubscriptionPlan.findById(planId).lean().catch(() => null)
    }
    if (!planModel) {
      planModel = await SubscriptionPlan.findOne({ slug: normalizedPlanKey }).lean().catch(() => null)
    }

    const legacyPlan = getSubscriptionPlan(normalizedPlanKey)
    const configPlan = PLAN_CONFIGURATIONS[normalizedPlanKey] || {}
    const planName = planModel?.name || configPlan.name || legacyPlan?.name || "Subscription"

    // 2. Authoritative Validity Calculation
    let cycle = (validityType || billingCycle || "monthly").toLowerCase()
    if (cycle === "annual") cycle = "yearly"
    const cycleConfig = BILLING_CYCLES[cycle] || BILLING_CYCLES.monthly
    const durationDays = cycleConfig.durationDays || (cycle === "yearly" ? 365 : cycle === "quarterly" ? 90 : 30)

    const now = new Date()

    // 3. Find or create user subscription record
    let sub = await Subscription.findOne({
      $or: [{ userId }, { user_id: userId }],
    })

    if (!sub) {
      sub = new Subscription({
        userId,
        user_id: userId,
      })
    }

    // 4. Determine lifecycle action (Renewal vs Upgrade vs New Subscription)
    const previousPlan = (sub.plan || "free").toLowerCase()
    const previousPlanId = sub.planId || null
    const isCurrentlyActive =
      sub.status === "active" && sub.expiresAt && new Date(sub.expiresAt) > now

    let resolvedAction = "subscription_activated"
    let startDate = now
    let expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000)

    if (actionType === "renew" || (isCurrentlyActive && previousPlan === normalizedPlanKey)) {
      resolvedAction = "subscription_renewed"
      startDate = sub.startDate || now
      const baseExpiry = sub.expiresAt && new Date(sub.expiresAt) > now ? new Date(sub.expiresAt) : now
      expiresAt = new Date(baseExpiry.getTime() + durationDays * 24 * 60 * 60 * 1000)
    } else if (previousPlan !== "free" && previousPlan !== normalizedPlanKey) {
      resolvedAction = "plan_upgraded"
      startDate = now
      expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000)
    } else {
      resolvedAction = "subscription_activated"
      startDate = now
      expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000)
    }

    // 5. Update Subscription Model Attributes
    sub.plan = normalizedPlanKey
    sub.planId = planModel?._id || sub.planId || null
    sub.previousPlanId = previousPlanId
    sub.status = "active"
    sub.startDate = startDate
    sub.endDate = expiresAt
    sub.expiresAt = expiresAt
    sub.expiryDate = expiresAt
    sub.autoRenew = true
    sub.cancelAtPeriodEnd = false
    sub.downgradeToPlan = null
    sub.billingCycle = cycle
    sub.validityType = cycle
    sub.lastTransactionId = transactionId ? String(transactionId) : sub.lastTransactionId
    sub.paymentId = paymentId || sub.paymentId || ""
    sub.paymentGateway = "razorpay"
    sub.amountPaid = amountPaid
    sub.lastBillingDate = now
    sub.nextBillingDate = expiresAt
    sub.nextRenewalDate = expiresAt

    // Configure snapshot entitlement allowances
    const dailyDownloadLimit =
      planModel?.limits?.dailyDownloadLimit ||
      configPlan.dailyDownloads ||
      legacyPlan?.features?.downloadLimitPerDay ||
      5
    const maxDevices =
      planModel?.limits?.maxDevices ||
      configPlan.concurrentStreams ||
      legacyPlan?.features?.maxDevices ||
      2

    sub.download_limit = dailyDownloadLimit
    sub.download_quota_type = "daily"
    sub.download_enabled = true
    sub.max_download_devices = maxDevices

    await sub.save()

    // 6. Record Immutable Subscription History Record
    try {
      await SubscriptionHistory.create({
        userId,
        subscriptionId: sub._id,
        previousPlanId: previousPlanId || null,
        newPlanId: planModel?._id || sub.planId || sub._id,
        action: resolvedAction,
        reason: `Subscription ${resolvedAction.replace(/_/g, " ")} via Razorpay (${cycle})`,
        performedAt: now,
        metadata: {
          previousPlan,
          newPlan: normalizedPlanKey,
          billingCycle: cycle,
          validityType: cycle,
          amountPaid,
          paymentId,
          transactionId: transactionId ? String(transactionId) : null,
          startDate,
          expiresAt,
        },
      })
    } catch (histErr) {
      logger.warn("SubscriptionHistory creation notice:", histErr.message)
    }

    // 7. Synchronize active download quota record immediately
    try {
      const quota = await quotaService.getActiveQuotaRecord(userId, normalizedPlanKey)
      if (quota) {
        quota.plan = normalizedPlanKey
        quota.subscription_plan = normalizedPlanKey
        quota.quota_limit = dailyDownloadLimit
        quota.quota_remaining = Math.max(0, dailyDownloadLimit - (quota.quota_used || 0))
        await quota.save()
      }
    } catch (e) {
      logger.warn("Quota synchronization note on activation:", e.message)
    }

    // 8. Log audit event
    downloadAuditService.logEvent(DownloadEvents.SUBSCRIPTION_ACTIVATED, {
      userId,
      plan: normalizedPlanKey,
      reason: `Plan ${resolvedAction} via Razorpay (${cycle})`,
      metadata: {
        paymentId,
        transactionId,
        expiresAt,
        amountPaid,
      },
    })

    logger.info(
      `Subscription ${resolvedAction} for user ${userId}: ${previousPlan} -> ${normalizedPlanKey} (Valid until ${expiresAt.toISOString()})`
    )

    return {
      success: true,
      subscription: sub,
      plan: normalizedPlanKey,
      planName,
      startDate,
      expiresAt,
      billingCycle: cycle,
      action: resolvedAction,
    }
  }
}

export const subscriptionActivationService = new SubscriptionActivationService()
export default subscriptionActivationService
