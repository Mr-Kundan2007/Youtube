import { ApiError } from "../utils/apiError.js"
import { sendError } from "../utils/apiResponse.js"
import { logger, MeetingEvents } from "../utils/logger.js"

/**
 * In-Memory Sliding Window Rate Limiter.
 * Tracks requests per client key (IP or user ID) within a time window.
 */
export class MemoryRateLimiter {
  constructor(windowMs, maxRequests, categoryName) {
    this.windowMs = windowMs
    this.maxRequests = maxRequests
    this.categoryName = categoryName
    this.hits = new Map() // key -> [{ timestamp }]

    // Cleanup stale entries every 5 minutes to avoid memory leaks
    setInterval(() => this.cleanup(), 5 * 60 * 1000).unref()
  }

  cleanup() {
    const now = Date.now()
    for (const [key, timestamps] of this.hits.entries()) {
      const valid = timestamps.filter((t) => now - t < this.windowMs)
      if (valid.length === 0) {
        this.hits.delete(key)
      } else {
        this.hits.set(key, valid)
      }
    }
  }

  middleware() {
    return (req, res, next) => {
      if (process.env.NODE_ENV === "test") {
        return next()
      }

      const clientIp =
        req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
        req.socket.remoteAddress ||
        "127.0.0.1"

      // Use user ID if authenticated, otherwise IP
      const clientKey = req.user?.id ? `user_${req.user.id}` : `ip_${clientIp}`
      const now = Date.now()

      const userHits = this.hits.get(clientKey) || []
      const windowHits = userHits.filter((time) => now - time < this.windowMs)

      if (windowHits.length >= this.maxRequests) {
        const oldestHit = windowHits[0]
        const retryAfterSeconds = Math.ceil((this.windowMs - (now - oldestHit)) / 1000)

        res.setHeader("Retry-After", String(retryAfterSeconds))

        logger.warn(MeetingEvents.RATE_LIMIT_EXCEEDED, {
          category: this.categoryName,
          clientKey,
          limit: this.maxRequests,
          retryAfterSeconds,
        })

        return sendError(
          res,
          new ApiError(
            429,
            "RATE_LIMIT_EXCEEDED",
            `Too many requests for ${this.categoryName}. Please retry after ${retryAfterSeconds} seconds.`
          ),
          429
        )
      }

      windowHits.push(now)
      this.hits.set(clientKey, windowHits)
      next()
    }
  }
}

// 1. Meeting creation limiter: max 10 rooms per 15 minutes
export const createMeetingLimiter = new MemoryRateLimiter(
  15 * 60 * 1000,
  10,
  "meeting-creation"
).middleware()

// 2. Token generation limiter: max 30 tokens per minute
export const meetingTokenLimiter = new MemoryRateLimiter(
  60 * 1000,
  30,
  "token-generation"
).middleware()

// 3. General meeting query limiter: max 120 requests per minute
export const generalMeetingLimiter = new MemoryRateLimiter(
  60 * 1000,
  120,
  "meeting-api"
).middleware()

// 4. Auth & Session operations limiter: max 20 requests per 5 minutes
export const authSecurityLimiter = new MemoryRateLimiter(
  5 * 60 * 1000,
  20,
  "auth-security"
).middleware()

// 5. In-call chat message limiter: max 60 messages per minute
export const chatLimiter = new MemoryRateLimiter(
  60 * 1000,
  60,
  "chat-messages"
).middleware()

// 6. File sharing upload limiter: max 15 uploads per minute
export const fileUploadLimiter = new MemoryRateLimiter(
  60 * 1000,
  15,
  "file-uploads"
).middleware()

// 7. Meeting recording actions limiter: max 20 requests per minute
export const recordingLimiter = new MemoryRateLimiter(
  60 * 1000,
  20,
  "recording-actions"
).middleware()

// 8. Download authorization limiter: max 30 authorization attempts per minute
export const downloadAuthLimiter = new MemoryRateLimiter(
  60 * 1000,
  30,
  "download-authorization"
).middleware()

// 9. General download queries limiter: max 120 queries per minute
export const downloadQueryLimiter = new MemoryRateLimiter(
  60 * 1000,
  120,
  "download-queries"
).middleware()

// 10. Download token validation limiter: max 60 token validations per minute
export const downloadTokenValidationLimiter = new MemoryRateLimiter(
  60 * 1000,
  60,
  "download-token-validation"
).middleware()

