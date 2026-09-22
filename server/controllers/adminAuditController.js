import mongoose from "mongoose"
import DownloadAuditLog from "../Modals/DownloadAuditLog.js"
import { sendSuccess, sendError } from "../utils/apiResponse.js"

/**
 * Handles GET /api/admin/audit-logs
 */
export const getAuditLogsHandler = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 25,
      event,
      action,
      userId,
      downloadId,
      deviceId,
      startDate,
      endDate,
    } = req.query

    const p = Math.max(1, Number(page) || 1)
    const lim = Math.max(1, Math.min(100, Number(limit) || 25))
    const skip = (p - 1) * lim

    const query = {}

    const eventFilter = event || action
    if (eventFilter && eventFilter !== "all") {
      query.event = eventFilter
    }

    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      query.$or = [
        { userId: new mongoose.Types.ObjectId(userId) },
        { user_id: new mongoose.Types.ObjectId(userId) },
      ]
    }

    if (downloadId && mongoose.Types.ObjectId.isValid(downloadId)) {
      query.$or = [
        { downloadId: new mongoose.Types.ObjectId(downloadId) },
        { download_id: new mongoose.Types.ObjectId(downloadId) },
      ]
    }

    if (deviceId) {
      query.deviceId = deviceId
    }

    if (startDate || endDate) {
      query.createdAt = {}
      if (startDate) query.createdAt.$gte = new Date(startDate)
      if (endDate) query.createdAt.$lte = new Date(endDate)
    }

    const [total, logs] = await Promise.all([
      DownloadAuditLog.countDocuments(query),
      DownloadAuditLog.find(query)
        .populate("userId", "name email role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(lim)
        .lean(),
    ])

    return sendSuccess(
      res,
      {
        logs,
        pagination: {
          page: p,
          limit: lim,
          total,
          totalPages: Math.ceil(total / lim) || 1,
        },
      },
      "Audit logs retrieved successfully"
    )
  } catch (err) {
    return sendError(res, err)
  }
}

export default {
  getAuditLogsHandler,
}
