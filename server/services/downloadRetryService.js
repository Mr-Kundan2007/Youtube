import DownloadRecord from "../Modals/DownloadRecord.js"
import Video from "../Modals/video.js"
import User from "../Modals/Auth.js"
import downloadTokenService from "./downloadTokenService.js"
import subscriptionService from "./subscriptionService.js"
import downloadAuditService, { DownloadEvents } from "./downloadAuditService.js"
import { downloadConfig } from "../config/index.js"
import { ApiError } from "../utils/apiError.js"

/**
 * Service managing controlled download retries for failed, interrupted, or ready downloads.
 * Enforces ownership, retry count limits, retry window boundaries, and prevents duplicate quota consumption.
 */
export class DownloadRetryService {
  /**
   * Retries an eligible failed or interrupted download record.
   * Generates a fresh delivery authorization token without consuming additional quota.
   */
  async retryDownload({
    downloadId,
    user,
    clientIp = "",
    userAgent = "",
    deviceId = "web",
  }) {
    if (!downloadId) {
      throw ApiError.badRequest("DOWNLOAD_ID_REQUIRED", "Download ID is required for retry")
    }
    if (!user || !user.id) {
      throw ApiError.unauthorized("UNAUTHORIZED", "Authenticated user is required")
    }

    // 1. Fetch Download Record
    const record = await DownloadRecord.findById(downloadId)
    if (!record) {
      throw ApiError.notFound("DOWNLOAD_NOT_FOUND", "Download record not found")
    }

    // 2. Ownership Validation: Must belong to authenticated user
    if (String(record.userId) !== String(user.id)) {
      downloadAuditService.logEvent(DownloadEvents.DOWNLOAD_RETRY_DENIED, {
        userId: user.id,
        videoId: record.videoId,
        downloadId: record._id,
        ip: clientIp,
        reason: "DOWNLOAD_ACCESS_DENIED",
      })
      throw ApiError.forbidden(
        "DOWNLOAD_ACCESS_DENIED",
        "You do not have permission to retry this download record"
      )
    }

    downloadAuditService.logEvent(DownloadEvents.DOWNLOAD_RETRY_REQUESTED, {
      userId: user.id,
      videoId: record.videoId,
      downloadId: record._id,
      ip: clientIp,
      metadata: {
        currentStatus: record.download_status,
        retryCount: record.retry_count || 0,
      },
    })

    // 3. Status Eligibility Validation
    const retryableStatuses = ["failed", "interrupted", "ready", "authorized"]
    if (!retryableStatuses.includes(record.download_status)) {
      downloadAuditService.logEvent(DownloadEvents.DOWNLOAD_RETRY_DENIED, {
        userId: user.id,
        videoId: record.videoId,
        downloadId: record._id,
        reason: "DOWNLOAD_NOT_RETRYABLE",
      })
      throw ApiError.badRequest(
        "DOWNLOAD_NOT_RETRYABLE",
        `Downloads with status '${record.download_status}' cannot be retried`
      )
    }

    // 4. Retry Limit Validation
    const maxRetries = Number(downloadConfig.maxRetries || 3)
    if ((record.retry_count || 0) >= maxRetries) {
      downloadAuditService.logEvent(DownloadEvents.DOWNLOAD_RETRY_DENIED, {
        userId: user.id,
        videoId: record.videoId,
        downloadId: record._id,
        reason: "DOWNLOAD_RETRY_LIMIT_EXCEEDED",
      })
      throw ApiError.badRequest(
        "DOWNLOAD_RETRY_LIMIT_EXCEEDED",
        `Maximum retry limit of ${maxRetries} attempts reached for this download`
      )
    }

    // 5. Retry Time Window Validation
    const retryWindowMinutes = Number(downloadConfig.retryWindowMinutes || 60)
    const retryWindowMs = retryWindowMinutes * 60 * 1000
    const referenceTime = record.updatedAt || record.createdAt || new Date()
    const elapsedMs = Date.now() - new Date(referenceTime).getTime()

    if (elapsedMs > retryWindowMs) {
      downloadAuditService.logEvent(DownloadEvents.DOWNLOAD_RETRY_DENIED, {
        userId: user.id,
        videoId: record.videoId,
        downloadId: record._id,
        reason: "DOWNLOAD_RETRY_WINDOW_EXPIRED",
      })
      throw ApiError.badRequest(
        "DOWNLOAD_RETRY_WINDOW_EXPIRED",
        `Retry window of ${retryWindowMinutes} minutes has expired. Please initiate a new download.`
      )
    }

    // 6. Re-verify User Account Status
    const userDoc = await User.findById(user.id)
    if (!userDoc || userDoc.status === "blocked" || userDoc.status === "suspended") {
      throw ApiError.forbidden(
        "ACCOUNT_DOWNLOAD_RESTRICTED",
        "User account is blocked or suspended. Retry denied."
      )
    }

    // 7. Re-verify Video Availability
    const video = await Video.findById(record.videoId)
    if (!video || video.deleted_at) {
      throw ApiError.notFound("VIDEO_NOT_AVAILABLE", "Video file is no longer available")
    }
    if (video.is_downloadable === false) {
      throw ApiError.forbidden("VIDEO_NOT_DOWNLOADABLE", "Video is marked not downloadable")
    }

    // 8. Re-verify Subscription State
    const sub = await subscriptionService.getUserSubscription(user.id)
    const subValidation = subscriptionService.validateSubscriptionState(sub)
    if (!subValidation.isValid) {
      throw ApiError.forbidden(
        subValidation.code || "SUBSCRIPTION_EXPIRED",
        subValidation.message || "Active subscription required to retry download"
      )
    }

    // 9. Increment retry count and update download status
    const previousStatus = record.download_status
    record.retry_count = (record.retry_count || 0) + 1
    record.download_status = "preparing"
    record.failure_reason = ""
    record.failure_code = ""

    // 10. Generate Fresh Delivery Token (dl_...) tied to this download record without consuming quota
    const tokenResult = await downloadTokenService.generateDownloadToken({
      downloadId: record._id,
      videoId: record.videoId,
      userId: user.id,
      ipAddress: clientIp,
      userAgent,
      expiresInSeconds: downloadConfig.tokenExpirySeconds,
    })

    record.download_token_id = tokenResult.rawToken
    await record.save()

    downloadAuditService.logEvent(DownloadEvents.DOWNLOAD_RETRY_ALLOWED, {
      userId: user.id,
      videoId: record.videoId,
      downloadId: record._id,
      ip: clientIp,
      metadata: {
        previousStatus,
        retryNumber: record.retry_count,
        maxRetries,
        tokenId: tokenResult.tokenId,
      },
    })

    return {
      success: true,
      message: "Download retry authorized",
      downloadId: record._id,
      authorizationToken: tokenResult.rawToken,
      downloadToken: tokenResult.rawToken,
      token: tokenResult.rawToken,
      downloadUrl: `/api/download/${tokenResult.rawToken}`,
      expiresAt: tokenResult.expiresAt,
      expiresInSeconds: tokenResult.expiresInSeconds,
      status: "preparing",
      retryCount: record.retry_count,
      maxRetries,
      remainingRetries: Math.max(0, maxRetries - record.retry_count),
    }
  }
}

export const downloadRetryService = new DownloadRetryService()
export default downloadRetryService
