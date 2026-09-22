import SubscriptionPlan from "../../Modals/SubscriptionPlan.js"
import Subscription from "../../Modals/Subscription.js"
import PaymentTransaction from "../../Modals/PaymentTransaction.js"
import AdminSubscriptionAuditLog from "../../Modals/AdminSubscriptionAuditLog.js"
import { SUBSCRIPTION_PLANS } from "../../config/subscriptionPlans.js"

/**
 * Ensures default plans exist in SubscriptionPlan collection if empty
 */
export const ensureDefaultPlansSeeded = async () => {
  try {
    const count = await SubscriptionPlan.countDocuments()
    if (count > 0) return

    const defaults = [
      {
        name: "Free",
        slug: "free",
        description: "Essential video streaming with basic community access",
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
          offlineDownloads: true,
          fastStreaming: false,
          exclusiveContent: false,
        },
        limits: {
          streamingQuality: "720p",
          dailyWatchTime: null,
          dailyUsageLimit: null,
          dailyDownloadLimit: 1,
          maxDownloadQuality: "720p",
          maxDevices: 1,
          maxConcurrentStreams: 1,
        },
      },
      {
        name: "Bronze",
        slug: "bronze",
        description: "Great for regular viewers seeking crisp Full HD and daily offline downloads",
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
          adFree: true,
          offlineDownloads: true,
          fastStreaming: true,
          exclusiveContent: false,
        },
        limits: {
          streamingQuality: "1080p",
          dailyWatchTime: null,
          dailyUsageLimit: null,
          dailyDownloadLimit: 5,
          maxDownloadQuality: "1080p",
          maxDevices: 2,
          maxConcurrentStreams: 1,
        },
      },
      {
        name: "Silver",
        slug: "silver",
        description: "Best for power learners, high-speed streaming, and full catalog access",
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
          exclusiveContent: true,
        },
        limits: {
          streamingQuality: "1440p",
          dailyWatchTime: null,
          dailyUsageLimit: null,
          dailyDownloadLimit: 15,
          maxDownloadQuality: "1440p",
          maxDevices: 4,
          maxConcurrentStreams: 2,
        },
      },
      {
        name: "Gold",
        slug: "gold",
        description: "Ultimate cinema & masterclass access with 4K UHD and priority offline storage",
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
          maxDevices: 8,
          maxConcurrentStreams: 4,
        },
      },
    ]

    await SubscriptionPlan.insertMany(defaults)
  } catch (err) {
    console.error("[planManagementService] Error seeding default plans:", err.message)
  }
}

/**
 * Get all subscription plans with active subscriber counts and generated revenue stats
 */
export const getAllPlansWithStats = async () => {
  await ensureDefaultPlansSeeded()

  const plans = await SubscriptionPlan.find().sort({ displayOrder: 1 }).lean()

  // Aggregate active subscriptions grouped by plan
  const subStats = await Subscription.aggregate([
    {
      $group: {
        _id: {
          $toLower: { $ifNull: ["$plan", "$planKey"] },
        },
        total: { $sum: 1 },
        active: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$status", "active"] },
                  { $gt: ["$endDate", new Date()] },
                ],
              },
              1,
              0,
            ],
          },
        },
        cancelled: {
          $sum: {
            $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0],
          },
        },
      },
    },
  ])

  const subStatMap = {}
  subStats.forEach((s) => {
    if (s._id) subStatMap[s._id] = s
  })

  // Aggregate verified revenue grouped by planKey
  const revStats = await PaymentTransaction.aggregate([
    {
      $match: {
        status: { $in: ["success", "successful"] },
      },
    },
    {
      $group: {
        _id: {
          $toLower: { $ifNull: ["$planKey", "$metadata.planKey"] },
        },
        revenueSum: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
  ])

  const revStatMap = {}
  revStats.forEach((r) => {
    if (r._id) {
      // Normalize paise to rupees if stored in paise
      const rev = r.revenueSum > 1000 ? r.revenueSum / 100 : r.revenueSum
      revStatMap[r._id] = {
        totalRevenue: Math.round(rev * 100) / 100,
        transactionsCount: r.count,
      }
    }
  })

  return plans.map((p) => {
    const slugKey = (p.slug || "").toLowerCase()
    const sStat = subStatMap[slugKey] || { total: 0, active: 0, cancelled: 0 }
    const rStat = revStatMap[slugKey] || { totalRevenue: 0, transactionsCount: 0 }

    return {
      ...p,
      stats: {
        activeSubscribers: sStat.active,
        totalSubscribers: sStat.total,
        cancelledSubscribers: sStat.cancelled,
        totalRevenue: rStat.totalRevenue,
        transactionsCount: rStat.transactionsCount,
      },
    }
  })
}

/**
 * Update an existing subscription plan's pricing, limits, features, or metadata
 */
export const updatePlan = async ({
  planId,
  updates,
  reason,
  adminId,
  ip = null,
  userAgent = null,
}) => {
  if (!reason || reason.trim().length < 3) {
    throw new Error("A valid administrative reason (minimum 3 characters) is required.")
  }

  const plan = await SubscriptionPlan.findById(planId)
  if (!plan) {
    throw new Error(`Subscription plan with ID '${planId}' not found.`)
  }

  const previousValues = plan.toObject()

  const allowedFields = [
    "name",
    "description",
    "price",
    "currency",
    "isActive",
    "isPopular",
    "displayOrder",
    "validityType",
    "validityDays",
    "features",
    "limits",
  ]

  allowedFields.forEach((field) => {
    if (updates[field] !== undefined) {
      if (typeof updates[field] === "object" && updates[field] !== null && !Array.isArray(updates[field])) {
        plan[field] = { ...plan[field], ...updates[field] }
      } else {
        plan[field] = updates[field]
      }
    }
  })

  await plan.save()

  // Log audit
  await AdminSubscriptionAuditLog.create({
    adminId,
    subscriptionPlanId: plan._id,
    action: "update_plan",
    previousValues,
    newValues: plan.toObject(),
    reason,
    ip,
    userAgent,
    metadata: {
      planSlug: plan.slug,
      planName: plan.name,
    },
  })

  return plan
}

/**
 * Toggle active/inactive status of a subscription plan
 */
export const togglePlanStatus = async ({
  planId,
  isActive,
  reason,
  adminId,
  ip = null,
  userAgent = null,
}) => {
  if (!reason || reason.trim().length < 3) {
    throw new Error("A valid administrative reason (minimum 3 characters) is required.")
  }

  const plan = await SubscriptionPlan.findById(planId)
  if (!plan) {
    throw new Error(`Subscription plan with ID '${planId}' not found.`)
  }

  const previousStatus = plan.isActive
  plan.isActive = Boolean(isActive)
  await plan.save()

  await AdminSubscriptionAuditLog.create({
    adminId,
    subscriptionPlanId: plan._id,
    action: "toggle_plan_status",
    previousValues: { isActive: previousStatus },
    newValues: { isActive: plan.isActive },
    reason,
    ip,
    userAgent,
    metadata: {
      planSlug: plan.slug,
      planName: plan.name,
    },
  })

  return plan
}
