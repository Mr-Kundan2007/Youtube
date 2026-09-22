import Subscription from "../Modals/Subscription.js"
import { downloadConfig } from "../config/index.js"
import { ApiError } from "../utils/apiError.js"

/**
 * Service managing user subscriptions, plan configurations, and download entitlement resolution.
 */
export class SubscriptionService {
  /**
   * Retrieves or provisions the user's subscription record.
   */
  async getUserSubscription(userId) {
    if (!userId) {
      throw ApiError.badRequest("USER_ID_REQUIRED", "User ID is required to resolve subscription")
    }

    const now = new Date()
    let sub = await Subscription.findOne({ userId })

    if (!sub) {
      try {
        const freeConfig = downloadConfig.plans.free || {}
        sub = await Subscription.create({
          userId,
          plan: "free",
          status: "active",
          startDate: now,
          endDate: null,
          expiresAt: null,
          download_limit: freeConfig.quotaLimit || 1,
          download_quota_type: freeConfig.quotaType || "daily",
          download_enabled: freeConfig.downloadEnabled !== false,
          max_download_devices: freeConfig.maxDevices || 1,
        })
      } catch (err) {
        sub = await Subscription.findOne({ userId })
      }
    }

    // Check if paid subscription has expired
    if (sub && sub.plan !== "free" && sub.expiresAt && new Date(sub.expiresAt) < now) {
      if (sub.status !== "expired") {
        sub.status = "expired"
        await sub.save()
      }
    }

    return sub
  }

  /**
   * Validates if a subscription is currently active and eligible for plan privileges.
   */
  validateSubscriptionState(sub) {
    const now = new Date()

    if (!sub) {
      return {
        isValid: true,
        effectivePlan: "free",
        isExpired: false,
        reason: null,
      }
    }

    // Free plan never expires
    if (sub.plan === "free") {
      return {
        isValid: true,
        effectivePlan: "free",
        isExpired: false,
        reason: null,
      }
    }

    // Check expiration on paid plans
    if (sub.expiresAt && new Date(sub.expiresAt) < now) {
      return {
        isValid: false,
        effectivePlan: "free", // Fallback to free plan
        isExpired: true,
        reason: "Your subscription has expired. Upgrade or renew your plan to continue downloading.",
      }
    }

    if (sub.status !== "active") {
      return {
        isValid: false,
        effectivePlan: "free",
        isExpired: false,
        reason: `Subscription is currently ${sub.status}. Please check your billing status.`,
      }
    }

    return {
      isValid: true,
      effectivePlan: sub.plan,
      isExpired: false,
      reason: null,
    }
  }

  /**
   * Returns plan configuration details from central config.
   */
  getPlanDetails(planKey) {
    const normalizedKey = (planKey || "free").toLowerCase()
    return downloadConfig.plans[normalizedKey] || downloadConfig.plans.free
  }

  /**
   * Resolves the comprehensive download entitlement for a given user.
   */
  async getUserDownloadEntitlement(userId) {
    const sub = await this.getUserSubscription(userId)
    const validation = this.validateSubscriptionState(sub)
    const planConfig = this.getPlanDetails(validation.effectivePlan)

    // Merge central plan configuration with optional subscription-level custom snapshots/overrides
    const quotaLimit =
      sub.download_limit !== null && sub.download_limit !== undefined
        ? sub.download_limit
        : planConfig.quotaLimit
    const quotaType = sub.download_quota_type || planConfig.quotaType || "daily"
    const downloadEnabled =
      sub.download_enabled !== null && sub.download_enabled !== undefined
        ? sub.download_enabled
        : planConfig.downloadEnabled !== false
    const maxDevices =
      sub.max_download_devices !== null && sub.max_download_devices !== undefined
        ? sub.max_download_devices
        : planConfig.maxDevices || 1

    const canDownload =
      downloadEnabled &&
      !validation.isExpired &&
      (sub.status === "active" || validation.effectivePlan === "free")

    return {
      userId: String(userId),
      subscriptionId: sub._id,
      plan: validation.effectivePlan,
      rawPlan: sub.plan,
      status: sub.status,
      isExpired: validation.isExpired,
      downloadEnabled,
      quotaLimit,
      quotaType,
      resetPeriod: planConfig.resetPeriod || "daily",
      maxDevices,
      maxQuality: planConfig.maxQuality || "1080p",
      duplicateWindowHours: planConfig.duplicateWindowHours || 24,
      price: planConfig.price,
      expiresAt: sub.expiresAt,
      canDownload,
      reason: validation.reason,
    }
  }

  /**
   * Upgrades or updates a user's subscription.
   */
  async upgradeSubscription(userId, planKey, durationDays = 30) {
    const normalizedKey = (planKey || "free").toLowerCase()
    if (!downloadConfig.plans[normalizedKey]) {
      throw ApiError.badRequest("INVALID_PLAN", `Unknown subscription plan: ${planKey}`)
    }

    const planConfig = downloadConfig.plans[normalizedKey]
    const now = new Date()
    const expiresAt =
      normalizedKey === "free"
        ? null
        : new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000)

    const sub = await Subscription.findOneAndUpdate(
      { userId },
      {
        plan: normalizedKey,
        status: "active",
        startDate: now,
        endDate: expiresAt,
        expiresAt,
        download_limit: planConfig.quotaLimit,
        download_quota_type: planConfig.quotaType,
        download_enabled: planConfig.downloadEnabled,
        max_download_devices: planConfig.maxDevices,
      },
      { upsert: true, new: true }
    )

    return sub
  }

  /**
   * Cancels an active user subscription.
   */
  async cancelSubscription(userId) {
    const sub = await this.getUserSubscription(userId)
    if (!sub || sub.plan === "free") {
      throw ApiError.badRequest("CANNOT_CANCEL_FREE", "Free plan cannot be cancelled")
    }

    sub.status = "cancelled"
    await sub.save()
    return sub
  }

  /**
   * Renews or extends an existing subscription.
   */
  async renewSubscription(userId, durationDays = 30) {
    const sub = await this.getUserSubscription(userId)
    if (!sub || sub.plan === "free") {
      throw ApiError.badRequest("CANNOT_RENEW_FREE", "Free plan does not require renewal")
    }

    const now = new Date()
    const baseDate = sub.expiresAt && new Date(sub.expiresAt) > now ? new Date(sub.expiresAt) : now
    const newExpiresAt = new Date(baseDate.getTime() + durationDays * 24 * 60 * 60 * 1000)

    sub.status = "active"
    sub.expiresAt = newExpiresAt
    sub.endDate = newExpiresAt
    await sub.save()
    return sub
  }

  /**
   * Returns all available subscription plans with pricing and download allowances.
   */
  getAvailablePlans() {
    return Object.values(downloadConfig.plans).map((plan) => ({
      ...plan,
      features: [
        `${plan.quotaLimit} ${plan.quotaType === "daily" ? "Daily" : "Monthly"} video downloads`,
        `Up to ${plan.maxQuality || "1080p"} download quality`,
        `Registered device allowance: up to ${plan.maxDevices || 1} ${plan.maxDevices === 1 ? "device" : "devices"}`,
        "Unlimited high-speed streaming",
        plan.planKey !== "free" ? "Priority bandwidth & fast downloads" : "Standard download speed",
        plan.planKey === "gold" ? "Offline multi-device archive" : "Standard offline viewing",
      ],
    }))
  }

  // -------------------------------------------------------------
  // Centralized Feature & Permission Checking Methods
  // -------------------------------------------------------------

  async canAccessPremiumVideo(userId) {
    const { subscriptionModuleService } = await import("../modules/subscription/subscription.service.js")
    return subscriptionModuleService.canAccessPremiumVideo(userId)
  }

  async canAccessPremiumCourse(userId) {
    const { subscriptionModuleService } = await import("../modules/subscription/subscription.service.js")
    return subscriptionModuleService.canAccessPremiumCourse(userId)
  }

  async canDownloadVideo(userId) {
    const { subscriptionModuleService } = await import("../modules/subscription/subscription.service.js")
    return subscriptionModuleService.canDownloadVideo(userId)
  }

  async canAccessOfflineDownload(userId) {
    const { subscriptionModuleService } = await import("../modules/subscription/subscription.service.js")
    return subscriptionModuleService.canAccessOfflineDownload(userId)
  }

  async canUseAdFreeExperience(userId) {
    const { subscriptionModuleService } = await import("../modules/subscription/subscription.service.js")
    return subscriptionModuleService.canUseAdFreeExperience(userId)
  }

  async canAccessPriorityContent(userId) {
    const { subscriptionModuleService } = await import("../modules/subscription/subscription.service.js")
    return subscriptionModuleService.canAccessPriorityContent(userId)
  }

  async getStreamingQuality(userId) {
    const { subscriptionModuleService } = await import("../modules/subscription/subscription.service.js")
    return subscriptionModuleService.getStreamingQuality(userId)
  }

  async getDailyDownloadLimit(userId) {
    const { subscriptionModuleService } = await import("../modules/subscription/subscription.service.js")
    return subscriptionModuleService.getDailyDownloadLimit(userId)
  }

  async getDailyWatchTimeLimit(userId) {
    const { subscriptionModuleService } = await import("../modules/subscription/subscription.service.js")
    return subscriptionModuleService.getDailyWatchTimeLimit(userId)
  }

  async getMaxConcurrentStreams(userId) {
    const { subscriptionModuleService } = await import("../modules/subscription/subscription.service.js")
    return subscriptionModuleService.getMaxConcurrentStreams(userId)
  }

  async getUserSubscriptionDetails(userId) {
    const { subscriptionModuleService } = await import("../modules/subscription/subscription.service.js")
    return subscriptionModuleService.getCurrentSubscriptionDetails(userId)
  }
}

export const subscriptionService = new SubscriptionService()
export default subscriptionService
