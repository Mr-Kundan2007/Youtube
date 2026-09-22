import mongoose from "mongoose"
import DownloadRecord from "../Modals/DownloadRecord.js"
import quotaService from "./quotaService.js"
import subscriptionService from "./subscriptionService.js"
import { downloadConfig } from "../config/index.js"
import { ApiError } from "../utils/apiError.js"

/**
 * Service managing user download history queries, detailed inspections,
 * status polling, safe search/filtering, pagination, and user quota/statistics summaries.
 */
export class DownloadHistoryService {
  mapFailureReason(internalReason) {
    if (!internalReason) return null
    const reasonStr = String(internalReason).toUpperCase()
    if (reasonStr.includes("TOKEN_EXPIRED") || reasonStr.includes("SIGNED_URL_EXPIRED") || reasonStr.includes("EXPIRED")) {
      return "Your download session expired. Please try again."
    }
    if (reasonStr.includes("QUOTA_EXCEEDED") || reasonStr.includes("DOWNLOAD_QUOTA_EXCEEDED")) {
      return "You have reached your download limit."
    }
    if (reasonStr.includes("SUBSCRIPTION_EXPIRED")) {
      return "Your subscription is no longer active."
    }
    if (reasonStr.includes("VIDEO_ACCESS_DENIED") || reasonStr.includes("VIDEO_NOT_AVAILABLE") || reasonStr.includes("NOT_AVAILABLE")) {
      return "This video is not available for download."
    }
    if (reasonStr.includes("DOWNLOAD_NOT_ALLOWED_FOR_PLAN")) {
      return "This video requires a higher subscription plan."
    }
    if (reasonStr.includes("DEVICE_LIMIT_REACHED") || reasonStr.includes("DEVICE_BLOCKED")) {
      return "This device is not authorized for downloads."
    }
    if (reasonStr.includes("CANCELLED")) {
      return "Download was cancelled."
    }
    if (reasonStr.includes("INTERRUPTED") || reasonStr.includes("NETWORK")) {
      return "Your internet connection was interrupted."
    }
    return "The download encountered an issue. Please try again."
  }

  /**
   * Sanitizes a download record for safe user-facing display.
   * Strips token hashes, internal storage paths, and sensitive client tracking data.
   */
  sanitizeDownloadRecord(record) {
    if (!record) return null
    const isRetryable =
      ["failed", "interrupted"].includes(record.download_status) && (record.retry_count || 0) < 5
    const retryStatus =
      (record.retry_count || 0) >= 5
        ? "RETRY_LIMIT_REACHED"
        : ["failed", "interrupted"].includes(record.download_status)
        ? "RETRY_AVAILABLE"
        : "NOT_RETRYABLE"

    return {
      downloadId: record._id,
      videoId: record.videoId,
      videoTitle: record.videoTitle || "Untitled Video",
      thumbnailUrl: record.thumbnailUrl || "/video/snowglobe.jpg",
      status: record.download_status,
      fileSize: record.file_size || 0,
      fileType: record.file_type || record.mime_type || "video/mp4",
      plan: record.subscription_plan || "free",
      retryCount: record.retry_count || 0,
      isRetryable,
      retryStatus,
      isDuplicate: record.is_duplicate || false,
      originalDownloadId: record.original_download_id || null,
      downloadRequestedAt: record.download_requested_at || record.createdAt,
      downloadStartedAt: record.download_started_at || null,
      downloadCompletedAt: record.download_completed_at || null,
      failureReason: record.failure_reason || null,
      userFriendlyFailureReason: this.mapFailureReason(record.failure_reason),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }
  }

  /**
   * Query user's own downloads with pagination, status/plan filtering,
   * sanitized text search, date range boundaries, and safe sorting.
   */
  async getUserDownloads({
    userId,
    page = 1,
    limit = 20,
    status = null,
    plan = null,
    search = "",
    from = null,
    to = null,
    sortBy = "createdAt",
    sortOrder = "desc",
  }) {
    if (!userId) {
      throw ApiError.unauthorized("UNAUTHORIZED", "Authenticated user required")
    }

    const safePage = Math.max(1, parseInt(page, 10) || 1)
    const maxLimit = Number(downloadConfig.historyMaxLimit || 50)
    const safeLimit = Math.min(maxLimit, Math.max(1, parseInt(limit, 10) || 20))

    // Strict query filter: ONLY the authenticated user's records
    const query = { userId: new mongoose.Types.ObjectId(userId) }

    // Status filtering
    const validStatuses = [
      "authorized",
      "preparing",
      "ready",
      "downloading",
      "started",
      "completed",
      "interrupted",
      "failed",
      "cancelled",
      "expired",
      "blocked",
    ]
    if (status && status !== "all" && validStatuses.includes(status)) {
      query.download_status = status
    }

    // Plan filtering
    const validPlans = ["free", "bronze", "silver", "gold"]
    if (plan && plan !== "all" && validPlans.includes(plan)) {
      query.subscription_plan = plan
    }

    // Date range filtering
    if (from || to) {
      query.createdAt = {}
      if (from) {
        const fromDate = new Date(from)
        if (!isNaN(fromDate.getTime())) {
          query.createdAt.$gte = fromDate
        }
      }
      if (to) {
        const toDate = new Date(to)
        if (!isNaN(toDate.getTime())) {
          query.createdAt.$lte = toDate
        }
      }
    }

    // Search query on video title (sanitized against ReDoS)
    if (search && typeof search === "string" && search.trim()) {
      const cleanSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      query.videoTitle = { $regex: cleanSearch, $options: "i" }
    }

    // Whitelisted sort fields
    const allowedSortFields = {
      createdAt: "createdAt",
      downloadRequestedAt: "download_requested_at",
      downloadCompletedAt: "download_completed_at",
      fileSize: "file_size",
      status: "download_status",
    }
    const sortField = allowedSortFields[sortBy] || "createdAt"
    const sortDirection = String(sortOrder).toLowerCase() === "asc" ? 1 : -1
    const sortObj = { [sortField]: sortDirection }

    // Execute queries in parallel
    const [rawDownloads, totalCount, statusCounts, userSub] = await Promise.all([
      DownloadRecord.find(query)
        .sort(sortObj)
        .skip((safePage - 1) * safeLimit)
        .limit(safeLimit)
        .lean(),
      DownloadRecord.countDocuments(query),
      DownloadRecord.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId) } },
        { $group: { _id: "$download_status", count: { $sum: 1 } } },
      ]),
      subscriptionService.getUserSubscription(userId),
    ])

    // Compile summary statistics
    const summary = {
      total: 0,
      completed: 0,
      failed: 0,
      interrupted: 0,
      active: 0,
    }
    statusCounts.forEach((item) => {
      summary.total += item.count
      if (item._id === "completed") summary.completed += item.count
      else if (item._id === "failed") summary.failed += item.count
      else if (item._id === "interrupted") summary.interrupted += item.count
      else if (
        ["authorized", "preparing", "ready", "downloading", "started"].includes(item._id)
      ) {
        summary.active += item.count
      }
    })

    // Get current quota status
    const currentPlan = userSub?.plan || "free"
    let quotaSnapshot = null
    try {
      const quotaRecord = await quotaService.getActiveQuotaRecord(userId, currentPlan)
      quotaSnapshot = {
        plan: currentPlan,
        limit: quotaRecord?.quota_limit,
        used: quotaRecord?.quota_used || 0,
        remaining: quotaRecord?.quota_remaining,
        resetAt: quotaRecord?.quota_period_end,
      }
    } catch {
      quotaSnapshot = {
        plan: currentPlan,
        limit: null,
        used: 0,
        remaining: null,
        resetAt: null,
      }
    }

    const sanitizedDownloads = rawDownloads.map((rec) => this.sanitizeDownloadRecord(rec))

    return {
      downloads: sanitizedDownloads,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / safeLimit) || 1,
      },
      quota: quotaSnapshot,
      summary,
    }
  }

  /**
   * Get single download record details, enforcing ownership.
   */
  async getDownloadDetails({ downloadId, userId, userRole = "user" }) {
    if (!downloadId || !mongoose.Types.ObjectId.isValid(downloadId)) {
      throw ApiError.badRequest("INVALID_DOWNLOAD_ID", "Invalid download ID format")
    }

    const record = await DownloadRecord.findById(downloadId).lean()
    if (!record) {
      throw ApiError.notFound("DOWNLOAD_NOT_FOUND", "Download record not found")
    }

    // Ownership check
    if (String(record.userId) !== String(userId) && userRole !== "admin") {
      throw ApiError.forbidden(
        "DOWNLOAD_ACCESS_DENIED",
        "You do not have access to this download record"
      )
    }

    return this.sanitizeDownloadRecord(record)
  }

  /**
   * Lightweight status query for polling.
   */
  async getDownloadStatus({ downloadId, userId, userRole = "user" }) {
    if (!downloadId || !mongoose.Types.ObjectId.isValid(downloadId)) {
      throw ApiError.badRequest("INVALID_DOWNLOAD_ID", "Invalid download ID format")
    }

    const record = await DownloadRecord.findById(downloadId, {
      userId: 1,
      download_status: 1,
      retry_count: 1,
      file_size: 1,
      download_started_at: 1,
      download_completed_at: 1,
      failure_reason: 1,
    }).lean()

    if (!record) {
      throw ApiError.notFound("DOWNLOAD_NOT_FOUND", "Download record not found")
    }

    // Ownership check
    if (String(record.userId) !== String(userId) && userRole !== "admin") {
      throw ApiError.forbidden(
        "DOWNLOAD_ACCESS_DENIED",
        "You do not have access to this download record"
      )
    }

    return {
      downloadId: record._id,
      status: record.download_status,
      retryCount: record.retry_count || 0,
      fileSize: record.file_size || 0,
      startedAt: record.download_started_at || null,
      completedAt: record.download_completed_at || null,
      failureReason: record.failure_reason || null,
    }
  }
}

export const downloadHistoryService = new DownloadHistoryService()
export default downloadHistoryService
