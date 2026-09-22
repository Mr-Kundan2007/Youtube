import fs from "fs"
import path from "path"
import crypto from "crypto"
import mongoose from "mongoose"
import DownloadRecord from "../Modals/DownloadRecord.js"
import DownloadSecurityEvent from "../Modals/DownloadSecurityEvent.js"
import DownloadRestriction from "../Modals/DownloadRestriction.js"
import DownloadQuota from "../Modals/DownloadQuota.js"
import ReportExportJob from "../Modals/ReportExportJob.js"
import adminAnalyticsService from "./adminAnalyticsService.js"
import adminDashboardService from "./adminDashboardService.js"
import downloadAuditService, { DownloadEvents } from "./downloadAuditService.js"
import { ApiError } from "../utils/apiError.js"

const EXPORTS_DIR = path.join(process.cwd(), "uploads", "exports")

/**
 * Service generating operational reports and secure CSV export jobs.
 */
export class AdminReportService {
  constructor() {
    if (!fs.existsSync(EXPORTS_DIR)) {
      fs.mkdirSync(EXPORTS_DIR, { recursive: true })
    }
  }

  /**
   * Helper to format fields safely for CSV.
   */
  escapeCsv(val) {
    if (val === null || val === undefined) return '""'
    const str = String(val).replace(/"/g, '""')
    return `"${str}"`
  }

  /**
   * Generates structured report data by reportType.
   */
  async generateReportData(reportType = "downloads", { range = "30d", startDate = null, endDate = null } = {}) {
    const { start, end } = adminAnalyticsService.resolveDateRange(range, startDate, endDate)

    if (reportType === "downloads") {
      const records = await DownloadRecord.find({
        createdAt: { $gte: start, $lte: end },
      })
        .sort({ createdAt: -1 })
        .limit(2000)
        .select("-download_token_id -token_hash")
        .lean()

      return {
        reportType,
        range,
        startDate: start,
        endDate: end,
        count: records.length,
        items: records.map((r) => ({
          downloadId: r._id,
          userId: r.userId,
          videoTitle: r.videoTitle,
          plan: r.subscription_plan,
          status: r.download_status,
          fileSize: r.file_size,
          deviceId: r.device_id,
          ipAddress: r.ip_address,
          riskLevel: r.riskLevel || "low",
          createdAt: r.createdAt,
        })),
      }
    }

    if (reportType === "subscriptions") {
      const subAnalytics = await adminAnalyticsService.getSubscriptionAnalytics()
      return {
        reportType,
        range,
        startDate: start,
        endDate: end,
        plans: subAnalytics.plans,
      }
    }

    if (reportType === "security") {
      const events = await DownloadSecurityEvent.find({
        createdAt: { $gte: start, $lte: end },
      })
        .sort({ createdAt: -1 })
        .limit(1000)
        .lean()

      return {
        reportType,
        range,
        startDate: start,
        endDate: end,
        count: events.length,
        items: events.map((e) => ({
          eventId: e._id,
          userId: e.userId,
          deviceId: e.deviceId,
          eventType: e.eventType,
          riskLevel: e.riskLevel,
          riskPoints: e.riskPoints,
          status: e.status,
          createdAt: e.createdAt,
        })),
      }
    }

    if (reportType === "users") {
      const quotas = await DownloadQuota.find({
        status: "active",
      })
        .limit(1000)
        .lean()

      return {
        reportType,
        range,
        count: quotas.length,
        items: quotas.map((q) => ({
          quotaId: q._id,
          userId: q.userId,
          plan: q.subscription_plan,
          quotaUsed: q.quota_used,
          quotaRemaining: q.quota_remaining,
          quotaLimit: q.quota_limit,
          periodEnd: q.period_end,
        })),
      }
    }

    // Default to summary report
    const summary = await adminDashboardService.getDashboardSummary()
    return {
      reportType,
      range,
      startDate: start,
      endDate: end,
      summary,
    }
  }

  /**
   * Converts structured report data into CSV formatted string.
   */
  convertToCsv(reportType, data) {
    if (reportType === "downloads") {
      const headers = [
        "Download ID",
        "User ID",
        "Video Title",
        "Subscription Plan",
        "Status",
        "File Size (Bytes)",
        "Device ID",
        "Risk Level",
        "Created At",
      ]
      const rows = (data.items || []).map((i) =>
        [
          this.escapeCsv(i.downloadId),
          this.escapeCsv(i.userId),
          this.escapeCsv(i.videoTitle),
          this.escapeCsv(i.plan),
          this.escapeCsv(i.status),
          this.escapeCsv(i.fileSize),
          this.escapeCsv(i.deviceId),
          this.escapeCsv(i.riskLevel),
          this.escapeCsv(i.createdAt ? new Date(i.createdAt).toISOString() : ""),
        ].join(",")
      )
      return [headers.join(","), ...rows].join("\n")
    }

    if (reportType === "security") {
      const headers = [
        "Event ID",
        "User ID",
        "Device ID",
        "Event Type",
        "Risk Level",
        "Risk Points",
        "Status",
        "Created At",
      ]
      const rows = (data.items || []).map((i) =>
        [
          this.escapeCsv(i.eventId),
          this.escapeCsv(i.userId),
          this.escapeCsv(i.deviceId),
          this.escapeCsv(i.eventType),
          this.escapeCsv(i.riskLevel),
          this.escapeCsv(i.riskPoints),
          this.escapeCsv(i.status),
          this.escapeCsv(i.createdAt ? new Date(i.createdAt).toISOString() : ""),
        ].join(",")
      )
      return [headers.join(","), ...rows].join("\n")
    }

    if (reportType === "subscriptions") {
      const headers = [
        "Plan",
        "Quota Limit",
        "Total Subscribers",
        "Total Downloads",
        "Avg Downloads Per User",
        "Exhausted Quotas",
        "Exhaustion Rate %",
      ]
      const rows = (data.plans || []).map((p) =>
        [
          this.escapeCsv(p.plan),
          this.escapeCsv(p.configuredLimit),
          this.escapeCsv(p.totalSubscribers),
          this.escapeCsv(p.totalDownloads),
          this.escapeCsv(p.avgDownloadsPerUser),
          this.escapeCsv(p.exhaustedQuotasCount),
          this.escapeCsv(p.exhaustionRatePercentage),
        ].join(",")
      )
      return [headers.join(","), ...rows].join("\n")
    }

    // Generic JSON to CSV fallback
    return JSON.stringify(data, null, 2)
  }

  /**
   * Initiates an export job, generating the file securely on disk.
   */
  async createExportJob({
    reportType = "downloads",
    dateRange = "30d",
    startDate = null,
    endDate = null,
    filters = {},
    format = "csv",
    adminId = null,
    adminEmail = "",
  } = {}) {
    const jobId = `exp_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`
    const downloadToken = crypto.randomBytes(24).toString("hex")
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours validity

    const job = await ReportExportJob.create({
      jobId,
      reportType,
      dateRange,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      filters,
      format,
      status: "processing",
      downloadToken,
      createdBy: adminId,
      adminEmail,
      expiresAt,
    })

    try {
      const reportData = await this.generateReportData(reportType, {
        range: dateRange,
        startDate,
        endDate,
      })

      const content = this.convertToCsv(reportType, reportData)
      const fileName = `${reportType}_report_${jobId}.${format}`
      const fullPath = path.join(EXPORTS_DIR, fileName)

      fs.writeFileSync(fullPath, content, "utf8")
      const stats = fs.statSync(fullPath)

      job.status = "completed"
      job.filePath = fullPath
      job.fileName = fileName
      job.fileSize = stats.size
      job.rowCount = reportData.count || (reportData.plans ? reportData.plans.length : 1)
      job.completedAt = new Date()
      await job.save()

      downloadAuditService.logEvent(DownloadEvents.ADMIN_REPORT_EXPORTED, {
        userId: adminId,
        reason: `Report exported: ${reportType}`,
        metadata: {
          jobId,
          reportType,
          format,
          fileSize: stats.size,
          rowCount: job.rowCount,
        },
      })

      return {
        success: true,
        jobId: job.jobId,
        status: job.status,
        fileName: job.fileName,
        fileSize: job.fileSize,
        rowCount: job.rowCount,
        downloadToken: job.downloadToken,
        expiresAt: job.expiresAt,
      }
    } catch (err) {
      job.status = "failed"
      job.error = err.message || "Failed to generate report export"
      await job.save()
      throw err
    }
  }

  /**
   * Retrieves status and metadata of an export job.
   */
  async getExportJob(jobId) {
    if (!jobId) throw ApiError.badRequest("JOB_ID_REQUIRED", "jobId is required")
    const job = await ReportExportJob.findOne({ jobId }).lean()
    if (!job) throw ApiError.notFound("REPORT_NOT_FOUND", "Export job not found")
    return job
  }

  /**
   * Validates download token and retrieves full file path for download streaming.
   */
  async getExportDownloadStream(jobId, token) {
    const job = await this.getExportJob(jobId)

    if (job.status !== "completed") {
      throw ApiError.badRequest("EXPORT_NOT_READY", `Export job status is ${job.status}`)
    }

    if (new Date(job.expiresAt) < new Date()) {
      throw ApiError.gone("EXPORT_EXPIRED", "This report export has expired")
    }

    if (token && job.downloadToken && token !== job.downloadToken) {
      throw ApiError.forbidden("INVALID_EXPORT_TOKEN", "Invalid export download token")
    }

    if (!fs.existsSync(job.filePath)) {
      throw ApiError.notFound("FILE_NOT_FOUND", "Export file no longer exists on disk")
    }

    return {
      filePath: job.filePath,
      fileName: job.fileName,
      fileSize: job.fileSize,
    }
  }
}

export const adminReportService = new AdminReportService()
export default adminReportService
