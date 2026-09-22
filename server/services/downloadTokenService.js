import crypto from "crypto"
import mongoose from "mongoose"
import jwt from "jsonwebtoken"
import DownloadToken from "../Modals/DownloadToken.js"
import User from "../Modals/Auth.js"
import Video from "../Modals/video.js"
import securityEventService from "./securityEventService.js"
import downloadAuditService, { DownloadEvents } from "./downloadAuditService.js"
import { downloadConfig } from "../config/index.js"
import { ApiError } from "../utils/apiError.js"

/**
 * Service for generating, storing (hashed), validating, and revoking cryptographically
 * secure, single-use, short-lived download tokens.
 */
export class DownloadTokenService {
  /**
   * Hashes a raw token using SHA-256 for secure database storage.
   */
  hashToken(rawToken) {
    if (!rawToken || typeof rawToken !== "string") {
      throw new Error("Token string is required for hashing")
    }
    return crypto.createHash("sha256").update(rawToken).digest("hex")
  }

  /**
   * Generates a cryptographically secure, random download token.
   * Returns the raw token to the client, while persisting only the SHA-256 hash in MongoDB.
   */
  async generateDownloadToken({
    downloadId,
    videoId,
    userId,
    deviceId = "",
    ipAddress = "",
    userAgent = "",
    expiresInSeconds = null,
  }) {
    if (!downloadId) throw new Error("downloadId is required to generate download token")
    if (!videoId) throw new Error("videoId is required to generate download token")
    if (!userId) throw new Error("userId is required to generate download token")

    const ttl = Number(expiresInSeconds) || downloadConfig.tokenExpirySeconds || 600
    const rawToken = `dl_${crypto.randomBytes(32).toString("hex")}`
    const tokenHash = this.hashToken(rawToken)
    const expiresAt = new Date(Date.now() + ttl * 1000)

    const tokenDoc = new DownloadToken({
      download_id: downloadId,
      downloadId,
      user_id: userId,
      userId,
      video_id: videoId,
      videoId,
      device_id: deviceId || "",
      deviceId: deviceId || "",
      token_hash: tokenHash,
      status: "active",
      expires_at: expiresAt,
      max_uses: 1,
      use_count: 0,
      ip_address: ipAddress || "",
      user_agent: userAgent || "",
    })

    await tokenDoc.save()

    downloadAuditService.logEvent(DownloadEvents.TOKEN_GENERATED, {
      userId,
      videoId,
      downloadId,
      ip: ipAddress,
      userAgent,
      metadata: {
        tokenId: tokenDoc._id,
        expiresAt: expiresAt.toISOString(),
        expiresInSeconds: ttl,
      },
    })

    return {
      token: rawToken,
      rawToken,
      tokenId: tokenDoc._id,
      expiresAt,
      expiresIn: ttl,
      expiresInSeconds: ttl,
    }
  }

  /**
   * Validates a raw download token:
   * - Hashes token and queries MongoDB
   * - Checks revocation
   * - Checks single-use / replay attempts
   * - Checks expiry
   * - Checks user binding
   * - Checks video binding
   * - Re-verifies user account status and video availability
   * - Atomically marks token as used if markUsed is true
   */
  async validateDownloadToken({
    rawToken,
    token,
    userId = null,
    videoId = null,
    deviceId = null,
    ipAddress = "",
    userAgent = "",
    markUsed = false,
  }) {
    const candidate = rawToken || token
    if (!candidate || typeof candidate !== "string") {
      throw ApiError.badRequest("TOKEN_INVALID", "Download token is required and must be a string")
    }

    // Hash the incoming raw token to find its record
    const tokenHash = this.hashToken(candidate)
    let tokenRecord = await DownloadToken.findOne({ token_hash: tokenHash })

    // If not found by hash, check if it's a legacy signed JWT
    if (!tokenRecord && candidate.split(".").length === 3) {
      try {
        const decoded = jwt.verify(candidate, downloadConfig.tokenSecret, { algorithms: ["HS256"] })
        if (decoded.downloadId) {
          tokenRecord = await DownloadToken.findOne({ download_id: decoded.downloadId })
        }
      } catch (e) {
        // Fallthrough to standard not found error
      }
    }

    if (!tokenRecord) {
      await securityEventService.recordEvent({
        userId,
        deviceId,
        eventType: "INVALID_DOWNLOAD_TOKEN",
        ipAddress,
        userAgent,
        metadata: { attemptedTokenHash: tokenHash },
      }).catch(() => {})
      throw ApiError.notFound("TOKEN_NOT_FOUND", "Download token not found or invalid")
    }

    // 1. Check Revocation
    if (tokenRecord.status === "revoked") {
      downloadAuditService.logEvent(DownloadEvents.TOKEN_REVOKED, {
        userId: tokenRecord.user_id,
        videoId: tokenRecord.video_id,
        downloadId: tokenRecord.download_id,
        ip: ipAddress,
        reason: tokenRecord.revocation_reason || "TOKEN_REVOKED",
      })
      throw ApiError.forbidden("TOKEN_REVOKED", "This download token has been revoked")
    }

    // 2. Check Replay / Already Used
    if (tokenRecord.status === "used" || tokenRecord.use_count >= tokenRecord.max_uses) {
      await securityEventService.recordEvent({
        userId: tokenRecord.user_id,
        deviceId: tokenRecord.device_id || deviceId,
        downloadId: tokenRecord.download_id,
        eventType: "TOKEN_REPLAY_ATTEMPT",
        ipAddress,
        userAgent,
        metadata: {
          tokenId: tokenRecord._id,
          usedAt: tokenRecord.used_at,
          useCount: tokenRecord.use_count,
        },
      }).catch(() => {})

      downloadAuditService.logEvent(DownloadEvents.TOKEN_REPLAY_ATTEMPT, {
        userId: tokenRecord.user_id,
        videoId: tokenRecord.video_id,
        downloadId: tokenRecord.download_id,
        ip: ipAddress,
        metadata: {
          tokenId: tokenRecord._id,
          usedAt: tokenRecord.used_at,
          useCount: tokenRecord.use_count,
        },
      })
      throw ApiError.conflict("TOKEN_ALREADY_USED", "This download token has already been used")
    }

    // 3. Check Expiry
    const now = new Date()
    if (tokenRecord.status === "expired" || now > new Date(tokenRecord.expires_at)) {
      if (tokenRecord.status !== "expired") {
        tokenRecord.status = "expired"
        await tokenRecord.save().catch(() => {})
      }
      downloadAuditService.logEvent(DownloadEvents.TOKEN_EXPIRED, {
        userId: tokenRecord.user_id,
        videoId: tokenRecord.video_id,
        downloadId: tokenRecord.download_id,
        ip: ipAddress,
      })
      throw ApiError.unauthorized("TOKEN_EXPIRED", "This download token has expired")
    }

    // 4. Validate User Binding
    if (userId && String(tokenRecord.user_id) !== String(userId)) {
      await securityEventService.recordEvent({
        userId,
        deviceId: deviceId || tokenRecord.device_id,
        downloadId: tokenRecord.download_id,
        eventType: "TOKEN_USER_MISMATCH",
        ipAddress,
        userAgent,
        metadata: { expectedUserId: tokenRecord.user_id, actualUserId: userId },
      }).catch(() => {})

      throw ApiError.forbidden(
        "TOKEN_USER_MISMATCH",
        "Download token does not belong to the authenticated user"
      )
    }

    // 5. Validate Video Binding
    if (videoId && String(tokenRecord.video_id) !== String(videoId)) {
      throw ApiError.forbidden(
        "TOKEN_VIDEO_MISMATCH",
        "Download token is not valid for the requested video"
      )
    }

    // 5.5. Validate Device Binding (prevent cross-device token replay)
    if (deviceId && (tokenRecord.device_id || tokenRecord.deviceId)) {
      const boundDeviceId = tokenRecord.device_id || tokenRecord.deviceId
      if (boundDeviceId !== String(deviceId).trim()) {
        await securityEventService.recordEvent({
          userId: tokenRecord.user_id,
          deviceId: String(deviceId).trim(),
          downloadId: tokenRecord.download_id,
          eventType: "TOKEN_DEVICE_MISMATCH",
          ipAddress,
          userAgent,
          metadata: {
            expectedDeviceId: boundDeviceId,
            actualDeviceId: String(deviceId).trim(),
          },
        }).catch(() => {})

        downloadAuditService.logEvent(DownloadEvents.DOWNLOAD_DEVICE_MISMATCH, {
          userId: tokenRecord.user_id,
          videoId: tokenRecord.video_id,
          downloadId: tokenRecord.download_id,
          deviceId: String(deviceId).trim(),
          ip: ipAddress,
          reason: "DOWNLOAD_DEVICE_MISMATCH",
          metadata: {
            expectedDeviceId: boundDeviceId,
            actualDeviceId: String(deviceId).trim(),
          },
        })
        throw ApiError.forbidden(
          "DOWNLOAD_DEVICE_MISMATCH",
          "Download token was generated for a different device"
        )
      }
    }

    // 6. Re-check Critical Account Access Invariants
    const userDoc = await User.findById(tokenRecord.user_id)
    if (!userDoc || userDoc.status === "blocked" || userDoc.status === "suspended") {
      throw ApiError.forbidden(
        "ACCOUNT_DOWNLOAD_RESTRICTED",
        "User account is blocked or suspended. Download denied."
      )
    }

    // 7. Re-check Critical Video Access Invariants
    const videoDoc = await Video.findById(tokenRecord.video_id)
    if (!videoDoc || videoDoc.deleted_at) {
      throw ApiError.notFound(
        "VIDEO_NOT_AVAILABLE",
        "The requested video is no longer available for download."
      )
    }

    if (videoDoc.is_downloadable === false) {
      throw ApiError.forbidden(
        "VIDEO_NOT_DOWNLOADABLE",
        "This video has been marked not downloadable by its creator."
      )
    }

    // 8. Consume Token (Single-Use atomic lock) if requested
    if (markUsed) {
      const updated = await DownloadToken.findOneAndUpdate(
        {
          _id: tokenRecord._id,
          status: "active",
          use_count: { $lt: tokenRecord.max_uses },
        },
        {
          $set: {
            status: "used",
            used_at: now,
          },
          $inc: { use_count: 1 },
        },
        { new: true }
      )

      if (!updated) {
        throw ApiError.conflict(
          "TOKEN_ALREADY_USED",
          "This download token has already been used by a concurrent request"
        )
      }

      tokenRecord = updated

      downloadAuditService.logEvent(DownloadEvents.TOKEN_USED, {
        userId: tokenRecord.user_id,
        videoId: tokenRecord.video_id,
        downloadId: tokenRecord.download_id,
        ip: ipAddress,
      })
    }

    downloadAuditService.logEvent(DownloadEvents.TOKEN_VALIDATED, {
      userId: tokenRecord.user_id,
      videoId: tokenRecord.video_id,
      downloadId: tokenRecord.download_id,
      ip: ipAddress,
    })

    return {
      valid: true,
      tokenRecord,
      downloadId: tokenRecord.download_id,
      videoId: tokenRecord.video_id,
      userId: tokenRecord.user_id,
      expiresAt: tokenRecord.expires_at,
      status: tokenRecord.status,
      video: videoDoc,
      user: userDoc,
    }
  }

  /**
   * Revokes an active download token.
   */
  async revokeDownloadToken(tokenIdOrRaw, reason = "REVOKED_BY_SYSTEM") {
    if (!tokenIdOrRaw) {
      throw ApiError.badRequest("TOKEN_REQUIRED", "Token identifier or raw token is required for revocation")
    }

    let query
    if (mongoose.Types.ObjectId.isValid(tokenIdOrRaw)) {
      query = { _id: tokenIdOrRaw }
    } else {
      const hash = tokenIdOrRaw.startsWith("dl_")
        ? this.hashToken(tokenIdOrRaw)
        : tokenIdOrRaw
      query = { token_hash: hash }
    }

    const tokenRecord = await DownloadToken.findOneAndUpdate(
      query,
      {
        $set: {
          status: "revoked",
          revoked_at: new Date(),
          revocation_reason: reason,
        },
      },
      { new: true }
    )

    if (!tokenRecord) {
      throw ApiError.notFound("TOKEN_NOT_FOUND", "Download token not found for revocation")
    }

    downloadAuditService.logEvent(DownloadEvents.TOKEN_REVOKED, {
      userId: tokenRecord.user_id,
      videoId: tokenRecord.video_id,
      downloadId: tokenRecord.download_id,
      reason,
      metadata: { tokenId: tokenRecord._id },
    })

    return tokenRecord
  }

  /**
   * Backwards compatibility helper for streaming endpoints.
   */
  async verifyDownloadToken(token) {
    if (!token) {
      throw ApiError.unauthorized("TOKEN_REQUIRED", "Download token is required")
    }

    // If it's a new dl_ token, validate it through the database
    if (token.startsWith("dl_")) {
      try {
        const validated = await this.validateDownloadToken({ rawToken: token, markUsed: false })
        return {
          downloadId: validated.downloadId,
          videoId: validated.videoId,
          userId: validated.userId,
          type: "video_download",
        }
      } catch (err) {
        if (err.code === "TOKEN_EXPIRED") {
          throw ApiError.unauthorized("DOWNLOAD_TOKEN_EXPIRED", "The download link has expired. Please try again.")
        }
        throw err
      }
    }

    // Legacy fallback for JWT tokens
    try {
      const decoded = jwt.verify(token, downloadConfig.tokenSecret, { algorithms: ["HS256"] })
      if (decoded.type !== "video_download") {
        throw ApiError.unauthorized("INVALID_TOKEN_TYPE", "Token is not a valid download token")
      }
      return decoded
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        throw ApiError.unauthorized("DOWNLOAD_TOKEN_EXPIRED", "The download link has expired. Please try again.")
      }
      throw ApiError.unauthorized("INVALID_DOWNLOAD_TOKEN", "The download link is invalid or has been modified.")
    }
  }
}

export const downloadTokenService = new DownloadTokenService()
export default downloadTokenService
