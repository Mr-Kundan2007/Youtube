import { userDownloadCenterService } from "../services/userDownloadCenterService.js"
import { sendSuccess, sendError } from "../utils/apiResponse.js"

/**
 * GET /api/downloads/dashboard
 */
export const getUserDashboardHandler = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id
    const dashboard = await userDownloadCenterService.getUserDashboard(userId)
    return sendSuccess(res, dashboard, "User download dashboard retrieved successfully")
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * GET /api/downloads/active
 */
export const getActiveDownloadsHandler = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id
    const active = await userDownloadCenterService.getActiveDownloads(userId)
    return sendSuccess(res, { activeDownloads: active }, "Active downloads retrieved successfully")
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * POST /api/downloads/:downloadId/cancel
 */
export const cancelUserDownloadHandler = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id
    const { downloadId } = req.params
    const { reason } = req.body || {}
    const result = await userDownloadCenterService.cancelUserDownload(userId, downloadId, reason)
    return sendSuccess(res, result, "Download cancelled successfully")
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * GET /api/downloads/export
 */
export const exportUserDownloadHistoryHandler = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id
    const result = await userDownloadCenterService.exportUserDownloadHistory(userId)

    res.setHeader("Content-Type", "text/csv; charset=utf-8")
    res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`)
    return res.status(200).send(result.csvData)
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * GET /api/downloads/security
 */
export const getUserSecurityOverviewHandler = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id
    const security = await userDownloadCenterService.getUserSecurityOverview(userId)
    return sendSuccess(res, security, "Security overview retrieved successfully")
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * POST /api/downloads/report-suspicious
 */
export const reportSuspiciousActivityHandler = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id
    const { downloadId, reason } = req.body
    const result = await userDownloadCenterService.reportSuspiciousActivity(userId, {
      downloadId,
      reason,
    })
    return sendSuccess(res, result, 201, "Suspicious activity reported successfully")
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * GET /api/downloads/preferences
 */
export const getDownloadPreferencesHandler = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id
    const prefs = await userDownloadCenterService.getPreferences(userId)
    return sendSuccess(res, prefs, "Download preferences retrieved successfully")
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * PUT /api/downloads/preferences
 */
export const updateDownloadPreferencesHandler = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id
    const updated = await userDownloadCenterService.updatePreferences(userId, req.body)
    return sendSuccess(res, updated, "Download preferences updated successfully")
  } catch (err) {
    return sendError(res, err)
  }
}
