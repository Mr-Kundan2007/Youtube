import mongoose from "mongoose"
import DownloadQuota from "../Modals/DownloadQuota.js"
import DownloadRecord from "../Modals/DownloadRecord.js"
import DownloadAuditLog from "../Modals/DownloadAuditLog.js"
import { downloadConfig } from "../config/index.js"
import { downloadEntitlementService } from "./downloadEntitlementService.js"

export const QuotaErrorCodes = {
  DOWNLOAD_QUOTA_EXCEEDED: "DOWNLOAD_QUOTA_EXCEEDED",
  QUOTA_RESERVATION_FAILED: "QUOTA_RESERVATION_FAILED",
  QUOTA_RESERVATION_EXPIRED: "QUOTA_RESERVATION_EXPIRED",
  QUOTA_ALREADY_CONSUMED: "QUOTA_ALREADY_CONSUMED",
  QUOTA_ALREADY_RELEASED: "QUOTA_ALREADY_RELEASED",
  INVALID_QUOTA_CONFIGURATION: "INVALID_QUOTA_CONFIGURATION",
  QUOTA_PERIOD_INVALID: "QUOTA_PERIOD_INVALID",
  CONCURRENT_QUOTA_UPDATE_FAILED: "CONCURRENT_QUOTA_UPDATE_FAILED",
}

/**
 * Service managing quota calculation, periods, lazy reset, and atomic reservation.
 */
export class DownloadQuotaService {
  /**
   * Computes the deterministic quota period window [start, end) using UTC boundaries.
   * Eliminates boundary race conditions at midnight (23:59:59.999 -> 00:00:00.000).
   */
  getQuotaPeriodWindow(resetPeriod = "daily", referenceDate = new Date(), subscription = null) {
    const ref = new Date(referenceDate)

    if (resetPeriod === "monthly") {
      const y = ref.getUTCFullYear()
      const m = ref.getUTCMonth()
      const start = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0))
      // Next month 1st midnight in UTC handles leap years and variable month lengths
      const end = new Date(Date.UTC(y, m + 1, 1, 0, 0, 0, 0))
      return { start, end }
    }

    if (resetPeriod === "billing_cycle" && subscription?.startDate) {
      const subStart = new Date(subscription.startDate)
      // If subscription has active expiresAt in the future, use billing cycle end
      if (subscription.expiresAt && new Date(subscription.expiresAt) > ref) {
        return { start: subStart, end: new Date(subscription.expiresAt) }
      }
      // Fallback to 30-day billing interval from start
      const cycleEnd = new Date(subStart.getTime() + 30 * 86400000)
      return { start: subStart, end: cycleEnd }
    }

    if (resetPeriod === "unlimited") {
      const y = ref.getUTCFullYear()
      const start = new Date(Date.UTC(y, 0, 1, 0, 0, 0, 0))
      const end = new Date(Date.UTC(y + 1, 0, 1, 0, 0, 0, 0))
      return { start, end }
    }

    // Default: daily period [00:00:00.000 UTC to next day 00:00:00.000 UTC)
    const y = ref.getUTCFullYear()
    const m = ref.getUTCMonth()
    const d = ref.getUTCDate()
    const start = new Date(Date.UTC(y, m, d, 0, 0, 0, 0))
    const end = new Date(Date.UTC(y, m, d + 1, 0, 0, 0, 0))
    return { start, end }
  }

  /**
   * Retrieves or initializes the active quota record for the user and current period.
   * Lazily creates the new period document if one does not exist (Lazy Quota Reset).
   */
  async getActiveQuotaRecord(
    userId,
    planKey = "free",
    customLimit = null,
    quotaTypeOverride = null,
    referenceDate = new Date()
  ) {
    const planConfig = downloadConfig.plans[planKey] || downloadConfig.plans.free
    const effectiveQuotaType = quotaTypeOverride || planConfig.quotaType || "daily"
    const { start, end } = this.getQuotaPeriodWindow(effectiveQuotaType, referenceDate)

    const isUnlimited = effectiveQuotaType === "unlimited"
    const effectiveLimit = isUnlimited
      ? 0
      : customLimit !== null && customLimit !== undefined
      ? customLimit
      : planConfig.quotaLimit

    // Try finding existing quota for the active period
    let quota = await DownloadQuota.findOne({
      userId,
      quota_period_start: start,
      quota_period_end: end,
    })

    if (!quota) {
      try {
        quota = await DownloadQuota.create({
          userId,
          user_id: userId,
          plan: planConfig.planKey,
          subscription_plan: planConfig.planKey,
          quota_type: effectiveQuotaType,
          quota_limit: effectiveLimit,
          quota_used: 0,
          quota_remaining: isUnlimited ? 999999 : effectiveLimit,
          quota_period_start: start,
          quota_period_end: end,
          period_start: start,
          period_end: end,
          last_download_at: null,
        })

        // Log audit event for lazy quota reset/creation
        DownloadAuditLog.create({
          event_type: "QUOTA_RESET",
          user_id: userId,
          metadata: {
            plan: planConfig.planKey,
            quotaType: effectiveQuotaType,
            periodStart: start,
            periodEnd: end,
            limit: effectiveLimit,
          },
        }).catch(() => {})
      } catch (err) {
        quota = await DownloadQuota.findOne({
          userId,
          quota_period_start: start,
          quota_period_end: end,
        })
      }
    } else {
      // Synchronize plan or custom limit changes
      if (
        quota.plan !== planConfig.planKey ||
        quota.quota_limit !== effectiveLimit ||
        quota.quota_type !== effectiveQuotaType
      ) {
        quota.plan = planConfig.planKey
        quota.subscription_plan = planConfig.planKey
        quota.quota_type = effectiveQuotaType
        quota.quota_limit = effectiveLimit
        quota.quota_remaining = isUnlimited
          ? 999999
          : Math.max(0, effectiveLimit - quota.quota_used)
        await quota.save()
      }
    }

    return quota
  }

  /**
   * Retrieves user's complete current quota status.
   */
  async getCurrentQuota(userId, referenceDate = new Date()) {
    const entitlementRes = await downloadEntitlementService.getDownloadEntitlement(userId)
    const entitlement = entitlementRes.data

    if (!entitlement) {
      return {
        plan: "Free",
        quotaType: "daily",
        quotaLimited: true,
        limit: 1,
        used: 0,
        remaining: 1,
        periodStart: null,
        periodEnd: null,
        resetAt: null,
        available: false,
      }
    }

    const quotaRecord = await this.getActiveQuotaRecord(
      userId,
      entitlement.planKey,
      entitlement.downloadLimit,
      entitlement.quotaType,
      referenceDate
    )

    const isUnlimited = entitlement.quotaType === "unlimited"
    const remaining = isUnlimited
      ? null
      : Math.max(0, quotaRecord.quota_limit - quotaRecord.quota_used)
    const available =
      entitlement.canDownload && (isUnlimited || quotaRecord.quota_used < quotaRecord.quota_limit)

    return {
      plan: entitlement.plan,
      quotaType: entitlement.quotaType,
      quotaLimited: !isUnlimited,
      limit: isUnlimited ? null : quotaRecord.quota_limit,
      used: quotaRecord.quota_used,
      remaining,
      periodStart: quotaRecord.quota_period_start,
      periodEnd: quotaRecord.quota_period_end,
      resetAt: quotaRecord.quota_period_end,
      available,
    }
  }

  /**
   * Returns download units remaining for user (or null if unlimited).
   */
  async getRemainingQuota(userId) {
    const status = await this.getCurrentQuota(userId)
    return status.remaining
  }

  /**
   * Checks if user has quota availability for another download.
   */
  async checkQuotaAvailability(userId) {
    const status = await this.getCurrentQuota(userId)
    return {
      available: status.available,
      remaining: status.remaining,
      status,
    }
  }

  /**
   * Checks if user has a completed download for this video within duplicate window.
   */
  async checkDuplicateDownload(userId, videoId, duplicateWindowHours = downloadConfig.duplicateWindowHours) {
    if (!userId || !videoId) return null
    const cutoff = new Date(Date.now() - duplicateWindowHours * 60 * 60 * 1000)

    return await DownloadRecord.findOne({
      userId,
      videoId,
      download_status: "completed",
      createdAt: { $gte: cutoff },
    }).sort({ createdAt: -1 })
  }

  /**
   * Atomically reserves a download quota unit.
   * Protects against race conditions across multiple tabs, devices, or concurrent requests.
   */
  async reserveQuota({
    userId,
    videoId,
    planKey = "free",
    idempotencyKey = null,
    requestId = null,
    customLimit = null,
  }) {
    // 1. Idempotency check: Return existing reservation if same idempotencyKey is used
    if (idempotencyKey) {
      const existingIdempotent = await DownloadRecord.findOne({
        userId,
        idempotency_key: idempotencyKey,
        download_status: { $in: ["authorized", "preparing", "started", "completed"] },
      })

      if (existingIdempotent) {
        const currentQuota = await this.getActiveQuotaRecord(userId, planKey, customLimit)
        return {
          success: true,
          isDuplicate: false,
          isIdempotentReplay: true,
          originalDownloadId: existingIdempotent._id,
          quotaRecord: currentQuota,
          quotaBefore: currentQuota.quota_used,
          quotaAfter: currentQuota.quota_used,
          quotaRemaining: Math.max(0, currentQuota.quota_limit - currentQuota.quota_used),
          resetAt: currentQuota.quota_period_end,
        }
      }
    }

    // 2. Duplicate download grace check: Re-downloads within 24h do not consume quota
    if (videoId) {
      const duplicate = await this.checkDuplicateDownload(
        userId,
        videoId,
        downloadConfig.duplicateWindowHours
      )

      if (duplicate) {
        const currentQuota = await this.getActiveQuotaRecord(userId, planKey, customLimit)
        return {
          success: true,
          isDuplicate: true,
          isIdempotentReplay: false,
          originalDownloadId: duplicate._id,
          quotaRecord: currentQuota,
          quotaBefore: currentQuota.quota_used,
          quotaAfter: currentQuota.quota_used,
          quotaRemaining: Math.max(0, currentQuota.quota_limit - currentQuota.quota_used),
          resetAt: currentQuota.quota_period_end,
        }
      }
    }

    // 3. Resolve user entitlement to determine effective plan, quota type, and limits
    const entitlementRes = await downloadEntitlementService.getDownloadEntitlement(userId)
    const entitlement = entitlementRes?.data
    const effectivePlan = entitlement?.planKey || planKey || "free"
    const effectiveQuotaType = entitlement?.quotaType || "daily"
    const effectiveLimit = entitlement?.downloadLimit !== undefined ? entitlement.downloadLimit : customLimit

    // 4. Resolve active quota period record (lazily created if new day/month)
    const currentQuota = await this.getActiveQuotaRecord(
      userId,
      effectivePlan,
      effectiveLimit,
      effectiveQuotaType
    )
    const isUnlimited = currentQuota.quota_type === "unlimited" || effectiveQuotaType === "unlimited"

    // 4. Handle Unlimited plans
    if (isUnlimited) {
      await DownloadQuota.findByIdAndUpdate(currentQuota._id, {
        $inc: { quota_used: 1 },
        $set: { last_download_at: new Date() },
      })

      return {
        success: true,
        quotaRecord: currentQuota,
        isDuplicate: false,
        isIdempotentReplay: false,
        originalDownloadId: null,
        quotaBefore: currentQuota.quota_used,
        quotaAfter: currentQuota.quota_used + 1,
        quotaRemaining: null,
        resetAt: currentQuota.quota_period_end,
      }
    }

    // 5. Atomic conditional update: strictly increment quota_used only if quota_used < quota_limit
    const updatedQuota = await DownloadQuota.findOneAndUpdate(
      {
        _id: currentQuota._id,
        quota_used: { $lt: currentQuota.quota_limit },
      },
      {
        $inc: { quota_used: 1 },
        $set: { last_download_at: new Date() },
      },
      { new: true }
    )

    if (!updatedQuota) {
      // Quota exhausted or exceeded concurrently!
      DownloadAuditLog.create({
        event_type: "QUOTA_EXCEEDED",
        user_id: userId,
        video_id: videoId || null,
        request_id: requestId || "",
        metadata: {
          limit: currentQuota.quota_limit,
          used: currentQuota.quota_used,
          periodEnd: currentQuota.quota_period_end,
        },
      }).catch(() => {})

      return {
        success: false,
        code: QuotaErrorCodes.DOWNLOAD_QUOTA_EXCEEDED,
        message: "Your download limit for the current period has been reached.",
        quotaRecord: currentQuota,
        isDuplicate: false,
        isIdempotentReplay: false,
        originalDownloadId: null,
        quotaBefore: currentQuota.quota_used,
        quotaAfter: currentQuota.quota_used,
        quotaRemaining: 0,
        resetAt: currentQuota.quota_period_end,
      }
    }

    // Recalculate remaining quota
    updatedQuota.quota_remaining = Math.max(
      0,
      updatedQuota.quota_limit - updatedQuota.quota_used
    )
    await updatedQuota.save()

    // Log atomic reservation audit event
    DownloadAuditLog.create({
      event_type: "QUOTA_RESERVED",
      user_id: userId,
      video_id: videoId || null,
      request_id: requestId || "",
      metadata: {
        limit: updatedQuota.quota_limit,
        usedBefore: updatedQuota.quota_used - 1,
        usedAfter: updatedQuota.quota_used,
        remaining: updatedQuota.quota_remaining,
      },
    }).catch(() => {})

    return {
      success: true,
      quotaRecord: updatedQuota,
      isDuplicate: false,
      isIdempotentReplay: false,
      originalDownloadId: null,
      quotaBefore: updatedQuota.quota_used - 1,
      quotaAfter: updatedQuota.quota_used,
      quotaRemaining: updatedQuota.quota_remaining,
      resetAt: updatedQuota.quota_period_end,
    }
  }

  /**
   * Confirms quota consumption when a download starts or completes.
   */
  async consumeQuota({ downloadId, quotaId, userId }) {
    DownloadAuditLog.create({
      event_type: "QUOTA_CONSUMED",
      download_id: downloadId || null,
      user_id: userId || null,
      metadata: { quotaId },
    }).catch(() => {})
  }

  /**
   * Releases a reserved quota unit (e.g. if authorization fails before file transfer).
   * Atomically decrements quota_used ensuring it never drops below 0.
   */
  async releaseQuota({ quotaId, downloadId = null, userId = null, reason = "AUTHORIZATION_FAILED" }) {
    if (!quotaId) return null

    try {
      // If downloadId is supplied, ensure we don't release twice
      if (downloadId) {
        const download = await DownloadRecord.findById(downloadId)
        if (download && (download.download_status === "cancelled" || download.download_status === "failed")) {
          if (download.quota_released === true) {
            return { success: false, code: QuotaErrorCodes.QUOTA_ALREADY_RELEASED }
          }
          download.quota_released = true
          await download.save()
        }
      }

      // Decrement only if quota_used > 0 (prevents negative counts)
      const updated = await DownloadQuota.findOneAndUpdate(
        { _id: quotaId, quota_used: { $gt: 0 } },
        { $inc: { quota_used: -1 } },
        { new: true }
      )

      if (updated) {
        updated.quota_remaining = Math.max(0, updated.quota_limit - updated.quota_used)
        await updated.save()

        DownloadAuditLog.create({
          event_type: "QUOTA_RELEASED",
          download_id: downloadId,
          user_id: userId,
          metadata: { quotaId, reason, usedAfter: updated.quota_used },
        }).catch(() => {})
      }

      return { success: true, quotaRecord: updated }
    } catch (err) {
      console.warn("Error releasing quota reservation:", err.message)
      return { success: false, message: err.message }
    }
  }

  /**
   * Backward-compatible alias for releaseQuotaReservation.
   */
  async releaseQuotaReservation(quotaId) {
    return await this.releaseQuota({ quotaId })
  }

  /**
   * Scans and releases expired pending reservations older than maxAgeMinutes.
   */
  async cleanupExpiredReservations(maxAgeMinutes = 15) {
    const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000)
    const expiredDownloads = await DownloadRecord.find({
      download_status: { $in: ["authorized", "preparing"] },
      createdAt: { $lt: cutoff },
    })

    let releasedCount = 0
    for (const dl of expiredDownloads) {
      await DownloadRecord.findByIdAndUpdate(dl._id, {
        $set: {
          download_status: "expired",
          failure_reason: "RESERVATION_EXPIRED",
        },
      })

      // Find active quota and release
      const quota = await DownloadQuota.findOne({
        userId: dl.userId,
        quota_period_start: { $lte: dl.createdAt },
        quota_period_end: { $gte: dl.createdAt },
      })

      if (quota) {
        await this.releaseQuota({
          quotaId: quota._id,
          downloadId: dl._id,
          userId: dl.userId,
          reason: "RESERVATION_EXPIRED",
        })
        releasedCount++
      }
    }

    return { cleaned: expiredDownloads.length, releasedCount }
  }

  /**
   * Reconciles recorded completed downloads against recorded quota_used.
   */
  async reconcileQuota(userId) {
    const currentQuota = await this.getActiveQuotaRecord(userId)
    const actualCompletedCount = await DownloadRecord.countDocuments({
      userId,
      download_status: "completed",
      is_duplicate: false,
      createdAt: {
        $gte: currentQuota.quota_period_start,
        $lt: currentQuota.quota_period_end,
      },
    })

    const mismatch = currentQuota.quota_used !== actualCompletedCount

    return {
      userId,
      quotaId: currentQuota._id,
      recordedUsed: currentQuota.quota_used,
      actualCompleted: actualCompletedCount,
      mismatch,
      periodStart: currentQuota.quota_period_start,
      periodEnd: currentQuota.quota_period_end,
    }
  }
}

export const downloadQuotaService = new DownloadQuotaService()
export const quotaService = downloadQuotaService
export default downloadQuotaService
