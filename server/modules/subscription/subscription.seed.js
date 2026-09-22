import SubscriptionPlan from "../../Modals/SubscriptionPlan.js"
import { logger } from "../../utils/logger.js"

export const DEFAULT_PLANS = [
  {
    name: "Free",
    slug: "free",
    description: "Basic streaming and learning access with 1 daily download",
    price: 0,
    currency: "INR",
    isActive: true,
    isPopular: false,
    displayOrder: 1,
    validityType: "lifetime",
    validityDays: null,
    features: {
      premiumVideoAccess: false,
      premiumCourses: false,
      priorityContent: false,
      adFree: false,
      offlineDownloads: false,
      fastStreaming: false,
      exclusiveContent: false,
    },
    limits: {
      streamingQuality: "720p",
      dailyWatchTime: 120, // 2 hours standard
      dailyUsageLimit: 1000,
      dailyDownloadLimit: 1,
      maxDownloadQuality: "720p",
      maxDevices: 1,
      maxConcurrentStreams: 1,
    },
  },
  {
    name: "Bronze",
    slug: "bronze",
    description: "Enhanced HD streaming with 5 downloads/day and standard ad experience",
    price: 199,
    currency: "INR",
    isActive: true,
    isPopular: false,
    displayOrder: 2,
    validityType: "monthly",
    validityDays: 30,
    features: {
      premiumVideoAccess: true,
      premiumCourses: false,
      priorityContent: false,
      adFree: false,
      offlineDownloads: true,
      fastStreaming: false,
      exclusiveContent: false,
    },
    limits: {
      streamingQuality: "1080p",
      dailyWatchTime: null,
      dailyUsageLimit: null,
      dailyDownloadLimit: 5,
      maxDownloadQuality: "1080p",
      maxDevices: 2,
      maxConcurrentStreams: 2,
    },
  },
  {
    name: "Silver",
    slug: "silver",
    description: "Full HD 2K streaming, Ad-free playback, premium courses and 15 downloads/day",
    price: 499,
    currency: "INR",
    isActive: true,
    isPopular: true,
    displayOrder: 3,
    validityType: "monthly",
    validityDays: 30,
    features: {
      premiumVideoAccess: true,
      premiumCourses: true,
      priorityContent: true,
      adFree: true,
      offlineDownloads: true,
      fastStreaming: true,
      exclusiveContent: false,
    },
    limits: {
      streamingQuality: "1440p",
      dailyWatchTime: null,
      dailyUsageLimit: null,
      dailyDownloadLimit: 15,
      maxDownloadQuality: "1080p",
      maxDevices: 5,
      maxConcurrentStreams: 3,
    },
  },
  {
    name: "Gold",
    slug: "gold",
    description: "Ultra HD 4K HDR, VIP ad-free streaming, exclusive content, 50 downloads/day",
    price: 999,
    currency: "INR",
    isActive: true,
    isPopular: false,
    displayOrder: 4,
    validityType: "monthly",
    validityDays: 30,
    features: {
      premiumVideoAccess: true,
      premiumCourses: true,
      priorityContent: true,
      adFree: true,
      offlineDownloads: true,
      fastStreaming: true,
      exclusiveContent: true,
    },
    limits: {
      streamingQuality: "4k",
      dailyWatchTime: null,
      dailyUsageLimit: null,
      dailyDownloadLimit: 50,
      maxDownloadQuality: "4k",
      maxDevices: 10,
      maxConcurrentStreams: 5,
    },
  },
]

/**
 * Seeds default subscription plans into the database if they do not already exist.
 * Idempotent: Never duplicates or overwrites existing plans with the same slug.
 *
 * @returns {Promise<{ created: number, existing: number, plans: Array }>}
 */
export const seedSubscriptionPlans = async () => {
  let created = 0
  let existing = 0
  const plans = []

  for (const planDef of DEFAULT_PLANS) {
    try {
      const existingPlan = await SubscriptionPlan.findOne({ slug: planDef.slug })
      if (!existingPlan) {
        const newPlan = await SubscriptionPlan.findOneAndUpdate(
          { slug: planDef.slug },
          { $setOnInsert: planDef },
          { upsert: true, new: true }
        )
        plans.push(newPlan)
        created++
        logger.info(`Subscription plan seeded: ${planDef.name} (${planDef.slug})`)
      } else {
        plans.push(existingPlan)
        existing++
      }
    } catch (err) {
      if (err.code === 11000) {
        const existingPlan = await SubscriptionPlan.findOne({ slug: planDef.slug })
        if (existingPlan) plans.push(existingPlan)
        existing++
      } else {
        throw err
      }
    }
  }

  return { created, existing, plans }
}

export default seedSubscriptionPlans
