import mongoose from "mongoose"
import DownloadRecord from "../Modals/DownloadRecord.js"
import DownloadQuota from "../Modals/DownloadQuota.js"
import DownloadDevice from "../Modals/DownloadDevice.js"
import DownloadRestriction from "../Modals/DownloadRestriction.js"
import QuotaAdjustment from "../Modals/QuotaAdjustment.js"
import User from "../Modals/Auth.js"
import Subscription from "../Modals/Subscription.js"
import downloadQuotaService from "./downloadQuotaService.js"
import downloadEntitlementService from "./downloadEntitlementService.js"
import riskAssessmentService from "./riskAssessmentService.js"
import downloadAuditService, { DownloadEvents } from "./downloadAuditService.js"
import { ApiError } from "../utils/apiError.js"

/**
 * Service managing user-specific download activity, profiles, and manual quota adjustments.
 */
export class AdminUserDownloadService {
  /**
   * Retrieves complete user download profile and statistics.
   */
  async getUserDownloadProfile(userId, { page = 1, limit = 10 } = {}) {
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      throw ApiError.badRequest("INVALID_USER_ID", "Valid user ID is required")
    }

    const uId = new mongoose.Types.ObjectId(userId)
    const userDoc = await User.findById(uId).select("name email role status joinedon").lean()
    if (!userDoc) {
      throw ApiError.notFound("USER_NOT_FOUND", "User not found")
    }

    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)

    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const p = Math.max(1, Number(page) || 1)
    const lim = Math.max(1, Math.min(50, Number(limit) || 10))
    const skip = (p - 1) * lim

    const [
      totalDownloads,
      todayDownloads,
      monthDownloads,
      successfulDownloads,
      failedDownloads,
      blockedDownloads,
      entitlement,
      activeQuota,
      devices,
      restrictions,
      risk,
      downloads,
    ] = await Promise.all([
      DownloadRecord.countDocuments({ $or: [{ userId: uId }, { user_id: uId }] }),
      DownloadRecord.countDocuments({
        $or: [{ userId: uId }, { user_id: uId }],
        createdAt: { $gte: startOfToday },
      }),
      DownloadRecord.countDocuments({
        $or: [{ userId: uId }, { user_id: uId }],
        createdAt: { $gte: startOfMonth },
      }),
      DownloadRecord.countDocuments({
        $or: [{ userId: uId }, { user_id: uId }],
        download_status: "completed",
      }),
      DownloadRecord.countDocuments({
        $or: [{ userId: uId }, { user_id: uId }],
        download_status: { $in: ["failed", "interrupted", "expired"] },
      }),
      DownloadRecord.countDocuments({
        $or: [{ userId: uId }, { user_id: uId }],
        download_status: "blocked",
      }),
      downloadEntitlementService.getDownloadEntitlement(userId),
      DownloadQuota.findOne({
        $or: [{ userId: uId }, { user_id: uId }],
        status: "active",
      }).lean(),
      DownloadDevice.find({
        $or: [{ userId: uId }, { user_id: uId }],
      })
        .select("device_identifier device_name device_type status last_seen_at")
        .lean(),
      DownloadRestriction.find({
        $or: [{ userId: uId }, { user_id: uId }],
        status: "active",
      }).lean(),
      riskAssessmentService.calculateRiskScore({ userId }),
      DownloadRecord.find({ $or: [{ userId: uId }, { user_id: uId }] })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(lim)
        .select("-download_token_id -token_hash")
        .lean(),
    ])

    return {
      user: {
        id: userDoc._id,
        name: userDoc.name,
        email: userDoc.email,
        role: userDoc.role,
        status: userDoc.status,
        joinedon: userDoc.joinedon,
      },
      subscription: {
        plan: entitlement?.data?.planKey || "free",
        status: entitlement?.data?.subscriptionStatus || "active",
        expiresAt: entitlement?.data?.expiresAt || null,
      },
      stats: {
        totalDownloads,
        todayDownloads,
        monthDownloads,
        successfulDownloads,
        completedDownloads: successfulDownloads,
        failedDownloads,
        blockedDownloads,
      },
      quota: activeQuota
        ? {
            quotaUsed: activeQuota.quota_used,
            quotaRemaining: activeQuota.quota_remaining,
            quotaLimit: activeQuota.quota_limit,
            quotaType: activeQuota.quota_type,
            periodStart: activeQuota.period_start,
            periodEnd: activeQuota.period_end,
          }
        : {
            quotaUsed: 0,
            quotaRemaining: entitlement?.data?.downloadLimit || 1,
            quotaLimit: entitlement?.data?.downloadLimit || 1,
            quotaType: entitlement?.data?.quotaType || "daily",
          },
      devices: {
        count: devices.length,
        items: devices,
      },
      restrictions: {
        isRestricted: restrictions.length > 0,
        count: restrictions.length,
        items: restrictions,
      },
      security: {
        riskScore: risk.riskScore,
        riskLevel: risk.riskLevel,
        activeFlags: risk.activeFlags,
      },
      recentDownloads: {
        items: downloads,
        pagination: {
          page: p,
          limit: lim,
          total: totalDownloads,
          totalPages: Math.ceil(totalDownloads / lim) || 1,
        },
      },
    }
  }

  /**
   * Applies a manual administrative quota adjustment for a user.
   */
  async adjustUserQuota({
    userId,
    adminId = null,
    adminEmail = "",
    adjustmentType = "ADD_CREDIT",
    value,
    reason,
  } = {}) {
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      throw ApiError.badRequest("INVALID_USER_ID", "Valid user ID is required")
    }

    const numValue = Number(value)
    if (isNaN(numValue) || numValue <= 0) {
      throw ApiError.badRequest("INVALID_VALUE", "Value must be a positive number")
    }

    if (!reason || !reason.trim()) {
      throw ApiError.badRequest("REASON_REQUIRED", "Adjustment reason is required")
    }

    const entitlement = await downloadEntitlementService.getDownloadEntitlement(userId)
    const effectivePlan = entitlement?.data?.planKey || "free"

    // Get or create active quota record
    const quota = await downloadQuotaService.getActiveQuotaRecord(userId, effectivePlan)
    const quotaBefore = quota.quota_remaining

    let quotaAfter = quotaBefore

    if (adjustmentType === "ADD_CREDIT") {
      quota.quota_remaining = (quota.quota_remaining || 0) + numValue
      // If quota_used is > 0, we can also offset quota_used
      quota.quota_used = Math.max(0, (quota.quota_used || 0) - numValue)
      quotaAfter = quota.quota_remaining
    } else if (adjustmentType === "REMOVE_CREDIT") {
      quota.quota_remaining = Math.max(0, (quota.quota_remaining || 0) - numValue)
      quota.quota_used = (quota.quota_used || 0) + numValue
      quotaAfter = quota.quota_remaining
    } else if (adjustmentType === "TEMPORARY_LIMIT") {
      quota.quota_limit = numValue
      quota.quota_remaining = Math.max(0, numValue - (quota.quota_used || 0))
      quotaAfter = quota.quota_remaining
    }

    await quota.save()

    const adjustment = await QuotaAdjustment.create({
      userId,
      user_id: userId,
      adminId,
      admin_id: adminId,
      adminEmail,
      adjustmentType,
      value: numValue,
      reason: reason.trim(),
      quotaBefore,
      quotaAfter,
      status: "active",
    })

    downloadAuditService.logEvent(DownloadEvents.ADMIN_QUOTA_ADJUSTED, {
      userId,
      quotaBefore,
      quotaAfter,
      reason: reason.trim(),
      metadata: {
        adjustmentId: adjustment._id,
        adjustmentType,
        value: numValue,
        adminId,
        adminEmail,
      },
    })

    return {
      success: true,
      adjustmentId: adjustment._id,
      adjustmentType,
      value: numValue,
      quotaBefore,
      quotaAfter,
      reason: reason.trim(),
    }
  }

  /**
   * Retrieves adjustment history for a specific user.
   */
  async getUserQuotaAdjustments(userId) {
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      throw ApiError.badRequest("INVALID_USER_ID", "Valid user ID is required")
    }

    return await QuotaAdjustment.find({
      $or: [{ userId }, { user_id: userId }],
    })
      .sort({ createdAt: -1 })
      .lean()
  }
}

export const adminUserDownloadService = new AdminUserDownloadService()
export default adminUserDownloadService
