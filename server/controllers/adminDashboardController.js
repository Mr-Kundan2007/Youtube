import adminDashboardService from "../services/adminDashboardService.js"
import adminOperationsService from "../services/adminOperationsService.js"
import downloadAuditService, { DownloadEvents } from "../services/downloadAuditService.js"
import { sendSuccess, sendError } from "../utils/apiResponse.js"

/**
 * Handles GET /api/admin/dashboard/summary
 */
export const getDashboardSummaryHandler = async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === "true"
    const summary = await adminDashboardService.getDashboardSummary({ forceRefresh })

    downloadAuditService.logEvent(DownloadEvents.ADMIN_VIEWED_DASHBOARD, {
      userId: req.user?.id,
      reason: "Admin dashboard summary accessed",
    })

    return sendSuccess(res, summary, "Dashboard summary retrieved successfully")
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Handles GET /api/admin/operations/summary
 */
export const getOperationsSummaryHandler = async (req, res) => {
  try {
    const ops = await adminOperationsService.getOperationsSummary()
    return sendSuccess(res, ops, "Operations summary retrieved successfully")
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Handles GET /api/admin/operations/active-downloads
 */
export const getActiveDownloadsHandler = async (req, res) => {
  try {
    const page = req.query.page || 1
    const limit = req.query.limit || 20
    const result = await adminOperationsService.getActiveDownloads({ page, limit })
    return sendSuccess(res, result, "Active downloads retrieved successfully")
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Handles POST /api/admin/operations/downloads/:downloadId/cancel
 */
export const cancelActiveDownloadHandler = async (req, res) => {
  try {
    const { downloadId } = req.params
    const { reason } = req.body || {}
    const result = await adminOperationsService.cancelActiveDownload(downloadId, {
      adminId: req.user?.id,
      reason: reason || "Cancelled by administrator",
    })
    return sendSuccess(res, result, "Download cancelled successfully")
  } catch (err) {
    return sendError(res, err)
  }
}

export default {
  getDashboardSummaryHandler,
  getOperationsSummaryHandler,
  getActiveDownloadsHandler,
  cancelActiveDownloadHandler,
}
