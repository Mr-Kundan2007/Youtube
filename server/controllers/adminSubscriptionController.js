import Subscription from "../Modals/Subscription.js"
import PaymentTransaction from "../Modals/PaymentTransaction.js"
import Invoice from "../Modals/Invoice.js"
import subscriptionActivationService from "../services/subscriptionActivationService.js"
import { SUBSCRIPTION_PLANS, getSubscriptionPlan } from "../config/subscriptionPlans.js"
import { sendSuccess, sendError } from "../utils/response.js"
import { ApiError } from "../utils/apiError.js"

/**
 * Handles GET /api/admin/subscriptions/analytics
 */
export const getAdminBillingAnalyticsHandler = async (req, res) => {
  try {
    const [subscribersByPlan, activeTotal, totalRevenueAgg, recentTransactions] = await Promise.all([
      Subscription.aggregate([
        { $match: { status: "active" } },
        { $group: { _id: "$plan", count: { $sum: 1 } } },
      ]),
      Subscription.countDocuments({ status: "active" }),
      PaymentTransaction.aggregate([
        { $match: { status: "successful" } },
        { $group: { _id: null, totalPaise: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]),
      PaymentTransaction.find({ status: "successful" })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
    ])

    const planCounts = { free: 0, bronze: 0, silver: 0, gold: 0 }
    subscribersByPlan.forEach((group) => {
      if (planCounts[group._id] !== undefined) {
        planCounts[group._id] = group.count
      }
    })

    // Compute approximate Monthly Recurring Revenue (MRR in INR)
    const mrr =
      planCounts.bronze * 199 +
      planCounts.silver * 499 +
      planCounts.gold * 999

    const totalRevenueInr = (totalRevenueAgg[0]?.totalPaise || 0) / 100

    return sendSuccess(
      res,
      {
        metrics: {
          mrr,
          arr: mrr * 12,
          totalPaidSubscribers: planCounts.bronze + planCounts.silver + planCounts.gold,
          totalSubscribers: activeTotal,
          totalLifetimeRevenueInr: totalRevenueInr,
          totalTransactions: totalRevenueAgg[0]?.count || 0,
        },
        planBreakdown: planCounts,
        recentTransactions,
      },
      "Subscription analytics retrieved successfully"
    )
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Handles GET /api/admin/subscriptions/transactions
 */
export const getAdminTransactionsHandler = async (req, res) => {
  try {
    const { status, planKey, page = 1, limit = 10 } = req.query || {}
    const p = Math.max(1, Number(page) || 1)
    const lim = Math.max(1, Math.min(50, Number(limit) || 10))
    const skip = (p - 1) * lim

    const filter = {}
    if (status) filter.status = status
    if (planKey) filter.planKey = planKey

    const [transactions, total] = await Promise.all([
      PaymentTransaction.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(lim)
        .populate("userId", "name email")
        .lean(),
      PaymentTransaction.countDocuments(filter),
    ])

    return sendSuccess(
      res,
      {
        transactions,
        pagination: {
          page: p,
          limit: lim,
          total,
          totalPages: Math.ceil(total / lim) || 1,
        },
      },
      "Admin transactions retrieved successfully"
    )
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Handles POST /api/admin/subscriptions/:userId/override
 */
export const overrideUserSubscriptionHandler = async (req, res) => {
  try {
    const { userId } = req.params
    const { planKey = "silver", durationDays = 30, reason = "Admin override grant" } = req.body || {}

    const activation = await subscriptionActivationService.activateSubscription({
      userId,
      planKey,
      billingCycle: durationDays >= 365 ? "annual" : "monthly",
      paymentId: `admin_override_${Date.now()}`,
      amountPaid: 0,
      customerName: "Admin Override Grant",
    })

    return sendSuccess(
      res,
      {
        userId,
        plan: activation.plan,
        expiresAt: activation.expiresAt,
        reason,
      },
      `User subscription manually updated to ${activation.planName}`
    )
  } catch (err) {
    return sendError(res, err)
  }
}
