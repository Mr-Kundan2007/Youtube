import adminReportService from "../services/adminReportService.js"
import downloadAuditService, { DownloadEvents } from "../services/downloadAuditService.js"
import { sendSuccess, sendError } from "../utils/apiResponse.js"

/**
 * Handles GET /api/admin/reports/:reportType
 */
export const generateReportHandler = async (req, res) => {
  try {
    const { reportType } = req.params
    const { range, startDate, endDate } = req.query

    const data = await adminReportService.generateReportData(reportType, {
      range,
      startDate,
      endDate,
    })

    downloadAuditService.logEvent(DownloadEvents.ADMIN_REPORT_GENERATED, {
      userId: req.user?.id,
      reason: `Report generated: ${reportType}`,
    })

    return sendSuccess(res, data, "Report data generated successfully")
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Handles POST /api/admin/reports/export
 */
export const requestExportJobHandler = async (req, res) => {
  try {
    const { reportType, dateRange, startDate, endDate, filters, format } = req.body || {}

    const job = await adminReportService.createExportJob({
      reportType: reportType || "downloads",
      dateRange: dateRange || "30d",
      startDate,
      endDate,
      filters,
      format: format || "csv",
      adminId: req.user?.id,
      adminEmail: req.user?.email || "",
    })

    return sendSuccess(res, job, "Export job created successfully")
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Handles GET /api/admin/reports/exports/:jobId
 */
export const getExportJobStatusHandler = async (req, res) => {
  try {
    const { jobId } = req.params
    const job = await adminReportService.getExportJob(jobId)
    return sendSuccess(res, job, "Export job status retrieved successfully")
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Handles GET /api/admin/reports/exports/:jobId/download
 */
export const downloadExportFileHandler = async (req, res) => {
  try {
    const { jobId } = req.params
    const token = req.query.token || req.headers["x-download-token"]

    const { filePath, fileName } = await adminReportService.getExportDownloadStream(jobId, token)

    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`)
    res.setHeader("Content-Type", "text/csv; charset=utf-8")
    return res.sendFile(filePath)
  } catch (err) {
    return sendError(res, err)
  }
}

export default {
  generateReportHandler,
  requestExportJobHandler,
  getExportJobStatusHandler,
  downloadExportFileHandler,
}
