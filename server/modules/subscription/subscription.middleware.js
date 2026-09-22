import subscriptionModuleService from "./subscription.service.js"
import { sendError } from "../../utils/response.js"
import { ApiError } from "../../utils/apiError.js"

/**
 * Ensures user has an initialized subscription record (auto-provisions Free if missing).
 */
export const requireSubscription = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?._id
    if (!userId) {
      return sendError(res, ApiError.unauthorized("UNAUTHORIZED", "Authentication required"), 401)
    }

    const sub = await subscriptionModuleService.getOrCreateUserSubscription(userId)
    req.subscription = sub
    return next()
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Requires that the user's subscription is currently active and not expired.
 */
export const requireActiveSubscription = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?._id
    if (!userId) {
      return sendError(res, ApiError.unauthorized("UNAUTHORIZED", "Authentication required"), 401)
    }

    const details = await subscriptionModuleService.getCurrentSubscriptionDetails(userId)
    if (!details.isActive) {
      return sendError(
        res,
        ApiError.forbidden(
          details.isExpired ? "SUBSCRIPTION_EXPIRED" : "SUBSCRIPTION_INACTIVE",
          details.isExpired
            ? "Your subscription has expired. Please renew to access this feature."
            : "An active subscription is required to access this feature."
        ),
        403
      )
    }

    req.subscriptionDetails = details
    return next()
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Requires that the user's active plan enables a specific feature flag.
 *
 * @param {string} featureName
 */
export const requireFeature = (featureName) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id || req.user?._id
      if (!userId) {
        return sendError(res, ApiError.unauthorized("UNAUTHORIZED", "Authentication required"), 401)
      }

      const details = await subscriptionModuleService.getCurrentSubscriptionDetails(userId)
      if (!details.isActive) {
        return sendError(
          res,
          ApiError.forbidden("SUBSCRIPTION_INACTIVE", "An active subscription is required"),
          403
        )
      }

      const hasFeature = Boolean(details.enabledFeatures[featureName])
      if (!hasFeature) {
        return sendError(
          res,
          ApiError.forbidden(
            "FEATURE_NOT_PERMITTED",
            `Your current plan (${details.currentPlan.name}) does not include access to '${featureName}'. Upgrade required.`
          ),
          403
        )
      }

      req.subscriptionDetails = details
      return next()
    } catch (err) {
      return sendError(res, err)
    }
  }
}

/**
 * Requires that the user is on a paid premium tier (Bronze, Silver, or Gold).
 */
export const requirePremiumAccess = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?._id
    if (!userId) {
      return sendError(res, ApiError.unauthorized("UNAUTHORIZED", "Authentication required"), 401)
    }

    const details = await subscriptionModuleService.getCurrentSubscriptionDetails(userId)
    if (!details.isActive || details.currentPlan.slug === "free") {
      return sendError(
        res,
        ApiError.forbidden(
          "PREMIUM_PLAN_REQUIRED",
          "A premium subscription (Bronze, Silver, or Gold) is required to access this content."
        ),
        403
      )
    }

    req.subscriptionDetails = details
    return next()
  } catch (err) {
    return sendError(res, err)
  }
}

export default {
  requireSubscription,
  requireActiveSubscription,
  requireFeature,
  requirePremiumAccess,
}
