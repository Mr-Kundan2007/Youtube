import mongoose from "mongoose"
import DownloadRecord from "../Modals/DownloadRecord.js"
import DownloadToken from "../Modals/DownloadToken.js"
import deviceService from "./deviceService.js"
import downloadAuditService, { DownloadEvents } from "./downloadAuditService.js"
import { downloadConfig } from "../config/index.js"
import { ApiError } from "../utils/apiError.js"

/**
 * Service managing device-level authorization, plan device limits,
 * multi-device concurrent download limits, and device-token binding.
 */
export class DeviceAuthorizationService {
  /**
   * Cleans up stale active downloads that never completed or were abandoned.
   */
  async sweepStaleActiveDownloads(userId, maxAgeMinutes = 15) {
    if (!userId) return
    const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000)
    await DownloadRecord.updateMany(
      {
        $or: [{ userId }, { user_id: userId }],
        download_status: { $in: ["downloading", "started", "ready", "preparing"] },
        updatedAt: { $lt: cutoff },
      },
      {
        $set: {
          download_status: "expired",
          failure_reason: "DOWNLOAD_ABANDONED_EXPIRED",
        },
      }
    ).catch(() => {})
  }

  /**
   * Authorizes a device for download, checking registration status, plan device allowances,
   * account-level concurrent download limits, and per-device concurrent download limits.
   */
  async authorizeDeviceForDownload({
    user,
    userId: explicitUserId,
    deviceId,
    metadata = {},
    planConfig = {},
  }) {
    const activeUserId = user?.id || explicitUserId
    if (!activeUserId) {
      throw ApiError.unauthorized("UNAUTHORIZED", "Authentication required for device authorization.")
    }
    const userId = String(activeUserId)
    const effectiveDeviceId = String(deviceId || "device_web_default").trim()

    // 1. Device Registration & Allowance Validation
    const devResult = await deviceService.findOrCreateDevice({
      userId,
      deviceId: effectiveDeviceId,
      metadata,
      planConfig,
    })

    if (devResult.isBlocked) {
      throw ApiError.forbidden("DEVICE_BLOCKED", "This device has been blocked from downloading.")
    }

    if (devResult.isRevoked) {
      throw ApiError.forbidden(
        "DEVICE_REVOKED",
        "This device has been revoked. Please re-register or use an active authorized device."
      )
    }

    if (devResult.limitReached) {
      throw new ApiError(
        403,
        "DEVICE_LIMIT_REACHED",
        "You have reached the maximum number of registered devices allowed for your plan.",
        {
          maxAllowed: devResult.maxAllowed,
          activeCount: devResult.activeCount,
          plan: planConfig.planKey || "free",
        }
      )
    }

    // 2. Multi-Device Concurrent Download Validation
    await this.sweepStaleActiveDownloads(userId)

    const activeDownloads = await DownloadRecord.find({
      $or: [{ userId }, { user_id: userId }],
      download_status: { $in: ["downloading", "started", "ready", "preparing"] },
    })

    // A. Account-level concurrent downloads limit
    const maxConcurrent = planConfig.maxConcurrentDeviceDownloads || 1
    if (activeDownloads.length >= maxConcurrent) {
      downloadAuditService.logEvent(DownloadEvents.CONCURRENT_DOWNLOAD_LIMIT_REACHED, {
        userId,
        deviceId: effectiveDeviceId,
        ip: metadata.clientIp,
        reason: "CONCURRENT_DOWNLOAD_LIMIT_REACHED",
        metadata: {
          activeCount: activeDownloads.length,
          maxConcurrent,
        },
      })

      throw new ApiError(
        429,
        "CONCURRENT_DOWNLOAD_LIMIT_REACHED",
        "Maximum concurrent downloads reached across your devices. Please wait for an active download to complete.",
        {
          activeDownloads: activeDownloads.length,
          maxConcurrent,
        }
      )
    }

    // B. Same-device concurrent download limit
    const perDeviceLimit =
      planConfig.maxConcurrentDownloadsPerDevice ||
      downloadConfig.maxConcurrentDownloadsPerDevice ||
      1

    const activeOnThisDevice = activeDownloads.filter(
      (d) => String(d.device_id) === effectiveDeviceId
    )

    if (activeOnThisDevice.length >= perDeviceLimit) {
      downloadAuditService.logEvent(DownloadEvents.DEVICE_CONCURRENT_DOWNLOAD_LIMIT_REACHED, {
        userId,
        deviceId: effectiveDeviceId,
        ip: metadata.clientIp,
        reason: "DEVICE_CONCURRENT_DOWNLOAD_LIMIT_REACHED",
        metadata: {
          activeOnDevice: activeOnThisDevice.length,
          perDeviceLimit,
        },
      })

      throw new ApiError(
        429,
        "DEVICE_CONCURRENT_DOWNLOAD_LIMIT_REACHED",
        "A download is already in progress on this device. Please wait for it to complete.",
        {
          activeOnDevice: activeOnThisDevice.length,
          perDeviceLimit,
        }
      )
    }

    // 3. Audit Device Authorized
    downloadAuditService.logEvent(DownloadEvents.DEVICE_AUTHORIZED, {
      userId,
      deviceId: effectiveDeviceId,
      ip: metadata.clientIp,
      deviceType: devResult.device?.device_type || "desktop",
      browser: devResult.device?.browser || "unknown",
      operatingSystem: devResult.device?.operating_system || "unknown",
    })

    return {
      authorized: true,
      device: devResult.device,
      deviceId: effectiveDeviceId,
    }
  }

  /**
   * Validates that an issued download token is being used on the authorized device.
   * Prevents cross-device token sharing and token replay attacks.
   */
  validateTokenDeviceBinding({ tokenDoc, deviceId, clientIp = "" }) {
    if (!tokenDoc) return true

    const tokenDeviceId = tokenDoc.device_id || tokenDoc.deviceId
    if (!tokenDeviceId) {
      // Backward compatibility for tokens issued before device binding
      return true
    }

    const candidateDeviceId = String(deviceId || "").trim()

    if (candidateDeviceId && tokenDeviceId !== candidateDeviceId) {
      downloadAuditService.logEvent(DownloadEvents.DOWNLOAD_DEVICE_MISMATCH, {
        userId: tokenDoc.user_id || tokenDoc.userId,
        videoId: tokenDoc.video_id || tokenDoc.videoId,
        downloadId: tokenDoc.download_id || tokenDoc.downloadId,
        deviceId: candidateDeviceId,
        ip: clientIp,
        reason: "DOWNLOAD_DEVICE_MISMATCH",
        metadata: {
          expectedDeviceId: tokenDeviceId,
          actualDeviceId: candidateDeviceId,
        },
      })

      throw ApiError.forbidden(
        "DOWNLOAD_DEVICE_MISMATCH",
        "Download token was generated for a different device. Access denied."
      )
    }

    downloadAuditService.logEvent(DownloadEvents.DOWNLOAD_DEVICE_VALIDATED, {
      userId: tokenDoc.user_id || tokenDoc.userId,
      downloadId: tokenDoc.download_id || tokenDoc.downloadId,
      deviceId: tokenDeviceId,
      ip: clientIp,
    })

    return true
  }
}

export const deviceAuthorizationService = new DeviceAuthorizationService()
export default deviceAuthorizationService
