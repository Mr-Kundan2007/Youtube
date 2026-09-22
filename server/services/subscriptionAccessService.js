import Subscription from "../Modals/Subscription.js"
import { getSubscriptionPlan, SUBSCRIPTION_TIERS } from "../config/subscriptionPlans.js"
import { ApiError } from "../utils/apiError.js"

const RESOLUTION_TIERS = {
  "360p": 1,
  "480p": 2,
  "720p": 3,
  "1080p": 4,
  "1440p": 5,
  "4k": 6,
  "2160p": 6,
}

export class SubscriptionAccessService {
  /**
   * Retrieves current active subscription for user with lazy-expiry evaluation.
   */
  async getUserActiveSubscription(userId) {
    if (!userId) return { plan: SUBSCRIPTION_TIERS.FREE, status: "active", isExpired: false }

    const sub = await Subscription.findOne({
      $or: [{ userId }, { user_id: userId }],
    }).lean()

    if (!sub) {
      return { plan: SUBSCRIPTION_TIERS.FREE, status: "active", isExpired: false }
    }

    const now = new Date()
    // If paid plan has passed its expiry date
    if (sub.plan !== SUBSCRIPTION_TIERS.FREE && sub.expiresAt && new Date(sub.expiresAt) < now) {
      return {
        ...sub,
        effectivePlan: SUBSCRIPTION_TIERS.FREE,
        isExpired: true,
        status: "expired",
      }
    }

    return {
      ...sub,
      effectivePlan: sub.plan || SUBSCRIPTION_TIERS.FREE,
      isExpired: false,
    }
  }

  /**
   * Evaluates if user can stream at the requested resolution.
   */
  async canStreamQuality(userId, requestedResolution = "720p") {
    const sub = await this.getUserActiveSubscription(userId)
    const planConfig = getSubscriptionPlan(sub.effectivePlan)
    const planMaxRes = planConfig.features.maxResolution || "720p"

    const requestedLevel = RESOLUTION_TIERS[String(requestedResolution).toLowerCase()] || 3
    const allowedLevel = RESOLUTION_TIERS[String(planMaxRes).toLowerCase()] || 3

    return {
      allowed: requestedLevel <= allowedLevel,
      maxAllowedResolution: planMaxRes,
      currentPlan: sub.effectivePlan,
      requestedResolution,
    }
  }

  /**
   * Returns whether playback is ad-free for the user.
   */
  async isAdFree(userId) {
    const sub = await this.getUserActiveSubscription(userId)
    const planConfig = getSubscriptionPlan(sub.effectivePlan)
    return Boolean(planConfig.features.adFree)
  }

  /**
   * Returns complete feature matrix and entitlement payload.
   */
  async getFeatureMatrix(userId) {
    const sub = await this.getUserActiveSubscription(userId)
    const planConfig = getSubscriptionPlan(sub.effectivePlan)

    return {
      planKey: sub.effectivePlan,
      planName: planConfig.name,
      status: sub.status,
      isExpired: sub.isExpired,
      expiresAt: sub.expiresAt || null,
      autoRenew: Boolean(sub.autoRenew && !sub.cancelAtPeriodEnd),
      cancelAtPeriodEnd: Boolean(sub.cancelAtPeriodEnd),
      features: planConfig.features,
      featureList: planConfig.featureList,
      pricing: planConfig.pricing,
    }
  }

  /**
   * Asserts user is on at least minPlanKey; throws ApiError otherwise.
   */
  async assertPlanAccess(userId, minPlanKey = "bronze") {
    const sub = await this.getUserActiveSubscription(userId)
    const hierarchy = { free: 0, bronze: 1, silver: 2, gold: 3 }
    const userRank = hierarchy[sub.effectivePlan] || 0
    const requiredRank = hierarchy[minPlanKey] || 1

    if (userRank < requiredRank) {
      const targetConfig = getSubscriptionPlan(minPlanKey)
      throw ApiError.forbidden(
        "PLAN_UPGRADE_REQUIRED",
        `This premium feature requires a ${targetConfig.name} plan or higher.`
      )
    }

    return sub
  }
}

export const subscriptionAccessService = new SubscriptionAccessService()
export default subscriptionAccessService
