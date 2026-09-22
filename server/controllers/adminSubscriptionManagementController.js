import { getSubscriptionKPIs } from "../services/admin/subscriptionAnalyticsService.js"
import {
  getPlatformRevenueStats,
  getRevenueTimeSeries,
} from "../services/admin/revenueAnalyticsService.js"
import {
  listSubscribers,
  getSubscriberProfile,
  extendSubscriptionValidity,
  suspendSubscription,
  restoreSubscription,
  moveToFreeTier,
} from "../services/admin/subscriberManagementService.js"
import {
  getAllPlansWithStats,
  updatePlan,
  togglePlanStatus,
} from "../services/admin/planManagementService.js"
import {
  generateRevenueReport,
  generateSubscribersReport,
  generatePlanPerformanceReport,
} from "../services/admin/subscriptionReportService.js"
import AdminSubscriptionAuditLog from "../Modals/AdminSubscriptionAuditLog.js"
import PaymentTransaction from "../Modals/PaymentTransaction.js"

const getClientIp = (req) =>
  req.headers["x-forwarded-for"]?.split(",")[0] || req.socket?.remoteAddress || null

const getUserAgent = (req) => req.headers["user-agent"] || null

/**
 * GET /api/admin/subscriptions/analytics/overview
 * Complete analytics overview: KPIs + Revenue metrics
 */
export const getAnalyticsOverviewHandler = async (req, res) => {
  try {
    const [kpis, revenue] = await Promise.all([
      getSubscriptionKPIs(),
      getPlatformRevenueStats(),
    ])

    return res.status(200).json({
      success: true,
      data: {
        kpis,
        revenue,
        refreshedAt: new Date().toISOString(),
      },
    })
  } catch (err) {
    console.error("[getAnalyticsOverviewHandler] Error:", err)
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to retrieve subscription analytics overview.",
    })
  }
}

/**
 * GET /api/admin/subscriptions/analytics/revenue-trends
 * Time series trend data for charts (period: daily, monthly, yearly)
 */
export const getRevenueTrendsHandler = async (req, res) => {
  try {
    const { period = "monthly" } = req.query
    const trends = await getRevenueTimeSeries({ period })

    return res.status(200).json({
      success: true,
      data: trends,
    })
  } catch (err) {
    console.error("[getRevenueTrendsHandler] Error:", err)
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to retrieve revenue trends.",
    })
  }
}

/**
 * GET /api/admin/subscriptions/subscribers
 * Paginated subscriber directory with search and filtering
 */
export const getSubscribersHandler = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      plan = "",
      status = "",
      expiringWithinDays = "",
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query

    const result = await listSubscribers({
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 20,
      search,
      plan,
      status,
      expiringWithinDays,
      sortBy,
      sortOrder,
    })

    return res.status(200).json({
      success: true,
      data: result,
    })
  } catch (err) {
    console.error("[getSubscribersHandler] Error:", err)
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to retrieve subscriber list.",
    })
  }
}

/**
 * GET /api/admin/subscriptions/subscribers/:userId
 * Aggregated 360-degree subscriber profile
 */
export const getSubscriberProfileHandler = async (req, res) => {
  try {
    const { userId } = req.params
    const profile = await getSubscriberProfile(userId)

    return res.status(200).json({
      success: true,
      data: profile,
    })
  } catch (err) {
    console.error("[getSubscriberProfileHandler] Error:", err)
    const statusCode = err.message?.includes("not found") ? 404 : 500
    return res.status(statusCode).json({
      success: false,
      message: err.message || "Failed to retrieve subscriber profile.",
    })
  }
}

/**
 * POST /api/admin/subscriptions/subscribers/:userId/extend
 * Extend subscription validity
 */
export const extendValidityHandler = async (req, res) => {
  try {
    const { userId } = req.params
    const { additionalDays, reason } = req.body
    const adminId = req.user?.id || req.user?._id

    const result = await extendSubscriptionValidity({
      userId,
      additionalDays,
      reason,
      adminId,
      ip: getClientIp(req),
      userAgent: getUserAgent(req),
    })

    return res.status(200).json({
      success: true,
      message: `Subscription successfully extended by ${result.daysAdded} days.`,
      data: result,
    })
  } catch (err) {
    console.error("[extendValidityHandler] Error:", err)
    return res.status(400).json({
      success: false,
      message: err.message || "Failed to extend subscription validity.",
    })
  }
}

/**
 * POST /api/admin/subscriptions/subscribers/:userId/suspend
 * Suspend a user subscription
 */
export const suspendSubscriptionHandler = async (req, res) => {
  try {
    const { userId } = req.params
    const { reason } = req.body
    const adminId = req.user?.id || req.user?._id

    const result = await suspendSubscription({
      userId,
      reason,
      adminId,
      ip: getClientIp(req),
      userAgent: getUserAgent(req),
    })

    return res.status(200).json({
      success: true,
      message: "Subscription has been suspended.",
      data: result,
    })
  } catch (err) {
    console.error("[suspendSubscriptionHandler] Error:", err)
    return res.status(400).json({
      success: false,
      message: err.message || "Failed to suspend subscription.",
    })
  }
}

/**
 * POST /api/admin/subscriptions/subscribers/:userId/restore
 * Restore a suspended subscription
 */
export const restoreSubscriptionHandler = async (req, res) => {
  try {
    const { userId } = req.params
    const { reason } = req.body
    const adminId = req.user?.id || req.user?._id

    const result = await restoreSubscription({
      userId,
      reason,
      adminId,
      ip: getClientIp(req),
      userAgent: getUserAgent(req),
    })

    return res.status(200).json({
      success: true,
      message: "Subscription has been restored to active status.",
      data: result,
    })
  } catch (err) {
    console.error("[restoreSubscriptionHandler] Error:", err)
    return res.status(400).json({
      success: false,
      message: err.message || "Failed to restore subscription.",
    })
  }
}

/**
 * POST /api/admin/subscriptions/subscribers/:userId/move-to-free
 * Revert subscriber to standard free tier
 */
export const moveToFreeHandler = async (req, res) => {
  try {
    const { userId } = req.params
    const { reason } = req.body
    const adminId = req.user?.id || req.user?._id

    const result = await moveToFreeTier({
      userId,
      reason,
      adminId,
      ip: getClientIp(req),
      userAgent: getUserAgent(req),
    })

    return res.status(200).json({
      success: true,
      message: "User subscription moved to Free tier.",
      data: result,
    })
  } catch (err) {
    console.error("[moveToFreeHandler] Error:", err)
    return res.status(400).json({
      success: false,
      message: err.message || "Failed to move subscription to free tier.",
    })
  }
}

/**
 * GET /api/admin/subscriptions/plans
 * List all configurable plans with live usage statistics
 */
export const getPlansHandler = async (req, res) => {
  try {
    const plans = await getAllPlansWithStats()
    return res.status(200).json({
      success: true,
      data: plans,
    })
  } catch (err) {
    console.error("[getPlansHandler] Error:", err)
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to retrieve subscription plans.",
    })
  }
}

/**
 * PUT /api/admin/subscriptions/plans/:planId
 * Update plan settings, features, limits
 */
export const updatePlanHandler = async (req, res) => {
  try {
    const { planId } = req.params
    const { updates, reason } = req.body
    const adminId = req.user?.id || req.user?._id

    const updated = await updatePlan({
      planId,
      updates: updates || req.body,
      reason,
      adminId,
      ip: getClientIp(req),
      userAgent: getUserAgent(req),
    })

    return res.status(200).json({
      success: true,
      message: "Subscription plan updated successfully.",
      data: updated,
    })
  } catch (err) {
    console.error("[updatePlanHandler] Error:", err)
    return res.status(400).json({
      success: false,
      message: err.message || "Failed to update subscription plan.",
    })
  }
}

/**
 * PATCH /api/admin/subscriptions/plans/:planId/toggle-status
 * Toggle plan active status
 */
export const togglePlanStatusHandler = async (req, res) => {
  try {
    const { planId } = req.params
    const { isActive, reason } = req.body
    const adminId = req.user?.id || req.user?._id

    const updated = await togglePlanStatus({
      planId,
      isActive,
      reason,
      adminId,
      ip: getClientIp(req),
      userAgent: getUserAgent(req),
    })

    return res.status(200).json({
      success: true,
      message: `Plan ${updated.isActive ? "activated" : "deactivated"} successfully.`,
      data: updated,
    })
  } catch (err) {
    console.error("[togglePlanStatusHandler] Error:", err)
    return res.status(400).json({
      success: false,
      message: err.message || "Failed to toggle plan status.",
    })
  }
}

/**
 * GET /api/admin/subscriptions/payments
 * Live transaction monitoring with search and filters
 */
export const getPaymentsListHandler = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      status = "",
      plan = "",
      from = "",
      to = "",
    } = req.query

    const p = Math.max(1, parseInt(page, 10) || 1)
    const lim = Math.min(100, Math.max(1, parseInt(limit, 10) || 20))
    const skip = (p - 1) * lim

    const query = {}

    if (status && status !== "all") {
      query.status = status.toLowerCase()
    }

    if (plan && plan !== "all") {
      query.$or = [
        { planKey: plan.toLowerCase() },
        { "metadata.planKey": plan.toLowerCase() },
      ]
    }

    if (from || to) {
      query.createdAt = {}
      if (from) query.createdAt.$gte = new Date(from)
      if (to) query.createdAt.$lte = new Date(to)
    }

    if (search && search.trim()) {
      const s = search.trim()
      query.$or = [
        { transactionId: { $regex: s, $options: "i" } },
        { orderId: { $regex: s, $options: "i" } },
        { "metadata.userName": { $regex: s, $options: "i" } },
        { "metadata.userEmail": { $regex: s, $options: "i" } },
      ]
    }

    const [total, transactions] = await Promise.all([
      PaymentTransaction.countDocuments(query),
      PaymentTransaction.find(query)
        .populate("userId", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(lim)
        .lean(),
    ])

    const formatted = transactions.map((t) => {
      let amt = Number(t.amount) || 0
      if (amt > 1000 && !t.amountInRupees) amt = amt / 100

      return {
        _id: t._id,
        transactionId: t.transactionId || t._id.toString(),
        orderId: t.orderId || "",
        user: {
          id: t.userId?._id || t.userId,
          name: t.userId?.name || t.metadata?.userName || "Unknown",
          email: t.userId?.email || t.metadata?.userEmail || "",
        },
        plan: (t.planKey || t.metadata?.planName || "").toUpperCase(),
        amount: Math.round(amt * 100) / 100,
        currency: t.currency || "INR",
        status: t.status,
        paymentMethod: t.paymentMethod || t.method || "card",
        createdAt: t.createdAt,
      }
    })

    return res.status(200).json({
      success: true,
      data: {
        payments: formatted,
        pagination: {
          total,
          page: p,
          limit: lim,
          totalPages: Math.ceil(total / lim) || 1,
        },
      },
    })
  } catch (err) {
    console.error("[getPaymentsListHandler] Error:", err)
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to retrieve payments list.",
    })
  }
}

/**
 * GET /api/admin/subscriptions/reports
 * Fetch report summary & data
 */
export const getReportHandler = async (req, res) => {
  try {
    const { type = "revenue", from, to, plan, status } = req.query

    let result
    if (type === "revenue") {
      result = await generateRevenueReport({ from, to })
    } else if (type === "subscribers") {
      result = await generateSubscribersReport({ plan, status })
    } else if (type === "plans") {
      result = await generatePlanPerformanceReport()
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid report type. Expected 'revenue', 'subscribers', or 'plans'.",
      })
    }

    return res.status(200).json({
      success: true,
      data: result,
    })
  } catch (err) {
    console.error("[getReportHandler] Error:", err)
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to generate report.",
    })
  }
}

/**
 * GET /api/admin/subscriptions/reports/export-csv
 * Download report as RFC 4180 CSV
 */
export const exportReportCsvHandler = async (req, res) => {
  try {
    const { type = "revenue", from, to, plan, status } = req.query

    let result
    if (type === "revenue") {
      result = await generateRevenueReport({ from, to })
    } else if (type === "subscribers") {
      result = await generateSubscribersReport({ plan, status })
    } else if (type === "plans") {
      result = await generatePlanPerformanceReport()
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid report type.",
      })
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const filename = `subscription-${type}-report-${timestamp}.csv`

    res.setHeader("Content-Type", "text/csv; charset=utf-8")
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`)

    return res.status(200).send(result.csv)
  } catch (err) {
    console.error("[exportReportCsvHandler] Error:", err)
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to export report CSV.",
    })
  }
}

/**
 * GET /api/admin/subscriptions/audit-logs
 * Fetch audit logs of admin subscription modifications
 */
export const getAuditLogsHandler = async (req, res) => {
  try {
    const { page = 1, limit = 25, userId, action } = req.query

    const p = Math.max(1, parseInt(page, 10) || 1)
    const lim = Math.min(100, Math.max(1, parseInt(limit, 10) || 25))
    const skip = (p - 1) * lim

    const query = {}
    if (userId) query.userId = userId
    if (action) query.action = action

    const [total, logs] = await Promise.all([
      AdminSubscriptionAuditLog.countDocuments(query),
      AdminSubscriptionAuditLog.find(query)
        .populate("adminId", "name email")
        .populate("userId", "name email")
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(lim)
        .lean(),
    ])

    return res.status(200).json({
      success: true,
      data: {
        logs,
        pagination: {
          total,
          page: p,
          limit: lim,
          totalPages: Math.ceil(total / lim) || 1,
        },
      },
    })
  } catch (err) {
    console.error("[getAuditLogsHandler] Error:", err)
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to retrieve audit logs.",
    })
  }
}
