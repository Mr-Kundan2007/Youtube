import DownloadRecord from "../Modals/DownloadRecord.js"
import DownloadRestriction from "../Modals/DownloadRestriction.js"
import DownloadSecurityEvent from "../Modals/DownloadSecurityEvent.js"
import DownloadDevice from "../Modals/DownloadDevice.js"
import Subscription from "../Modals/Subscription.js"

/**
 * Service providing high-level dashboard summaries and operational health metrics with TTL caching.
 */
export class AdminDashboardService {
  constructor(cacheTtlMs = 30 * 1000) {
    this.cacheTtlMs = cacheTtlMs
    this.cachedSummary = null
    this.cacheTimestamp = 0
  }

  /**
   * Invalidates internal summary cache.
   */
  invalidateCache() {
    this.cachedSummary = null
    this.cacheTimestamp = 0
  }

  /**
   * Returns comprehensive dashboard summary metrics across downloads, users, subscriptions, and security.
   */
  async getDashboardSummary({ forceRefresh = false } = {}) {
    const now = Date.now()
    if (!forceRefresh && this.cachedSummary && now - this.cacheTimestamp < this.cacheTtlMs) {
      return this.cachedSummary
    }

    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)

    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const [
      totalDownloads,
      todayDownloads,
      monthDownloads,
      successfulDownloads,
      failedDownloads,
      blockedDownloads,
      inProgressDownloads,
      uniqueUsersList,
      todayUsersList,
      restrictedUsersCount,
      blockedDevicesCount,
      openSecurityEvents,
      highRiskEvents,
      criticalRiskEvents,
      planAggregates,
      bandwidthAgg,
    ] = await Promise.all([
      DownloadRecord.countDocuments(),
      DownloadRecord.countDocuments({ createdAt: { $gte: startOfToday } }),
      DownloadRecord.countDocuments({ createdAt: { $gte: startOfMonth } }),
      DownloadRecord.countDocuments({ download_status: "completed" }),
      DownloadRecord.countDocuments({ download_status: { $in: ["failed", "interrupted", "expired"] } }),
      DownloadRecord.countDocuments({ download_status: "blocked" }),
      DownloadRecord.countDocuments({ download_status: { $in: ["authorized", "preparing", "started", "downloading"] } }),
      DownloadRecord.distinct("userId"),
      DownloadRecord.distinct("userId", { createdAt: { $gte: startOfToday } }),
      DownloadRestriction.countDocuments({ status: "active", userId: { $ne: null } }),
      DownloadDevice.countDocuments({ status: "blocked" }),
      DownloadSecurityEvent.countDocuments({ status: { $in: ["open", "investigating"] } }),
      DownloadSecurityEvent.countDocuments({ status: { $in: ["open", "investigating"] }, riskLevel: "high" }),
      DownloadSecurityEvent.countDocuments({ status: { $in: ["open", "investigating"] }, riskLevel: "critical" }),
      DownloadRecord.aggregate([
        {
          $group: {
            _id: "$subscription_plan",
            count: { $sum: 1 },
          },
        },
      ]),
      DownloadRecord.aggregate([
        { $match: { download_status: "completed" } },
        { $group: { _id: null, totalBytes: { $sum: "$file_size" } } },
      ]),
    ])

    const plans = { free: 0, bronze: 0, silver: 0, gold: 0 }
    for (const p of planAggregates) {
      if (p._id && plans[p._id] !== undefined) {
        plans[p._id] = p.count
      }
    }

    const totalBandwidthBytes = bandwidthAgg[0]?.totalBytes || 0
    const totalAttempted = successfulDownloads + failedDownloads + blockedDownloads
    const successRate = totalAttempted > 0 ? Number(((successfulDownloads / totalAttempted) * 100).toFixed(1)) : 100
    const failureRate = totalAttempted > 0 ? Number((((failedDownloads + blockedDownloads) / totalAttempted) * 100).toFixed(1)) : 0

    const summary = {
      // Top-level aliases for backward compatibility with earlier tests & components
      totalDownloads,
      downloadsToday: todayDownloads,
      downloadsThisMonth: monthDownloads,
      successfulDownloads,
      failedDownloads,
      quotaLimitBlocks: blockedDownloads,
      subscriptionExpiryBlocks: 0,
      downloadsByPlan: plans,
      activeDownloads: inProgressDownloads,
      bandwidthToday: totalBandwidthBytes,

      // Structured Phase 10 schema
      downloads: {
        total: totalDownloads,
        today: todayDownloads,
        thisMonth: monthDownloads,
        successful: successfulDownloads,
        failed: failedDownloads,
        blocked: blockedDownloads,
        inProgress: inProgressDownloads,
        successRate,
        failureRate,
      },
      users: {
        totalDownloadUsers: uniqueUsersList.length,
        activeToday: todayUsersList.length,
        restrictedUsers: restrictedUsersCount,
      },
      subscriptions: {
        distribution: plans,
      },
      security: {
        openEvents: openSecurityEvents,
        highRiskEvents,
        criticalRiskEvents,
        blockedDevices: blockedDevicesCount,
      },
      system: {
        totalBandwidthBytes,
        storageUsedBytes: totalBandwidthBytes,
        cacheTimestamp: new Date().toISOString(),
      },
    }

    this.cachedSummary = summary
    this.cacheTimestamp = now
    return summary
  }
}

export const adminDashboardService = new AdminDashboardService()
export default adminDashboardService
