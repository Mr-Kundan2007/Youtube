/**
 * Subscription Utilities
 * Reusable helper functions for date calculation, validity checks, and feature extraction.
 */

/**
 * Calculates the expiry date based on a start date and validity type or custom day duration.
 *
 * @param {Date|string|number} startDate - Starting timestamp
 * @param {string} validityType - 'monthly' | 'quarterly' | 'yearly' | 'lifetime'
 * @param {number|null} customDays - Explicit number of days override
 * @returns {Date|null} Expiry date, or null if lifetime
 */
export const calculateExpiryDate = (startDate = new Date(), validityType = "monthly", customDays = null) => {
  if (validityType === "lifetime") {
    return null
  }

  const start = new Date(startDate)
  if (isNaN(start.getTime())) {
    throw new Error("Invalid start date provided for expiry calculation")
  }

  if (typeof customDays === "number" && customDays > 0) {
    return new Date(start.getTime() + customDays * 86400000)
  }

  const result = new Date(start)

  switch (validityType) {
    case "quarterly":
      result.setMonth(result.getMonth() + 3)
      break
    case "yearly":
    case "annual":
      result.setFullYear(result.getFullYear() + 1)
      break
    case "monthly":
    default:
      result.setMonth(result.getMonth() + 1)
      break
  }

  return result
}

/**
 * Calculates the integer number of remaining days until subscription expiry.
 *
 * @param {Date|string|null} expiryDate
 * @param {Date} [referenceDate=new Date()]
 * @returns {number|null} Number of days remaining, 0 if expired, or null if lifetime
 */
export const calculateRemainingDays = (expiryDate, referenceDate = new Date()) => {
  if (!expiryDate) return null // Lifetime or never-expiring

  const expiry = new Date(expiryDate)
  if (isNaN(expiry.getTime())) return 0

  const diffMs = expiry.getTime() - referenceDate.getTime()
  if (diffMs <= 0) return 0

  return Math.ceil(diffMs / 86400000)
}

/**
 * Checks whether a given subscription is currently active and within its valid period.
 *
 * @param {object|null} subscription
 * @param {Date} [referenceDate=new Date()]
 * @returns {boolean}
 */
export const isSubscriptionActive = (subscription, referenceDate = new Date()) => {
  if (!subscription) return false

  const activeStatuses = ["active", "cancel_scheduled", "expiring_soon", "grace_period"]
  if (!activeStatuses.includes(subscription.status)) return false

  const expiry = subscription.expiryDate || subscription.expiresAt || subscription.endDate
  if (!expiry) return true // Lifetime/unlimited active

  // If in grace period, check gracePeriodEnd if present
  if (subscription.status === "grace_period" && subscription.gracePeriodEnd) {
    return new Date(subscription.gracePeriodEnd) > referenceDate
  }

  return new Date(expiry) > referenceDate
}

/**
 * Checks whether a given subscription has passed its expiry threshold.
 *
 * @param {object|null} subscription
 * @param {Date} [referenceDate=new Date()]
 * @returns {boolean}
 */
export const isSubscriptionExpired = (subscription, referenceDate = new Date()) => {
  if (!subscription) return true

  if (subscription.status === "expired") return true

  // If in grace period, not expired until gracePeriodEnd
  if (subscription.status === "grace_period" && subscription.gracePeriodEnd) {
    return new Date(subscription.gracePeriodEnd) <= referenceDate
  }

  const expiry = subscription.expiryDate || subscription.expiresAt || subscription.endDate
  if (!expiry) return false // Lifetime does not expire

  return new Date(expiry) <= referenceDate
}

/**
 * Extracts formatted feature flags from a subscription plan or raw configuration.
 *
 * @param {object} plan
 * @returns {object}
 */
export const getSubscriptionFeatures = (plan) => {
  if (!plan) {
    return {
      premiumVideoAccess: false,
      premiumCourses: false,
      priorityContent: false,
      adFree: false,
      offlineDownloads: false,
      fastStreaming: false,
      exclusiveContent: false,
    }
  }

  return {
    premiumVideoAccess: Boolean(plan.features?.premiumVideoAccess),
    premiumCourses: Boolean(plan.features?.premiumCourses),
    priorityContent: Boolean(plan.features?.priorityContent),
    adFree: Boolean(plan.features?.adFree),
    offlineDownloads: Boolean(plan.features?.offlineDownloads),
    fastStreaming: Boolean(plan.features?.fastStreaming),
    exclusiveContent: Boolean(plan.features?.exclusiveContent),
  }
}

/**
 * Extracts formatted usage limits from a subscription plan.
 *
 * @param {object} plan
 * @returns {object}
 */
export const getSubscriptionLimits = (plan) => {
  if (!plan) {
    return {
      streamingQuality: "720p",
      dailyWatchTime: null,
      dailyUsageLimit: null,
      dailyDownloadLimit: 1,
      maxDownloadQuality: "720p",
      maxDevices: 1,
      maxConcurrentStreams: 1,
    }
  }

  return {
    streamingQuality: plan.limits?.streamingQuality || "720p",
    dailyWatchTime: plan.limits?.dailyWatchTime ?? null,
    dailyUsageLimit: plan.limits?.dailyUsageLimit ?? null,
    dailyDownloadLimit: plan.limits?.dailyDownloadLimit ?? 1,
    maxDownloadQuality: plan.limits?.maxDownloadQuality || "720p",
    maxDevices: plan.limits?.maxDevices ?? 1,
    maxConcurrentStreams: plan.limits?.maxConcurrentStreams ?? 1,
  }
}

/**
 * Validates whether a user can switch or be assigned to a specific target plan.
 *
 * @param {object} user
 * @param {object} targetPlan
 * @returns {{ eligible: boolean, reason?: string }}
 */
export const validatePlanEligibility = (user, targetPlan) => {
  if (!user) {
    return { eligible: false, reason: "User must be authenticated" }
  }

  if (user.status === "blocked" || user.status === "suspended") {
    return { eligible: false, reason: "User account is suspended or blocked" }
  }

  if (!targetPlan) {
    return { eligible: false, reason: "Target subscription plan does not exist" }
  }

  if (!targetPlan.isActive) {
    return { eligible: false, reason: "Target subscription plan is currently inactive" }
  }

  return { eligible: true }
}
