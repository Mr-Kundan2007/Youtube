import mongoose from "mongoose"
import SubscriptionSecurityEvent from "../../Modals/SubscriptionSecurityEvent.js"
import { sanitizeMetadata } from "../utils/securityUtils.js"
import { getClientIp, hashIp, parseUserAgent } from "../utils/ipUtils.js"
import { logger } from "../../utils/logger.js"

export class SecurityAuditService {
  /**
   * Records a sanitized security event in database and emits structured logs.
   */
  static async recordEvent({
    eventType,
    userId = null,
    severity = "LOW",
    riskScore = 0,
    safeMetadata = {},
    relatedTransactionId = null,
    relatedSubscriptionId = null,
    orderId = null,
    req = null,
    ip = null,
    userAgent = null,
    adminNotes = null,
  }) {
    if (!eventType) return null

    const resolvedIp = ip || (req ? getClientIp(req) : null)
    const ipHash = resolvedIp ? hashIp(resolvedIp) : null
    const uaSummary = userAgent || (req ? parseUserAgent(req).summary : null)
    const requestId = req?.requestId || req?.id || null

    const cleanedMeta = sanitizeMetadata(safeMetadata)

    // Ensure valid MongoDB ObjectIds
    let validUserId = null
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      validUserId = userId
    } else if (userId) {
      cleanedMeta.originalUserId = String(userId)
    }

    let validTxId = null
    if (relatedTransactionId && mongoose.Types.ObjectId.isValid(relatedTransactionId)) {
      validTxId = relatedTransactionId
    }

    let validSubId = null
    if (relatedSubscriptionId && mongoose.Types.ObjectId.isValid(relatedSubscriptionId)) {
      validSubId = relatedSubscriptionId
    }

    try {
      const event = await SubscriptionSecurityEvent.create({
        eventType,
        userId: validUserId,
        severity,
        riskScore,
        safeMetadata: cleanedMeta,
        relatedTransactionId: validTxId,
        relatedSubscriptionId: validSubId,
        orderId,
        ipHash,
        ip: resolvedIp ? resolvedIp.slice(0, 45) : null,
        userAgent: uaSummary,
        requestId,
        adminNotes,
        status: "OPEN",
        timestamp: new Date(),
      })

      // Log structured output
      if (severity === "CRITICAL" || severity === "HIGH") {
        logger.warn(`[SecurityAudit] ${severity} Event: ${eventType}`, {
          userId,
          riskScore,
          orderId,
          ...cleanedMeta,
        })
      } else {
        logger.info(`[SecurityAudit] Event: ${eventType}`, {
          userId,
          riskScore,
        })
      }

      return event
    } catch (err) {
      console.error("[SecurityAuditService] Error saving event:", err.message)
      return null
    }
  }

  /**
   * Retrieves paginated security events with filtering.
   */
  static async listEvents({
    page = 1,
    limit = 20,
    eventType = null,
    severity = null,
    status = null,
    userId = null,
    from = null,
    to = null,
  } = {}) {
    const p = Math.max(1, parseInt(page, 10) || 1)
    const lim = Math.min(100, Math.max(1, parseInt(limit, 10) || 20))
    const skip = (p - 1) * lim

    const query = {}
    if (eventType && eventType !== "all") query.eventType = eventType
    if (severity && severity !== "all") query.severity = severity
    if (status && status !== "all") query.status = status
    if (userId) query.userId = userId

    if (from || to) {
      query.createdAt = {}
      if (from) query.createdAt.$gte = new Date(from)
      if (to) query.createdAt.$lte = new Date(to)
    }

    const [total, events] = await Promise.all([
      SubscriptionSecurityEvent.countDocuments(query),
      SubscriptionSecurityEvent.find(query)
        .populate("userId", "name email")
        .populate("reviewedBy", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(lim)
        .lean(),
    ])

    return {
      events,
      pagination: {
        total,
        page: p,
        limit: lim,
        totalPages: Math.ceil(total / lim) || 1,
      },
    }
  }

  /**
   * Reviews and updates status of a security event.
   */
  static async updateEventStatus(arg1, arg2) {
    let targetEventId
    let status
    let adminNotes
    let reviewedBy

    if (arg1 && typeof arg1 === "object" && !(arg1 instanceof mongoose.Types.ObjectId)) {
      targetEventId = arg1.eventId || arg1.id || arg1._id
      status = arg1.status
      adminNotes = arg1.adminNotes
      reviewedBy = arg1.reviewedBy || arg1.adminId
    } else {
      targetEventId = arg1
      status = arg2?.status
      adminNotes = arg2?.adminNotes
      reviewedBy = arg2?.reviewedBy || arg2?.adminId
    }

    if (!adminNotes || typeof adminNotes !== "string" || !adminNotes.trim()) {
      throw new Error("Admin notes are mandatory to review or resolve a security event.")
    }

    const event = await SubscriptionSecurityEvent.findById(targetEventId)
    if (!event) {
      throw new Error(`Security event with ID '${targetEventId}' not found.`)
    }

    if (status) event.status = status
    event.adminNotes = adminNotes.trim()
    if (reviewedBy) {
      event.reviewedBy = reviewedBy
      event.reviewedAt = new Date()
    }

    await event.save()
    return event
  }
}

export default SecurityAuditService
