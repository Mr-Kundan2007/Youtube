import mongoose from "mongoose"
import SecurityEvent from "../Modals/SecurityEvent.js"
import { logger } from "../utils/logger.js"

const REDACT_SUBSTRINGS = [
  "password",
  "token",
  "jwt",
  "secret",
  "key",
  "credential",
  "authorization",
]

const sanitizeMetadata = (obj) => {
  if (!obj || typeof obj !== "object") return obj
  const out = Array.isArray(obj) ? [] : {}
  for (const [k, v] of Object.entries(obj)) {
    const lower = k.toLowerCase()
    const isSensitive = REDACT_SUBSTRINGS.some((s) => lower.includes(s))
    if (isSensitive) {
      out[k] = "[REDACTED]"
    } else if (v && typeof v === "object") {
      out[k] = sanitizeMetadata(v)
    } else {
      out[k] = v
    }
  }
  return out
}

export class SecurityAuditService {
  /**
   * Logs and persists a structured security audit event.
   */
  static async logEvent(eventType, payload = {}) {
    const {
      userId = null,
      meetingId = null,
      roomId = null,
      targetId = null,
      severity = "INFO",
      metadata = {},
      ip = null,
      req = null,
    } = payload

    const clientIp =
      ip ||
      req?.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req?.socket?.remoteAddress ||
      null

    const cleanedMeta = sanitizeMetadata(metadata)

    // 1. Structured console logging
    if (severity === "CRITICAL" || severity === "WARN") {
      logger.warn(eventType, {
        userId,
        roomId,
        targetId,
        ...cleanedMeta,
      })
    } else {
      logger.info(eventType, {
        userId,
        roomId,
        targetId,
        ...cleanedMeta,
      })
    }

    // 2. Persistent storage for audit queries
    if (mongoose.connection?.readyState === 1) {
      try {
        await SecurityEvent.create({
          eventType,
          userId: userId ? String(userId) : null,
          meetingId,
          roomId,
          targetId: targetId ? String(targetId) : null,
          severity,
          ip: clientIp,
          metadata: cleanedMeta,
          timestamp: new Date(),
        })
      } catch (err) {
        console.warn("SecurityAuditService: failed to persist audit event", err.message)
      }
    }
  }

  /**
   * Fetches the security audit trail for a meeting room (Host/Admin access).
   */
  static async getRoomAuditTrail(roomId, limit = 50) {
    if (!roomId) return []
    return SecurityEvent.find({ roomId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean()
  }
}

export const securityAudit = SecurityAuditService
export const securityAuditService = SecurityAuditService
export default SecurityAuditService

