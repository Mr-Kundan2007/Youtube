import securityAuditService from "../services/securityAuditService.js"
import { getClientIp, hashIp } from "../utils/ipUtils.js"
import { logger } from "../../utils/logger.js"

// Suspicious patterns (NoSQL injection, path traversal, script injection attempts)
const SUSPICIOUS_PATTERNS = [
  /\.\.\//, // Path traversal
  /\$where/i, // MongoDB $where operator
  /\$regex/i, // MongoDB $regex injection
  /\$gt|\$ne|\$lt/i, // Operator injection in plain string bodies
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, // Basic XSS
]

function hasSuspiciousPattern(val) {
  if (typeof val === "string") {
    return SUSPICIOUS_PATTERNS.some((pattern) => pattern.test(val))
  }
  if (typeof val === "object" && val !== null) {
    return Object.entries(val).some(
      ([k, v]) =>
        k.startsWith("$") || hasSuspiciousPattern(k) || hasSuspiciousPattern(v)
    )
  }
  return false
}

/**
 * Middleware inspecting incoming requests for common exploitation patterns.
 */
export const detectSuspiciousActivity = (req, res, next) => {
  const ip = getClientIp(req)
  const userId = req.user?.id || req.user?._id

  // Check URL query parameters
  const isQuerySuspicious = hasSuspiciousPattern(req.query)
  // Check body (if parsed)
  const isBodySuspicious = hasSuspiciousPattern(req.body)

  if (isQuerySuspicious || isBodySuspicious) {
    logger.warn(`[SuspiciousActivity] Flagged malicious payload from IP ${ip} on ${req.originalUrl}`)

    // Record audit event asynchronously
    securityAuditService
      .recordEvent({
        eventType: "API_ABUSE_DETECTED",
        severity: "HIGH",
        userId: userId || null,
        riskScore: 70,
        ipHash: hashIp(ip),
        userAgent: req.headers["user-agent"],
        requestId: req.id || req.headers["x-request-id"],
        safeMetadata: {
          path: req.originalUrl,
          method: req.method,
          suspiciousQuery: isQuerySuspicious,
          suspiciousBody: isBodySuspicious,
        },
      })
      .catch((err) => logger.warn("[SuspiciousActivity] Audit failed:", err.message))

    return res.status(400).json({
      success: false,
      error: "Malicious or invalid request payload detected.",
      code: "SUSPICIOUS_PAYLOAD",
    })
  }

  next()
}

export default detectSuspiciousActivity
