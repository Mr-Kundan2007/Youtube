import adminUserDownloadService from "../services/adminUserDownloadService.js"
import downloadAuditService, { DownloadEvents } from "../services/downloadAuditService.js"
import { sendSuccess, sendError } from "../utils/apiResponse.js"
import { ApiError } from "../utils/apiError.js"

/**
 * Handles GET /api/admin/users/:userId/downloads
 */
export const getUserDownloadProfileHandler = async (req, res) => {
  try {
    const { userId } = req.params
    const page = req.query.page || 1
    const limit = req.query.limit || 10

    const profile = await adminUserDownloadService.getUserDownloadProfile(userId, { page, limit })

    downloadAuditService.logEvent(DownloadEvents.ADMIN_VIEWED_USER_PROFILE, {
      userId,
      reason: "Admin viewed user download profile",
      metadata: { adminId: req.user?.id },
    })

    return sendSuccess(res, profile, "User download profile retrieved successfully")
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Handles POST /api/admin/users/:userId/quota/adjust
 */
export const adjustUserQuotaHandler = async (req, res) => {
  try {
    const { userId } = req.params
    const { adjustmentType, value, amount, reason } = req.body || {}

    const result = await adminUserDownloadService.adjustUserQuota({
      userId,
      adminId: req.user?.id,
      adminEmail: req.user?.email || "",
      adjustmentType: adjustmentType || "ADD_CREDIT",
      value: value !== undefined ? value : amount,
      reason,
    })

    return sendSuccess(res, result, "Quota adjusted successfully")
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Handles GET /api/admin/users/:userId/quota/history
 */
export const getUserQuotaHistoryHandler = async (req, res) => {
  try {
    const { userId } = req.params
    const adjustments = await adminUserDownloadService.getUserQuotaAdjustments(userId)
    return sendSuccess(res, { adjustments }, "User quota history retrieved successfully")
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Handles POST /api/admin/users/:userId/notes
 */
export const addUserNoteHandler = async (req, res) => {
  try {
    const { userId } = req.params
    const { note } = req.body || {}

    if (!note || !note.trim()) {
      throw ApiError.badRequest("NOTE_REQUIRED", "Note text is required")
    }

    downloadAuditService.logEvent(DownloadEvents.ADMIN_NOTE_ADDED, {
      userId,
      reason: note.trim(),
      metadata: {
        adminId: req.user?.id,
        adminEmail: req.user?.email,
        target: "user",
      },
    })

    return sendSuccess(res, { userId, note: note.trim() }, "Admin note recorded successfully")
  } catch (err) {
    return sendError(res, err)
  }
}

export default {
  getUserDownloadProfileHandler,
  adjustUserQuotaHandler,
  getUserQuotaHistoryHandler,
  addUserNoteHandler,
}
