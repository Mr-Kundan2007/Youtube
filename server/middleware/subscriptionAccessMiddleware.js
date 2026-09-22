import Video from "../Modals/video.js"
import Course from "../Modals/Course.js"
import subscriptionAccessControlService from "../services/subscriptionAccessControlService.js"
import { canAccessPlanContent } from "../config/subscriptionConfig.js"

/**
 * Sends structured access denied error envelope as required by Step 21.
 */
const sendAccessDenied = (res, { code, message, requiredPlan, currentPlan, limit, used, statusCode = 403 }) => {
  return res.status(statusCode).json({
    success: false,
    code,
    message,
    ...(requiredPlan ? { requiredPlan } : {}),
    ...(currentPlan ? { currentPlan } : {}),
    ...(limit !== undefined ? { limit } : {}),
    ...(used !== undefined ? { used } : {}),
    upgradeAvailable: true,
  })
}

/**
 * Middleware validating that a user has sufficient subscription tier to access a video.
 * Note: Free videos are NEVER blocked.
 */
export const requireVideoAccess = async (req, res, next) => {
  try {
    const videoId = req.params.id || req.params.videoId || req.body.videoId
    if (!videoId) return next()

    const video = await Video.findById(videoId)
    if (!video) {
      return res.status(404).json({ success: false, code: "VIDEO_NOT_FOUND", message: "Video not found" })
    }

    const userId = req.user?.id || req.user?._id || null
    const check = await subscriptionAccessControlService.canWatchVideo(userId, video)

    if (!check.allowed) {
      return sendAccessDenied(res, {
        code: check.code || "SUBSCRIPTION_REQUIRED",
        message: check.message || "Subscription required to view this content",
        requiredPlan: check.requiredPlan,
        currentPlan: check.currentPlan,
        limit: check.limit,
        used: check.used,
        statusCode: check.code === "AUTHENTICATION_REQUIRED" ? 401 : 403,
      })
    }

    req.video = video
    return next()
  } catch (err) {
    return res.status(500).json({ success: false, code: "INTERNAL_ERROR", message: err.message })
  }
}

/**
 * Middleware requiring a minimum plan rank in the hierarchy (e.g. "bronze", "silver", "gold").
 *
 * @param {string} minimumPlanSlug
 */
export const requireMinimumPlan = (minimumPlanSlug = "free") => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id || req.user?._id
      if (!userId) {
        return sendAccessDenied(res, {
          code: "AUTHENTICATION_REQUIRED",
          message: "Sign in required to access this resource",
          requiredPlan: minimumPlanSlug,
          currentPlan: "none",
          statusCode: 401,
        })
      }

      const { plan: userPlan, isExpired } = await subscriptionAccessControlService.getUserEffectivePlan(userId)

      if (isExpired) {
        return sendAccessDenied(res, {
          code: "SUBSCRIPTION_EXPIRED",
          message: "Your subscription has expired. Please renew.",
          requiredPlan: minimumPlanSlug,
          currentPlan: "free",
        })
      }

      if (!canAccessPlanContent(userPlan, minimumPlanSlug)) {
        return sendAccessDenied(res, {
          code: "SUBSCRIPTION_REQUIRED",
          message: `Your current plan (${userPlan.toUpperCase()}) does not meet the required ${minimumPlanSlug.toUpperCase()} plan.`,
          requiredPlan: minimumPlanSlug,
          currentPlan: userPlan,
        })
      }

      return next()
    } catch (err) {
      return res.status(500).json({ success: false, code: "INTERNAL_ERROR", message: err.message })
    }
  }
}

/**
 * Middleware checking requested streaming quality against plan maximum allowed.
 */
export const requireStreamingQuality = async (req, res, next) => {
  try {
    const requestedQuality = req.query.quality || req.headers["x-stream-quality"]
    if (!requestedQuality) return next()

    const userId = req.user?.id || req.user?._id || null
    const check = await subscriptionAccessControlService.checkStreamingQuality(userId, requestedQuality)

    if (!check.allowed) {
      return res.status(403).json({
        success: false,
        code: "QUALITY_NOT_PERMITTED",
        message: `Streaming at ${requestedQuality} is not supported on your ${check.userPlan.toUpperCase()} plan. Maximum allowed quality is ${check.maxAllowed}.`,
        requestedQuality,
        maxAllowedQuality: check.maxAllowed,
        currentPlan: check.userPlan,
        upgradeAvailable: true,
      })
    }

    req.streamingQuality = requestedQuality
    return next()
  } catch (err) {
    return res.status(500).json({ success: false, code: "INTERNAL_ERROR", message: err.message })
  }
}

/**
 * Middleware checking if user has remaining daily watch time.
 */
export const requireWatchTimeAvailable = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?._id
    if (!userId) return next() // Handled by auth if required

    const check = await subscriptionAccessControlService.checkWatchTimeAvailable(userId)
    if (!check.available) {
      return sendAccessDenied(res, {
        code: "USAGE_LIMIT_REACHED",
        message: "You have reached your daily watch time limit. Upgrade your plan for unlimited watching.",
        limit: check.limitMinutes,
        used: check.usedMinutes,
      })
    }

    return next()
  } catch (err) {
    return res.status(500).json({ success: false, code: "INTERNAL_ERROR", message: err.message })
  }
}

/**
 * Middleware enforcing concurrent stream session limits.
 */
export const enforceConcurrentStreamLimit = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?._id
    if (!userId) return next()

    const deviceId = req.body?.deviceId || req.headers["x-device-id"] || req.ip || "device_unknown"
    const videoId = req.body?.videoId || req.params?.id || null

    const sessionCheck = await subscriptionAccessControlService.startStreamSession(userId, {
      deviceId,
      videoId,
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

    req.streamSession = sessionCheck.session
    return next()
  } catch (err) {
    return res.status(500).json({ success: false, code: "INTERNAL_ERROR", message: err.message })
  }
}

export default {
  requireVideoAccess,
  requireMinimumPlan,
  requireStreamingQuality,
  requireWatchTimeAvailable,
  enforceConcurrentStreamLimit,
}
