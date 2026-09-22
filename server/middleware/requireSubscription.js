import subscriptionAccessService from "../services/subscriptionAccessService.js"
import { sendError } from "../utils/response.js"
import { ApiError } from "../utils/apiError.js"

/**
 * Middleware requiring user to have at least minPlan tier (e.g. "bronze", "silver", "gold").
 */
export const requirePlan = (minPlan = "bronze") => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id || req.user?._id
      if (!userId) {
        throw ApiError.unauthorized("UNAUTHORIZED", "Authentication required")
      }
      const sub = await subscriptionAccessService.assertPlanAccess(userId, minPlan)
      req.subscription = sub
      next()
    } catch (err) {
      return sendError(res, err)
    }
  }
}

/**
 * Middleware requiring specific feature access (e.g. "adFree", "collaborationMeetings").
 */
export const requireFeature = (featureKey) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id || req.user?._id
      if (!userId) {
        throw ApiError.unauthorized("UNAUTHORIZED", "Authentication required")
      }
      const matrix = await subscriptionAccessService.getFeatureMatrix(userId)
      if (!matrix.features[featureKey]) {
        throw ApiError.forbidden(
          "FEATURE_NOT_PERMITTED",
          `Your current subscription plan (${matrix.planName}) does not include ${featureKey}.`
        )
      }
      req.featureMatrix = matrix
      next()
    } catch (err) {
      return sendError(res, err)
    }
  }
}
