import mongoose from "mongoose"
import DownloadRecord from "../Modals/DownloadRecord.js"
import DownloadAuditLog from "../Modals/DownloadAuditLog.js"
import User from "../Modals/Auth.js"
import downloadAuditService, { DownloadEvents } from "../services/downloadAuditService.js"
import { sendSuccess, sendError } from "../utils/apiResponse.js"
import { ApiError } from "../utils/apiError.js"

/**
 * Handles GET /api/admin/downloads with multi-filtering, search, controlled sorting, and pagination.
 */
export const getDownloadsListHandler = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      plan,
      riskLevel,
      securityFlagged,
      userId,
      videoId,
      deviceId,
      startDate,
      endDate,
      search,
      sortBy = "newest",
    } = req.query

    const p = Math.max(1, Number(page) || 1)
    const lim = Math.max(1, Math.min(100, Number(limit) || 20))
    const skip = (p - 1) * lim

    const query = {}

    if (status && status !== "all") {
      query.download_status = status
    }

    if (plan && plan !== "all") {
      query.subscription_plan = plan
    }

    if (riskLevel && riskLevel !== "all") {
      query.riskLevel = riskLevel
    }

    if (securityFlagged !== undefined && securityFlagged !== "") {
      query.securityFlagged = securityFlagged === "true" || securityFlagged === true
    }

    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      query.$or = [{ userId: new mongoose.Types.ObjectId(userId) }, { user_id: new mongoose.Types.ObjectId(userId) }]
    }

    if (videoId && mongoose.Types.ObjectId.isValid(videoId)) {
      query.videoId = new mongoose.Types.ObjectId(videoId)
    }

    if (deviceId) {
      query.device_id = deviceId
    }

    if (startDate || endDate) {
      query.createdAt = {}
      if (startDate) query.createdAt.$gte = new Date(startDate)
      if (endDate) query.createdAt.$lte = new Date(endDate)
    }

    // Search by text (User Name, Email, Video Title, Download ID)
    if (search && search.trim()) {
      const term = search.trim()
      const searchConditions = []

      // If valid ObjectId, match downloadId or userId
      if (mongoose.Types.ObjectId.isValid(term)) {
        searchConditions.push({ _id: new mongoose.Types.ObjectId(term) })
        searchConditions.push({ userId: new mongoose.Types.ObjectId(term) })
      }

      // Regex on video title
      searchConditions.push({ videoTitle: { $regex: term, $options: "i" } })

      // Find user matching name or email
      const matchedUsers = await User.find({
        $or: [
          { name: { $regex: term, $options: "i" } },
          { email: { $regex: term, $options: "i" } },
        ],
      })
        .select("_id")
        .limit(20)
        .lean()

      if (matchedUsers.length > 0) {
        const uIds = matchedUsers.map((u) => u._id)
        searchConditions.push({ userId: { $in: uIds } })
      }

      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: searchConditions }]
        delete query.$or
      } else {
        query.$or = searchConditions
      }
    }

    // Controlled sorting
    let sort = { createdAt: -1 }
    if (sortBy === "oldest") sort = { createdAt: 1 }
    else if (sortBy === "largest") sort = { file_size: -1 }
    else if (sortBy === "smallest") sort = { file_size: 1 }
    else if (sortBy === "highest_risk") sort = { riskLevel: -1, createdAt: -1 }

    const [total, downloads] = await Promise.all([
      DownloadRecord.countDocuments(query),
      DownloadRecord.find(query)
        .populate("userId", "name email role status")
        .sort(sort)
        .skip(skip)
        .limit(lim)
        .select("-download_token_id -token_hash")
        .lean(),
    ])

    downloadAuditService.logEvent(DownloadEvents.ADMIN_VIEWED_DOWNLOADS, {
      userId: req.user?.id,
      reason: "Admin viewed download list",
    })

    return sendSuccess(
      res,
      {
        downloads,
        pagination: {
          page: p,
          limit: lim,
          total,
          totalPages: Math.ceil(total / lim) || 1,
        },
      },
      "Downloads retrieved successfully"
    )
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Handles GET /api/admin/downloads/:downloadId
 */
export const getDownloadDetailHandler = async (req, res) => {
  try {
    const { downloadId } = req.params

    if (!downloadId || !mongoose.Types.ObjectId.isValid(downloadId)) {
      throw ApiError.badRequest("INVALID_DOWNLOAD_ID", "Valid download ID is required")
    }

    const download = await DownloadRecord.findById(downloadId)
      .populate("userId", "name email role status joinedon")
      .populate("videoId", "videotitle videochanel uploader filesize duration")
      .select("-download_token_id -token_hash")
      .lean()

    if (!download) {
      throw ApiError.notFound("DOWNLOAD_NOT_FOUND", "Download record not found")
    }

    // Fetch related audit logs
    const auditLogs = await DownloadAuditLog.find({
      $or: [{ downloadId: download._id }, { download_id: download._id }],
    })
      .sort({ createdAt: 1 })
      .limit(50)
      .lean()

    return sendSuccess(
      res,
      {
        download,
        timeline: auditLogs,
      },
      "Download details retrieved successfully"
    )
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Handles POST /api/admin/downloads/:downloadId/notes
 */
export const addDownloadNoteHandler = async (req, res) => {
  try {
    const { downloadId } = req.params
    const { note } = req.body || {}

    if (!downloadId || !mongoose.Types.ObjectId.isValid(downloadId)) {
      throw ApiError.badRequest("INVALID_DOWNLOAD_ID", "Valid download ID is required")
    }

    if (!note || !note.trim()) {
      throw ApiError.badRequest("NOTE_REQUIRED", "Note text is required")
    }

    const download = await DownloadRecord.findById(downloadId)
    if (!download) {
      throw ApiError.notFound("DOWNLOAD_NOT_FOUND", "Download record not found")
    }

    // Attach note in metadata or security audit
    downloadAuditService.logEvent(DownloadEvents.ADMIN_NOTE_ADDED, {
      userId: download.userId,
      downloadId: download._id,
      reason: note.trim(),
      metadata: {
        adminId: req.user?.id,
        adminEmail: req.user?.email,
      },
    })

    return sendSuccess(res, { downloadId, note: note.trim() }, "Note added successfully")
  } catch (err) {
    return sendError(res, err)
  }
}

export default {
  getDownloadsListHandler,
  getDownloadDetailHandler,
  addDownloadNoteHandler,
}
