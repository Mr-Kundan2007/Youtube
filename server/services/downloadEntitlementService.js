import mongoose from "mongoose"
import User from "../Modals/Auth.js"
import Subscription from "../Modals/Subscription.js"
import { downloadConfig } from "../config/index.js"
import { ApiError } from "../utils/apiError.js"

export const EntitlementErrorCodes = {
  USER_NOT_FOUND: "USER_NOT_FOUND",
  ACCOUNT_BLOCKED: "ACCOUNT_BLOCKED",
  SUBSCRIPTION_NOT_FOUND: "SUBSCRIPTION_NOT_FOUND",
  SUBSCRIPTION_INACTIVE: "SUBSCRIPTION_INACTIVE",
  SUBSCRIPTION_EXPIRED: "SUBSCRIPTION_EXPIRED",
  PAYMENT_REQUIRED: "PAYMENT_REQUIRED",
  DOWNLOAD_NOT_ENABLED: "DOWNLOAD_NOT_ENABLED",
  PLAN_CONFIGURATION_INVALID: "PLAN_CONFIGURATION_INVALID",
}

export const VALID_QUOTA_TYPES = ["daily", "monthly", "billing_cycle", "unlimited"]

/**
 * Centralized service responsible for resolving download permissions and subscription entitlements.
 * Single source of truth across the platform for:
 * User -> Account Status -> Subscription -> Expiry -> Fallback -> Plan Config -> Entitlement.
 */
export class DownloadEntitlementService {
  /**
   * Validates user account status.
   */
  async validateAccountAccess(userId) {
    if (!userId) {
      return {
        isValid: false,
        code: EntitlementErrorCodes.USER_NOT_FOUND,
        message: "User ID is required",
      }
    }

    const user = await User.findById(userId)
    if (!user) {
      return {
        isValid: false,
        code: EntitlementErrorCodes.USER_NOT_FOUND,
        message: "User account does not exist",
      }
    }

    if (user.status === "blocked" || user.status === "suspended") {
      return {
        isValid: false,
        code: EntitlementErrorCodes.ACCOUNT_BLOCKED,
        message: `User account is ${user.status}. Download access is restricted.`,
      }
    }

    return { isValid: true, user }
  }

  /**
   * Validates plan configuration rules.
   */
  validatePlanConfiguration(config = {}) {
    if (!config || typeof config !== "object") {
      throw new Error("Plan configuration must be an object")
    }

    if (config.quotaType && !VALID_QUOTA_TYPES.includes(config.quotaType)) {
      throw new Error(
        `Invalid quota_type "${config.quotaType}". Must be one of: ${VALID_QUOTA_TYPES.join(", ")}`
      )
    }

    if (config.quotaType === "unlimited") {
      if (config.quotaLimit !== null && config.quotaLimit !== undefined && config.quotaLimit !== 0) {
        throw new Error("Unlimited quotaType must specify quotaLimit as null or 0")
      }
    } else if (config.quotaLimit !== null && config.quotaLimit !== undefined) {
      if (typeof config.quotaLimit !== "number" || config.quotaLimit < 0) {
        throw new Error("quotaLimit must be a non-negative number")
      }
    }

    if (config.duplicateWindowHours !== undefined && config.duplicateWindowHours < 0) {
      throw new Error("duplicateWindowHours must be non-negative")
    }

    return true
  }

  /**
   * Retrieves plan download configuration from central config.
   */
  getPlanDownloadConfiguration(planKey = "free") {
    const key = (planKey || "free").toLowerCase()
    const config = downloadConfig.plans[key] || downloadConfig.plans.free
    this.validatePlanConfiguration(config)
    return config
  }

  /**
   * Validates active subscription status, handling expiration and cancellations.
   */
  async validateSubscriptionAccess(userId) {
    const accountCheck = await this.validateAccountAccess(userId)
    if (!accountCheck.isValid) {
      return {
        isValid: false,
        code: accountCheck.code,
        message: accountCheck.message,
        effectivePlan: "free",
        subscription: null,
        isExpired: false,
      }
    }

    const now = new Date()
    let sub = await Subscription.findOne({ userId })

    if (!sub) {
      try {
        const freeConfig = this.getPlanDownloadConfiguration("free")
        sub = await Subscription.create({
          userId,
          plan: "free",
          status: "active",
          startDate: now,
          endDate: null,
          expiresAt: null,
          download_limit: freeConfig.quotaLimit || 1,
          download_quota_type: freeConfig.quotaType || "daily",
          download_enabled: freeConfig.downloadEnabled !== false,
          max_download_devices: freeConfig.maxDevices || 1,
        })
      } catch (err) {
        sub = await Subscription.findOne({ userId })
      }
    }

    // Free plan never expires
    if (sub.plan === "free") {
      return {
        isValid: true,
        effectivePlan: "free",
        subscription: sub,
        isExpired: false,
        code: null,
        message: null,
      }
    }

    // Check expiry for paid plans
    if (sub.expiresAt && new Date(sub.expiresAt) < now) {
      if (sub.status !== "expired") {
        sub.status = "expired"
        await sub.save()
      }

      // Explicit Fallback Policy:
      // Expired paid subscriptions fall back to Free plan tier with an EXPIRED notice.
      return {
        isValid: false,
        effectivePlan: "free",
        subscription: sub,
        isExpired: true,
        code: EntitlementErrorCodes.SUBSCRIPTION_EXPIRED,
        message: "Your subscription has expired. Paid entitlement has been removed.",
      }
    }

    // Check cancellation: Cancelled subscriptions remain valid until period end (expiresAt)
    if (sub.status === "cancelled") {
      if (sub.expiresAt && new Date(sub.expiresAt) >= now) {
        return {
          isValid: true,
          effectivePlan: sub.plan,
          subscription: sub,
          isExpired: false,
          code: null,
          message: "Subscription is cancelled but active until period end.",
        }
      } else {
        return {
          isValid: false,
          effectivePlan: "free",
          subscription: sub,
          isExpired: true,
          code: EntitlementErrorCodes.SUBSCRIPTION_INACTIVE,
          message: "Subscription cancelled and period has ended.",
        }
      }
    }

    if (sub.status === "past_due") {
      return {
        isValid: false,
        effectivePlan: "free",
        subscription: sub,
        isExpired: false,
        code: EntitlementErrorCodes.PAYMENT_REQUIRED,
        message: "Payment is past due. Please update payment method to retain paid download privileges.",
      }
    }

    if (sub.status !== "active") {
      return {
        isValid: false,
        effectivePlan: "free",
        subscription: sub,
        isExpired: false,
        code: EntitlementErrorCodes.SUBSCRIPTION_INACTIVE,
        message: `Subscription status is ${sub.status}.`,
      }
    }

    return {
      isValid: true,
      effectivePlan: sub.plan,
      subscription: sub,
      isExpired: false,
      code: null,
      message: null,
    }
  }

  /**
   * Core entitlement resolution function:
   * Determines user plan, subscription validity, download limits, device restrictions, and duplicate window.
   */
  async getDownloadEntitlement(userId) {
    const subValidation = await this.validateSubscriptionAccess(userId)

    if (subValidation.code === EntitlementErrorCodes.ACCOUNT_BLOCKED) {
      return {
        success: false,
        code: EntitlementErrorCodes.ACCOUNT_BLOCKED,
        message: subValidation.message,
        data: {
          userId: String(userId),
          plan: "free",
          subscriptionStatus: "blocked",
          subscriptionValid: false,
          downloadEnabled: false,
          quotaType: "daily",
          downloadLimit: 0,
          deviceLimit: 0,
          duplicateWindow: 86400,
          subscriptionExpiresAt: null,
          canDownload: false,
          reason: subValidation.message,
        },
      }
    }

    if (subValidation.code === EntitlementErrorCodes.USER_NOT_FOUND) {
      return {
        success: false,
        code: EntitlementErrorCodes.USER_NOT_FOUND,
        message: subValidation.message,
        data: null,
      }
    }

    const { effectivePlan, subscription, isExpired, code, message } = subValidation
    const planConfig = this.getPlanDownloadConfiguration(effectivePlan)

    // Snapshot / Custom Overrides on Subscription document (if set and plan is active paid)
    let quotaLimit = planConfig.quotaType === "unlimited" ? null : planConfig.quotaLimit
    let quotaType = planConfig.quotaType || "daily"
    let downloadEnabled = planConfig.downloadEnabled !== false
    let deviceLimit = planConfig.maxDevices || 1

    if (subscription && subValidation.isValid && subscription.plan !== "free") {
      if (subscription.download_limit !== null && subscription.download_limit !== undefined) {
        quotaLimit = subscription.download_limit
      }
      if (subscription.download_quota_type) {
        quotaType = subscription.download_quota_type
      }
      if (subscription.download_enabled !== null && subscription.download_enabled !== undefined) {
        downloadEnabled = subscription.download_enabled
      }
      if (subscription.max_download_devices !== null && subscription.max_download_devices !== undefined) {
        deviceLimit = subscription.max_download_devices
      }
    }

    if (quotaType === "unlimited") {
      quotaLimit = null
    }

    const duplicateWindowSeconds = (planConfig.duplicateWindowHours || 24) * 3600
    const canDownload = downloadEnabled && !isExpired && (subValidation.isValid || effectivePlan === "free")

    const maxRegisteredDevices = planConfig.maxRegisteredDevices || deviceLimit
    const maxConcurrentDeviceDownloads = planConfig.maxConcurrentDeviceDownloads || 1
    const maxConcurrentDownloadsPerDevice = planConfig.maxConcurrentDownloadsPerDevice || 1
    const requireRegisteredDevice = planConfig.requireRegisteredDevice !== false

    // Construct standardized response structure
    const entitlementData = {
      userId: String(userId),
      plan: effectivePlan.charAt(0).toUpperCase() + effectivePlan.slice(1),
      planKey: effectivePlan,
      subscriptionStatus: subscription ? subscription.status : "none",
      subscriptionValid: subValidation.isValid,
      downloadEnabled,
      quotaType,
      downloadLimit: quotaLimit,
      deviceLimit,
      maxRegisteredDevices,
      maxConcurrentDeviceDownloads,
      maxConcurrentDownloadsPerDevice,
      requireRegisteredDevice,
      duplicateWindow: duplicateWindowSeconds,
      subscriptionExpiresAt: subscription ? subscription.expiresAt : null,
      canDownload,
      isExpired,
      reason: message || null,
      subscription: {
        active: subValidation.isValid,
        status: subscription ? subscription.status : "none",
        expiresAt: subscription ? subscription.expiresAt : null,
        valid: subValidation.isValid,
      },
      download: {
        enabled: downloadEnabled,
        quotaType,
        limit: quotaLimit,
        deviceLimit,
        maxRegisteredDevices,
        maxConcurrentDeviceDownloads,
        maxConcurrentDownloadsPerDevice,
        requireRegisteredDevice,
        duplicateWindow: duplicateWindowSeconds,
        maxQuality: planConfig.maxQuality || "1080p",
        canDownload,
      },
    }

    if (isExpired) {
      return {
        success: false,
        code: EntitlementErrorCodes.SUBSCRIPTION_EXPIRED,
        message: message || "Your subscription has expired.",
        data: entitlementData,
      }
    }

    return {
      success: true,
      data: entitlementData,
    }
  }
}

export const downloadEntitlementService = new DownloadEntitlementService()
export default downloadEntitlementService
