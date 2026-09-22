import mongoose from "mongoose"
import DownloadRecord from "../Modals/DownloadRecord.js"
import ReportExportJob from "../Modals/ReportExportJob.js"
import DownloadRestriction from "../Modals/DownloadRestriction.js"
import downloadQuotaService from "./downloadQuotaService.js"
import downloadAuditService, { DownloadEvents } from "./downloadAuditService.js"
import { ApiError } from "../utils/apiError.js"

/**
 * Service managing operational monitoring, active downloads, stuck download recovery, and administrative controls.
 */
export class AdminOperationsService {
  /**
   * Retrieves operational system summary.
   */
  async getOperationsSummary() {
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000)

    const [
      activeDownloadsCount,
      stuckDownloadsCount,
      activeRestrictionsCount,
      pendingExportJobsCount,
      recentErrorsCount,
    ] = await Promise.all([
      DownloadRecord.countDocuments({
        download_status: { $in: ["authorized", "preparing", "started", "downloading"] },
      }),
      DownloadRecord.countDocuments({
        download_status: { $in: ["started", "downloading", "preparing"] },
        updatedAt: { $lt: thirtyMinsAgo },
      }),
      DownloadRestriction.countDocuments({ status: "active" }),
      ReportExportJob.countDocuments({ status: { $in: ["pending", "processing"] } }),
      DownloadRecord.countDocuments({
        download_status: { $in: ["failed", "interrupted"] },
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      }),
    ])

    return {
      activeDownloads: activeDownloadsCount,
      stuckDownloads: stuckDownloadsCount,
      activeRestrictions: activeRestrictionsCount,
      pendingExportJobs: pendingExportJobsCount,
      recentErrors24h: recentErrorsCount,
      systemStatus: stuckDownloadsCount > 5 ? "DEGRADED" : "HEALTHY",
      checkedAt: new Date().toISOString(),
    }
  }

  /**
   * Returns list of currently in-flight active downloads.
   */
  async getActiveDownloads({ page = 1, limit = 20 } = {}) {
    const p = Math.max(1, Number(page) || 1)
    const lim = Math.max(1, Math.min(50, Number(limit) || 20))
    const skip = (p - 1) * lim

    const query = {
      download_status: { $in: ["authorized", "preparing", "started", "downloading"] },
    }

    const [total, downloads] = await Promise.all([
      DownloadRecord.countDocuments(query),
      DownloadRecord.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(lim)
        .select("-download_token_id -token_hash")
        .lean(),
    ])

    return {
      downloads,
      pagination: {
        page: p,
        limit: lim,
        total,
        totalPages: Math.ceil(total / lim) || 1,
      },
    }
  }

  /**
   * Identifies stuck in-progress downloads older than thresholdMinutes.
   */
  async getStuckDownloads(thresholdMinutes = 30) {
    const cutoff = new Date(Date.now() - thresholdMinutes * 60 * 1000)

    return await DownloadRecord.find({
      download_status: { $in: ["started", "downloading", "preparing"] },
      updatedAt: { $lt: cutoff },
    })
      .select("-download_token_id -token_hash")
      .lean()
  }

  /**
   * Cancels an active in-flight download, restoring user's quota reservation.
   */
  async cancelActiveDownload(downloadId, { adminId = null, reason = "Cancelled by admin" } = {}) {
    if (!downloadId || !mongoose.Types.ObjectId.isValid(downloadId)) {
      throw ApiError.badRequest("INVALID_DOWNLOAD_ID", "Valid download ID is required")
    }

    const record = await DownloadRecord.findById(downloadId)
    if (!record) {
      throw ApiError.notFound("DOWNLOAD_NOT_FOUND", "Download record not found")
    }

    if (record.download_status === "completed") {
      throw ApiError.badRequest("ALREADY_COMPLETED", "Cannot cancel an already completed download")
    }

    const prevStatus = record.download_status
    record.download_status = "cancelled"
    record.failure_reason = reason
    await record.save()

    // Release quota reservation if quota record is linked
    if (record.quota_id) {
      await downloadQuotaService.releaseQuota({
        quotaId: record.quota_id,
        downloadId: record._id,
        userId: record.userId,
        reason: "ADMIN_CANCELLED",
      }).catch(() => {})
    }

    downloadAuditService.logEvent(DownloadEvents.ADMIN_DOWNLOAD_CANCELLED, {
      userId: record.userId,
      downloadId: record._id,
      reason,
      metadata: {
        previousStatus: prevStatus,
        adminId,
      },
    })

    return {
      success: true,
      downloadId: record._id,
      previousStatus: prevStatus,
      status: "cancelled",
      reason,
    }
  }
}

export const adminOperationsService = new AdminOperationsService()
export default adminOperationsService
