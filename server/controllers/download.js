import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import mongoose from "mongoose"
import Video from "../Modals/video.js"
import DownloadRecord from "../Modals/DownloadRecord.js"
import downloadAuthorizationService from "../services/downloadAuthorizationService.js"
import downloadTokenService from "../services/downloadTokenService.js"
import downloadDeliveryService from "../services/downloadDeliveryService.js"
import downloadRetryService from "../services/downloadRetryService.js"
import downloadHistoryService from "../services/downloadHistoryService.js"
import storageService from "../services/storageService.js"
import subscriptionService from "../services/subscriptionService.js"
import quotaService, { downloadQuotaService } from "../services/quotaService.js"
import downloadAuditService, { DownloadEvents } from "../services/downloadAuditService.js"
import { sendSuccess, sendError } from "../utils/apiResponse.js"
import { ApiError } from "../utils/apiError.js"
import { logger } from "../utils/logger.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Safely resolves the absolute filepath for a video.
 * Handles both uploaded files and sample/default video files.
 */
const resolveVideoFilePath = (video) => {
  const possiblePaths = []

  // 1. Direct filepath in video document
  if (video.filepath) {
    possiblePaths.push(path.resolve(process.cwd(), video.filepath))
    possiblePaths.push(path.resolve(__dirname, "..", video.filepath))
    possiblePaths.push(path.resolve(__dirname, "../uploads", path.basename(video.filepath)))
  }

  // 2. videofilepath / videoUrl
  const urlPath = video.videofilepath || video.videoUrl || ""
  if (urlPath) {
    const clean = urlPath.startsWith("/") ? urlPath.slice(1) : urlPath
    possiblePaths.push(path.resolve(process.cwd(), clean))
    possiblePaths.push(path.resolve(process.cwd(), "public", clean))
    possiblePaths.push(path.resolve(__dirname, "..", clean))
    possiblePaths.push(path.resolve(__dirname, "../uploads", path.basename(clean)))
  }

  // 3. filename
  if (video.filename) {
    possiblePaths.push(path.resolve(__dirname, "../uploads", video.filename))
    possiblePaths.push(path.resolve(process.cwd(), "uploads", video.filename))
  }

  // 4. Default mock/sample fallback
  possiblePaths.push(path.resolve(__dirname, "../../public/video/vdo.mp4"))
  possiblePaths.push(path.resolve(process.cwd(), "public/video/vdo.mp4"))

  for (const candidate of possiblePaths) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate
    }
  }

  return null
}

/**
 * Authorize video download endpoint.
 * POST /api/videos/:videoId/download/authorize
 */
export const authorizeVideoDownload = async (req, res) => {
  try {
    const videoId = req.params.videoId || req.body.videoId
    const clientIp =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      "127.0.0.1"
    const userAgent = req.headers["user-agent"] || ""
    const deviceId = req.headers["x-device-id"] || req.body.deviceId || "web"
    const requestId = req.headers["x-request-id"] || req.body.requestId || ""
    const idempotencyKey =
      req.headers["idempotency-key"] ||
      req.headers["x-idempotency-key"] ||
      req.body.idempotencyKey ||
      req.body.idempotency_key ||
      ""

    const result = await downloadAuthorizationService.authorizeDownload({
      user: req.user,
      videoId,
      clientIp,
      userAgent,
      deviceId,
      requestId,
      idempotencyKey,
    })

    return res.status(200).json({
      success: true,
      message: result.message,
      data: result.data || {
        downloadId: result.downloadId,
        authorizationToken: result.authorizationToken,
        expiresAt: result.expiresAt,
        status: result.status,
        remainingQuota: result.remainingQuota,
      },
      ...result,
    })
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Validate download token endpoint.
 * POST /api/downloads/validate-token
 */
export const validateDownloadTokenHandler = async (req, res) => {
  try {
    const { token, rawToken, videoId, markUsed } = req.body
    const candidate = token || rawToken
    const clientIp =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      "127.0.0.1"
    const userAgent = req.headers["user-agent"] || ""

    const validated = await downloadTokenService.validateDownloadToken({
      rawToken: candidate,
      userId: req.user?.id || null,
      videoId: videoId || req.body.videoId || null,
      ipAddress: clientIp,
      userAgent,
      markUsed: markUsed === true,
    })

    return res.status(200).json({
      success: true,
      message: "Token is valid",
      data: {
        valid: true,
        downloadId: validated.downloadId,
        videoId: validated.videoId,
        userId: validated.userId,
        expiresAt: validated.expiresAt,
        status: validated.status,
      },
    })
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Revoke download token endpoint.
 * POST /api/downloads/tokens/revoke
 */
export const revokeDownloadTokenHandler = async (req, res) => {
  try {
    const { token, tokenId, reason } = req.body
    const target = tokenId || token
    const revoked = await downloadTokenService.revokeDownloadToken(target, reason || "REVOKED_BY_ADMIN")

    return res.status(200).json({
      success: true,
      message: "Download token revoked successfully",
      data: {
        tokenId: revoked._id,
        status: revoked.status,
        revokedAt: revoked.revoked_at,
        reason: revoked.revocation_reason,
      },
    })
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Request download delivery and obtain temporary signed streaming URL.
 * POST /api/downloads/deliver
 */
export const requestDownloadDeliveryHandler = async (req, res) => {
  try {
    const { downloadId, token, rawToken } = req.body
    const candidateToken = token || rawToken || req.headers["x-download-token"]
    const clientIp =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      "127.0.0.1"
    const userAgent = req.headers["user-agent"] || ""
    const deviceId =
      req.headers["x-device-id"] ||
      req.headers["x-device-identifier"] ||
      req.body.deviceId ||
      ""

    const deliveryResult = await downloadDeliveryService.requestDelivery({
      downloadId: downloadId || req.params.downloadId,
      token: candidateToken,
      user: req.user,
      deviceId,
      clientIp,
      userAgent,
    })

    return res.status(200).json({
      success: true,
      message: "Download delivery ready",
      data: deliveryResult,
    })
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Stream protected video using signed URL token or raw token.
 * GET /api/downloads/stream
 */
export const streamProtectedVideoHandler = async (req, res) => {
  try {
    const token = req.query.token || req.params.token || req.headers["x-download-token"]
    const rangeHeader = req.headers.range
    return await downloadDeliveryService.handleFileStream({
      signedToken: token,
      rangeHeader,
      req,
      res,
    })
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Stream authorized video file using token.
 * GET /api/download/:token
 */
export const streamVideoDownload = async (req, res) => {
  try {
    const token = req.params.token || req.query.token || req.headers["x-download-token"]
    const rangeHeader = req.headers.range
    return await downloadDeliveryService.handleFileStream({
      signedToken: token,
      rangeHeader,
      req,
      res,
    })
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Get download history for authenticated user.
 * GET /api/downloads
 */
export const getUserDownloads = async (req, res) => {
  try {
    const userId = req.user.id
    const { page, limit, status, plan, search, from, to, sortBy, sortOrder } = req.query

    const history = await downloadHistoryService.getUserDownloads({
      userId,
      page,
      limit,
      status,
      plan,
      search,
      from,
      to,
      sortBy,
      sortOrder,
    })

    return sendSuccess(res, history)
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Get quota status for authenticated user.
 * GET /api/downloads/quota
 */
export const getUserQuotaStatus = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id
    const currentQuota = await downloadQuotaService.getCurrentQuota(userId)

    return sendSuccess(res, {
      ...currentQuota,
      planKey: (currentQuota.plan || "free").toLowerCase(),
      quotaLimit: currentQuota.limit,
      quotaUsed: currentQuota.used,
      quotaRemaining: currentQuota.remaining,
      quotaType: currentQuota.quotaType,
    })
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Get single download record details.
 * GET /api/downloads/:downloadId
 */
export const getDownloadById = async (req, res) => {
  try {
    const { downloadId } = req.params
    const userId = req.user.id
    const userRole = req.user.role

    const download = await downloadHistoryService.getDownloadDetails({
      downloadId,
      userId,
      userRole,
    })

    return sendSuccess(res, { download })
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Get download status for polling.
 * GET /api/downloads/:downloadId/status
 */
export const getDownloadStatusHandler = async (req, res) => {
  try {
    const { downloadId } = req.params
    const userId = req.user.id
    const userRole = req.user.role

    const statusData = await downloadHistoryService.getDownloadStatus({
      downloadId,
      userId,
      userRole,
    })

    return sendSuccess(res, statusData)
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Retry download for interrupted or failed download record.
 * POST /api/downloads/:downloadId/retry
 */
export const retryDownload = async (req, res) => {
  try {
    const { downloadId } = req.params
    const clientIp =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      "127.0.0.1"
    const userAgent = req.headers["user-agent"] || ""
    const deviceId = req.headers["x-device-id"] || req.body?.deviceId || "web"

    const retryResult = await downloadRetryService.retryDownload({
      downloadId,
      user: req.user,
      clientIp,
      userAgent,
      deviceId,
    })

    return res.status(200).json({
      success: true,
      message: "Download retry authorized",
      data: retryResult,
      ...retryResult,
    })
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Admin: List all downloads across users.
 * GET /api/admin/downloads
 */
export const getAdminDownloads = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20))
    const { userId, videoId, plan, status, startDate, endDate, search } = req.query

    const query = {}
    if (userId && mongoose.Types.ObjectId.isValid(userId)) query.userId = userId
    if (videoId && mongoose.Types.ObjectId.isValid(videoId)) query.videoId = videoId
    if (plan && plan !== "all") query.subscription_plan = plan
    if (status && status !== "all") query.download_status = status

    if (startDate || endDate) {
      query.createdAt = {}
      if (startDate) query.createdAt.$gte = new Date(startDate)
      if (endDate) query.createdAt.$lte = new Date(endDate)
    }

    if (search) {
      const regex = new RegExp(search.trim(), "i")
      query.$or = [{ videoTitle: regex }, { ip_address: regex }, { device_id: regex }]
    }

    const [downloads, total] = await Promise.all([
      DownloadRecord.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("userId", "name email channelname image"),
      DownloadRecord.countDocuments(query),
    ])

    return sendSuccess(res, {
      downloads,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Admin: Aggregated download metrics.
 * GET /api/admin/downloads/statistics
 */
export const getAdminDownloadStats = async (req, res) => {
  try {
    const stats = await downloadAuditService.getDownloadStatistics()
    return sendSuccess(res, stats)
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Admin: Get downloads for specific user.
 * GET /api/admin/users/:userId/downloads
 */
export const getAdminUserDownloads = async (req, res) => {
  try {
    const { userId } = req.params
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10))

    const [downloads, total] = await Promise.all([
      DownloadRecord.find({ userId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      DownloadRecord.countDocuments({ userId }),
    ])

    return sendSuccess(res, {
      downloads,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Get available subscription plans.
 * GET /api/subscription/plans
 */
export const getSubscriptionPlans = async (req, res) => {
  try {
    const plans = subscriptionService.getAvailablePlans()
    return sendSuccess(res, { plans })
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Get current user subscription.
 * GET /api/subscription/current
 */
export const getUserSubscription = async (req, res) => {
  try {
    const userId = req.user.id
    const sub = await subscriptionService.getUserSubscription(userId)
    const validation = subscriptionService.validateSubscriptionState(sub)
    const planDetails = subscriptionService.getPlanDetails(sub.plan)

    return sendSuccess(res, {
      subscription: sub,
      planDetails,
      validation,
    })
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Upgrade or change user subscription plan.
 * POST /api/subscription/upgrade
 */
export const upgradeSubscription = async (req, res) => {
  try {
    const userId = req.user.id
    const { plan, durationDays = 30 } = req.body

    const sub = await subscriptionService.upgradeSubscription(userId, plan, durationDays)
    const quota = await quotaService.getActiveQuotaRecord(userId, plan)

    return sendSuccess(res, {
      message: `Subscription successfully updated to ${plan}`,
      subscription: sub,
      quota,
    })
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Get user download entitlement.
 * GET /api/subscription/entitlement
 */
export const getUserEntitlement = async (req, res) => {
  try {
    const userId = req.user.id
    const entitlement = await subscriptionService.getUserDownloadEntitlement(userId)
    return sendSuccess(res, { entitlement })
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Cancel user subscription.
 * POST /api/subscription/cancel
 */
export const cancelUserSubscription = async (req, res) => {
  try {
    const userId = req.user.id
    const sub = await subscriptionService.cancelSubscription(userId)
    return sendSuccess(res, {
      message: "Subscription successfully cancelled",
      subscription: sub,
    })
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Renew user subscription.
 * POST /api/subscription/renew
 */
export const renewUserSubscription = async (req, res) => {
  try {
    const userId = req.user.id
    const { durationDays = 30 } = req.body
    const sub = await subscriptionService.renewSubscription(userId, durationDays)
    return sendSuccess(res, {
      message: "Subscription successfully renewed",
      subscription: sub,
    })
  } catch (err) {
    return sendError(res, err)
  }
}
