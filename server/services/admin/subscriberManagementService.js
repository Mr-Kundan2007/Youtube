import User from "../../Modals/Auth.js"
import Subscription from "../../Modals/Subscription.js"
import SubscriptionPlan from "../../Modals/SubscriptionPlan.js"
import SubscriptionHistory from "../../Modals/SubscriptionHistory.js"
import PaymentTransaction from "../../Modals/PaymentTransaction.js"
import Invoice from "../../Modals/Invoice.js"
import AdminSubscriptionAuditLog from "../../Modals/AdminSubscriptionAuditLog.js"
import { ApiError } from "../../utils/apiError.js"
import { sanitizeTransactionForClient } from "../billing/billingUtils.js"
import subscriptionAnalyticsService from "./subscriptionAnalyticsService.js"

export class SubscriberManagementService {
  async listSubscribers(opts) {
    return this.getSubscribersList(opts)
  }

  async getSubscriberProfile(userId) {
    return this.getSubscriberDetails(userId)
  }

  async extendValidity(opts) {
    return this.extendSubscriptionValidity(opts)
  }

  /**
   * Searches and filters subscribers with pagination.
   */
  async getSubscribersList({
    page = 1,
    limit = 10,
    search = "",
    plan = "all",
    status = "all",
    expiringDays = null,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = {}) {
    const p = Math.max(1, Number(page) || 1)
    const lim = Math.max(1, Math.min(50, Number(limit) || 10))
    const skip = (p - 1) * lim

    const subQuery = {}

    if (search && String(search).trim().length > 0) {
      const term = String(search).trim()
      const matchingUsers = await User.find({
        $or: [
          { name: { $regex: term, $options: "i" } },
          { email: { $regex: term, $options: "i" } },
          { channelname: { $regex: term, $options: "i" } },
        ],
      })
        .select("_id")
        .lean()
      const userIds = matchingUsers.map((u) => u._id)
      subQuery.$or = [{ userId: { $in: userIds } }, { user: { $in: userIds } }]
    }

    if (plan && plan !== "all") {
      subQuery.plan = plan.toLowerCase()
    }

    if (status && status !== "all") {
      if (status === "cancel_scheduled") {
        subQuery.$or = [{ status: "cancel_scheduled" }, { cancelScheduled: true }]
      } else {
        subQuery.status = status.toLowerCase()
      }
    }

    if (expiringDays) {
      const days = Number(expiringDays)
      const now = new Date()
      const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
      subQuery.expiresAt = { $gte: now, $lte: future }
      subQuery.status = { $in: ["active", "cancel_scheduled", "expiring_soon"] }
    }

    // Sorting
    const sort = {}
    const dir = sortOrder === "asc" ? 1 : -1
    sort[sortBy] = dir

    const [subscriptions, total] = await Promise.all([
      Subscription.find(subQuery)
        .sort(sort)
        .skip(skip)
        .limit(lim)
        .populate("userId", "name email channelname image")
        .populate("planId", "name slug price currency")
        .lean(),
      Subscription.countDocuments(subQuery),
    ])

    const subscribers = subscriptions.map((sub) => {
      const u =
        sub.userId && typeof sub.userId === "object"
          ? sub.userId
          : sub.user && typeof sub.user === "object"
          ? sub.user
          : {}
      const uId = String(u._id || sub.userId || sub.user || "")
      const name = u.name || u.channelname || "Subscriber"
      const email = u.email || "N/A"
      const planKey = (sub.plan || sub.planId?.slug || "free").toLowerCase()
      const daysRemaining = sub.expiresAt
        ? Math.max(0, Math.ceil((new Date(sub.expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
        : null

      return {
        _id: sub._id,
        subscriptionId: sub._id,
        userId: uId,
        name,
        userName: name,
        email,
        userEmail: email,
        image: u.image || null,
        plan: planKey,
        planName: sub.planId?.name || planKey.toUpperCase(),
        status: sub.status,
        isActive: sub.isActive,
        cancelScheduled: Boolean(sub.cancelScheduled),
        billingCycle: sub.billingCycle || "monthly",
        startDate: sub.startDate,
        endDate: sub.endDate || sub.expiresAt,
        expiresAt: sub.expiresAt,
        daysRemaining,
        autoRenew: Boolean(sub.autoRenew),
        isExpiringSoon: daysRemaining !== null && daysRemaining <= 7,
        amountPaid: sub.amountPaid || sub.planId?.price || 0,
        createdAt: sub.createdAt,
      }
    })

    return {
      subscribers,
      pagination: {
        page: p,
        limit: lim,
        total,
        totalPages: Math.ceil(total / lim) || 1,
      },
    }
  }

  /**
   * Retrieves full details for a single subscriber including history, transactions, invoices, and audit logs.
   */
  async getSubscriberDetails(userId) {
    const user = await User.findById(userId).select("-password -__v").lean()
    if (!user) {
      throw ApiError.notFound("USER_NOT_FOUND", "User record not found")
    }

    const [subscription, history, transactions, invoices, auditLogs] = await Promise.all([
      Subscription.findOne({ userId })
        .populate("planId")
        .lean(),
      SubscriptionHistory.find({ userId })
        .sort({ performedAt: -1, createdAt: -1 })
        .limit(20)
        .populate("newPlanId previousPlanId")
        .lean(),
      PaymentTransaction.find({ userId })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
      Invoice.find({ userId })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
      AdminSubscriptionAuditLog.find({ userId })
        .sort({ timestamp: -1 })
        .populate("adminId", "name email")
        .lean(),
    ])

    return {
      user: {
        id: user._id,
        name: user.name || user.channelname || "Subscriber",
        email: user.email,
        image: user.image || null,
        joinedOn: user.joinedon || user.createdAt,
      },
      subscription: subscription || {
        plan: "free",
        status: "free",
        isActive: true,
      },
      history,
      transactions: transactions.map(sanitizeTransactionForClient),
      invoices,
      auditLogs,
    }
  }

  /**
   * Admin action: Extends subscription validity with mandatory audit log.
   */
  async extendSubscriptionValidity({
    userId,
    durationDays = 30,
    additionalDays = null,
    newDate = null,
    reason,
    adminId,
    ip = null,
    userAgent = null,
  }) {
    if (!reason || String(reason).trim().length < 5) {
      throw ApiError.badRequest("INVALID_REASON", "A descriptive reason (min 5 chars) is required for admin extension")
    }

    const sub = await Subscription.findOne({ $or: [{ userId }, { user: userId }] })
    if (!sub) {
      throw ApiError.notFound("SUBSCRIPTION_NOT_FOUND", "No subscription record found for user")
    }

    const days = Number(additionalDays || durationDays || 30)
    const prevExpiry = sub.expiresAt || new Date()
    let updatedExpiry

    if (newDate) {
      updatedExpiry = new Date(newDate)
    } else {
      const baseTime = prevExpiry > new Date() ? prevExpiry.getTime() : Date.now()
      updatedExpiry = new Date(baseTime + days * 24 * 60 * 60 * 1000)
    }

    sub.expiresAt = updatedExpiry
    sub.endDate = updatedExpiry
    sub.expiryDate = updatedExpiry
    sub.status = "active"
    sub.isActive = true
    await sub.save()

    // Record Admin Audit Log
    await AdminSubscriptionAuditLog.create({
      adminId,
      userId,
      subscriptionId: sub._id,
      action: "EXTEND_VALIDITY",
      previousValue: { expiresAt: prevExpiry },
      newValue: { expiresAt: updatedExpiry, durationDays: days },
      reason,
      ip,
      userAgent,
    })

    // Record Subscription History
    await SubscriptionHistory.create({
      userId,
      subscriptionId: sub._id,
      action: "subscription_renewed",
      reason: `Admin validity extension: ${reason}`,
      performedAt: new Date(),
      metadata: { extendedByAdmin: true, previousExpiry: prevExpiry, newExpiry: updatedExpiry },
    })

    subscriptionAnalyticsService.invalidateCache()

    return {
      success: true,
      userId,
      previousExpiry: prevExpiry,
      newExpiry: updatedExpiry,
      daysAdded: days,
      status: sub.status,
    }
  }

  /**
   * Admin action: Suspends an active subscription.
   */
  async suspendSubscription({ userId, reason, adminId, ip = null, userAgent = null }) {
    if (!reason || String(reason).trim().length < 5) {
      throw ApiError.badRequest("INVALID_REASON", "A descriptive reason is required for suspension")
    }

    const sub = await Subscription.findOne({ $or: [{ userId }, { user: userId }] })
    if (!sub) {
      throw ApiError.notFound("SUBSCRIPTION_NOT_FOUND", "No subscription record found")
    }

    const prevStatus = sub.status
    sub.status = "suspended"
    sub.isActive = false
    await sub.save()

    await AdminSubscriptionAuditLog.create({
      adminId,
      userId,
      subscriptionId: sub._id,
      action: "SUSPEND_SUBSCRIPTION",
      previousValue: { status: prevStatus, isActive: true },
      newValue: { status: "suspended", isActive: false },
      reason,
      ip,
      userAgent,
    })

    subscriptionAnalyticsService.invalidateCache()

    return { success: true, userId, previousStatus: prevStatus, newStatus: "suspended", status: "suspended" }
  }

  /**
   * Admin action: Restores a suspended or cancelled subscription.
   */
  async restoreSubscription({ userId, reason, adminId, ip = null, userAgent = null }) {
    if (!reason || String(reason).trim().length < 5) {
      throw ApiError.badRequest("INVALID_REASON", "A descriptive reason is required for restoration")
    }

    const sub = await Subscription.findOne({ $or: [{ userId }, { user: userId }] })
    if (!sub) {
      throw ApiError.notFound("SUBSCRIPTION_NOT_FOUND", "No subscription record found")
    }

    const prevStatus = sub.status
    sub.status = "active"
    sub.isActive = true
    sub.cancelScheduled = false
    await sub.save()

    await AdminSubscriptionAuditLog.create({
      adminId,
      userId,
      subscriptionId: sub._id,
      action: "RESTORE_SUBSCRIPTION",
      previousValue: { status: prevStatus },
      newValue: { status: "active", isActive: true },
      reason,
      ip,
      userAgent,
    })

    subscriptionAnalyticsService.invalidateCache()

    return { success: true, userId, previousStatus: prevStatus, newStatus: "active", status: "active" }
  }

  /**
   * Admin action: Manually transitions user to standard Free tier.
   */
  async moveToFreeTier({ userId, reason, adminId, ip = null, userAgent = null }) {
    if (!reason || String(reason).trim().length < 5) {
      throw ApiError.badRequest("INVALID_REASON", "A descriptive reason is required to downgrade user")
    }

    const freePlan = await SubscriptionPlan.findOne({ slug: "free" })
    const sub = await Subscription.findOne({ $or: [{ userId }, { user: userId }] })
    if (!sub) {
      throw ApiError.notFound("SUBSCRIPTION_NOT_FOUND", "No subscription record found")
    }

    const prevPlan = sub.plan
    const prevStatus = sub.status

    sub.plan = "free"
    sub.planId = freePlan?._id || sub.planId
    sub.status = "active"
    sub.isActive = true
    sub.expiresAt = null
    sub.endDate = null
    sub.expiryDate = null
    sub.autoRenew = false
    await sub.save()

    await AdminSubscriptionAuditLog.create({
      adminId,
      userId,
      subscriptionId: sub._id,
      action: "MOVE_TO_FREE",
      previousValue: { plan: prevPlan, status: prevStatus },
      newValue: { plan: "free", status: "active" },
      reason,
      ip,
      userAgent,
    })

    await SubscriptionHistory.create({
      userId,
      subscriptionId: sub._id,
      action: "downgraded_to_free",
      reason: `Admin downgrade: ${reason}`,
      performedAt: new Date(),
    })

    subscriptionAnalyticsService.invalidateCache()

    return { success: true, userId, previousPlan: prevPlan, newPlan: "free", status: "active" }
  }
}

export const subscriberManagementService = new SubscriberManagementService()
export const listSubscribers = (opts) => subscriberManagementService.listSubscribers(opts)
export const getSubscriberProfile = (userId) => subscriberManagementService.getSubscriberProfile(userId)
export const extendSubscriptionValidity = (opts) => subscriberManagementService.extendSubscriptionValidity(opts)
export const suspendSubscription = (opts) => subscriberManagementService.suspendSubscription(opts)
export const restoreSubscription = (opts) => subscriberManagementService.restoreSubscription(opts)
export const moveToFreeTier = (opts) => subscriberManagementService.moveToFreeTier(opts)
export default subscriberManagementService
