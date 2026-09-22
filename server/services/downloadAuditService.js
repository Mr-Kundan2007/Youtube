import { logger } from "../utils/logger.js"
import DownloadRecord from "../Modals/DownloadRecord.js"
import DownloadAuditLog, { DownloadAuditEvents } from "../Modals/DownloadAuditLog.js"

export const DownloadEvents = {
  DOWNLOAD_REQUESTED: "DOWNLOAD_REQUESTED",
  DOWNLOAD_AUTHORIZED: "DOWNLOAD_AUTHORIZED",
  DOWNLOAD_DENIED: "DOWNLOAD_DENIED",
  DOWNLOAD_DELIVERY_REQUESTED: "DOWNLOAD_DELIVERY_REQUESTED",
  STORAGE_VALIDATED: "STORAGE_VALIDATED",
  SIGNED_URL_GENERATED: "SIGNED_URL_GENERATED",
  DOWNLOAD_READY: "DOWNLOAD_READY",
  DOWNLOAD_PREPARING: "DOWNLOAD_PREPARING",
  DOWNLOAD_STARTED: "DOWNLOAD_STARTED",
  DOWNLOAD_COMPLETED: "DOWNLOAD_COMPLETED",
  DOWNLOAD_FAILED: "DOWNLOAD_FAILED",
  DOWNLOAD_INTERRUPTED: "DOWNLOAD_INTERRUPTED",
  DOWNLOAD_CANCELLED: "DOWNLOAD_CANCELLED",
  DOWNLOAD_BLOCKED_QUOTA: "DOWNLOAD_BLOCKED_QUOTA",
  DOWNLOAD_BLOCKED_SUBSCRIPTION: "DOWNLOAD_BLOCKED_SUBSCRIPTION",
  DOWNLOAD_BLOCKED_VIDEO: "DOWNLOAD_BLOCKED_VIDEO",
  DOWNLOAD_BLOCKED_DEVICE: "DOWNLOAD_BLOCKED_DEVICE",
  VIDEO_FILE_NOT_AVAILABLE: "VIDEO_FILE_NOT_AVAILABLE",
  STORAGE_SERVICE_UNAVAILABLE: "STORAGE_SERVICE_UNAVAILABLE",
  DOWNLOAD_TOKEN_CREATED: "DOWNLOAD_TOKEN_CREATED",
  DOWNLOAD_TOKEN_EXPIRED: "DOWNLOAD_TOKEN_EXPIRED",
  DOWNLOAD_TOKEN_REVOKED: "DOWNLOAD_TOKEN_REVOKED",
  TOKEN_GENERATED: "TOKEN_GENERATED",
  TOKEN_VALIDATED: "TOKEN_VALIDATED",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  TOKEN_USED: "TOKEN_USED",
  TOKEN_REVOKED: "TOKEN_REVOKED",
  TOKEN_REPLAY_ATTEMPT: "TOKEN_REPLAY_ATTEMPT",
  DUPLICATE_DETECTED: "DUPLICATE_DETECTED",
  DUPLICATE_REUSED: "DUPLICATE_REUSED",
  DOWNLOAD_RETRY_REQUESTED: "DOWNLOAD_RETRY_REQUESTED",
  DOWNLOAD_RETRY_ALLOWED: "DOWNLOAD_RETRY_ALLOWED",
  DOWNLOAD_RETRY_DENIED: "DOWNLOAD_RETRY_DENIED",
  DEVICE_REGISTERED: "DEVICE_REGISTERED",
  DEVICE_AUTHORIZED: "DEVICE_AUTHORIZED",
  DEVICE_DENIED: "DEVICE_DENIED",
  DEVICE_LIMIT_REACHED: "DEVICE_LIMIT_REACHED",
  DEVICE_REVOKED: "DEVICE_REVOKED",
  DEVICE_REACTIVATED: "DEVICE_REACTIVATED",
  DEVICE_BLOCKED: "DEVICE_BLOCKED",
  DEVICE_CHANGED: "DEVICE_CHANGED",
  DEVICE_RECOGNIZED: "DEVICE_RECOGNIZED",
  UNKNOWN_DEVICE_DETECTED: "UNKNOWN_DEVICE_DETECTED",
  DEVICE_METADATA_CHANGED: "DEVICE_METADATA_CHANGED",
  DOWNLOAD_DEVICE_VALIDATED: "DOWNLOAD_DEVICE_VALIDATED",
  DOWNLOAD_DEVICE_MISMATCH: "DOWNLOAD_DEVICE_MISMATCH",
  CONCURRENT_DOWNLOAD_LIMIT_REACHED: "CONCURRENT_DOWNLOAD_LIMIT_REACHED",
  DEVICE_CONCURRENT_DOWNLOAD_LIMIT_REACHED: "DEVICE_CONCURRENT_DOWNLOAD_LIMIT_REACHED",
  SECURITY_EVENT_CREATED: "SECURITY_EVENT_CREATED",
  RISK_SCORE_UPDATED: "RISK_SCORE_UPDATED",
  RESTRICTION_CREATED: "RESTRICTION_CREATED",
  RESTRICTION_REMOVED: "RESTRICTION_REMOVED",
  SECURITY_EVENT_RESOLVED: "SECURITY_EVENT_RESOLVED",
  SECURITY_CHECK_PASSED: "SECURITY_CHECK_PASSED",
  SECURITY_CHECK_FLAGGED: "SECURITY_CHECK_FLAGGED",
  SECURITY_CHECK_BLOCKED: "SECURITY_CHECK_BLOCKED",
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  RAPID_DEVICE_SWITCH: "RAPID_DEVICE_SWITCH",
  RAPID_IP_CHANGE: "RAPID_IP_CHANGE",
  QUOTA_BYPASS_ATTEMPT: "QUOTA_BYPASS_ATTEMPT",
  ADMIN_VIEWED_DASHBOARD: "ADMIN_VIEWED_DASHBOARD",
  ADMIN_VIEWED_DOWNLOADS: "ADMIN_VIEWED_DOWNLOADS",
  ADMIN_VIEWED_USER_PROFILE: "ADMIN_VIEWED_USER_PROFILE",
  ADMIN_QUOTA_ADJUSTED: "ADMIN_QUOTA_ADJUSTED",
  ADMIN_DOWNLOAD_CANCELLED: "ADMIN_DOWNLOAD_CANCELLED",
  ADMIN_NOTE_ADDED: "ADMIN_NOTE_ADDED",
  ADMIN_REPORT_GENERATED: "ADMIN_REPORT_GENERATED",
  ADMIN_REPORT_EXPORTED: "ADMIN_REPORT_EXPORTED",
}

/**
 * Service for logging and querying download audits and metrics.
 */
export class DownloadAuditService {
  /**
   * Logs a download lifecycle audit event both to structured logs and DownloadAuditLog in DB.
   */
  logEvent(event, data = {}) {
    const payload = {
      event,
      userId: data.userId || null,
      videoId: data.videoId || null,
      plan: data.plan || null,
      ip: data.ip || null,
      deviceId: data.deviceId || null,
      quotaBefore: data.quotaBefore !== undefined ? data.quotaBefore : null,
      quotaAfter: data.quotaAfter !== undefined ? data.quotaAfter : null,
      reason: data.reason || null,
      downloadId: data.downloadId || null,
      requestId: data.requestId || null,
    }

    if (
      event === DownloadEvents.DOWNLOAD_BLOCKED_QUOTA ||
      event === DownloadEvents.DOWNLOAD_BLOCKED_SUBSCRIPTION ||
      event === DownloadEvents.DOWNLOAD_BLOCKED_DEVICE ||
      event === DownloadEvents.DOWNLOAD_FAILED
    ) {
      logger.warn(event, payload)
    } else {
      logger.info(event, payload)
    }

    // Persist to DownloadAuditLog in database asynchronously
    if (DownloadAuditEvents.includes(event)) {
      DownloadAuditLog.create({
        event: event,
        event_type: event,
        download_id: data.downloadId || null,
        downloadId: data.downloadId || null,
        user_id: data.userId || null,
        userId: data.userId || null,
        video_id: data.videoId || null,
        videoId: data.videoId || null,
        ip_address: data.ip || "",
        device_id: data.deviceId || "",
        browser: data.browser || "unknown",
        operating_system: data.operatingSystem || "unknown",
        device_type: data.deviceType || "desktop",
        user_agent: data.userAgent || "",
        request_id: data.requestId || "",
        metadata: {
          plan: data.plan || null,
          quotaBefore: data.quotaBefore,
          quotaAfter: data.quotaAfter,
          reason: data.reason,
          ...(data.metadata || {}),
        },
      }).catch((err) => {
        logger.warn("Failed to persist DownloadAuditLog:", err.message)
      })
    }
  }

  /**
   * Computes aggregate metrics for admin dashboard.
   */
  async getDownloadStatistics() {
    const now = new Date()
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0))
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0))

    const [
      totalDownloads,
      downloadsToday,
      downloadsMonth,
      successfulDownloads,
      failedDownloads,
      blockedQuotaDownloads,
      blockedSubDownloads,
      downloadsByPlan,
      topVideos,
    ] = await Promise.all([
      DownloadRecord.countDocuments(),
      DownloadRecord.countDocuments({ createdAt: { $gte: todayStart } }),
      DownloadRecord.countDocuments({ createdAt: { $gte: monthStart } }),
      DownloadRecord.countDocuments({ download_status: "completed" }),
      DownloadRecord.countDocuments({ download_status: { $in: ["failed", "interrupted"] } }),
      DownloadRecord.countDocuments({ download_status: "blocked", failure_reason: /quota|limit/i }),
      DownloadRecord.countDocuments({ download_status: "blocked", failure_reason: /subscription|expired/i }),
      DownloadRecord.aggregate([
        { $group: { _id: "$subscription_plan", count: { $sum: 1 } } },
      ]),
      DownloadRecord.aggregate([
        { $group: { _id: "$videoId", title: { $first: "$videoTitle" }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
    ])

    const planBreakdown = { free: 0, bronze: 0, silver: 0, gold: 0 }
    downloadsByPlan.forEach((item) => {
      if (item._id) planBreakdown[item._id] = item.count
    })

    return {
      totalDownloads,
      downloadsToday,
      downloadsThisMonth: downloadsMonth,
      successfulDownloads,
      failedDownloads,
      quotaLimitBlocks: blockedQuotaDownloads,
      subscriptionExpiryBlocks: blockedSubDownloads,
      downloadsByPlan: planBreakdown,
      topDownloadedVideos: topVideos.map((v) => ({
        videoId: v._id,
        title: v.title || "Untitled Video",
        downloads: v.count,
      })),
      timestamp: now.toISOString(),
    }
  }
}

export const downloadAuditService = new DownloadAuditService()
export default downloadAuditService
