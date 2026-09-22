import mongoose from "mongoose"
import DownloadRestriction from "../Modals/DownloadRestriction.js"
import downloadAuditService, { DownloadEvents } from "./downloadAuditService.js"
import { downloadSecurityConfig } from "../config/index.js"
import { ApiError } from "../utils/apiError.js"

/**
 * Service managing temporary and permanent download restrictions for users, devices, and IPs.
 */
export class RestrictionService {
  constructor(config = downloadSecurityConfig) {
    this.config = config
  }

  /**
   * Checks if user, device, or IP currently has an active, non-expired restriction.
   * Auto-expires stale restrictions encountered during lookup.
   */
  async checkActiveRestrictions({ userId, deviceId, ipAddress } = {}) {
    if (!userId && !deviceId && !ipAddress) {
      return { isRestricted: false, restriction: null }
    }

    const isLoopback =
      !ipAddress ||
      ["127.0.0.1", "::1", "::ffff:127.0.0.1", "localhost"].includes(String(ipAddress).toLowerCase().trim())

    const conditions = []
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      conditions.push({ userId }, { user_id: userId })
    }
    const isGenericDevice =
      !deviceId ||
      ["web", "unknown", "browser", "default"].includes(String(deviceId).toLowerCase().trim())

    if (deviceId && !isGenericDevice) {
      conditions.push({ deviceId }, { device_id: deviceId })
    }
    if (ipAddress && !isLoopback) {
      // Pure IP restrictions target the IP specifically (no user binding)
      conditions.push({ ipAddress, userId: null })
    }

    if (conditions.length === 0) {
      return { isRestricted: false, restriction: null }
    }

    const candidates = await DownloadRestriction.find({
      status: "active",
      $or: conditions,
    }).sort({ createdAt: -1 })

    const now = new Date()
    for (const res of candidates) {
      if (res.expiresAt && res.expiresAt < now) {
        // Auto-expire stale restriction
        res.status = "expired"
        await res.save().catch(() => {})
      } else {
        // Active non-expired restriction found
        return {
          isRestricted: true,
          restriction: {
            id: res._id,
            restrictionType: res.restrictionType,
            reason: res.reason,
            expiresAt: res.expiresAt,
            createdAt: res.createdAt,
            createdBy: res.createdBy,
          },
        }
      }
    }

    return { isRestricted: false, restriction: null }
  }

  /**
   * Creates a download restriction (automated or manual admin action).
   */
  async createRestriction({
    userId = null,
    deviceId = "",
    ipAddress = "",
    restrictionType = "DOWNLOAD_RESTRICTED",
    reason,
    durationMinutes = null,
    createdBy = "system",
    securityEventId = null,
    metadata = {},
  } = {}) {
    if (!reason) {
      throw ApiError.badRequest("REASON_REQUIRED", "Restriction reason is required")
    }

    const duration =
      durationMinutes !== null && durationMinutes !== undefined
        ? Number(durationMinutes)
        : (this.config?.tempRestrictionMinutes || 30)

    const expiresAt = new Date(Date.now() + duration * 60 * 1000)

    const restriction = await DownloadRestriction.create({
      userId,
      user_id: userId,
      deviceId,
      device_id: deviceId,
      ipAddress,
      restrictionType,
      reason,
      status: "active",
      expiresAt,
      createdBy,
      securityEventId,
      metadata,
    })

    downloadAuditService.logEvent(DownloadEvents.RESTRICTION_CREATED, {
      userId,
      deviceId,
      ip: ipAddress,
      reason,
      metadata: {
        restrictionId: restriction._id,
        restrictionType,
        expiresAt,
        durationMinutes: duration,
        createdBy,
      },
    })

    return restriction
  }

  /**
   * Removes or lifts an active restriction manually.
   */
  async removeRestriction({ restrictionId, adminId = null, reason = "Admin manually lifted restriction" } = {}) {
    if (!restrictionId || !mongoose.Types.ObjectId.isValid(restrictionId)) {
      throw ApiError.badRequest("INVALID_RESTRICTION_ID", "Invalid restriction ID")
    }

    const restriction = await DownloadRestriction.findById(restrictionId)
    if (!restriction) {
      throw ApiError.notFound("RESTRICTION_NOT_FOUND", "Restriction not found")
    }

    restriction.status = "removed"
    restriction.removedBy = adminId || null
    restriction.removedAt = new Date()
    restriction.removalReason = reason
    await restriction.save()

    downloadAuditService.logEvent(DownloadEvents.RESTRICTION_REMOVED, {
      userId: restriction.userId,
      deviceId: restriction.deviceId,
      reason,
      metadata: {
        restrictionId: restriction._id,
        removedBy: adminId,
      },
    })

    return restriction
  }

  /**
   * Lists restrictions with pagination and filters for admin review.
   */
  async getRestrictions({ page = 1, limit = 20, userId, deviceId, status } = {}) {
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
    if (status) filter.status = status

    const [restrictions, total] = await Promise.all([
      DownloadRestriction.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate("userId", "name email")
        .populate("removedBy", "name email")
        .lean(),
      DownloadRestriction.countDocuments(filter),
    ])

    return {
      restrictions: restrictions.map((r) => ({
        id: r._id,
        userId: r.userId?._id || r.userId,
        userName: r.userId?.name || "Unknown User",
        userEmail: r.userId?.email || "",
        deviceId: r.deviceId || r.device_id,
        ipAddress: r.ipAddress,
        restrictionType: r.restrictionType,
        reason: r.reason,
        status: r.status,
        expiresAt: r.expiresAt,
        createdBy: r.createdBy,
        createdAt: r.createdAt,
        removedBy: r.removedBy?.name || null,
        removedAt: r.removedAt,
        removalReason: r.removalReason,
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum) || 1,
        hasNext: pageNum * limitNum < total,
        hasPrev: pageNum > 1,
      },
    }
  }
}

export const restrictionService = new RestrictionService()
export default restrictionService
