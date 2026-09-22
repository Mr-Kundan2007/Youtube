/**
 * Centralized Subscription Configuration
 * Defines plan hierarchy, feature keys, limits, quality tiers, and permission comparison helpers.
 * Eliminates hardcoded plan checks across the application.
 */

export const PLAN_HIERARCHY = {
  free: 1,
  bronze: 2,
  silver: 3,
  gold: 4,
}

export const FEATURE_KEYS = {
  VIDEO_ACCESS: "video_access",
  PREMIUM_VIDEO_ACCESS: "premium_video_access",
  PREMIUM_COURSE_ACCESS: "premium_course_access",
  EXCLUSIVE_COURSE_ACCESS: "exclusive_course_access",
  EXCLUSIVE_CONTENT_ACCESS: "exclusive_content_access",
  PRIORITY_CONTENT_ACCESS: "priority_content_access",
  AD_FREE: "ad_free",
  OFFLINE_DOWNLOAD: "offline_download",
  FAST_STREAMING: "fast_streaming",
  PRIORITY_STREAMING: "priority_streaming",
  HIGH_QUALITY_STREAMING: "high_quality_streaming",
  UNLIMITED_WATCH_TIME: "unlimited_watch_time",
  DOWNLOAD_ACCESS: "download_access",
  MULTIPLE_DEVICES: "multiple_devices",
  CONCURRENT_STREAMING: "concurrent_streaming",
}

export const STREAMING_QUALITIES = ["360p", "480p", "720p", "1080p", "1440p", "4k"]

export const QUALITY_HIERARCHY = {
  "360p": 1,
  "480p": 2,
  "720p": 3,
  "1080p": 4,
  "1440p": 5,
  "4k": 6,
}

export const PLAN_MAX_QUALITY = {
  free: "480p",
  bronze: "720p",
  silver: "1080p",
  gold: "4k",
}

export const PLAN_MAX_CONCURRENT_STREAMS = {
  free: 1,
  bronze: 1,
  silver: 2,
  gold: 5,
}

export const PLAN_DAILY_WATCH_TIME_MINUTES = {
  free: 120, // 2 hours
  bronze: 360, // 6 hours
  silver: null, // Unlimited
  gold: null, // Unlimited
}

export const PLAN_CONFIGURATIONS = {
  free: {
    name: "Free",
    slug: "free",
    rank: 1,
    price: 0,
    currency: "INR",
    maxQuality: "480p",
    dailyWatchTimeMinutes: 120,
    dailyDownloads: 1,
    concurrentStreams: 1,
    adFree: false,
    offlineDownload: false,
    fastStreaming: false,
    priorityServers: false,
    exclusiveContent: false,
    premiumCourses: false,
    exclusiveCourses: false,
  },
  bronze: {
    name: "Bronze",
    slug: "bronze",
    rank: 2,
    price: 199,
    currency: "INR",
    maxQuality: "720p",
    dailyWatchTimeMinutes: 360,
    dailyDownloads: 5,
    concurrentStreams: 1,
    adFree: false,
    offlineDownload: true,
    fastStreaming: false,
    priorityServers: false,
    exclusiveContent: false,
    premiumCourses: false,
    exclusiveCourses: false,
  },
  silver: {
    name: "Silver",
    slug: "silver",
    rank: 3,
    price: 499,
    currency: "INR",
    maxQuality: "1080p",
    dailyWatchTimeMinutes: null,
    dailyDownloads: 15,
    concurrentStreams: 2,
    adFree: true,
    offlineDownload: true,
    fastStreaming: true,
    priorityServers: true,
    exclusiveContent: false,
    premiumCourses: true,
    exclusiveCourses: false,
  },
  gold: {
    name: "Gold",
    slug: "gold",
    rank: 4,
    price: 999,
    currency: "INR",
    maxQuality: "4k",
    dailyWatchTimeMinutes: null,
    dailyDownloads: 50,
    concurrentStreams: 5,
    adFree: true,
    offlineDownload: true,
    fastStreaming: true,
    priorityServers: true,
    exclusiveContent: true,
    premiumCourses: true,
    exclusiveCourses: true,
  },
}

/**
 * Checks if a user's subscription plan meets or exceeds the required content tier.
 * Higher plans automatically inherit access to lower-tier content.
 *
 * @param {string} userPlanSlug - e.g. "silver"
 * @param {string} requiredPlanSlug - e.g. "bronze"
 * @returns {boolean}
 */
export const canAccessPlanContent = (userPlanSlug = "free", requiredPlanSlug = "free") => {
  const userRank = PLAN_HIERARCHY[String(userPlanSlug).toLowerCase()] || 1
  const requiredRank = PLAN_HIERARCHY[String(requiredPlanSlug).toLowerCase()] || 1
  return userRank >= requiredRank
}

/**
 * Validates if the requested streaming quality is permitted for the user's plan.
 *
 * @param {string} userPlanSlug
 * @param {string} requestedQuality - e.g. "1080p"
 * @returns {{ allowed: boolean, maxAllowed: string }}
 */
export const isQualityAllowed = (userPlanSlug = "free", requestedQuality = "480p") => {
  const maxAllowed = PLAN_MAX_QUALITY[String(userPlanSlug).toLowerCase()] || "480p"
  const requestedRank = QUALITY_HIERARCHY[String(requestedQuality).toLowerCase()] || 1
  const allowedRank = QUALITY_HIERARCHY[maxAllowed] || 2
  return {
    allowed: requestedRank <= allowedRank,
    maxAllowed,
  }
}

/**
 * Supported billing periods with authoritative backend discount rates.
 */
export const BILLING_CYCLES = {
  monthly: {
    key: "monthly",
    label: "Monthly",
    durationMonths: 1,
    durationDays: 30,
    discountPercent: 0,
    badge: null,
    savingsText: null,
  },
  quarterly: {
    key: "quarterly",
    label: "Quarterly",
    durationMonths: 3,
    durationDays: 90,
    discountPercent: 10,
    badge: "Save 10%",
    savingsText: "Save 10%",
  },
  yearly: {
    key: "yearly",
    label: "Yearly",
    durationMonths: 12,
    durationDays: 365,
    discountPercent: 20,
    badge: "Save 20%",
    savingsText: "Save 20%",
  },
}

/**
 * Calculates authoritative plan pricing, duration, savings, and monthly-equivalent cost for any billing cycle.
 *
 * @param {number} baseMonthlyPrice
 * @param {string} cycle - "monthly" | "quarterly" | "yearly"
 * @returns {object}
 */
export const calculatePlanPricing = (baseMonthlyPrice, cycle = "monthly") => {
  const numericPrice = Number(baseMonthlyPrice) || 0
  const cycleConfig = BILLING_CYCLES[cycle] || BILLING_CYCLES.monthly

  if (numericPrice <= 0) {
    return {
      cycle: cycleConfig.key,
      price: 0,
      baseTotal: 0,
      monthlyEquivalent: 0,
      discountPercent: 0,
      savings: 0,
      durationMonths: cycleConfig.durationMonths,
      durationDays: null,
      savingsText: null,
    }
  }

  const rawTotal = numericPrice * cycleConfig.durationMonths
  const discountMultiplier = (100 - cycleConfig.discountPercent) / 100
  const finalPrice = Math.round(rawTotal * discountMultiplier)
  const savings = rawTotal - finalPrice
  const monthlyEquivalent = Math.round(finalPrice / cycleConfig.durationMonths)

  return {
    cycle: cycleConfig.key,
    price: finalPrice,
    baseTotal: rawTotal,
    monthlyEquivalent,
    discountPercent: cycleConfig.discountPercent,
    savings,
    durationMonths: cycleConfig.durationMonths,
    durationDays: cycleConfig.durationDays,
    savingsText: cycleConfig.savingsText,
  }
}

export default {
  PLAN_HIERARCHY,
  FEATURE_KEYS,
  STREAMING_QUALITIES,
  QUALITY_HIERARCHY,
  PLAN_MAX_QUALITY,
  PLAN_MAX_CONCURRENT_STREAMS,
  PLAN_DAILY_WATCH_TIME_MINUTES,
  PLAN_CONFIGURATIONS,
  BILLING_CYCLES,
  calculatePlanPricing,
  canAccessPlanContent,
  isQualityAllowed,
}

