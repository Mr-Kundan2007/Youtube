import subscriptionModuleService from "./subscription.service.js"
import subscriptionAccessControlService from "../../services/subscriptionAccessControlService.js"
import { validatePlanIdentifier } from "./subscription.validation.js"
import { sendSuccess, sendError } from "../../utils/response.js"
import { ApiError } from "../../utils/apiError.js"

import { BILLING_CYCLES } from "../../config/subscriptionConfig.js"

/**
 * GET /api/subscriptions/plans
 * Public endpoint returning all active subscription plans with billing cycle options.
 */
export const getPlansHandler = async (req, res) => {
  try {
    const plans = await subscriptionModuleService.getAllPlans(true)
    return sendSuccess(res, { plans, billingCycles: BILLING_CYCLES }, "Active subscription plans retrieved successfully")
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * GET /api/subscriptions/plans/:planId
 * Public endpoint returning specific plan details by ObjectId or slug.
 */
export const getPlanDetailsHandler = async (req, res) => {
  try {
    const identifier = validatePlanIdentifier(req.params.planId)
    const plan = await subscriptionModuleService.getPlanByIdOrSlug(identifier)

    if (!plan) {
      throw ApiError.notFound("PLAN_NOT_FOUND", "Subscription plan not found")
    }

    return sendSuccess(res, { plan }, "Subscription plan retrieved successfully")
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * GET /api/subscriptions/current
 * Authenticated endpoint returning user's current subscription, remaining days, features, limits, and usage.
 */
export const getCurrentSubscriptionHandler = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id
    if (!userId) {
      throw ApiError.unauthorized("UNAUTHORIZED", "Authentication required")
    }

    const details = await subscriptionModuleService.getCurrentSubscriptionDetails(userId)
    const usage = await subscriptionAccessControlService.getTodayUsage(userId)
    const watchCheck = await subscriptionAccessControlService.checkWatchTimeAvailable(userId)

    const payload = {
      ...details,
      plan: {
        name: details.currentPlan.name,
        slug: details.currentPlan.slug,
      },
      features: details.enabledFeatures,
      limits: details.usageLimits,
      usage: {
        date: usage.date,
        watchTimeSeconds: usage.watchTimeSeconds,
        watchTimeMinutes: Math.round(usage.watchTimeSeconds / 60),
        downloadCount: usage.downloadCount,
        streamCount: usage.streamCount,
      },
      remainingUsage: {
        watchTimeMinutes: watchCheck.remainingMinutes,
        dailyDownloadsRemaining: Math.max(
          0,
          details.usageLimits.dailyDownloadLimit - usage.downloadCount
        ),
      },
    }

    return sendSuccess(res, payload, "Current subscription retrieved successfully")
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * GET /api/subscriptions/history
 * Authenticated endpoint returning user's chronological subscription lifecycle history.
 */
export const getSubscriptionHistoryHandler = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id
    if (!userId) {
      throw ApiError.unauthorized("UNAUTHORIZED", "Authentication required")
    }

    const history = await subscriptionModuleService.getSubscriptionHistory(userId)
    return sendSuccess(res, { history }, "Subscription history retrieved successfully")
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * GET /api/subscriptions/features
 * Authenticated endpoint returning resolved features & limits for current user.
 */
export const getAvailableFeaturesHandler = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id
    if (!userId) {
      throw ApiError.unauthorized("UNAUTHORIZED", "Authentication required")
    }

    const featureMatrix = await subscriptionModuleService.getUserFeatures(userId)
    return sendSuccess(res, featureMatrix, "Available features retrieved successfully")
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * GET /api/subscriptions/usage
 * Authenticated endpoint returning today's usage statistics and remaining allowances.
 */
export const getSubscriptionUsageHandler = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id
    if (!userId) {
      throw ApiError.unauthorized("UNAUTHORIZED", "Authentication required")
    }

    const usage = await subscriptionAccessControlService.getTodayUsage(userId)
    const watchCheck = await subscriptionAccessControlService.checkWatchTimeAvailable(userId)

    return sendSuccess(
      res,
      {
        date: usage.date,
        watchTimeSeconds: usage.watchTimeSeconds,
        watchTimeMinutes: Math.round(usage.watchTimeSeconds / 60),
        dailyWatchTimeLimitMinutes: watchCheck.limitMinutes,
        remainingWatchTimeMinutes: watchCheck.remainingMinutes,
        downloadCount: usage.downloadCount,
        streamCount: usage.streamCount,
      },
      "Today's subscription usage retrieved successfully"
    )
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * POST /api/subscriptions/usage/watch-time
 * Authenticated endpoint recording watched seconds from player.
 */
export const recordWatchTimeHandler = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id
    if (!userId) {
      throw ApiError.unauthorized("UNAUTHORIZED", "Authentication required")
    }

    const { seconds } = req.body || {}
    const watchedSecs = Math.max(0, Number(seconds) || 0)

    const updated = await subscriptionAccessControlService.recordWatchTime(userId, watchedSecs)
    const watchCheck = await subscriptionAccessControlService.checkWatchTimeAvailable(userId)

    return sendSuccess(
      res,
      {
        watchTimeSeconds: updated?.watchTimeSeconds || 0,
        remainingWatchTimeMinutes: watchCheck.remainingMinutes,
        withinLimit: watchCheck.available,
      },
      "Watch time recorded successfully"
    )
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * POST /api/subscriptions/stream/start
 * Authenticated endpoint starting a playback session enforcing concurrency limits.
 */
export const startStreamSessionHandler = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id
    if (!userId) {
      throw ApiError.unauthorized("UNAUTHORIZED", "Authentication required")
    }

    const { deviceId, videoId } = req.body || {}
    const effectiveDeviceId = deviceId || req.headers["x-device-id"] || "device_default"

    const sessionCheck = await subscriptionAccessControlService.startStreamSession(userId, {
      deviceId: effectiveDeviceId,
      videoId: videoId || null,
    })

    if (!sessionCheck.allowed) {
      return res.status(403).json({
        success: false,
        code: "CONCURRENT_STREAM_LIMIT_EXCEEDED",
        message: `You are currently streaming on ${sessionCheck.activeStreams} devices. Your plan allows up to ${sessionCheck.maxAllowed} concurrent streams.`,
        activeStreams: sessionCheck.activeStreams,
        maxAllowed: sessionCheck.maxAllowed,
        upgradeAvailable: true,
      })
    }

    return sendSuccess(
      res,
      {
        sessionId: sessionCheck.session?._id,
        status: sessionCheck.session?.status,
        activeStreams: sessionCheck.activeStreams,
        maxAllowed: sessionCheck.maxAllowed,
      },
      "Stream session started successfully"
    )
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * POST /api/subscriptions/stream/heartbeat
 */
export const heartbeatStreamSessionHandler = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id
    const { sessionId } = req.body || {}

    const success = await subscriptionAccessControlService.heartbeatStreamSession(userId, sessionId)
    return sendSuccess(res, { refreshed: success }, "Stream heartbeat acknowledged")
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * POST /api/subscriptions/stream/end
 */
export const endStreamSessionHandler = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id
    const { sessionId } = req.body || {}

    const success = await subscriptionAccessControlService.endStreamSession(userId, sessionId)
    return sendSuccess(res, { ended: success }, "Stream session concluded")
  } catch (err) {
    return sendError(res, err)
  }
}

export default {
  getPlansHandler,
  getPlanDetailsHandler,
  getCurrentSubscriptionHandler,
  getSubscriptionHistoryHandler,
  getAvailableFeaturesHandler,
  getSubscriptionUsageHandler,
  recordWatchTimeHandler,
  startStreamSessionHandler,
  heartbeatStreamSessionHandler,
  endStreamSessionHandler,
}
