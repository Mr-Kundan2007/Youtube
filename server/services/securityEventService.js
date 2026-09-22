import mongoose from "mongoose"
import DownloadSecurityEvent from "../Modals/DownloadSecurityEvent.js"
import DownloadRestriction from "../Modals/DownloadRestriction.js"
import DownloadRecord from "../Modals/DownloadRecord.js"
import securityPolicyService from "./securityPolicyService.js"
import downloadAuditService, { DownloadEvents } from "./downloadAuditService.js"
import { downloadSecurityConfig } from "../config/index.js"
import { ApiError } from "../utils/apiError.js"

/**
 * Service managing download security events, deduplication, aggregation, and admin review.
 */
export class SecurityEventService {
  constructor(config = downloadSecurityConfig) {
    this.config = config
  }

  /**
   * Records a security event with automatic deduplication / aggregation to prevent database flooding.
   */
  async recordEvent({
    userId = null,
    deviceId = "",
    downloadId = null,
    eventType,
    ipAddress = "",
    browser = "unknown",
    userAgent = "",
    metadata = {},
    customPoints = null,
  }) {
    if (!eventType) return null

    const points =
      customPoints !== null && customPoints !== undefined
        ? Number(customPoints)
        : Number(this.config?.riskPoints?.[eventType] || 10)

    const riskLevel = securityPolicyService.getRiskLevel(points)
    const windowMinutes = this.config?.deduplicationWindowMinutes || 5
    const windowThreshold = new Date(Date.now() - windowMinutes * 60 * 1000)

    // Deduplication check: look for an open event of identical type for this user/device within window
    const query = {
      eventType,
      status: "open",
      createdAt: { $gte: windowThreshold },
    }

    if (userId) query.$or = [{ userId }, { user_id: userId }]
    if (deviceId) query.deviceId = deviceId

    const existing = await DownloadSecurityEvent.findOne(query).sort({ createdAt: -1 })

    if (existing) {
      existing.event_count = (existing.event_count || 1) + 1
      existing.last_seen_at = new Date()
      if (ipAddress) existing.ipAddress = ipAddress
      if (metadata && Object.keys(metadata).length > 0) {
        existing.metadata = { ...existing.metadata, ...metadata, lastUpdated: new Date() }
      }
      await existing.save()
      return existing
    }

    // Create fresh security event record
    const event = await DownloadSecurityEvent.create({
      userId,
      user_id: userId,
      deviceId,
      device_id: deviceId,
      downloadId,
      download_id: downloadId,
      eventType,
      riskLevel,
      riskPoints: points,
      ipAddress,
      browser,
      userAgent,
      metadata,
      event_count: 1,
      first_seen_at: new Date(),
      last_seen_at: new Date(),
      status: "open",
    })

    downloadAuditService.logEvent(DownloadEvents.SECURITY_EVENT_CREATED, {
      userId,
      deviceId,
      downloadId,
      ip: ipAddress,
      reason: eventType,
      metadata: {
        eventId: event._id,
        eventType,
        riskLevel,
        riskPoints: points,
      },
    })

    return event
  }

  /**
   * Retrieves paginated security events with rich filtering for admin review.
   */
  async getEvents({
    page = 1,
    limit = 20,
    userId,
    deviceId,
    eventType,
    riskLevel,
    status,
    from,
    to,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20))
    const skip = (pageNum - 1) * limitNum

    const filter = {}
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      filter.$or = [{ userId }, { user_id: userId }]
    }
    if (deviceId) {
      filter.$or = [{ deviceId }, { device_id: deviceId }]
    }
    if (eventType) filter.eventType = eventType
    if (riskLevel) filter.riskLevel = riskLevel
    if (status) filter.status = status

    if (from || to) {
      filter.createdAt = {}
      if (from) filter.createdAt.$gte = new Date(from)
      if (to) filter.createdAt.$lte = new Date(to)
    }

    const safeSortFields = ["createdAt", "riskPoints", "event_count", "riskLevel", "updatedAt"]
    const sortField = safeSortFields.includes(sortBy) ? sortBy : "createdAt"
    const sortDirection = sortOrder === "asc" ? 1 : -1

    const [events, total] = await Promise.all([
      DownloadSecurityEvent.find(filter)
        .sort({ [sortField]: sortDirection })
        .skip(skip)
        .limit(limitNum)
        .populate("userId", "name email role")
        .populate("reviewedBy", "name email")
        .lean(),
      DownloadSecurityEvent.countDocuments(filter),
    ])

    // Summary counters
    const [openCount, highRiskCount, criticalCount] = await Promise.all([
      DownloadSecurityEvent.countDocuments({ status: "open" }),
      DownloadSecurityEvent.countDocuments({ riskLevel: "high" }),
      DownloadSecurityEvent.countDocuments({ riskLevel: "critical" }),
    ])

    return {
      events: events.map((e) => ({
        id: e._id,
        eventType: e.eventType,
        riskLevel: e.riskLevel,
        riskPoints: e.riskPoints,
        userId: e.userId?._id || e.userId,
        userName: e.userId?.name || "Unknown User",
        userEmail: e.userId?.email || "",
        deviceId: e.deviceId || e.device_id,
        downloadId: e.downloadId || e.download_id,
        ipAddress: e.ipAddress,
        browser: e.browser,
        status: e.status,
        eventCount: e.event_count || 1,
        firstSeenAt: e.first_seen_at,
        lastSeenAt: e.last_seen_at,
        reviewedBy: e.reviewedBy?.name || null,
        reviewedAt: e.reviewedAt,
        resolution: e.resolution,
        adminNotes: e.adminNotes || [],
        createdAt: e.createdAt,
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum) || 1,
        hasNext: pageNum * limitNum < total,
        hasPrev: pageNum > 1,
      },
      summary: {
        open: openCount,
        highRisk: highRiskCount,
        critical: criticalCount,
      },
    }
  }

  /**
   * Retrieves full details of a specific security event.
   */
  async getEventById(eventId) {
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      throw ApiError.badRequest("INVALID_EVENT_ID", "Invalid security event ID format")
    }

    const event = await DownloadSecurityEvent.findById(eventId)
      .populate("userId", "name email role")
      .populate("reviewedBy", "name email")
      .lean()

    if (!event) {
      throw ApiError.notFound("EVENT_NOT_FOUND", "Security event not found")
    }

    return {
      id: event._id,
      eventType: event.eventType,
      riskLevel: event.riskLevel,
      riskPoints: event.riskPoints,
      userId: event.userId?._id || event.userId,
      user: event.userId || null,
      deviceId: event.deviceId,
      downloadId: event.downloadId,
      ipAddress: event.ipAddress,
      browser: event.browser,
      userAgent: event.userAgent,
      metadata: event.metadata,
      eventCount: event.event_count || 1,
      status: event.status,
      resolution: event.resolution,
      reviewedBy: event.reviewedBy,
      reviewedAt: event.reviewedAt,
      adminNotes: event.adminNotes || [],
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
    }
  }

  /**
   * Updates status, resolution, and adds investigation note to an event.
   */
  async updateEventStatus(eventId, { status, resolution = null, adminId, note = "" }) {
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      throw ApiError.badRequest("INVALID_EVENT_ID", "Invalid security event ID format")
    }

    const event = await DownloadSecurityEvent.findById(eventId)
    if (!event) {
      throw ApiError.notFound("EVENT_NOT_FOUND", "Security event not found")
    }

    const validStatuses = ["open", "investigating", "resolved", "false_positive", "blocked"]
    if (status && validStatuses.includes(status)) {
      event.status = status
    }

    if (resolution) {
      event.resolution = resolution
    }

    if (adminId) {
      event.reviewedBy = adminId
      event.reviewedAt = new Date()
    }

    if (note && typeof note === "string") {
      event.adminNotes.push({
        adminId: adminId || null,
        note: note.trim(),
        action: resolution || status || "REVIEW_NOTE",
        createdAt: new Date(),
      })
    }

    await event.save()

    downloadAuditService.logEvent(DownloadEvents.SECURITY_EVENT_RESOLVED, {
      userId: event.userId,
      deviceId: event.deviceId,
      reason: resolution || status,
      metadata: {
        eventId: event._id,
        status: event.status,
        resolution: event.resolution,
        reviewedBy: adminId,
      },
    })

    return event
  }

  /**
   * Returns aggregated platform security statistics for dashboard overview.
   */
  async getSecuritySummary(timeRange = "30d") {
    let days = 30
    if (timeRange === "today" || timeRange === "1d") days = 1
    else if (timeRange === "yesterday" || timeRange === "2d") days = 2
    else if (timeRange === "7d") days = 7

    const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    const [
      totalDownloads,
      flaggedDownloads,
      blockedDownloads,
      openEvents,
      highRiskEvents,
      criticalEvents,
      activeRestrictions,
      eventBreakdown,
    ] = await Promise.all([
      DownloadRecord.countDocuments({ createdAt: { $gte: threshold } }),
      DownloadRecord.countDocuments({ createdAt: { $gte: threshold }, securityFlagged: true }),
      DownloadRecord.countDocuments({
        createdAt: { $gte: threshold },
        download_status: "blocked",
      }),
      DownloadSecurityEvent.countDocuments({ status: "open", createdAt: { $gte: threshold } }),
      DownloadSecurityEvent.countDocuments({ riskLevel: "high", createdAt: { $gte: threshold } }),
      DownloadSecurityEvent.countDocuments({ riskLevel: "critical", createdAt: { $gte: threshold } }),
      DownloadRestriction.countDocuments({ status: "active", expiresAt: { $gt: new Date() } }),
      DownloadSecurityEvent.aggregate([
        { $match: { createdAt: { $gte: threshold } } },
        { $group: { _id: "$eventType", count: { $sum: "$event_count" } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
    ])

    return {
      timeRange,
      downloads: {
        total: totalDownloads,
        flagged: flaggedDownloads,
        blocked: blockedDownloads,
      },
      securityEvents: {
        open: openEvents,
        highRisk: highRiskEvents,
        critical: criticalEvents,
        topTypes: eventBreakdown.map((b) => ({ type: b._id, count: b.count })),
      },
      restrictions: {
        active: activeRestrictions,
      },
    }
  }
}

export const securityEventService = new SecurityEventService()
export default securityEventService
