import mongoose from "mongoose"
import securityEventService from "../services/securityEventService.js"
import restrictionService from "../services/restrictionService.js"
import deviceService from "../services/deviceService.js"
import DownloadRecord from "../Modals/DownloadRecord.js"
import Device from "../Modals/Device.js"
import { sendSuccess, sendError } from "../utils/apiResponse.js"
import { ApiError } from "../utils/apiError.js"

/**
 * Controller handling Admin Security & Monitoring endpoints:
 * /api/admin/security/events, /api/admin/security/restrictions,
 * /api/admin/security/devices, /api/admin/security/downloads, /api/admin/security/summary.
 */

/**
 * Lists paginated security events with rich filtering.
 * GET /api/admin/security/events
 */
export const getSecurityEventsHandler = async (req, res) => {
  try {
    const result = await securityEventService.getEvents(req.query)
    return res.status(200).json({
      success: true,
      data: result,
    })
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Retrieves details of a specific security event.
 * GET /api/admin/security/events/:eventId
 */
export const getSecurityEventByIdHandler = async (req, res) => {
  try {
    const result = await securityEventService.getEventById(req.params.eventId)
    return res.status(200).json({
      success: true,
      data: result,
    })
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Updates status, sets resolution, or adds investigation note to a security event.
 * PATCH /api/admin/security/events/:eventId
 */
export const updateSecurityEventHandler = async (req, res) => {
  try {
    const { status, resolution, note } = req.body
    const adminId = req.user?.id

    const result = await securityEventService.updateEventStatus(req.params.eventId, {
      status,
      resolution,
      adminId,
      note,
    })

    return res.status(200).json({
      success: true,
      message: "Security event updated successfully",
      data: result,
    })
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Creates a manual user or device download restriction.
 * POST /api/admin/security/restrictions
 */
export const createRestrictionHandler = async (req, res) => {
  try {
    const { userId, deviceId, ipAddress, restrictionType, reason, durationMinutes, metadata } = req.body
    const adminId = req.user?.id || "admin"

    if (!reason) {
      throw ApiError.badRequest("REASON_REQUIRED", "Restriction reason is required")
    }

    const restriction = await restrictionService.createRestriction({
      userId,
      deviceId,
      ipAddress,
      restrictionType,
      reason,
      durationMinutes,
      createdBy: adminId,
      metadata,
    })

    return res.status(201).json({
      success: true,
      message: "Download restriction created successfully",
      data: restriction,
    })
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Removes / lifts an active restriction manually.
 * DELETE /api/admin/security/restrictions/:restrictionId
 */
export const removeRestrictionHandler = async (req, res) => {
  try {
    const { reason } = req.body || {}
    const adminId = req.user?.id

    const restriction = await restrictionService.removeRestriction({
      restrictionId: req.params.restrictionId,
      adminId,
      reason,
    })

    return res.status(200).json({
      success: true,
      message: "Restriction removed successfully",
      data: restriction,
    })
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Lists restrictions with pagination.
 * GET /api/admin/security/restrictions
 */
export const getRestrictionsHandler = async (req, res) => {
  try {
    const result = await restrictionService.getRestrictions(req.query)
    return res.status(200).json({
      success: true,
      data: result,
    })
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Blocks a specific device across the platform.
 * POST /api/admin/security/devices/:deviceId/block
 */
export const blockDeviceHandler = async (req, res) => {
  try {
    const deviceId = req.params.deviceId
    const { reason, durationMinutes } = req.body || {}
    const adminId = req.user?.id || "admin"

    if (!deviceId) {
      throw ApiError.badRequest("DEVICE_ID_REQUIRED", "Device ID is required")
    }

    // Update status in Device collection if exists
    await Device.updateMany(
      { device_identifier: deviceId },
      { $set: { status: "blocked" } }
    )

    // Create corresponding active restriction
    const restriction = await restrictionService.createRestriction({
      deviceId,
      restrictionType: "DEVICE_RESTRICTED",
      reason: reason || "Device blocked by administrator",
      durationMinutes: durationMinutes || 43200, // default 30 days
      createdBy: adminId,
    })

    return res.status(200).json({
      success: true,
      message: `Device ${deviceId} has been blocked successfully`,
      data: {
        deviceId,
        status: "blocked",
        restriction,
      },
    })
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Unblocks a device.
 * POST /api/admin/security/devices/:deviceId/unblock
 */
export const unblockDeviceHandler = async (req, res) => {
  try {
    const deviceId = req.params.deviceId
    const adminId = req.user?.id

    if (!deviceId) {
      throw ApiError.badRequest("DEVICE_ID_REQUIRED", "Device ID is required")
    }

    // Set status to active in Device collection
    await Device.updateMany(
      { device_identifier: deviceId, status: "blocked" },
      { $set: { status: "active" } }
    )

    // Remove active restrictions for this device
    await restrictionService.removeRestriction({
      restrictionId: req.body.restrictionId,
      adminId,
      reason: "Device unblocked by administrator",
    }).catch(() => {})

    return res.status(200).json({
      success: true,
      message: `Device ${deviceId} has been unblocked successfully`,
      data: {
        deviceId,
        status: "active",
      },
    })
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Admin download monitoring query with risk level filters and pagination.
 * GET /api/admin/security/downloads
 */
export const getAdminDownloadsMonitoringHandler = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      userId,
      videoId,
      deviceId,
      plan,
      status,
      riskLevel,
      securityFlagged,
      from,
      to,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query

    const pageNum = Math.max(1, parseInt(page, 10) || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20))
    const skip = (pageNum - 1) * limitNum

    const filter = { deleted_at: null }

    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      filter.$or = [{ userId }, { user_id: userId }]
    }
    if (videoId && mongoose.Types.ObjectId.isValid(videoId)) {
      filter.videoId = videoId
    }
    if (deviceId) {
      filter.device_id = deviceId
    }
    if (plan) {
      filter.subscription_plan = plan
    }
    if (status) {
      filter.download_status = status
    }
    if (riskLevel) {
      filter.riskLevel = riskLevel
    }
    if (securityFlagged !== undefined) {
      filter.securityFlagged = securityFlagged === "true" || securityFlagged === true
    }

    if (from || to) {
      filter.createdAt = {}
      if (from) filter.createdAt.$gte = new Date(from)
      if (to) filter.createdAt.$lte = new Date(to)
    }

    const safeSortFields = ["createdAt", "file_size", "download_requested_at", "riskLevel"]
    const sortField = safeSortFields.includes(sortBy) ? sortBy : "createdAt"
    const sortDirection = sortOrder === "asc" ? 1 : -1

    const [downloads, total] = await Promise.all([
      DownloadRecord.find(filter)
        .sort({ [sortField]: sortDirection })
        .skip(skip)
        .limit(limitNum)
        .populate("userId", "name email")
        .populate("videoId", "videotitle")
        .lean(),
      DownloadRecord.countDocuments(filter),
    ])

    return res.status(200).json({
      success: true,
      data: {
        downloads: downloads.map((d) => ({
          id: d._id,
          userId: d.userId?._id || d.userId,
          userName: d.userId?.name || "Unknown User",
          userEmail: d.userId?.email || "",
          videoId: d.videoId?._id || d.videoId,
          videoTitle: d.videoTitle || d.videoId?.videotitle || "Untitled Video",
          plan: d.subscription_plan,
          status: d.download_status,
          deviceId: d.device_id,
          deviceType: d.device_type,
          browser: d.browser,
          ipAddress: d.ip_address,
          riskLevel: d.riskLevel || "low",
          securityFlagged: Boolean(d.securityFlagged),
          securityFlags: d.security_flags || [],
          requestedAt: d.download_requested_at,
          startedAt: d.download_started_at,
          completedAt: d.download_completed_at,
          createdAt: d.createdAt,
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum) || 1,
          hasNext: pageNum * limitNum < total,
          hasPrev: pageNum > 1,
        },
      },
    })
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Summary dashboard metrics.
 * GET /api/admin/security/summary
 */
export const getSecuritySummaryHandler = async (req, res) => {
  try {
    const summary = await securityEventService.getSecuritySummary(req.query.timeRange)
    return res.status(200).json({
      success: true,
      data: summary,
    })
  } catch (err) {
    return sendError(res, err)
  }
}
