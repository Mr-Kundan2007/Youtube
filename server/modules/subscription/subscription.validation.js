import mongoose from "mongoose"
import { ApiError } from "../../utils/apiError.js"

export const VALID_VALIDITY_TYPES = ["monthly", "quarterly", "yearly", "lifetime"]
export const VALID_PLAN_SLUGS = ["free", "bronze", "silver", "gold"]

/**
 * Validates a plan identifier (MongoDB ObjectId or slug).
 *
 * @param {string} planId
 * @returns {string} Cleaned identifier
 */
export const validatePlanIdentifier = (planId) => {
  if (!planId || typeof planId !== "string") {
    throw ApiError.badRequest("INVALID_PLAN_IDENTIFIER", "A valid plan ID or slug is required")
  }

  const clean = planId.trim()
  if (mongoose.Types.ObjectId.isValid(clean)) {
    return clean
  }

  if (VALID_PLAN_SLUGS.includes(clean.toLowerCase())) {
    return clean.toLowerCase()
  }

  throw ApiError.badRequest(
    "INVALID_PLAN_IDENTIFIER",
    `Plan identifier must be a valid ObjectId or one of: ${VALID_PLAN_SLUGS.join(", ")}`
  )
}

/**
 * Validates validity type.
 *
 * @param {string} validityType
 * @returns {string}
 */
export const validateValidityType = (validityType) => {
  if (!validityType) return "monthly"

  const clean = String(validityType).toLowerCase().trim()
  if (!VALID_VALIDITY_TYPES.includes(clean)) {
    throw ApiError.badRequest(
      "INVALID_VALIDITY_TYPE",
      `Validity type must be one of: ${VALID_VALIDITY_TYPES.join(", ")}`
    )
  }

  return clean
}

export default {
  validatePlanIdentifier,
  validateValidityType,
}
