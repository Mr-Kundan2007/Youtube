import mongoose from "mongoose"
import SubscriptionPlan from "../../Modals/SubscriptionPlan.js"
import Subscription from "../../Modals/Subscription.js"
import SubscriptionHistory from "../../Modals/SubscriptionHistory.js"
import User from "../../Modals/Auth.js"
import {
  calculateRemainingDays,
  isSubscriptionActive,
  isSubscriptionExpired,
  getSubscriptionFeatures,
  getSubscriptionLimits,
} from "../../utils/subscriptionUtils.js"
import { logger } from "../../utils/logger.js"
import { seedSubscriptionPlans, DEFAULT_PLANS } from "./subscription.seed.js"
import {
  calculatePlanPricing,
  BILLING_CYCLES,
  PLAN_HIERARCHY,
} from "../../config/subscriptionConfig.js"

export class SubscriptionModuleService {
  /**
   * Internal helper to enrich raw plan documents with calculated multi-cycle pricing, rank, and benefits.
   *
   * @param {object} plan
   * @returns {object}
   */
  _enrichPlanWithPricing(plan) {
    if (!plan) return null
    const monthlyPrice = Number(plan.price) || 0
    const slug = String(plan.slug || "").toLowerCase()
    const rank = PLAN_HIERARCHY[slug] || plan.displayOrder || 1

    const billingCycles = {
      monthly: calculatePlanPricing(monthlyPrice, "monthly"),
      quarterly: calculatePlanPricing(monthlyPrice, "quarterly"),
      yearly: calculatePlanPricing(monthlyPrice, "yearly"),
    }

    const summaryBenefits = []
    if (slug === "free") {
      summaryBenefits.push("Standard public video access")
      summaryBenefits.push("Standard 720p HD streaming")
      summaryBenefits.push("1 daily offline video download")
      summaryBenefits.push("Single active device stream")
    } else if (slug === "bronze") {
      summaryBenefits.push("Premium video library access")
      summaryBenefits.push("Crisp 1080p Full HD streaming")
      summaryBenefits.push("5 daily offline video downloads")
      summaryBenefits.push("2 registered devices")
    } else if (slug === "silver") {
      summaryBenefits.push("Full premium video & course catalog")
      summaryBenefits.push("Ad-Free uninterrupted viewing")
      summaryBenefits.push("2K 1440p Quad HD streaming")
      summaryBenefits.push("15 daily offline video downloads")
      summaryBenefits.push("Priority fast streaming servers")
    } else if (slug === "gold") {
      summaryBenefits.push("All-Access VIP pass & exclusive masterclasses")
      summaryBenefits.push("Cinematic 4K Ultra HD HDR streaming")
      summaryBenefits.push("50 daily offline video downloads")
      summaryBenefits.push("Ad-Free across 5 concurrent screens")
      summaryBenefits.push("Dedicated VIP priority customer support")
    }

    return {
      ...plan,
      rank,
      billingCycles,
      summaryBenefits,
    }
  }

  /**
   * Retrieves all subscription plans.
   *
   * @param {boolean} activeOnly
   * @returns {Promise<Array>}
   */
  async getAllPlans(activeOnly = true) {
    try {
      if (mongoose.connection.readyState === 1) {
        // Ensure default plans are present if collection is empty
        const count = await SubscriptionPlan.countDocuments().catch(() => 0)
        if (count === 0) {
          await seedSubscriptionPlans().catch(() => {})
        }

        const query = activeOnly ? { isActive: true } : {}
        const plans = await SubscriptionPlan.find(query).sort({ displayOrder: 1 }).lean()
        if (plans && plans.length > 0) {
          return plans.map((p) => this._enrichPlanWithPricing(p))
        }
      }
    } catch (err) {
      logger.warn("Database unavailable for live plans query, using offline fallback", err)
    }

    const basePlans = activeOnly ? DEFAULT_PLANS.filter((p) => p.isActive) : DEFAULT_PLANS
    return basePlans.map((p) =>
      this._enrichPlanWithPricing({
        ...p,
        _id: `static-plan-${p.slug}`,
        id: `static-plan-${p.slug}`,
      })
    )
  }

  /**
   * Retrieves a single plan by ObjectId, slug, or planKey.
   *
   * @param {string} identifier
   * @returns {Promise<object|null>}
   */
  async getPlanByIdOrSlug(identifier) {
    if (!identifier) return null

    try {
      if (mongoose.connection.readyState === 1) {
        let plan = null
        if (mongoose.Types.ObjectId.isValid(identifier)) {
          plan = await SubscriptionPlan.findById(identifier).lean()
        }

        if (!plan) {
          const lower = String(identifier).toLowerCase()
          plan = await SubscriptionPlan.findOne({ slug: lower }).lean()
        }

        if (plan) return this._enrichPlanWithPricing(plan)
      }
    } catch (err) {
      logger.warn("Database query failed in getPlanByIdOrSlug, using offline fallback", err)
    }

    const lower = String(identifier).toLowerCase()
    const staticPlan = DEFAULT_PLANS.find((p) => p.slug === lower) || DEFAULT_PLANS[0]
    return this._enrichPlanWithPricing({
      ...staticPlan,
      _id: `static-plan-${staticPlan.slug}`,
      id: `static-plan-${staticPlan.slug}`,
    })
  }


  /**
   * Finds or creates a default Free subscription for a user.
   *
   * @param {string|mongoose.Types.ObjectId} userId
   * @returns {Promise<object>}
   */
  async getOrCreateUserSubscription(userId) {
    let sub = await Subscription.findOne({
      $or: [{ userId }, { user_id: userId }],
    }).populate("planId")

    if (!sub) {
      // Find the Free plan
      let freePlan = await SubscriptionPlan.findOne({ slug: "free" })
      if (!freePlan) {
        await seedSubscriptionPlans()
        freePlan = await SubscriptionPlan.findOne({ slug: "free" })
      }

      sub = await Subscription.create({
        userId,
        user_id: userId,
        planId: freePlan?._id || null,
        plan: "free",
        status: "active",
        startDate: new Date(),
        endDate: null,
        expiresAt: null,
        expiryDate: null,
        autoRenew: false,
        billingCycle: "lifetime",
        amountPaid: 0,
        currency: "INR",
        download_limit: freePlan?.limits?.dailyDownloadLimit || 1,
        download_quota_type: "daily",
        download_enabled: true,
        max_download_devices: freePlan?.limits?.maxDevices || 1,
      })

      // Log subscription creation in history
      if (freePlan) {
        await this.logHistory({
          userId,
          subscriptionId: sub._id,
          newPlanId: freePlan._id,
          action: "subscription_created",
          reason: "Default Free subscription initialized",
        })
      }

      sub = await Subscription.findById(sub._id).populate("planId")
    }

    // Link planId if legacy subscription record was created without planId
    if (!sub.planId && sub.plan) {
      const matchedPlan = await SubscriptionPlan.findOne({ slug: sub.plan.toLowerCase() })
      if (matchedPlan) {
        sub.planId = matchedPlan._id
        await sub.save()
        sub = await Subscription.findById(sub._id).populate("planId")
      }
    }

    return sub
  }

  /**
   * Formats the complete user subscription details with calculated fields.
   *
   * @param {string|mongoose.Types.ObjectId} userId
   * @returns {Promise<object>}
   */
  async getCurrentSubscriptionDetails(userId) {
    try {
      if (mongoose.connection.readyState === 1) {
        const sub = await this.getOrCreateUserSubscription(userId)
        const plan = sub.planId || (await this.getPlanByIdOrSlug(sub.plan || "free"))

        const expiry = sub.expiryDate || sub.expiresAt || sub.endDate
        const remainingDays = calculateRemainingDays(expiry)
        const isActive = isSubscriptionActive(sub)
        const isExpired = isSubscriptionExpired(sub)

        const features = getSubscriptionFeatures(plan)
        const limits = getSubscriptionLimits(plan)

        return {
          subscriptionId: sub._id,
          userId: sub.userId,
          currentPlan: {
            id: plan?._id || null,
            name: plan?.name || "Free",
            slug: plan?.slug || "free",
            description: plan?.description || "",
            price: plan?.price || 0,
            currency: plan?.currency || "INR",
            validityType: plan?.validityType || "lifetime",
          },
          status: isExpired && sub.status === "active" ? "expired" : sub.status,
          isActive,
          isExpired,
          startDate: sub.startDate,
          expiryDate: expiry,
          remainingDays,
          nextRenewalDate: sub.nextRenewalDate || sub.nextBillingDate,
          autoRenew: Boolean(sub.autoRenew),
          cancelAtPeriodEnd: Boolean(sub.cancelAtPeriodEnd || sub.cancelScheduled),
          cancelScheduled: Boolean(sub.cancelScheduled || sub.cancelAtPeriodEnd),
          cancelRequestedAt: sub.cancelRequestedAt || sub.cancelledAt || null,
          cancelEffectiveAt: sub.cancelEffectiveAt || (sub.cancelAtPeriodEnd ? expiry : null),
          cancellationReason: sub.cancellationReason || sub.cancelReason || null,
          cancelledAt: sub.cancelledAt || null,
          cancelReason: sub.cancelReason || sub.cancellationReason || null,
          gracePeriodActive: sub.status === "grace_period",
          gracePeriodEnd: sub.gracePeriodEnd || null,
          enabledFeatures: features,
          usageLimits: limits,
        }
      }
    } catch (err) {
      logger.warn("Database offline during subscription query, returning default free tier", err)
    }

    const freePlan = DEFAULT_PLANS[0]
    return {
      subscriptionId: "offline-sub-free",
      userId,
      currentPlan: {
        id: "static-plan-free",
        name: freePlan.name,
        slug: freePlan.slug,
        description: freePlan.description,
        price: freePlan.price,
        currency: freePlan.currency,
        validityType: freePlan.validityType,
      },
      status: "active",
      isActive: true,
      isExpired: false,
      startDate: new Date(),
      expiryDate: null,
      remainingDays: null,
      nextRenewalDate: null,
      autoRenew: false,
      cancelAtPeriodEnd: false,
      cancelScheduled: false,
      cancelRequestedAt: null,
      cancelEffectiveAt: null,
      cancellationReason: null,
      cancelledAt: null,
      cancelReason: null,
      gracePeriodActive: false,
      gracePeriodEnd: null,
      enabledFeatures: freePlan.features || getSubscriptionFeatures(freePlan),
      usageLimits: freePlan.limits || getSubscriptionLimits(freePlan),
    }
  }

  /**
   * Logs a subscription lifecycle audit entry.
   *
   * @param {object} params
   * @returns {Promise<object>}
   */
  async logHistory({
    userId,
    subscriptionId,
    previousPlanId = null,
    newPlanId,
    action,
    reason = "",
    metadata = {},
  }) {
    try {
      return await SubscriptionHistory.create({
        userId,
        subscriptionId,
        previousPlanId,
        newPlanId,
        action,
        reason,
        metadata,
        performedAt: new Date(),
      })
    } catch (err) {
      logger.warn("Failed to log subscription history:", err.message)
      return null
    }
  }

  /**
   * Retrieves subscription history logs for a user.
   *
   * @param {string|mongoose.Types.ObjectId} userId
   * @returns {Promise<Array>}
   */
  async getSubscriptionHistory(userId) {
    return SubscriptionHistory.find({ userId })
      .populate("previousPlanId", "name slug price")
      .populate("newPlanId", "name slug price")
      .sort({ performedAt: -1 })
      .lean()
  }

  /**
   * Resolves the comprehensive feature permissions for an authenticated user.
   *
   * @param {string|mongoose.Types.ObjectId} userId
   * @returns {Promise<object>}
   */
  async getUserFeatures(userId) {
    const details = await this.getCurrentSubscriptionDetails(userId)
    return {
      userId,
      plan: details.currentPlan.slug,
      planName: details.currentPlan.name,
      status: details.status,
      isActive: details.isActive,
      features: details.enabledFeatures,
      limits: details.usageLimits,
    }
  }

  // -------------------------------------------------------------
  // Centralized Feature & Permission Checking Methods
  // -------------------------------------------------------------

  async canAccessPremiumVideo(userId) {
    const details = await this.getCurrentSubscriptionDetails(userId)
    return details.isActive && Boolean(details.enabledFeatures.premiumVideoAccess)
  }

  async canAccessPremiumCourse(userId) {
    const details = await this.getCurrentSubscriptionDetails(userId)
    return details.isActive && Boolean(details.enabledFeatures.premiumCourses)
  }

  async canDownloadVideo(userId) {
    const details = await this.getCurrentSubscriptionDetails(userId)
    return details.isActive && (details.usageLimits.dailyDownloadLimit > 0)
  }

  async canAccessOfflineDownload(userId) {
    const details = await this.getCurrentSubscriptionDetails(userId)
    return details.isActive && Boolean(details.enabledFeatures.offlineDownloads)
  }

  async canUseAdFreeExperience(userId) {
    const details = await this.getCurrentSubscriptionDetails(userId)
    return details.isActive && Boolean(details.enabledFeatures.adFree)
  }

  async canAccessPriorityContent(userId) {
    const details = await this.getCurrentSubscriptionDetails(userId)
    return details.isActive && Boolean(details.enabledFeatures.priorityContent)
  }

  async getStreamingQuality(userId) {
    const details = await this.getCurrentSubscriptionDetails(userId)
    return details.isActive ? details.usageLimits.streamingQuality : "720p"
  }

  async getDailyDownloadLimit(userId) {
    const details = await this.getCurrentSubscriptionDetails(userId)
    return details.isActive ? details.usageLimits.dailyDownloadLimit : 1
  }

  async getDailyWatchTimeLimit(userId) {
    const details = await this.getCurrentSubscriptionDetails(userId)
    return details.isActive ? details.usageLimits.dailyWatchTime : 120
  }

  async getMaxConcurrentStreams(userId) {
    const details = await this.getCurrentSubscriptionDetails(userId)
    return details.isActive ? details.usageLimits.maxConcurrentStreams : 1
  }
}

export const subscriptionModuleService = new SubscriptionModuleService()
export default subscriptionModuleService
