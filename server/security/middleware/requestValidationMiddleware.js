import { ApiError } from "../../utils/apiError.js"

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/
const VALID_PLANS = new Set(["free", "bronze", "silver", "gold"])
const VALID_CYCLES = new Set(["monthly", "quarterly", "yearly", "annual"])

/**
 * Validates that a route param conforms to a 24-character hexadecimal MongoDB ObjectId.
 */
export const validateObjectId = (paramName = "id") => {
  return (req, res, next) => {
    const val = req.params[paramName]
    if (!val || !OBJECT_ID_REGEX.test(val)) {
      return res.status(400).json({
        success: false,
        error: `Invalid identifier format for '${paramName}'`,
        code: "INVALID_OBJECT_ID",
      })
    }
    next()
  }
}

/**
 * Validates query pagination parameters (page, limit) to prevent memory exhaustion.
 */
export const validatePagination = (req, res, next) => {
  const { page, limit } = req.query

  if (page !== undefined) {
    const pageNum = Number(page)
    if (!Number.isInteger(pageNum) || pageNum < 1) {
      return res.status(400).json({
        success: false,
        error: "Query parameter 'page' must be a positive integer",
        code: "INVALID_PAGINATION",
      })
    }
  }

  if (limit !== undefined) {
    const limitNum = Number(limit)
    if (!Number.isInteger(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        success: false,
        error: "Query parameter 'limit' must be an integer between 1 and 100",
        code: "INVALID_PAGINATION",
      })
    }
  }

  next()
}

/**
 * Validates that requested plan key / tier is recognized by the subscription system.
 */
export const validatePlanTier = (req, res, next) => {
  const plan = (req.body?.planKey || req.body?.planId || req.body?.plan || req.query?.plan || "").toLowerCase()

  if (plan && !OBJECT_ID_REGEX.test(plan) && !VALID_PLANS.has(plan)) {
    return res.status(400).json({
      success: false,
      error: `Invalid plan tier: '${plan}'. Allowed plans: ${Array.from(VALID_PLANS).join(", ")}`,
      code: "INVALID_PLAN_TIER",
    })
  }

  next()
}

/**
 * Validates date ranges in query filters or body payload.
 */
export const validateDateRange = (req, res, next) => {
  const startDate = req.query?.startDate || req.body?.startDate
  const endDate = req.query?.endDate || req.body?.endDate

  if (startDate) {
    const start = new Date(startDate)
    if (isNaN(start.getTime())) {
      return res.status(400).json({
        success: false,
        error: "Invalid startDate format. ISO 8601 string expected.",
        code: "INVALID_DATE_RANGE",
      })
    }
  }

  if (endDate) {
    const end = new Date(endDate)
    if (isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        error: "Invalid endDate format. ISO 8601 string expected.",
        code: "INVALID_DATE_RANGE",
      })
    }
  }

  if (startDate && endDate) {
    const start = new Date(startDate)
    const end = new Date(endDate)
    if (start > end) {
      return res.status(400).json({
        success: false,
        error: "startDate must not be greater than endDate",
        code: "INVALID_DATE_RANGE",
      })
    }
  }

  next()
}

/**
 * Validates that an amount parameter is a positive number.
 */
export const validatePositiveAmount = (fieldName = "amount") => {
  return (req, res, next) => {
    const val = req.body?.[fieldName]
    if (val !== undefined && val !== null) {
      const num = Number(val)
      if (isNaN(num) || num <= 0) {
        return res.status(400).json({
          success: false,
          error: `Field '${fieldName}' must be a positive number`,
          code: "INVALID_AMOUNT",
        })
      }
    }
    next()
  }
}
