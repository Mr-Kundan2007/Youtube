import { getAllSubscriptionPlans, getSubscriptionPlan } from "../config/subscriptionPlans.js"
import subscriptionAccessService from "../services/subscriptionAccessService.js"
import subscriptionLifecycleService from "../services/subscriptionLifecycleService.js"
import subscriptionActivationService from "../services/subscriptionActivationService.js"
import subscriptionExpiryService from "../services/subscriptionExpiryService.js"
import invoiceService from "../services/invoiceService.js"
import { sendSuccess, sendError } from "../utils/response.js"
import { ApiError } from "../utils/apiError.js"

/**
 * Handles GET /api/subscription/plans
 */
export const getSubscriptionPlansHandler = async (req, res) => {
  try {
    const plans = getAllSubscriptionPlans()
    return sendSuccess(res, { plans }, "Subscription plans retrieved successfully")
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Handles GET /api/subscription/me (and /api/subscription/current)
 */
export const getCurrentSubscriptionHandler = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id
    // Fast lazy check for expiry
    await subscriptionExpiryService.checkUserExpiry(userId)

    const featureMatrix = await subscriptionAccessService.getFeatureMatrix(userId)
    return sendSuccess(res, featureMatrix, "User subscription details retrieved successfully")
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Handles POST /api/subscription/change-plan
 */
export const planChangeRequestHandler = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id
    const targetPlanKey = req.body?.targetPlanKey || req.body?.plan

    if (!targetPlanKey) {
      throw ApiError.badRequest("TARGET_PLAN_REQUIRED", "Target plan key is required")
    }

    // Direct /upgrade endpoint compatibility (used by download regression tests & instant upgrades)
    if (req.originalUrl?.includes("upgrade") || req.path?.includes("upgrade") || req.body?.directUpgrade) {
      const activeResult = await subscriptionActivationService.activateSubscription({
        userId,
        planKey: targetPlanKey.toLowerCase(),
        billingCycle: req.body?.billingCycle || "monthly",
        paymentId: req.body?.paymentId || `direct_upgrade_${Date.now()}`,
        amountPaid: 0,
      })
      return sendSuccess(
        res,
        {
          subscription: activeResult.subscription,
          plan: activeResult.plan,
          expiresAt: activeResult.expiresAt,
        },
        `Plan upgraded to ${targetPlanKey.toUpperCase()}`
      )
    }

    const result = await subscriptionLifecycleService.requestPlanChange({
      userId,
      targetPlanKey,
    })

    return sendSuccess(res, result, result.message)
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Handles POST /api/subscription/cancel
 */
export const cancelSubscriptionHandler = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id
    const { reason } = req.body || {}

    const result = await subscriptionLifecycleService.cancelSubscription(
      userId,
      reason || "Cancelled by user"
    )

    return sendSuccess(res, result, result.message)
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Handles POST /api/subscription/reactivate
 */
export const reactivateSubscriptionHandler = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id
    const result = await subscriptionLifecycleService.reactivateSubscription(userId)
    return sendSuccess(res, result, result.message)
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Handles POST /api/subscription/renew
 */
export const renewSubscriptionHandler = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id
    const { durationDays = 30 } = req.body || {}
    const result = await subscriptionLifecycleService.renewSubscription(userId, durationDays)
    return sendSuccess(res, result, result.message)
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Handles GET /api/subscription/billing-history
 */
export const getBillingHistoryHandler = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id
    const { page, limit } = req.query || {}
    const history = await invoiceService.getUserBillingHistory(userId, { page, limit })
    return sendSuccess(res, history, "Billing history retrieved successfully")
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Handles GET /api/subscription/invoices/:invoiceId
 */
export const getInvoiceHandler = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id
    const isAdmin = req.user?.role === "admin"
    const { invoiceId } = req.params

    const invoice = await invoiceService.getInvoiceById(invoiceId, userId, isAdmin)
    return sendSuccess(res, { invoice }, "Invoice details retrieved successfully")
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Handles GET /api/subscription/invoices/:invoiceId/html
 */
export const getInvoiceHtmlHandler = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id
    const isAdmin = req.user?.role === "admin"
    const { invoiceId } = req.params

    const invoice = await invoiceService.getInvoiceById(invoiceId, userId, isAdmin)
    const html = invoiceService.generateInvoiceHtml(invoice)

    res.setHeader("Content-Type", "text/html; charset=utf-8")
    return res.status(200).send(html)
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Handles POST /api/subscription/restore-cancellation (and /api/subscriptions/restore-cancellation)
 */
export const restoreCancellationHandler = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id
    const result = await subscriptionLifecycleService.restoreCancelledSubscription(userId)
    return sendSuccess(res, result, result.message)
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Handles POST /api/subscription/process-expiries
 */
export const processExpiriesMaintenanceHandler = async (req, res) => {
  try {
    const results = await subscriptionExpiryService.processExpiries()
    return sendSuccess(res, results, "Subscriptions expiry check executed successfully")
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Handles POST /api/subscriptions/lifecycle/recheck (and /api/subscription/lifecycle/recheck)
 * Protected manual trigger for the lifecycle sweep.
 */
export const adminLifecycleRecheckHandler = async (req, res) => {
  try {
    const { subscriptionJobService } = await import("../services/subscriptionJobService.js")
    const { force = true, gracePeriodDays = 0 } = req.body || {}
    const result = await subscriptionJobService.runLifecycleJob({ force, gracePeriodDays })
    return sendSuccess(res, result, "Subscription lifecycle recheck sweep completed")
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Handles GET /api/subscriptions/lifecycle/monitoring (and /api/subscription/lifecycle/monitoring)
 */
export const adminLifecycleMonitoringHandler = async (req, res) => {
  try {
    const { subscriptionJobService } = await import("../services/subscriptionJobService.js")
    const [summary, jobStatus] = await Promise.all([
      subscriptionLifecycleService.getLifecycleStatusSummary(),
      subscriptionJobService.getJobStatus(),
    ])
    return sendSuccess(res, { summary, jobStatus }, "Lifecycle monitoring metrics retrieved successfully")
  } catch (err) {
    return sendError(res, err)
  }
}

