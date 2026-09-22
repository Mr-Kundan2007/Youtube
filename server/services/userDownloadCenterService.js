import mongoose from "mongoose"
import DownloadRecord from "../Modals/DownloadRecord.js"
import DownloadQuota from "../Modals/DownloadQuota.js"
import DownloadDevice from "../Modals/DownloadDevice.js"
import DownloadSecurityEvent from "../Modals/DownloadSecurityEvent.js"
import DownloadPreference from "../Modals/DownloadPreference.js"
import DownloadRestriction from "../Modals/DownloadRestriction.js"
import { downloadQuotaService } from "./quotaService.js"
import { downloadAuditService, DownloadEvents } from "./downloadAuditService.js"
import { userNotificationService } from "./userNotificationService.js"
import { ApiError } from "../utils/apiError.js"

export class UserDownloadCenterService {
  /**
   * Retrieves high-level user download dashboard summary.
   */
  async getUserDashboard(userId) {
    if (!userId) {
      throw ApiError.unauthorized("UNAUTHORIZED", "User authentication required")
    }

    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)

    const userFilter = {
      $or: [
        { userId: new mongoose.Types.ObjectId(userId) },
        { user_id: new mongoose.Types.ObjectId(userId) },
      ],
    }

    const [
      totalDownloads,
      downloadsToday,
      completedDownloads,
      failedDownloads,
      activeDownloadsCount,
      quotaStatus,
      recentRecords,
    ] = await Promise.all([
      DownloadRecord.countDocuments(userFilter),
      DownloadRecord.countDocuments({ ...userFilter, createdAt: { $gte: startOfToday } }),
      DownloadRecord.countDocuments({ ...userFilter, download_status: "completed" }),
      DownloadRecord.countDocuments({
        ...userFilter,
        download_status: { $in: ["failed", "interrupted", "blocked"] },
      }),
      DownloadRecord.countDocuments({
        ...userFilter,
        download_status: { $in: ["authorized", "preparing", "ready", "downloading", "started"] },
      }),
      downloadQuotaService.getCurrentQuota(userId),
      DownloadRecord.find(userFilter)
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
    ])

    const totalLimit = quotaStatus.limit ?? 1
    const usedCount = quotaStatus.used ?? 0
    const remainingCount =
      quotaStatus.remaining !== undefined
        ? quotaStatus.remaining
        : Math.max(0, totalLimit - usedCount)

    return {
      totalDownloads,
      downloadsToday,
      completedDownloads,
      successfulDownloads: completedDownloads,
      failedDownloads,
      activeDownloads: activeDownloadsCount,
      quota: {
        plan: quotaStatus.plan || "free",
        limit: totalLimit,
        used: usedCount,
        remaining: remainingCount,
        quotaType: quotaStatus.quotaType || "daily",
        resetAt: quotaStatus.resetAt,
        isQuotaLimited: quotaStatus.isQuotaLimited !== false,
      },
      subscription: {
        plan: (quotaStatus.plan || "free").toUpperCase(),
        status: quotaStatus.isSubscriptionExpired ? "EXPIRED" : "ACTIVE",
        expiresAt: quotaStatus.subscriptionExpiresAt || null,
      },
      recentDownloads: recentRecords.map((r) => ({
        downloadId: r._id,
        videoId: r.videoId,
        videoTitle: r.videoTitle || "Video",
        status: r.download_status,
        fileSize: r.file_size || 0,
        plan: r.subscription_plan || "free",
        createdAt: r.createdAt,
      })),
    }
  }

  /**
   * Retrieves active in-progress downloads for the authenticated user.
   */
  async getActiveDownloads(userId) {
    if (!userId) {
      throw ApiError.unauthorized("UNAUTHORIZED", "User authentication required")
    }

    const activeStatuses = ["authorized", "preparing", "ready", "downloading", "started"]

    const downloads = await DownloadRecord.find({
      $or: [
        { userId: new mongoose.Types.ObjectId(userId) },
        { user_id: new mongoose.Types.ObjectId(userId) },
      ],
      download_status: { $in: activeStatuses },
    })
      .sort({ createdAt: -1 })
      .lean()

    return downloads.map((d) => ({
      downloadId: d._id,
      _id: d._id,
      videoId: d.videoId,
      videoTitle: d.videoTitle || "Video",
      thumbnailUrl: d.thumbnailUrl || "/video/snowglobe.jpg",
      status: d.download_status,
      fileSize: d.file_size || 0,
      subscriptionPlan: d.subscription_plan,
      startedAt: d.download_started_at || d.createdAt,
      createdAt: d.createdAt,
    }))
  }

  /**
   * Cancels an active download, validating user ownership.
   */
  async cancelUserDownload(userId, downloadId, reason = "Cancelled by user") {
    if (!userId || !downloadId) {
      throw ApiError.badRequest("MISSING_PARAMETERS", "User ID and Download ID required")
    }

    const download = await DownloadRecord.findOne({
      _id: downloadId,
      $or: [
        { userId: new mongoose.Types.ObjectId(userId) },
        { user_id: new mongoose.Types.ObjectId(userId) },
      ],
    })

    if (!download) {
      throw ApiError.notFound("DOWNLOAD_NOT_FOUND", "Download record not found or access denied")
    }

    if (download.download_status === "completed") {
      throw ApiError.badRequest("DOWNLOAD_ALREADY_COMPLETED", "Cannot cancel a completed download")
    }

    if (download.download_status === "cancelled") {
      return { success: true, message: "Download is already cancelled", download }
    }

    const prevStatus = download.download_status
    download.download_status = "cancelled"
    download.failure_reason = reason
    await download.save()

    // Safely release quota reservation if download was in an uncompleted active state
    if (["authorized", "preparing", "ready", "started", "downloading"].includes(prevStatus)) {
      try {
        const activeQuota = await downloadQuotaService.getActiveQuotaRecord(
          userId,
          download.subscription_plan || "free"
        )
        if (activeQuota) {
          await downloadQuotaService.releaseQuota({
            quotaId: activeQuota._id,
            userId,
            reason: "USER_DOWNLOAD_CANCELLED",
          })
        }
      } catch (err) {
        console.warn("Failed to release quota upon download cancellation:", err.message)
      }
    }

    // Audit log
    downloadAuditService.logEvent(DownloadEvents.DOWNLOAD_CANCELLED, {
      userId,
      videoId: download.videoId,
      downloadId: download._id,
      reason,
    })

    // Notify user
    await userNotificationService.createNotification({
      userId,
      type: "DOWNLOAD_CANCELLED",
      title: "Download Cancelled",
      message: `Your download of "${download.videoTitle || "Video"}" was cancelled.`,
      metadata: { downloadId: download._id, videoId: download.videoId },
    })

    return {
      success: true,
      message: "Download successfully cancelled",
      downloadId: download._id,
      status: download.download_status,
    }
  }

  /**
   * Generates safe CSV data of user's own downloads without administrative metadata.
   */
  async exportUserDownloadHistory(userId) {
    if (!userId) {
      throw ApiError.unauthorized("UNAUTHORIZED", "User authentication required")
    }

    const records = await DownloadRecord.find({
      $or: [
        { userId: new mongoose.Types.ObjectId(userId) },
        { user_id: new mongoose.Types.ObjectId(userId) },
      ],
    })
      .sort({ createdAt: -1 })
      .lean()

    const headers = ["Download Date", "Video Title", "Status", "Plan", "File Size (Bytes)"]
    const rows = [headers.join(",")]

    for (const r of records) {
      const escape = (str) => `"${String(str || "").replace(/"/g, '""')}"`
      const dateStr = r.createdAt ? new Date(r.createdAt).toISOString() : ""
      const titleStr = escape(r.videoTitle || "Untitled Video")
      const statusStr = escape(r.download_status || "unknown")
      const planStr = escape(r.subscription_plan || "free")
      const sizeStr = r.file_size || 0

      rows.push([dateStr, titleStr, statusStr, planStr, sizeStr].join(","))
    }

    return {
      csvData: rows.join("\n"),
      rowCount: records.length,
      filename: `my_downloads_${new Date().toISOString().split("T")[0]}.csv`,
    }
  }

  /**
   * Returns safe self-service security overview for user.
   */
  async getUserSecurityOverview(userId) {
    if (!userId) {
      throw ApiError.unauthorized("UNAUTHORIZED", "User authentication required")
    }

    const userFilter = {
      $or: [
        { userId: new mongoose.Types.ObjectId(userId) },
        { user_id: new mongoose.Types.ObjectId(userId) },
      ],
    }

    const [devicesCount, activeRestrictions, recentActivity] = await Promise.all([
      DownloadDevice.countDocuments({ ...userFilter, status: "active" }),
      DownloadRestriction.find({ ...userFilter, status: "active" }).lean(),
      DownloadRecord.find(userFilter)
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
    ])

    return {
      registeredDevicesCount: devicesCount,
      hasActiveRestrictions: activeRestrictions.length > 0,
      restrictions: activeRestrictions.map((r) => ({
        type: r.restrictionType,
        reason: r.reason,
        expiresAt: r.expiresAt,
      })),
      recentActivity: recentActivity.map((a) => ({
        downloadId: a._id,
        videoTitle: a.videoTitle || "Video",
        status: a.download_status,
        date: a.createdAt,
        device: a.device_identifier || a.device_id || "web",
      })),
    }
  }

  /**
   * Submits a user report of suspicious or unauthorized download activity.
   */
  async reportSuspiciousActivity(userId, { downloadId, reason }) {
    if (!userId || !downloadId) {
      throw ApiError.badRequest("MISSING_PARAMETERS", "User ID and Download ID required")
    }

    const download = await DownloadRecord.findOne({
      _id: downloadId,
      $or: [
        { userId: new mongoose.Types.ObjectId(userId) },
        { user_id: new mongoose.Types.ObjectId(userId) },
      ],
    })

    if (!download) {
      throw ApiError.notFound("DOWNLOAD_NOT_FOUND", "Download not found or access denied")
    }

    // Create a high-priority security event
    const securityEvent = await DownloadSecurityEvent.create({
      userId,
      user_id: userId,
      downloadId: download._id,
      eventType: "SUSPICIOUS_DOWNLOAD_REPORTED",
      riskPoints: 40,
      riskLevel: "medium",
      status: "open",
      ipAddress: download.ip_address || "127.0.0.1",
      deviceId: download.device_id || download.device_identifier || null,
      details: {
        reportedBy: "USER",
        userReason: reason || "User reported unfamiliar download activity",
        videoTitle: download.videoTitle,
      },
    })

    // Log security alert notification
    await userNotificationService.createNotification({
      userId,
      type: "SECURITY_ALERT",
      title: "Suspicious Activity Reported",
      message: `Your report regarding download "${download.videoTitle || "Video"}" was received and submitted for security review.`,
      metadata: { downloadId: download._id, eventId: securityEvent._id },
    })

    return {
      success: true,
      message: "Suspicious activity report recorded and under review",
      eventId: securityEvent._id,
    }
  }

  /**
   * Gets or initializes user download preferences.
   */
  async getPreferences(userId) {
    if (!userId) {
      throw ApiError.unauthorized("UNAUTHORIZED", "User authentication required")
    }

    let prefs = await DownloadPreference.findOne({
      $or: [
        { userId: new mongoose.Types.ObjectId(userId) },
        { user_id: new mongoose.Types.ObjectId(userId) },
      ],
    }).lean()

    if (!prefs) {
      prefs = await DownloadPreference.create({
        userId,
        user_id: userId,
        preferredQuality: "auto",
        notifyOnComplete: true,
        notifyOnFailure: true,
        notifyOnQuotaWarning: true,
        autoRetryOnFailure: false,
        confirmBeforeDownload: true,
      })
    }

    return {
      preferredQuality: prefs.preferredQuality || "auto",
      notifyOnComplete: prefs.notifyOnComplete ?? true,
      notifyOnFailure: prefs.notifyOnFailure ?? true,
      notifyOnQuotaWarning: prefs.notifyOnQuotaWarning ?? true,
      autoRetryOnFailure: prefs.autoRetryOnFailure ?? false,
      confirmBeforeDownload: prefs.confirmBeforeDownload ?? true,
    }
  }

  /**
   * Updates user download preferences.
   */
  async updatePreferences(userId, updateData) {
    if (!userId) {
      throw ApiError.unauthorized("UNAUTHORIZED", "User authentication required")
    }

    const allowedFields = [
      "preferredQuality",
      "notifyOnComplete",
      "notifyOnFailure",
      "notifyOnQuotaWarning",
      "autoRetryOnFailure",
      "confirmBeforeDownload",
    ]

    const updates = {}
    for (const f of allowedFields) {
      if (updateData[f] !== undefined) {
        updates[f] = updateData[f]
      }
    }

    const userObjId = mongoose.Types.ObjectId.isValid(userId)
      ? new mongoose.Types.ObjectId(userId)
      : userId

    let pref = await DownloadPreference.findOne({
      $or: [{ userId: userObjId }, { user_id: userObjId }],
    })

    if (!pref) {
      pref = new DownloadPreference({
        userId: userObjId,
        user_id: userObjId,
        ...updates,
      })
    } else {
      Object.assign(pref, updates)
    }

    await pref.save()

    return {
      preferredQuality: pref.preferredQuality,
      notifyOnComplete: pref.notifyOnComplete,
      notifyOnFailure: pref.notifyOnFailure,
      notifyOnQuotaWarning: pref.notifyOnQuotaWarning,
      autoRetryOnFailure: pref.autoRetryOnFailure,
      confirmBeforeDownload: pref.confirmBeforeDownload,
    }
  }
}

export const userDownloadCenterService = new UserDownloadCenterService()
export default userDownloadCenterService
