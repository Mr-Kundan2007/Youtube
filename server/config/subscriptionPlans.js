/**
 * Authoritative Subscription Plans Configuration
 * Defines pricing (INR / USD), billing cycles, download & streaming rules, and feature flags.
 */

export const SUBSCRIPTION_TIERS = {
  FREE: "free",
  BRONZE: "bronze",
  SILVER: "silver",
  GOLD: "gold",
}

export const BILLING_CYCLES = {
  MONTHLY: "monthly",
  ANNUAL: "annual",
}

export const SUBSCRIPTION_PLANS = {
  free: {
    key: "free",
    name: "Free",
    tagline: "Essential video streaming with basic community access",
    badge: null,
    isPopular: false,
    pricing: {
      monthly: {
        amountInr: 0,
        amountInrPaise: 0,
        amountUsd: 0,
        displayInr: "₹0",
        displayUsd: "$0",
        interval: "forever",
      },
      annual: {
        amountInr: 0,
        amountInrPaise: 0,
        amountUsd: 0,
        displayInr: "₹0",
        displayUsd: "$0",
        interval: "forever",
        savingsPercent: 0,
      },
    },
    features: {
      maxResolution: "720p",
      maxBitrateKbps: 2500,
      adFree: false,
      backgroundPlay: false,
      downloadsEnabled: true,
      downloadLimitPerDay: 1,
      maxDevices: 1,
      audioQuality: "Standard (128 kbps)",
      collaborationMeetings: false,
      recordingsEnabled: false,
      prioritySupport: false,
      vipBadge: false,
    },
    featureList: [
      "Standard definition streaming up to 720p",
      "1 video download per day",
      "Stream on 1 device at a time",
      "Standard audio quality",
      "Ad-supported viewing",
    ],
  },
  bronze: {
    key: "bronze",
    name: "Bronze",
    tagline: "Great for regular viewers seeking crisp Full HD and daily offline downloads",
    badge: "Starter Premium",
    isPopular: false,
    pricing: {
      monthly: {
        amountInr: 199,
        amountInrPaise: 19900,
        amountUsd: 4.99,
        displayInr: "₹199",
        displayUsd: "$4.99",
        interval: "per month",
      },
      annual: {
        amountInr: 1990,
        amountInrPaise: 199000,
        amountUsd: 49.99,
        displayInr: "₹1,990",
        displayUsd: "$49.99",
        interval: "per year",
        savingsPercent: 17,
      },
    },
    features: {
      maxResolution: "1080p",
      maxBitrateKbps: 6000,
      adFree: true,
      backgroundPlay: true,
      downloadsEnabled: true,
      downloadLimitPerDay: 5,
      maxDevices: 2,
      audioQuality: "High Definition (256 kbps)",
      collaborationMeetings: true,
      recordingsEnabled: false,
      prioritySupport: false,
      vipBadge: false,
    },
    featureList: [
      "Crisp Full HD streaming (1080p)",
      "5 downloads per day across all channels",
      "Ad-free uninterrupted playback",
      "Multi-device access up to 2 registered devices",
      "Background audio playback",
      "Join interactive video meeting rooms",
    ],
  },
  silver: {
    key: "silver",
    name: "Silver",
    tagline: "Ideal for power users, families, and content creators wanting QHD clarity",
    badge: "Most Popular",
    isPopular: true,
    pricing: {
      monthly: {
        amountInr: 499,
        amountInrPaise: 49900,
        amountUsd: 12.99,
        displayInr: "₹499",
        displayUsd: "$12.99",
        interval: "per month",
      },
      annual: {
        amountInr: 4990,
        amountInrPaise: 499000,
        amountUsd: 129.99,
        displayInr: "₹4,990",
        displayUsd: "$129.99",
        interval: "per year",
        savingsPercent: 17,
      },
    },
    features: {
      maxResolution: "1440p",
      maxBitrateKbps: 12000,
      adFree: true,
      backgroundPlay: true,
      downloadsEnabled: true,
      downloadLimitPerDay: 15,
      maxDevices: 5,
      audioQuality: "Master Audio (320 kbps)",
      collaborationMeetings: true,
      recordingsEnabled: true,
      prioritySupport: true,
      vipBadge: false,
    },
    featureList: [
      "Crystal-clear 2K Quad HD (1440p) streaming",
      "15 downloads per day with fast priority bandwidth",
      "Up to 5 registered devices simultaneously",
      "100% Ad-free experience across all devices",
      "Host meetings and capture cloud recordings",
      "Priority customer care response",
    ],
  },
  gold: {
    key: "gold",
    name: "Gold",
    tagline: "The ultimate tier for cinema-grade 4K HDR, massive quotas, and VIP perks",
    badge: "Best Value",
    isPopular: false,
    pricing: {
      monthly: {
        amountInr: 999,
        amountInrPaise: 99900,
        amountUsd: 24.99,
        displayInr: "₹999",
        displayUsd: "$24.99",
        interval: "per month",
      },
      annual: {
        amountInr: 9990,
        amountInrPaise: 999000,
        amountUsd: 249.99,
        displayInr: "₹9,990",
        displayUsd: "$249.99",
        interval: "per year",
        savingsPercent: 17,
      },
    },
    features: {
      maxResolution: "4k",
      maxBitrateKbps: 25000,
      adFree: true,
      backgroundPlay: true,
      downloadsEnabled: true,
      downloadLimitPerDay: 50,
      maxDevices: 10,
      audioQuality: "Lossless Studio Audio & Dolby Atmos",
      collaborationMeetings: true,
      recordingsEnabled: true,
      prioritySupport: true,
      vipBadge: true,
    },
    featureList: [
      "Cinema-grade 4K Ultra HD & HDR streaming",
      "Massive 50 downloads per day allowance",
      "Up to 10 registered devices for the whole team or home",
      "End-to-End Encrypted (E2EE) video meetings",
      "Unlimited cloud meeting recordings",
      "Gold VIP profile badge & dedicated VIP support",
    ],
  },
}

/**
 * Returns structured plan info by key. Defaults to free.
 */
export const getSubscriptionPlan = (planKey = "free") => {
  const normalized = String(planKey).toLowerCase()
  return SUBSCRIPTION_PLANS[normalized] || SUBSCRIPTION_PLANS.free
}

/**
 * Returns full plan array suitable for UI cards and pricing table.
 */
export const getAllSubscriptionPlans = () => {
  return Object.values(SUBSCRIPTION_PLANS)
}
