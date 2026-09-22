import mongoose from "mongoose"
import Subscription from "../Modals/Subscription.js"
import SubscriptionUsage from "../Modals/SubscriptionUsage.js"
import StreamSession from "../Modals/StreamSession.js"
import subscriptionModuleService from "../modules/subscription/subscription.service.js"
import {
  PLAN_HIERARCHY,
  PLAN_MAX_QUALITY,
  PLAN_MAX_CONCURRENT_STREAMS,
  PLAN_DAILY_WATCH_TIME_MINUTES,
  canAccessPlanContent,
  isQualityAllowed,
} from "../config/subscriptionConfig.js"

export class SubscriptionAccessControlService {
  /**
   * Helper returning today's date in YYYY-MM-DD format (UTC).
   */
  getTodayDateString(ref = new Date()) {
    const d = new Date(ref)
    return d.toISOString().split("T")[0]
  }

  /**
   * Resolves the user's active effective subscription plan.
   * If user has no subscription, or it is expired or inactive, falls back gracefully to "free".
   *
   * @param {string|mongoose.Types.ObjectId} userId
   * @returns {Promise<{ plan: string, isActive: boolean, isExpired: boolean, sub: object|null }>}
   */
  async getUserEffectivePlan(userId) {
    if (!userId) {
      return { plan: "free", isActive: true, isExpired: false, sub: null }
    }

    const details = await subscriptionModuleService.getCurrentSubscriptionDetails(userId)
    if (!details.isActive || details.isExpired) {
      return {
        plan: "free",
        isActive: false,
        isExpired: details.isExpired,
        sub: details,
      }
    }

    return {
      plan: details.currentPlan.slug,
      isActive: true,
      isExpired: false,
      sub: details,
    }
  }

  /**
   * Evaluates if a user can access a video based on required plan, premium flags, and watch time limits.
   *
   * @param {string|null} userId
   * @param {object} videoDoc
   * @returns {Promise<{ allowed: boolean, code?: string, message?: string, requiredPlan?: string, currentPlan?: string }>}
   */
  async canWatchVideo(userId, videoDoc) {
    if (!videoDoc) {
      return { allowed: false, code: "VIDEO_NOT_FOUND", message: "Video not found" }
    }

    const requiredPlan = (videoDoc.requiredPlan || videoDoc.accessLevel || "free").toLowerCase()
    const isPremium = Boolean(videoDoc.isPremium || videoDoc.is_premium)

    // Completely free and non-premium content is accessible to all
    if (requiredPlan === "free" && !isPremium) {
      return { allowed: true }
    }

    // Premium/Restricted content requires authentication
    if (!userId) {
      return {
        allowed: false,
        code: "AUTHENTICATION_REQUIRED",
        message: "You must be signed in to view this content.",
        requiredPlan: requiredPlan === "free" ? "bronze" : requiredPlan,
        currentPlan: "none",
        upgradeAvailable: true,
      }
    }

    const { plan: userPlan, isExpired } = await this.getUserEffectivePlan(userId)

    if (isExpired) {
      return {
        allowed: false,
        code: "SUBSCRIPTION_EXPIRED",
        message: "Your subscription has expired. Please renew to continue watching premium videos.",
        requiredPlan: requiredPlan === "free" ? "bronze" : requiredPlan,
        currentPlan: "free",
        upgradeAvailable: true,
      }
    }

    const effectiveRequired = requiredPlan === "free" && isPremium ? "bronze" : requiredPlan
    const hasRank = canAccessPlanContent(userPlan, effectiveRequired)

    if (!hasRank) {
      return {
        allowed: false,
        code: "SUBSCRIPTION_REQUIRED",
        message: `Your current plan (${userPlan.toUpperCase()}) does not provide access to this content. Requires ${effectiveRequired.toUpperCase()} or higher.`,
        requiredPlan: effectiveRequired,
        currentPlan: userPlan,
        upgradeAvailable: true,
      }
    }

    // Check watch time limit
    const watchCheck = await this.checkWatchTimeAvailable(userId)
    if (!watchCheck.available) {
      return {
        allowed: false,
        code: "USAGE_LIMIT_REACHED",
        message: "You have reached your daily watch time limit. Upgrade your plan for unlimited watching.",
        limit: watchCheck.limitMinutes,
        used: watchCheck.usedMinutes,
        upgradeAvailable: true,
      }
    }

    return { allowed: true, userPlan }
  }

  /**
   * Evaluates if a user can access a course.
   *
   * @param {string|null} userId
   * @param {object} courseDoc
   * @returns {Promise<{ allowed: boolean, code?: string, message?: string, requiredPlan?: string, currentPlan?: string }>}
   */
  async canAccessCourse(userId, courseDoc) {
    if (!courseDoc) {
      return { allowed: false, code: "COURSE_NOT_FOUND", message: "Course not found" }
    }

    const requiredPlan = (courseDoc.requiredPlan || courseDoc.courseAccessType || "free").toLowerCase()
    const isPremium = Boolean(courseDoc.isPremium)

    if (requiredPlan === "free" && !isPremium) {
      return { allowed: true }
    }

    if (!userId) {
      return {
        allowed: false,
        code: "AUTHENTICATION_REQUIRED",
        message: "Sign in required to access this course.",
        requiredPlan: requiredPlan === "free" ? "silver" : requiredPlan,
        currentPlan: "none",
        upgradeAvailable: true,
      }
    }

    const { plan: userPlan, isExpired } = await this.getUserEffectivePlan(userId)

    if (isExpired) {
      return {
        allowed: false,
        code: "SUBSCRIPTION_EXPIRED",
        message: "Your subscription has expired. Please renew to access premium courses.",
        requiredPlan: requiredPlan === "free" ? "silver" : requiredPlan,
        currentPlan: "free",
        upgradeAvailable: true,
      }
    }

    const effectiveRequired = requiredPlan === "free" && isPremium ? "silver" : requiredPlan
    const hasRank = canAccessPlanContent(userPlan, effectiveRequired)

    if (!hasRank) {
      return {
        allowed: false,
        code: "SUBSCRIPTION_REQUIRED",
        message: `Your current plan (${userPlan.toUpperCase()}) does not provide access to this course. Requires ${effectiveRequired.toUpperCase()} plan.`,
        requiredPlan: effectiveRequired,
        currentPlan: userPlan,
        upgradeAvailable: true,
      }
    }

    return { allowed: true, userPlan }
  }

  /**
   * Validates requested streaming quality against user plan cap.
   *
   * @param {string|null} userId
   * @param {string} requestedQuality - e.g. "1080p"
   * @returns {Promise<{ allowed: boolean, maxAllowed: string, userPlan: string }>}
   */
  async checkStreamingQuality(userId, requestedQuality = "480p") {
    const { plan: userPlan } = await this.getUserEffectivePlan(userId)
    const result = isQualityAllowed(userPlan, requestedQuality)
    return {
      allowed: result.allowed,
      maxAllowed: result.maxAllowed,
      userPlan,
    }
  }

  /**
   * Checks if user has an ad-free experience.
   *
   * @param {string|null} userId
   * @returns {Promise<boolean>}
   */
  async isAdFree(userId) {
    if (!userId) return false
    const { plan: userPlan } = await this.getUserEffectivePlan(userId)
    return userPlan === "silver" || userPlan === "gold"
  }

  /**
   * Retrieves today's usage document for a user.
   *
   * @param {string|mongoose.Types.ObjectId} userId
   * @returns {Promise<object>}
   */
  async getTodayUsage(userId) {
    const today = this.getTodayDateString()
    try {
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        let usage = await SubscriptionUsage.findOne({ userId, date: today })
        if (!usage) {
          usage = await SubscriptionUsage.findOneAndUpdate(
            { userId, date: today },
            { $setOnInsert: { watchTimeSeconds: 0, downloadCount: 0, streamCount: 0 } },
            { upsert: true, new: true }
          )
        }
        if (usage) return usage
      }
    } catch (err) {
      console.warn("[SubscriptionUsage] Database unavailable, using default usage:", err.message)
    }
    return {
      userId,
      date: today,
      watchTimeSeconds: 0,
      downloadCount: 0,
      streamCount: 0,
    }
  }

  /**
   * Increments today's watched seconds for a user.
   *
   * @param {string|mongoose.Types.ObjectId} userId
   * @param {number} seconds
   * @returns {Promise<object>}
   */
  async recordWatchTime(userId, seconds = 0) {
    if (!userId || seconds <= 0) return null
    const today = this.getTodayDateString()
    try {
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        return await SubscriptionUsage.findOneAndUpdate(
          { userId, date: today },
          { $inc: { watchTimeSeconds: seconds }, $set: { lastActiveAt: new Date() } },
          { upsert: true, new: true }
        )
      }
    } catch (err) {
      console.warn("[SubscriptionUsage] Failed to record watch time:", err.message)
    }
    return null
  }

  /**
   * Evaluates if user has remaining watch time today.
   *
   * @param {string|mongoose.Types.ObjectId} userId
   * @param {number} [additionalSeconds=0]
   * @returns {Promise<{ available: boolean, limitMinutes: number|null, usedMinutes: number, remainingMinutes: number|null }>}
   */
  async checkWatchTimeAvailable(userId, additionalSeconds = 0) {
    if (!userId) {
      return { available: true, limitMinutes: 120, usedMinutes: 0, remainingMinutes: 120 }
    }

    const { plan: userPlan } = await this.getUserEffectivePlan(userId)
    const limitMinutes = PLAN_DAILY_WATCH_TIME_MINUTES[userPlan]

    // null means unlimited
    if (limitMinutes === null) {
      return { available: true, limitMinutes: null, usedMinutes: 0, remainingMinutes: null }
    }

    const usage = await this.getTodayUsage(userId)
    const usedMinutes = Math.round((usage.watchTimeSeconds + additionalSeconds) / 60)
    const remainingMinutes = Math.max(0, limitMinutes - usedMinutes)

    return {
      available: usedMinutes < limitMinutes,
      limitMinutes,
      usedMinutes,
      remainingMinutes,
    }
  }

  /**
   * Starts or refreshes a stream session while enforcing concurrent streaming limits.
   *
   * @param {string|mongoose.Types.ObjectId} userId
   * @param {object} params
   * @returns {Promise<{ allowed: boolean, session?: object, activeStreams: number, maxAllowed: number }>}
   */
  async startStreamSession(userId, { deviceId, videoId = null }) {
    const { plan: userPlan } = await this.getUserEffectivePlan(userId)
    const maxAllowed = PLAN_MAX_CONCURRENT_STREAMS[userPlan] || 1

    const now = new Date()
    // Stale timeout: 60 seconds without heartbeat
    const activeThreshold = new Date(now.getTime() - 60 * 1000)

    // Mark timed-out sessions
    await StreamSession.updateMany(
      { userId, status: "active", lastActiveAt: { $lt: activeThreshold } },
      { $set: { status: "timed_out" } }
    )

    // Count currently active sessions (excluding current device)
    const otherActiveSessions = await StreamSession.countDocuments({
      userId,
      deviceId: { $ne: deviceId },
      status: "active",
      lastActiveAt: { $gte: activeThreshold },
    })

    if (otherActiveSessions >= maxAllowed) {
      return {
        allowed: false,
        activeStreams: otherActiveSessions,
        maxAllowed,
      }
    }

    // Upsert or refresh this device's active session
    const session = await StreamSession.findOneAndUpdate(
      { userId, deviceId },
      {
        $set: {
          videoId,
          startedAt: now,
          lastActiveAt: now,
          status: "active",
        },
      },
      { upsert: true, new: true }
    )

    return {
      allowed: true,
      session,
      activeStreams: otherActiveSessions + 1,
      maxAllowed,
    }
  }

  /**
   * Updates lastActiveAt for an ongoing stream session.
   *
   * @param {string|mongoose.Types.ObjectId} userId
   * @param {string|mongoose.Types.ObjectId} sessionId
   * @returns {Promise<boolean>}
   */
  async heartbeatStreamSession(userId, sessionId) {
    const updated = await StreamSession.findOneAndUpdate(
      { _id: sessionId, userId, status: "active" },
      { $set: { lastActiveAt: new Date() } }
    )
    return Boolean(updated)
  }

  /**
   * Concludes a stream session.
   *
   * @param {string|mongoose.Types.ObjectId} userId
   * @param {string|mongoose.Types.ObjectId} sessionId
   * @returns {Promise<boolean>}
   */
  async endStreamSession(userId, sessionId) {
    const updated = await StreamSession.findOneAndUpdate(
      { _id: sessionId, userId },
      { $set: { status: "ended", lastActiveAt: new Date() } }
    )
    return Boolean(updated)
  }
}

export const subscriptionAccessControlService = new SubscriptionAccessControlService()
export default subscriptionAccessControlService
