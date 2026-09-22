import DownloadRecord from "../Modals/DownloadRecord.js"
import DownloadToken from "../Modals/DownloadToken.js"
import downloadTokenService from "./downloadTokenService.js"
import { downloadQuotaService } from "./quotaService.js"
import downloadAuditService, { DownloadEvents } from "./downloadAuditService.js"
import { downloadConfig } from "../config/index.js"

/**
 * Service managing duplicate download detection and existing download reuse,
 * guaranteeing that duplicate requests within the configured window consume zero additional quota.
 */
export class DuplicateDownloadService {
  /**
   * Checks if an authorized or completed download exists for (userId, videoId)
   * within the configured duplicate window.
   */
  async checkDuplicateDownload({
    userId,
    videoId,
    windowMinutes = null,
    clientIp = "",
    userAgent = "",
    deviceId = "web",
  }) {
    if (!userId || !videoId) {
      return { isDuplicate: false, existingRecord: null }
    }

    const effectiveWindowMinutes =
      windowMinutes !== null && windowMinutes !== undefined
        ? Number(windowMinutes)
        : Number(
            downloadConfig.duplicateWindowMinutes ||
              (downloadConfig.duplicateWindowHours || 24) * 60
          )

    const windowMs = effectiveWindowMinutes * 60 * 1000
    const cutoff = new Date(Date.now() - windowMs)

    // Find the latest matching download record for the same user and video within the window
    const existingRecord = await DownloadRecord.findOne({
      userId,
      videoId,
      createdAt: { $gte: cutoff },
      download_status: {
        $in: [
          "authorized",
          "preparing",
          "ready",
          "downloading",
          "started",
          "completed",
          "interrupted",
          "failed",
        ],
      },
    }).sort({ createdAt: -1 })

    if (!existingRecord) {
      return {
        isDuplicate: false,
        existingRecord: null,
      }
    }

    // A matching record within the duplicate window was found
    downloadAuditService.logEvent(DownloadEvents.DUPLICATE_DETECTED, {
      userId,
      videoId,
      downloadId: existingRecord._id,
      ip: clientIp,
      metadata: {
        existingStatus: existingRecord.download_status,
        windowMinutes: effectiveWindowMinutes,
        originalDownloadId: existingRecord._id,
      },
    })

    return {
      isDuplicate: true,
      existingRecord,
      status: existingRecord.download_status,
      windowMinutes: effectiveWindowMinutes,
    }
  }

  /**
   * Reuses an existing download record for a duplicate request, ensuring zero extra quota deduction.
   * Generates a fresh delivery authorization token if needed, or returns the existing active token.
   */
  async reuseExistingDownload({
    existingRecord,
    userId,
    videoId,
    clientIp = "",
    userAgent = "",
    deviceId = "web",
  }) {
    // Check if there is an active valid token for this download
    let tokenResult = null
    const activeTokenDoc = await DownloadToken.findOne({
      download_id: existingRecord._id,
      status: "active",
      expires_at: { $gt: new Date() },
    })

    if (activeTokenDoc && existingRecord.download_token_id) {
      tokenResult = {
        token: existingRecord.download_token_id,
        rawToken: existingRecord.download_token_id,
        expiresAt: activeTokenDoc.expires_at,
        expiresInSeconds: Math.max(
          0,
          Math.floor((activeTokenDoc.expires_at.getTime() - Date.now()) / 1000)
        ),
      }
    } else {
      // Issue a fresh single-use token tied to this existing download record without touching quota!
      tokenResult = await downloadTokenService.generateDownloadToken({
        downloadId: existingRecord._id,
        videoId,
        userId,
        ipAddress: clientIp,
        userAgent,
        expiresInSeconds: downloadConfig.tokenExpirySeconds,
      })

      // Update token reference on existing record
      existingRecord.download_token_id = tokenResult.rawToken
      if (
        existingRecord.download_status === "completed" ||
        existingRecord.download_status === "interrupted" ||
        existingRecord.download_status === "failed"
      ) {
        existingRecord.download_status = "ready"
      }
      existingRecord.is_duplicate = true
      if (!existingRecord.original_download_id) {
        existingRecord.original_download_id = existingRecord._id
      }
      await existingRecord.save()
    }

    downloadAuditService.logEvent(DownloadEvents.DUPLICATE_REUSED, {
      userId,
      videoId,
      downloadId: existingRecord._id,
      ip: clientIp,
      metadata: {
        originalDownloadId: existingRecord.original_download_id || existingRecord._id,
        reusedStatus: existingRecord.download_status,
      },
    })

    // Fetch active quota status to return accurate remaining quota
    const activeQuota = await downloadQuotaService.getActiveQuotaRecord(
      userId,
      existingRecord.subscription_plan || "free"
    )
    const quotaRemaining = activeQuota
      ? (activeQuota.quota_type === "unlimited" ? null : activeQuota.quota_remaining)
      : Math.max(0, (existingRecord.quota_limit || 1) - (existingRecord.quota_after_download || 1))

    return {
      isDuplicate: true,
      originalDownloadId: existingRecord.original_download_id || existingRecord._id,
      downloadId: existingRecord._id,
      authorizationToken: tokenResult.rawToken,
      downloadToken: tokenResult.rawToken,
      token: tokenResult.rawToken,
      downloadUrl: `/api/download/${tokenResult.rawToken}`,
      expiresAt: tokenResult.expiresAt,
      expiresInSeconds: tokenResult.expiresInSeconds,
      status: existingRecord.download_status,
      quotaBefore: existingRecord.quota_before_download,
      quotaAfter: existingRecord.quota_after_download,
      remainingQuota: quotaRemaining,
      quotaRemaining: quotaRemaining,
      quotaUsed: activeQuota ? activeQuota.quota_used : existingRecord.quota_after_download,
      record: existingRecord,
    }
  }
}

export const duplicateDownloadService = new DuplicateDownloadService()
export default duplicateDownloadService
