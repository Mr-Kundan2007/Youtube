import mongoose from "mongoose"
import DownloadRecord from "../Modals/DownloadRecord.js"
import DownloadDevice from "../Modals/DownloadDevice.js"
import DownloadQuota from "../Modals/DownloadQuota.js"
import Subscription from "../Modals/Subscription.js"
import Video from "../Modals/video.js"
import { downloadConfig } from "../config/index.js"

/**
 * Service calculating deep operational, video, subscription, and failure analytics.
 */
export class AdminAnalyticsService {
  /**
   * Helper to parse date range strings into start and end Dates.
   */
  resolveDateRange(range = "30d", customStart = null, customEnd = null) {
    const end = customEnd ? new Date(customEnd) : new Date()
    let start

    if (customStart) {
      start = new Date(customStart)
    } else if (range === "today" || range === "24h") {
      start = new Date(Date.now() - 24 * 60 * 60 * 1000)
    } else if (range === "yesterday") {
      const d = new Date()
      d.setDate(d.getDate() - 1)
      d.setHours(0, 0, 0, 0)
      start = d
    } else if (range === "7d") {
      start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    } else if (range === "current_month") {
      start = new Date()
      start.setDate(1)
      start.setHours(0, 0, 0, 0)
    } else {
      // Default 30d
      start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    }

    return { start, end }
  }

  /**
   * Returns top downloaded videos ordered by volume with unique user metrics and failure rates.
   */
  async getTopVideos({ limit = 10, range = "30d", startDate = null, endDate = null } = {}) {
    const { start, end } = this.resolveDateRange(range, startDate, endDate)
    const lim = Math.max(1, Math.min(100, Number(limit) || 10))

    const pipeline = [
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: "$videoId",
          totalRequests: { $sum: 1 },
          completedDownloads: {
            $sum: { $cond: [{ $eq: ["$download_status", "completed"] }, 1, 0] },
          },
          failedDownloads: {
            $sum: {
              $cond: [
                { $in: ["$download_status", ["failed", "interrupted", "expired", "blocked"]] },
                1,
                0,
              ],
            },
          },
          uniqueUsers: { $addToSet: "$userId" },
          totalBytes: { $sum: "$file_size" },
          videoTitle: { $first: "$videoTitle" },
          thumbnailUrl: { $first: "$thumbnailUrl" },
        },
      },
      { $sort: { totalRequests: -1 } },
      { $limit: lim },
    ]

    const results = await DownloadRecord.aggregate(pipeline)

    return results.map((v, index) => {
      const uniqueCount = (v.uniqueUsers || []).length
      const failureRate =
        v.totalRequests > 0
          ? Number(((v.failedDownloads / v.totalRequests) * 100).toFixed(1))
          : 0

      return {
        rank: index + 1,
        videoId: v._id,
        title: v.videoTitle || "Untitled Video",
        thumbnailUrl: v.thumbnailUrl || "",
        totalRequests: v.totalRequests,
        completedDownloads: v.completedDownloads,
        failedDownloads: v.failedDownloads,
        uniqueUsersCount: uniqueCount,
        totalBytes: v.totalBytes || 0,
        failureRate,
      }
    })
  }

  /**
   * Returns detailed performance breakdown for a specific video.
   */
  async getVideoPerformance(videoId, { range = "30d" } = {}) {
    if (!videoId || !mongoose.Types.ObjectId.isValid(videoId)) {
      throw new Error("Invalid video ID")
    }

    const { start, end } = this.resolveDateRange(range)
    const vId = new mongoose.Types.ObjectId(videoId)

    const [videoDoc, stats] = await Promise.all([
      Video.findById(vId).lean(),
      DownloadRecord.aggregate([
        {
          $match: {
            videoId: vId,
            createdAt: { $gte: start, $lte: end },
          },
        },
        {
          $group: {
            _id: null,
            totalRequests: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $eq: ["$download_status", "completed"] }, 1, 0] },
            },
            failed: {
              $sum: {
                $cond: [
                  { $in: ["$download_status", ["failed", "interrupted", "expired"]] },
                  1,
                  0,
                ],
              },
            },
            blocked: {
              $sum: { $cond: [{ $eq: ["$download_status", "blocked"] }, 1, 0] },
            },
            uniqueUsers: { $addToSet: "$userId" },
            totalBytes: { $sum: "$file_size" },
          },
        },
      ]),
    ])

    const stat = stats[0] || {
      totalRequests: 0,
      completed: 0,
      failed: 0,
      blocked: 0,
      uniqueUsers: [],
      totalBytes: 0,
    }

    const totalAttempts = stat.totalRequests
    const successRate =
      totalAttempts > 0
        ? Number(((stat.completed / totalAttempts) * 100).toFixed(1))
        : 100

    return {
      videoId,
      title: videoDoc?.videotitle || "Unknown",
      duration: videoDoc?.videolength || 0,
      filesize: videoDoc?.filesize || 0,
      totalRequests: stat.totalRequests,
      completedDownloads: stat.completed,
      failedDownloads: stat.failed,
      blockedDownloads: stat.blocked,
      uniqueUsersCount: (stat.uniqueUsers || []).length,
      totalBandwidthBytes: stat.totalBytes,
      successRate,
      failureRate: Number((100 - successRate).toFixed(1)),
    }
  }

  /**
   * Returns daily download volume and completion trends.
   */
  async getDownloadTrends({ range = "30d", startDate = null, endDate = null } = {}) {
    const { start, end } = this.resolveDateRange(range, startDate, endDate)

    const trends = await DownloadRecord.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          total: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ["$download_status", "completed"] }, 1, 0] },
          },
          failed: {
            $sum: {
              $cond: [
                { $in: ["$download_status", ["failed", "interrupted", "expired", "blocked"]] },
                1,
                0,
              ],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ])

    return trends.map((t) => ({
      date: t._id,
      total: t.total,
      completed: t.completed,
      failed: t.failed,
      successRate:
        t.total > 0 ? Number(((t.completed / t.total) * 100).toFixed(1)) : 100,
    }))
  }

  /**
   * Returns 24-hour distribution histogram to detect peak download hours.
   */
  async getHourlyTrends({ range = "7d" } = {}) {
    const { start, end } = this.resolveDateRange(range)

    const hourly = await DownloadRecord.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: { $hour: "$createdAt" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ])

    const histogram = Array.from({ length: 24 }).map((_, hour) => ({
      hour,
      hourLabel: `${String(hour).padStart(2, "0")}:00`,
      count: 0,
    }))

    for (const h of hourly) {
      if (h._id >= 0 && h._id < 24) {
        histogram[h._id].count = h.count
      }
    }

    let peakHour = 0
    let maxCount = 0
    for (const item of histogram) {
      if (item.count > maxCount) {
        maxCount = item.count
        peakHour = item.hour
      }
    }

    return {
      histogram,
      peakHour: `${String(peakHour).padStart(2, "0")}:00`,
      peakVolume: maxCount,
    }
  }

  /**
   * Returns failure distribution categorized by error cause.
   */
  async getFailureAnalytics({ range = "30d" } = {}) {
    const { start, end } = this.resolveDateRange(range)

    const failures = await DownloadRecord.aggregate([
      {
        $match: {
          download_status: { $in: ["failed", "interrupted", "expired", "blocked"] },
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: {
            $ifNull: ["$failure_reason", "$download_status"],
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ])

    const totalFailures = failures.reduce((acc, f) => acc + f.count, 0)

    return {
      totalFailures,
      breakdown: failures.map((f) => ({
        reason: f._id || "UNKNOWN_ERROR",
        count: f.count,
        percentage:
          totalFailures > 0 ? Number(((f.count / totalFailures) * 100).toFixed(1)) : 0,
      })),
    }
  }

  /**
   * Returns subscription plan metrics, usage, and quota exhaustion analysis.
   */
  async getSubscriptionAnalytics() {
    const plans = ["free", "bronze", "silver", "gold"]

    const [userPlanCounts, downloadPlanCounts, quotas] = await Promise.all([
      Subscription.aggregate([
        { $match: { status: "active" } },
        { $group: { _id: "$plan", userCount: { $sum: 1 } } },
      ]),
      DownloadRecord.aggregate([
        { $group: { _id: "$subscription_plan", downloadCount: { $sum: 1 } } },
      ]),
      DownloadQuota.find({ status: "active" }).lean(),
    ])

    const userCountMap = {}
    for (const u of userPlanCounts) userCountMap[u._id] = u.userCount
    const downloadCountMap = {}
    for (const d of downloadPlanCounts) downloadCountMap[d._id] = d.downloadCount

    // Calculate quota exhaustion
    const exhaustionMap = {
      free: { total: 0, exhausted: 0, nearLimit: 0 },
      bronze: { total: 0, exhausted: 0, nearLimit: 0 },
      silver: { total: 0, exhausted: 0, nearLimit: 0 },
      gold: { total: 0, exhausted: 0, nearLimit: 0 },
    }

    for (const q of quotas) {
      const p = q.subscription_plan || "free"
      if (!exhaustionMap[p]) continue
      exhaustionMap[p].total++
      if (q.quota_remaining <= 0) {
        exhaustionMap[p].exhausted++
      } else if (q.quota_limit && q.quota_remaining <= Math.ceil(q.quota_limit * 0.2)) {
        exhaustionMap[p].nearLimit++
      }
    }

    const planSummaries = plans.map((planKey) => {
      const users = userCountMap[planKey] || (planKey === "free" ? 1 : 0)
      const downloads = downloadCountMap[planKey] || 0
      const avgDownloads = users > 0 ? Number((downloads / users).toFixed(1)) : 0
      const ex = exhaustionMap[planKey]
      const exhaustionRate =
        ex.total > 0 ? Number(((ex.exhausted / ex.total) * 100).toFixed(1)) : 0

      return {
        plan: planKey,
        configuredLimit: downloadConfig.plans[planKey]?.quotaLimit ?? "unlimited",
        quotaType: downloadConfig.plans[planKey]?.quotaType || "daily",
        totalSubscribers: users,
        totalDownloads: downloads,
        avgDownloadsPerUser: avgDownloads,
        activeQuotasMonitored: ex.total,
        exhaustedQuotasCount: ex.exhausted,
        nearLimitCount: ex.nearLimit,
        exhaustionRatePercentage: exhaustionRate,
      }
    })

    return { plans: planSummaries }
  }

  /**
   * Returns device analytics and distribution metrics.
   */
  async getDeviceAnalytics() {
    const [statusCounts, typeCounts] = await Promise.all([
      DownloadDevice.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      DownloadDevice.aggregate([
        { $group: { _id: "$device_type", count: { $sum: 1 } } },
      ]),
    ])

    const statuses = { active: 0, revoked: 0, blocked: 0, inactive: 0 }
    for (const s of statusCounts) {
      if (s._id && statuses[s._id] !== undefined) statuses[s._id] = s.count
    }

    const types = { desktop: 0, mobile: 0, tablet: 0, other: 0 }
    for (const t of typeCounts) {
      const k = t._id ? String(t._id).toLowerCase() : "other"
      if (types[k] !== undefined) types[k] = t.count
      else types.other += t.count
    }

    const totalDevices = Object.values(statuses).reduce((a, b) => a + b, 0)

    return {
      totalDevices,
      statuses,
      deviceTypes: types,
    }
  }
}

export const adminAnalyticsService = new AdminAnalyticsService()
export default adminAnalyticsService
