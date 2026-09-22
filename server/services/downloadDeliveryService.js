import fs from "fs"
import path from "path"
import mongoose from "mongoose"
import DownloadRecord from "../Modals/DownloadRecord.js"
import Video from "../Modals/video.js"
import User from "../Modals/Auth.js"
import storageService from "./storageService.js"
import downloadTokenService from "./downloadTokenService.js"
import subscriptionService from "./subscriptionService.js"
import quotaService from "./quotaService.js"
import downloadAuditService, { DownloadEvents } from "./downloadAuditService.js"
import { userNotificationService } from "./userNotificationService.js"
import { ApiError } from "../utils/apiError.js"
import { logger } from "../utils/logger.js"

/**
 * Service managing the download delivery pipeline:
 * Validating delivery requests, checking storage availability, generating signed URLs,
 * and streaming files with Range requests and lifecycle state transitions.
 */
export class DownloadDeliveryService {
  /**
   * Authorizes delivery and generates a short-lived signed streaming URL.
   * Atomic operations ensure tokens are marked used only when file delivery is validated.
   */
  async requestDelivery({ downloadId, token, rawToken, user, deviceId = "", clientIp = "", userAgent = "" }) {
    const candidateToken = token || rawToken
    if (!candidateToken) {
      throw ApiError.badRequest("DOWNLOAD_TOKEN_REQUIRED", "Download authorization token is required")
    }
    if (!downloadId) {
      throw ApiError.badRequest("DOWNLOAD_ID_REQUIRED", "Download ID is required for delivery")
    }
    if (!user || !user.id) {
      throw ApiError.unauthorized("UNAUTHORIZED", "Authenticated user is required")
    }

    // 1. Fetch Download Record
    const downloadRecord = await DownloadRecord.findById(downloadId)
    if (!downloadRecord) {
      throw ApiError.notFound("DOWNLOAD_NOT_FOUND", "Download record not found")
    }

    // Ensure download belongs to the user
    if (String(downloadRecord.userId) !== String(user.id)) {
      throw ApiError.forbidden("FORBIDDEN", "Download session does not belong to the authenticated user")
    }

    // 2. Validate token without immediately marking it used (prevents burnt token on storage failure)
    const tokenValidation = await downloadTokenService.validateDownloadToken({
      rawToken: candidateToken,
      userId: user.id,
      videoId: downloadRecord.videoId,
      deviceId: deviceId || downloadRecord.device_id || "",
      ipAddress: clientIp,
      userAgent,
      markUsed: false,
    })

    // 3. Re-verify user account status
    const userDoc = await User.findById(user.id)
    if (!userDoc || userDoc.status === "blocked" || userDoc.status === "suspended") {
      throw ApiError.forbidden(
        "ACCOUNT_DOWNLOAD_RESTRICTED",
        "User account is blocked or suspended. Delivery denied."
      )
    }

    // 4. Re-verify active subscription status
    const sub = await subscriptionService.getUserSubscription(user.id)
    const subValidation = subscriptionService.validateSubscriptionState(sub)
    if (!subValidation.isValid) {
      throw ApiError.forbidden(
        subValidation.code || "SUBSCRIPTION_EXPIRED",
        subValidation.message || "Active subscription is required to deliver video download"
      )
    }

    // 5. Fetch video details
    const video = await Video.findById(downloadRecord.videoId)
    if (!video || video.deleted_at) {
      downloadRecord.download_status = "failed"
      downloadRecord.failure_reason = "VIDEO_NOT_AVAILABLE"
      downloadRecord.failure_code = "VIDEO_NOT_AVAILABLE"
      await downloadRecord.save().catch(() => {})

      downloadAuditService.logEvent(DownloadEvents.DOWNLOAD_FAILED, {
        userId: user.id,
        videoId: downloadRecord.videoId,
        downloadId: downloadRecord._id,
        reason: "VIDEO_NOT_AVAILABLE",
      })

      throw ApiError.notFound("VIDEO_NOT_AVAILABLE", "The requested video is no longer available")
    }

    // 6. Validate physical file presence on storage
    downloadRecord.download_status = "preparing"
    await downloadRecord.save().catch(() => {})

    downloadAuditService.logEvent(DownloadEvents.DOWNLOAD_DELIVERY_REQUESTED, {
      userId: user.id,
      videoId: video._id,
      downloadId: downloadRecord._id,
      ip: clientIp,
      userAgent,
    })

    const fileValidation = storageService.validateFile(video)
    if (!fileValidation.isAvailable || !fileValidation.exists) {
      // Storage file is missing: fail download, release quota reservation, keep token unburned
      downloadRecord.download_status = "failed"
      downloadRecord.failure_reason = "VIDEO_FILE_NOT_AVAILABLE"
      downloadRecord.failure_code = "VIDEO_FILE_NOT_AVAILABLE"
      await downloadRecord.save().catch(() => {})

      let targetQuotaId = downloadRecord.quota_id
      if (!targetQuotaId) {
        const currentQuota = await quotaService.getActiveQuotaRecord(
          user.id,
          downloadRecord.subscription_plan || "free"
        )
        targetQuotaId = currentQuota?._id
      }

      if (targetQuotaId) {
        try {
          await quotaService.releaseQuota({
            quotaId: targetQuotaId,
            downloadId: downloadRecord._id,
            userId: user.id,
            reason: "VIDEO_FILE_NOT_AVAILABLE",
          })
        } catch (releaseErr) {
          logger.warn("Failed to release quota on missing file", { error: releaseErr.message })
        }
      }

      downloadAuditService.logEvent(DownloadEvents.VIDEO_FILE_NOT_AVAILABLE, {
        userId: user.id,
        videoId: video._id,
        downloadId: downloadRecord._id,
        reason: "VIDEO_FILE_NOT_AVAILABLE",
      })

      downloadAuditService.logEvent(DownloadEvents.DOWNLOAD_FAILED, {
        userId: user.id,
        videoId: video._id,
        downloadId: downloadRecord._id,
        reason: "VIDEO_FILE_NOT_AVAILABLE",
      })

      throw ApiError.notFound(
        "VIDEO_FILE_NOT_AVAILABLE",
        "The video file is not currently available on storage servers."
      )
    }

    downloadAuditService.logEvent(DownloadEvents.STORAGE_VALIDATED, {
      userId: user.id,
      videoId: video._id,
      downloadId: downloadRecord._id,
      metadata: {
        fileSize: fileValidation.size,
        mimeType: fileValidation.mimeType,
      },
    })

    // 7. Generate Signed Temporary Download URL (short TTL, e.g. 300s)
    let signedUrlData
    try {
      signedUrlData = storageService.generateSignedUrl({
        downloadId: downloadRecord._id,
        videoId: video._id,
        userId: user.id,
        action: "stream",
      })
    } catch (signErr) {
      logger.error("Failed to generate signed download URL", { error: signErr.message })
      throw ApiError.internal(
        "SIGNED_URL_GENERATION_FAILED",
        "Failed to generate secure signed download URL"
      )
    }

    // 8. Mark the Phase 5 download token as used atomically now that delivery is ready
    await downloadTokenService.validateDownloadToken({
      rawToken: candidateToken,
      markUsed: true,
    })

    // 9. Update Download Record to 'ready'
    downloadRecord.download_status = "ready"
    downloadRecord.file_size = fileValidation.size
    downloadRecord.mime_type = fileValidation.mimeType
    downloadRecord.file_type = fileValidation.mimeType
    downloadRecord.storage_path = fileValidation.filePath
    await downloadRecord.save()

    downloadAuditService.logEvent(DownloadEvents.SIGNED_URL_GENERATED, {
      userId: user.id,
      videoId: video._id,
      downloadId: downloadRecord._id,
      metadata: {
        expiresAt: signedUrlData.expiresAt.toISOString(),
        expiresInSeconds: signedUrlData.expiresInSeconds,
      },
    })

    downloadAuditService.logEvent(DownloadEvents.DOWNLOAD_READY, {
      userId: user.id,
      videoId: video._id,
      downloadId: downloadRecord._id,
    })

    return {
      downloadId: downloadRecord._id,
      videoId: video._id,
      title: video.videotitle || "video",
      fileSize: fileValidation.size,
      mimeType: fileValidation.mimeType,
      signedUrl: signedUrlData.signedUrl,
      signedToken: signedUrlData.signedToken,
      expiresAt: signedUrlData.expiresAt,
      expiresInSeconds: signedUrlData.expiresInSeconds,
      status: "ready",
    }
  }

  /**
   * Handles high-performance, non-buffering protected video streaming
   * supporting HTTP 206 Partial Content (Range requests) and lifecycle tracking.
   */
  async handleFileStream({ signedToken, token, rangeHeader, req, res }) {
    const candidate = signedToken || token || req.query?.token || req.params?.token
    if (!candidate) {
      throw ApiError.unauthorized("TOKEN_REQUIRED", "Signed delivery token is required")
    }

    let downloadId
    let videoId
    let userId

    // Check if token is Phase 5 raw token (starts with dl_) or Phase 6 signed URL token
    if (candidate.startsWith("dl_")) {
      const verified = await downloadTokenService.verifyDownloadToken(candidate)
      downloadId = verified.downloadId
      videoId = verified.videoId
      userId = verified.userId
    } else {
      const verified = storageService.verifySignedUrl(candidate, "stream")
      downloadId = verified.downloadId
      videoId = verified.videoId
      userId = verified.userId
    }

    // Fetch download record
    const downloadRecord = await DownloadRecord.findById(downloadId)
    if (!downloadRecord) {
      throw ApiError.notFound("DOWNLOAD_NOT_FOUND", "Download record not found")
    }

    if (
      downloadRecord.download_status === "blocked" ||
      downloadRecord.download_status === "cancelled" ||
      downloadRecord.download_status === "expired"
    ) {
      throw ApiError.forbidden("DOWNLOAD_NOT_PERMITTED", `This download is ${downloadRecord.download_status}`)
    }

    // Verify client device binding if X-Device-ID header is provided
    const clientDeviceId =
      req?.headers?.["x-device-id"] ||
      req?.headers?.["x-device-identifier"] ||
      req?.query?.deviceId ||
      ""
    if (
      clientDeviceId &&
      downloadRecord.device_id &&
      downloadRecord.device_id !== "device_web_default" &&
      downloadRecord.device_id !== String(clientDeviceId).trim()
    ) {
      downloadAuditService.logEvent(DownloadEvents.DOWNLOAD_DEVICE_MISMATCH, {
        userId: downloadRecord.userId,
        videoId: downloadRecord.videoId,
        downloadId: downloadRecord._id,
        deviceId: String(clientDeviceId).trim(),
        reason: "DOWNLOAD_DEVICE_MISMATCH",
      })
      throw ApiError.forbidden(
        "DOWNLOAD_DEVICE_MISMATCH",
        "Download token was generated for a different device"
      )
    }

    // Fetch video
    const video = await Video.findById(videoId)
    if (!video || video.deleted_at) {
      throw ApiError.notFound("VIDEO_NOT_AVAILABLE", "The video is no longer available")
    }

    // Validate storage file
    const fileValidation = storageService.validateFile(video)
    if (!fileValidation.isAvailable || !fileValidation.exists) {
      downloadRecord.download_status = "failed"
      downloadRecord.failure_reason = "VIDEO_FILE_NOT_AVAILABLE"
      await downloadRecord.save().catch(() => {})

      downloadAuditService.logEvent(DownloadEvents.VIDEO_FILE_NOT_AVAILABLE, {
        userId: downloadRecord.userId,
        videoId: video._id,
        downloadId: downloadRecord._id,
      })

      throw ApiError.notFound("VIDEO_FILE_NOT_AVAILABLE", "Video file not found on storage")
    }

    const filePath = fileValidation.filePath
    const fileSize = fileValidation.size
    const mimeType = fileValidation.mimeType || "video/mp4"
    const rawTitle = video.videotitle || "video"
    const safeTitle = encodeURIComponent(rawTitle.replace(/[^a-zA-Z0-9._-]/g, "_"))

    // Update status to 'downloading' (or 'started')
    downloadRecord.file_size = fileSize
    downloadRecord.download_status = "downloading"
    downloadRecord.download_started_at = new Date()
    downloadRecord.download_completed_at = null
    await downloadRecord.save()

    downloadAuditService.logEvent(DownloadEvents.DOWNLOAD_STARTED, {
      userId: downloadRecord.userId,
      videoId: downloadRecord.videoId,
      plan: downloadRecord.subscription_plan,
      downloadId: downloadRecord._id,
    })

    let readStream
    let isFinished = false

    // HTTP 206 Partial Content handling for range requests
    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, "").split("-")
      const start = parseInt(parts[0], 10)
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1

      if (start >= fileSize || end >= fileSize || start > end) {
        res.setHeader("Content-Range", `bytes */${fileSize}`)
        return res.status(416).send("Requested Range Not Satisfiable")
      }

      const chunkSize = end - start + 1

      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunkSize,
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${safeTitle}.mp4"`,
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      })

      readStream = storageService.createReadStream(filePath, { start, end })
    } else {
      // HTTP 200 standard full content
      res.writeHead(200, {
        "Content-Length": fileSize,
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${safeTitle}.mp4"`,
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      })

      readStream = storageService.createReadStream(filePath)
    }

    // Lifecycle events: completion, interruption, error
    res.on("finish", async () => {
      isFinished = true
      try {
        downloadRecord.download_status = "completed"
        downloadRecord.download_completed_at = new Date()
        await downloadRecord.save()

        if (downloadRecord.quota_id) {
          await quotaService
            .consumeQuota({
              downloadId: downloadRecord._id,
              quotaId: downloadRecord.quota_id,
              userId: downloadRecord.userId,
            })
            .catch(() => {})
        }

        downloadAuditService.logEvent(DownloadEvents.DOWNLOAD_COMPLETED, {
          userId: downloadRecord.userId,
          videoId: downloadRecord.videoId,
          plan: downloadRecord.subscription_plan,
          downloadId: downloadRecord._id,
        })

        // User Notification
        await userNotificationService
          .createNotification({
            userId: downloadRecord.userId,
            type: "DOWNLOAD_COMPLETED",
            title: "Download Complete",
            message: `"${video.videotitle || "Video"}" has finished downloading.`,
            metadata: {
              downloadId: downloadRecord._id,
              videoId: downloadRecord.videoId,
              videoTitle: video.videotitle,
            },
          })
          .catch(() => {})
      } catch (err) {
        logger.error("Error finalizing download completion", { error: err.message })
      }
    })

    res.on("close", async () => {
      if (!isFinished && !res.writableEnded) {
        try {
          downloadRecord.download_status = "interrupted"
          await downloadRecord.save()

          downloadAuditService.logEvent(DownloadEvents.DOWNLOAD_INTERRUPTED, {
            userId: downloadRecord.userId,
            videoId: downloadRecord.videoId,
            plan: downloadRecord.subscription_plan,
            downloadId: downloadRecord._id,
          })
        } catch (err) {
          logger.error("Error handling interrupted download", { error: err.message })
        }
      }
    })

    readStream.on("error", async (streamErr) => {
      logger.error("Download read stream error", { error: streamErr.message })
      try {
        downloadRecord.download_status = "failed"
        downloadRecord.failure_reason = streamErr.message
        await downloadRecord.save()

        downloadAuditService.logEvent(DownloadEvents.DOWNLOAD_FAILED, {
          userId: downloadRecord.userId,
          videoId: downloadRecord.videoId,
          downloadId: downloadRecord._id,
          reason: streamErr.message,
        })

        // User Notification
        await userNotificationService
          .createNotification({
            userId: downloadRecord.userId,
            type: "DOWNLOAD_FAILED",
            title: "Download Failed",
            message: `Download for "${video.videotitle || "Video"}" could not be completed.`,
            metadata: {
              downloadId: downloadRecord._id,
              videoId: downloadRecord.videoId,
              videoTitle: video.videotitle,
            },
          })
          .catch(() => {})
      } catch {}
      if (!res.headersSent) {
        res.status(500).send("Stream error")
      }
    })

    readStream.pipe(res)
  }
}

export const downloadDeliveryService = new DownloadDeliveryService()
export default downloadDeliveryService
