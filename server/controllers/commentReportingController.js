import {
  createCommentReport,
  hasUserReportedComment,
  getModerationSummary,
  getModerationReportsList,
  getReportDetails,
  updateReportStatus,
  executeModerationAction,
} from "../services/commentReportingService.js"

/**
 * Submits a new report on a comment or threaded reply
 */
export const reportCommentHandler = async (req, res) => {
  const commentId = req.params?.commentId || req.params?.id
  const userId = req.user?.id || req.user?._id || req.userId
  const { reason, description } = req.body || {}

  try {
    const result = await createCommentReport({
      commentId,
      userId,
      reason,
      description,
    })
    return res.status(201).json(result)
  } catch (error) {
    const status = error.statusCode || 400
    return res.status(status).json({
      success: false,
      code: error.code || "REPORT_ERROR",
      message: error.message,
    })
  }
}

/**
 * Checks whether the current user has already reported a comment
 */
export const getReportStatusHandler = async (req, res) => {
  const commentId = req.params?.commentId || req.params?.id
  const userId = req.user?.id || req.user?._id || req.userId

  try {
    const result = await hasUserReportedComment({ commentId, userId })
    return res.status(200).json(result)
  } catch (error) {
    return res.status(200).json({ hasReported: false, report: null })
  }
}

/**
 * Returns KPI statistics for the admin moderation dashboard
 */
export const getModerationSummaryHandler = async (req, res) => {
  try {
    const summary = await getModerationSummary()
    return res.status(200).json(summary)
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to load moderation summary",
    })
  }
}

/**
 * Returns a paginated list of comment reports
 */
export const getModerationReportsHandler = async (req, res) => {
  const {
    status,
    reason,
    priority,
    search,
    page = 1,
    limit = 20,
    sortBy = "createdAt",
    sortOrder = -1,
  } = req.query || {}

  try {
    const result = await getModerationReportsList({
      status,
      reason,
      priority,
      search,
      page,
      limit,
      sortBy,
      sortOrder,
    })
    return res.status(200).json(result)
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve moderation reports",
    })
  }
}

/**
 * Returns full context dossier for a specific report
 */
export const getReportDetailHandler = async (req, res) => {
  const reportId = req.params?.reportId || req.params?.id

  try {
    const dossier = await getReportDetails(reportId)
    return res.status(200).json(dossier)
  } catch (error) {
    const status = error.statusCode || 404
    return res.status(status).json({
      success: false,
      message: error.message || "Report details not found",
    })
  }
}

/**
 * Updates status or notes on a report
 */
export const updateReportStatusHandler = async (req, res) => {
  const reportId = req.params?.reportId || req.params?.id
  const moderatorId = req.user?.id || req.user?._id || req.userId
  const { status, notes } = req.body || {}

  try {
    const updated = await updateReportStatus({
      reportId,
      status,
      moderatorId,
      notes,
    })
    return res.status(200).json({
      success: true,
      report: updated,
      message: "Report status updated successfully",
    })
  } catch (error) {
    const status = error.statusCode || 400
    return res.status(status).json({
      success: false,
      message: error.message,
    })
  }
}

/**
 * Executes an authorized moderation action (hide, restore, delete, dismiss, resolve)
 */
export const executeModerationActionHandler = async (req, res) => {
  const reportId = req.params?.reportId || req.body?.reportId || null
  const commentId = req.params?.commentId || req.body?.commentId || null
  const moderatorId = req.user?.id || req.user?._id || req.userId
  const { action, reason, notes, expectedVersion } = req.body || {}

  try {
    const result = await executeModerationAction({
      reportId,
      commentId,
      action,
      reason,
      notes,
      moderatorId,
      expectedVersion,
    })
    return res.status(200).json(result)
  } catch (error) {
    const status = error.statusCode || 400
    return res.status(status).json({
      success: false,
      code: error.code || "MODERATION_ACTION_ERROR",
      message: error.message,
    })
  }
}

export default {
  reportCommentHandler,
  getReportStatusHandler,
  getModerationSummaryHandler,
  getModerationReportsHandler,
  getReportDetailHandler,
  updateReportStatusHandler,
  executeModerationActionHandler,
}
