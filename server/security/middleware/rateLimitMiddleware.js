import { getClientIp, hashIp } from "../utils/ipUtils.js"
import securityAuditService from "../services/securityAuditService.js"
import { logger } from "../../utils/logger.js"

/**
 * Creates a sliding-window memory rate limiting middleware.
 */
export const createRateLimiter = ({
  windowMs = 60 * 1000,
  max = 60,
  category = "GENERAL",
  message = "Too many requests. Please try again later.",
  enforceInTest = false,
} = {}) => {
  const store = new Map()

  // Periodic cleanup every 5 minutes to prevent memory leaks
  const cleanupInterval = setInterval(() => {
    const now = Date.now()
    for (const [key, timestamps] of store.entries()) {
      const validTimestamps = timestamps.filter((t) => now - t < windowMs)
      if (validTimestamps.length === 0) {
        store.delete(key)
      } else {
        store.set(key, validTimestamps)
      }
    }
  }, 5 * 60 * 1000)

  // Unref cleanup timer so it doesn't hold open test processes
  if (cleanupInterval.unref) cleanupInterval.unref()

  return async (req, res, next) => {
    // In test environment, bypass rate limiting unless explicitly forced
    const isTestMode = process.env.NODE_ENV === "test"
    const forceTestEnforcement =
      enforceInTest ||
      req.headers["x-test-enforce-rate-limit"] === "true" ||
      req.headers["x-force-rate-limit"] === "true"

    if (isTestMode && !forceTestEnforcement) {
      return next()
    }

    const ip = getClientIp(req)
    const userId = req.user?.id || req.user?._id
    // Key by user ID when authenticated, else client IP
    const clientKey = userId ? `user:${userId}:${category}` : `ip:${ip}:${category}`

    const now = Date.now()
    const timestamps = store.get(clientKey) || []
    const windowStart = now - windowMs

    // Filter out expired timestamps
    const activeTimestamps = timestamps.filter((t) => t > windowStart)

    if (activeTimestamps.length >= max) {
      const oldestInWindow = activeTimestamps[0]
      const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - oldestInWindow)) / 1000))
      const resetTime = Math.ceil((oldestInWindow + windowMs) / 1000)

      res.setHeader("Retry-After", String(retryAfterSec))
      res.setHeader("X-RateLimit-Limit", String(max))
      res.setHeader("X-RateLimit-Remaining", "0")
      res.setHeader("X-RateLimit-Reset", String(resetTime))

      // Asynchronously audit rate limit breach
      securityAuditService
        .recordEvent({
          eventType: "RATE_LIMIT_TRIGGERED",
          severity: category === "AUTH" || category === "PAYMENT" ? "MEDIUM" : "LOW",
          userId: userId || null,
          riskScore: category === "AUTH" || category === "PAYMENT" ? 30 : 15,
          ipHash: hashIp(ip),
          userAgent: req.headers["user-agent"],
          requestId: req.id || req.headers["x-request-id"],
          safeMetadata: {
            category,
            limit: max,
            windowMs,
            path: req.originalUrl || req.url,
            method: req.method,
          },
        })
        .catch((err) => logger.warn("[RateLimit] Failed to audit rate limit:", err.message))

      return res.status(429).json({
        success: false,
        error: message,
        code: "RATE_LIMIT_EXCEEDED",
        retryAfter: retryAfterSec,
      })
    }

    // Record this request
    activeTimestamps.push(now)
    store.set(clientKey, activeTimestamps)

    const remaining = Math.max(0, max - activeTimestamps.length)
    const resetTime = Math.ceil((activeTimestamps[0] + windowMs) / 1000)

    res.setHeader("X-RateLimit-Limit", String(max))
    res.setHeader("X-RateLimit-Remaining", String(remaining))
    res.setHeader("X-RateLimit-Reset", String(resetTime))

    return next()
  }
}

// 1. Auth Rate Limiter: 10 requests / 15 minutes (Brute-force protection)
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  category: "AUTH",
  message: "Too many authentication attempts. Please try again later.",
})

// 2. Payment Rate Limiter: 10 requests / minute
export const paymentRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  category: "PAYMENT",
  message: "Too many payment requests. Please wait a moment before trying again.",
})

// 3. Admin Rate Limiter: 30 requests / minute
export const adminRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  category: "ADMIN",
  message: "Admin request threshold exceeded. Please try again later.",
})

// 4. Download Rate Limiter: 30 requests / minute
export const downloadRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  category: "DOWNLOAD",
  message: "Too many download requests. Please wait before retrying.",
})

// 5. General API Rate Limiter: 120 requests / minute
export const generalApiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 120,
  category: "GENERAL",
  message: "API rate limit exceeded. Please try again later.",
})
