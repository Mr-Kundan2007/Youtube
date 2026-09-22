import mongoose from "mongoose"
import Video from "../Modals/video.js"
import DownloadRecord from "../Modals/DownloadRecord.js"
import DownloadToken from "../Modals/DownloadToken.js"
import downloadEntitlementService from "./downloadEntitlementService.js"
import quotaService from "./quotaService.js"
import downloadTokenService from "./downloadTokenService.js"
import duplicateDownloadService from "./duplicateDownloadService.js"
import deviceService from "./deviceService.js"
import deviceAuthorizationService from "./deviceAuthorizationService.js"
import downloadSecurityService from "./downloadSecurityService.js"
import securityEventService from "./securityEventService.js"
import downloadAuditService, { DownloadEvents } from "./downloadAuditService.js"
import { downloadConfig } from "../config/index.js"
import { ApiError } from "../utils/apiError.js"

/**
 * In-flight concurrency lock to serialize simultaneous identical requests (same user + same video).
 * Prevents race conditions during duplicate check and quota reservation.
 */
class RequestKeyLock {
  constructor() {
    this.activeLocks = new Map()
  }

  async acquire(key, timeoutMs = 15000) {
    const startTime = Date.now()
    while (this.activeLocks.has(key)) {
      const existingPromise = this.activeLocks.get(key)
      try {
        await Promise.race([
          existingPromise,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Lock timeout")), Math.max(100, timeoutMs - (Date.now() - startTime)))
          ),
        ])
      } catch {
        break
      }
    }

    let releaseFn
    const lockPromise = new Promise((resolve) => {
      releaseFn = resolve
    })

    this.activeLocks.set(key, lockPromise)

    let released = false
    return () => {
      if (!released) {
        released = true
        this.activeLocks.delete(key)
        releaseFn()
      }
    }
  }
}

const authLock = new RequestKeyLock()

/**
 * Central orchestrator for the video download authorization workflow.
 * Enforces: Authentication -> Account Validation -> Video Validation -> Video Accessibility
 * -> Entitlement Check -> Idempotency -> Atomic Quota Reservation -> Secure Token Generation
 * -> Atomic Failure Rollback -> Standardized Authorization Response.
 */
export class DownloadAuthorizationService {
  /**
   * Main authorization pipeline.
   */
  async authorizeDownload({
    user,
    userId: explicitUserId,
    videoId,
    clientIp = "127.0.0.1",
    userAgent = "",
    deviceId = "web",
    requestId = "",
    idempotencyKey = "",
  }) {
    // Audit download requested
    downloadAuditService.logEvent(DownloadEvents.DOWNLOAD_REQUESTED, {
      userId: user?.id || explicitUserId || null,
      videoId,
      ip: clientIp,
      deviceId,
      requestId,
    })

    // 1. User Authentication Check
    const activeUserId = user?.id || explicitUserId
    if (!activeUserId) {
      downloadAuditService.logEvent(DownloadEvents.DOWNLOAD_DENIED, {
        videoId,
        ip: clientIp,
        reason: "UNAUTHORIZED",
      })
      throw ApiError.unauthorized("UNAUTHORIZED", "Authentication required to download videos.")
    }

    const userId = String(activeUserId)

    // Concurrency lock: serialize simultaneous duplicate requests for the same user and video
    const lockKey = `${userId}:${String(videoId || "")}`
    const releaseLock = await authLock.acquire(lockKey)

    try {
      // 2. Account Validation Check
      const accountCheck = await downloadEntitlementService.validateAccountAccess(userId)
      if (!accountCheck.isValid) {
        downloadAuditService.logEvent(DownloadEvents.DOWNLOAD_DENIED, {
          userId,
          videoId,
          ip: clientIp,
          reason: "ACCOUNT_DOWNLOAD_RESTRICTED",
          metadata: { status: accountCheck.code },
        })
        throw ApiError.forbidden(
          "ACCOUNT_DOWNLOAD_RESTRICTED",
          accountCheck.message || "Your account is restricted from downloading."
        )
      }

      // 2.5. Subscription & Entitlement Resolution
      const entitlement = await downloadEntitlementService.getDownloadEntitlement(userId)
      if (!entitlement.success) {
        const errorCode =
          entitlement.code === "ACCOUNT_BLOCKED"
            ? "ACCOUNT_DOWNLOAD_RESTRICTED"
            : entitlement.code || "DOWNLOAD_DENIED"
        downloadAuditService.logEvent(DownloadEvents.DOWNLOAD_DENIED, {
          userId,
          videoId,
          ip: clientIp,
          reason: errorCode,
        })
        throw ApiError.forbidden(errorCode, entitlement.message)
      }

      const effectivePlan = entitlement.data.planKey || "free"
      const planConfig = downloadConfig.plans[effectivePlan] || downloadConfig.plans.free

      // 2.8. Device Identification, Validation & Device Limits Check
      const deviceMeta = deviceService.identifyDevice({
        headers: {
          "x-device-id": deviceId,
          "user-agent": userAgent,
          "x-forwarded-for": clientIp,
        },
        body: { deviceId },
      })
      const effectiveDeviceId = deviceId || deviceMeta.deviceId || "device_web_default"

      const deviceAuth = await deviceAuthorizationService.authorizeDeviceForDownload({
        user,
        userId,
        deviceId: effectiveDeviceId,
        metadata: {
          ...deviceMeta,
          clientIp,
          userAgent,
        },
        planConfig,
      })

      // 2.9. Advanced Download Security, Rate Limiting & Abuse Detection
      const securityAnalysis = await downloadSecurityService.analyzeDownloadSecurity({
        userId,
        user,
        deviceId: effectiveDeviceId,
        clientIp,
        userAgent,
        browser: deviceMeta.browser,
      })

      if (!securityAnalysis.allowed) {
        throw new ApiError(
          securityAnalysis.statusCode || 403,
          securityAnalysis.reason || "DOWNLOAD_RESTRICTED",
          securityAnalysis.message || "Download access is restricted."
        )
      }

      // 3. Video Validation Check
      if (!videoId || !mongoose.Types.ObjectId.isValid(videoId)) {
        throw ApiError.badRequest("INVALID_VIDEO_ID", "Valid video ID is required")
      }

      const video = await Video.findById(videoId)
      if (!video || video.deleted_at) {
        downloadAuditService.logEvent(DownloadEvents.DOWNLOAD_DENIED, {
          userId,
          videoId,
          ip: clientIp,
          reason: "VIDEO_NOT_FOUND",
        })
        throw ApiError.notFound("VIDEO_NOT_FOUND", "This video was not found or is no longer available.")
      }

      // 4. Video Accessibility Validation Check
      // A. General downloadable capability
      if (video.is_downloadable === false || video.allowDownload === false) {
        downloadAuditService.logEvent(DownloadEvents.DOWNLOAD_DENIED, {
          userId,
          videoId,
          ip: clientIp,
          reason: "VIDEO_NOT_DOWNLOADABLE",
        })
        throw ApiError.forbidden("VIDEO_NOT_DOWNLOADABLE", "This video is not permitted for download.")
      }

      // B. Private video validation: must be owner/uploader
      if (video.visibility === "private") {
        const isOwner =
          String(video.uploader) === userId ||
          String(video.channelId) === userId ||
          (user?.email && String(user.email) === String(video.uploader))
        if (!isOwner) {
          downloadAuditService.logEvent(DownloadEvents.DOWNLOAD_DENIED, {
            userId,
            videoId,
            ip: clientIp,
            reason: "VIDEO_ACCESS_DENIED",
          })
          throw ApiError.forbidden(
            "VIDEO_ACCESS_DENIED",
            "You do not have permission to download this private video."
          )
        }
      }

      // 5. Subscription & Entitlement Validation Details

    // C. Premium video validation: Free plan cannot download premium videos
    if (video.is_premium === true || video.visibility === "premium" || video.visibility === "subscription_only") {
      if (effectivePlan === "free") {
        downloadAuditService.logEvent(DownloadEvents.DOWNLOAD_DENIED, {
          userId,
          videoId,
          ip: clientIp,
          reason: "VIDEO_ACCESS_DENIED",
        })
        throw ApiError.forbidden(
          "VIDEO_ACCESS_DENIED",
          "A paid subscription plan is required to download premium videos."
        )
      }
    }

    // Check if download is enabled for plan
    if (entitlement.data.downloadEnabled === false) {
      downloadAuditService.logEvent(DownloadEvents.DOWNLOAD_DENIED, {
        userId,
        videoId,
        ip: clientIp,
        reason: "DOWNLOAD_NOT_ALLOWED_FOR_PLAN",
      })
      throw ApiError.forbidden(
        "DOWNLOAD_NOT_ALLOWED_FOR_PLAN",
        "Downloads are not enabled for your subscription plan."
      )
    }

    // Check subscription expiration
    if (entitlement.data.subscriptionStatus === "expired" || entitlement.data.isExpired) {
      downloadAuditService.logEvent(DownloadEvents.DOWNLOAD_DENIED, {
        userId,
        videoId,
        ip: clientIp,
        reason: "SUBSCRIPTION_EXPIRED",
      })
      throw ApiError.forbidden(
        "SUBSCRIPTION_EXPIRED",
        "Your subscription has expired. Upgrade or renew your plan to continue downloading."
      )
    }

    // 6. Idempotency Check: Avoid duplicate reservations for the same request
    const effectiveIdempotencyKey = idempotencyKey || requestId
    if (effectiveIdempotencyKey) {
      const existingRecord = await DownloadRecord.findOne({
        userId,
        $or: [
          { idempotency_key: effectiveIdempotencyKey },
          { request_id: effectiveIdempotencyKey },
        ],
        download_status: { $in: ["authorized", "pending"] },
      })

      if (existingRecord) {
        // Find existing active token
        const activeToken = await DownloadToken.findOne({
          download_id: existingRecord._id,
          status: "active",
          expires_at: { $gt: new Date() },
        })

        if (activeToken) {
          const rawToken = existingRecord.download_token_id || "dl_existing"
          return {
            success: true,
            message: "Download already authorized (idempotent request)",
            data: {
              downloadId: existingRecord._id,
              authorizationToken: rawToken,
              expiresAt: activeToken.expires_at,
              status: existingRecord.download_status,
              remainingQuota: existingRecord.quota_after_download,
            },
            downloadId: existingRecord._id,
            authorizationToken: rawToken,
            downloadToken: rawToken,
            token: rawToken,
            downloadUrl: `/api/download/${rawToken}`,
            expiresAt: activeToken.expires_at,
            status: existingRecord.download_status,
            remainingQuota: existingRecord.quota_after_download,
          }
        }
      }
    }

    // 6.5. Duplicate Download Check: Prevent duplicate quota consumption within duplicate window
    const duplicateCheck = await duplicateDownloadService.checkDuplicateDownload({
      userId,
      videoId,
      clientIp,
      userAgent,
      deviceId,
    })

    if (duplicateCheck.isDuplicate && duplicateCheck.existingRecord) {
      const reused = await duplicateDownloadService.reuseExistingDownload({
        existingRecord: duplicateCheck.existingRecord,
        userId,
        videoId,
        clientIp,
        userAgent,
        deviceId,
      })

      return {
        success: true,
        message: "Existing download reused (duplicate window active)",
        isDuplicate: true,
        originalDownloadId: reused.originalDownloadId,
        downloadId: reused.downloadId,
        authorizationToken: reused.authorizationToken,
        downloadToken: reused.downloadToken,
        token: reused.token,
        downloadUrl: reused.downloadUrl,
        expiresAt: reused.expiresAt,
        expiresInSeconds: reused.expiresInSeconds,
        status: reused.status,
        quotaBefore: reused.quotaBefore,
        quotaAfter: reused.quotaAfter,
        remainingQuota: reused.remainingQuota,
        quotaRemaining: reused.remainingQuota,
        quotaUsed: reused.quotaUsed,
        data: {
          downloadId: reused.downloadId,
          authorizationToken: reused.authorizationToken,
          expiresAt: reused.expiresAt,
          status: reused.status,
          remainingQuota: reused.remainingQuota,
          quotaRemaining: reused.remainingQuota,
          isDuplicate: true,
          originalDownloadId: reused.originalDownloadId,
        },
      }
    }

    // 7. Atomic Quota Reservation
    const reservation = await quotaService.reserveQuota({
      userId,
      videoId,
      planKey: effectivePlan,
      idempotencyKey: effectiveIdempotencyKey,
      requestId,
    })

    if (!reservation.success) {
      downloadAuditService.logEvent(DownloadEvents.DOWNLOAD_DENIED, {
        userId,
        videoId,
        ip: clientIp,
        reason: "DOWNLOAD_QUOTA_EXCEEDED",
      })

      // Record quota bypass attempt event if quota was exceeded
      await securityEventService.recordEvent({
        userId,
        deviceId: effectiveDeviceId,
        eventType: "QUOTA_BYPASS_ATTEMPT",
        ipAddress: clientIp,
        browser: deviceMeta.browser,
        userAgent,
        metadata: { plan: effectivePlan },
      }).catch(() => {})

      throw new ApiError(
        429,
        "DOWNLOAD_QUOTA_EXCEEDED",
        "Your download limit for the current period has been reached.",
        {
          remaining: 0,
          resetAt: reservation.quotaRecord?.period_end,
        }
      )
    }

    // 8. Create Download Record & Generate Secure Token with Atomic Rollback Support
    let downloadRecord = null
    let tokenResult = null

    try {
      downloadRecord = new DownloadRecord({
        userId,
        videoId,
        videoTitle: video.videotitle || "Untitled Video",
        thumbnailUrl: video.thumbnailUrl || "/video/snowglobe.jpg",
        subscription_plan: effectivePlan,
        download_status: "authorized",
        file_size: Number(video.filesize || 0),
        ip_address: clientIp,
        device_id: effectiveDeviceId,
        device_type: deviceMeta.deviceType,
        browser: deviceMeta.browser,
        operating_system: deviceMeta.operatingSystem,
        user_agent: userAgent,
        quota_before_download: reservation.quotaBefore,
        quota_after_download: reservation.quotaAfter,
        quota_id: reservation.quotaRecord?._id || null,
        request_id: requestId,
        idempotency_key: effectiveIdempotencyKey,
        securityFlagged: securityAnalysis?.action === "ALLOW_AND_FLAG",
        riskLevel: securityAnalysis?.riskLevel || "low",
        security_flags: securityAnalysis?.flags || [],
      })

      await downloadRecord.save()

      // Generate cryptographically secure download token (dl_...) bound to deviceId
      tokenResult = await downloadTokenService.generateDownloadToken({
        downloadId: downloadRecord._id,
        videoId: video._id,
        userId,
        deviceId: effectiveDeviceId,
        ipAddress: clientIp,
        userAgent,
        expiresInSeconds: downloadConfig.tokenExpirySeconds,
      })

      downloadRecord.download_token_id = tokenResult.rawToken
      await downloadRecord.save()

      // Update device activity for this download
      await deviceService.updateDeviceActivity(effectiveDeviceId, userId, {
        ip: clientIp,
        isDownload: true,
      })
    } catch (err) {
      // ROLLBACK: Release reserved quota to avoid leaking quota units on system failure
      if (reservation?.quotaRecord?._id) {
        await quotaService.releaseQuota({
          quotaId: reservation.quotaRecord._id,
          downloadId: downloadRecord?._id,
          userId,
          reason: "TOKEN_GENERATION_FAILED_ROLLBACK",
        }).catch(() => {})
      }

      if (downloadRecord?._id) {
        await DownloadRecord.findByIdAndDelete(downloadRecord._id).catch(() => {})
      }

      downloadAuditService.logEvent(DownloadEvents.DOWNLOAD_DENIED, {
        userId,
        videoId,
        ip: clientIp,
        reason: "TOKEN_GENERATION_FAILED",
      })

      throw new ApiError(
        500,
        "TOKEN_GENERATION_FAILED",
        "Failed to generate secure download token. Reserved quota has been restored."
      )
    }

    // 9. Audit Event & Standardized Response
    downloadAuditService.logEvent(DownloadEvents.DOWNLOAD_AUTHORIZED, {
      userId,
      videoId,
      plan: effectivePlan,
      ip: clientIp,
      deviceId,
      quotaBefore: reservation.quotaBefore,
      quotaAfter: reservation.quotaAfter,
      downloadId: downloadRecord._id,
    })

    return {
      success: true,
      message: "Download authorized",
      data: {
        downloadId: downloadRecord._id,
        authorizationToken: tokenResult.rawToken,
        expiresAt: tokenResult.expiresAt,
        status: downloadRecord.download_status,
        remainingQuota: reservation.quotaRemaining,
      },
      downloadId: downloadRecord._id,
      authorizationToken: tokenResult.rawToken,
      downloadToken: tokenResult.rawToken,
      token: tokenResult.rawToken,
      downloadUrl: `/api/download/${tokenResult.rawToken}`,
      expiresAt: tokenResult.expiresAt,
      expiresIn: tokenResult.expiresIn,
      status: downloadRecord.download_status,
      plan: entitlement.data.plan,
      planKey: effectivePlan,
      quotaLimit: reservation.quotaRecord?.quota_limit !== undefined ? reservation.quotaRecord.quota_limit : (effectivePlan === "free" ? 1 : null),
      remainingQuota: reservation.quotaRemaining,
      quotaRemaining: reservation.quotaRemaining,
      quotaUsed: reservation.quotaAfter,
      isDuplicate: Boolean(reservation.isDuplicate),
      originalDownloadId: reservation.originalDownloadId || null,
    }
    } finally {
      if (releaseLock) {
        releaseLock()
      }
    }
  }
}

export const downloadAuthorizationService = new DownloadAuthorizationService()
export default downloadAuthorizationService
