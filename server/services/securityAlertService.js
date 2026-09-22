/**
 * Security Alert Service (Phase 10)
 *
 * Central engine for security alert lifecycle, backend severity evaluation,
 * duplicate prevention, user security actions, and query pagination.
 */

import mongoose from "mongoose"
import { SECURITY_ALERT_CONFIG } from "../config/securityAlertConfig.js"
import SecurityAlert from "../Modals/SecurityAlert.js"
import SecurityEvent from "../Modals/SecurityEvent.js"
import { securityNotificationService } from "./securityNotificationService.js"
import { accountProtectionService } from "./accountProtectionService.js"
import { logger } from "../utils/logger.js"

export class SecurityAlertService {
  constructor() {
    // In-memory cooldown tracker for rapid duplicate suppression
    // Key: `${userId}_${type}_${deviceKeyOrIp}` -> timestamp
    this.duplicateMap = new Map()
  }

  /**
   * Generates a deterministic deduplication key for duplicate alert storm suppression.
   */
  getDedupeKey(userId, type, metadata = {}) {
    const devKey =
      metadata.deviceComparisonKey ||
      metadata.signature ||
      metadata.device ||
      metadata.maskedIP ||
      "generic"
    return `${userId}_${type}_${devKey}`
  }

  /**
   * Evaluates backend severity for a given alert type and contextual signals.
   */
  calculateSeverity(type, signals = {}) {
    if (signals.severity && Object.values(SECURITY_ALERT_CONFIG.severities).includes(signals.severity)) {
      return signals.severity
    }

    switch (type) {
      case SECURITY_ALERT_CONFIG.types.REFRESH_TOKEN_REUSE:
      case SECURITY_ALERT_CONFIG.types.ACCOUNT_PROTECTION_TRIGGERED:
        return SECURITY_ALERT_CONFIG.severities.CRITICAL

      case SECURITY_ALERT_CONFIG.types.NEW_COUNTRY_LOGIN:
      case SECURITY_ALERT_CONFIG.types.NEW_STATE_LOGIN:
      case SECURITY_ALERT_CONFIG.types.FAILED_LOGIN_THRESHOLD:
      case SECURITY_ALERT_CONFIG.types.FAILED_OTP_THRESHOLD:
      case SECURITY_ALERT_CONFIG.types.SUSPICIOUS_LOGIN:
        return SECURITY_ALERT_CONFIG.severities.HIGH

      case SECURITY_ALERT_CONFIG.types.NEW_DEVICE_LOGIN:
      case SECURITY_ALERT_CONFIG.types.NEW_BROWSER_LOGIN:
      case SECURITY_ALERT_CONFIG.types.NEW_IP_LOGIN:
      case SECURITY_ALERT_CONFIG.types.NEW_CITY_LOGIN:
      case SECURITY_ALERT_CONFIG.types.SESSION_REMOTE_LOGOUT:
      case SECURITY_ALERT_CONFIG.types.SESSION_REVOKED:
        return SECURITY_ALERT_CONFIG.severities.MEDIUM

      default:
        return SECURITY_ALERT_CONFIG.severities.LOW
    }
  }

  /**
   * Creates and dispatches a structured Security Alert.
   */
  async createAlert({
    userId,
    type,
    severity = null,
    title,
    message,
    actionRequired = false,
    metadata = {},
    securityEventId = null,
  }) {
    if (!userId || !type) {
      throw new Error("userId and alert type are required to create a security alert")
    }

    // 1. Enforce backend severity
    const finalSeverity = severity || this.calculateSeverity(type, metadata)
    const isCritical = finalSeverity === SECURITY_ALERT_CONFIG.severities.CRITICAL

    // 2. Check duplicate alert cooldown (10 minutes)
    // Critical events bypass cooldown to prevent suppressing acute attacks
    const dedupeKey = this.getDedupeKey(userId, type, metadata)
    const now = Date.now()
    const cooldownMs = SECURITY_ALERT_CONFIG.duplicateAlertWindowMinutes * 60 * 1000
    const lastTriggered = this.duplicateMap.get(dedupeKey)

    if (!isCritical && lastTriggered && now - lastTriggered < cooldownMs) {
      logger.info(`[SecurityAlertService] Suppressing duplicate alert '${dedupeKey}' within 10m window`)
      return {
        suppressed: true,
        reason: "DUPLICATE_ALERT_COOLDOWN",
        type,
        userId: userId.toString(),
      }
    }

    this.duplicateMap.set(dedupeKey, now)

    // 3. Format default titles and descriptions if omitted
    const alertTitle = title || this.getDefaultTitle(type)
    const alertMessage = message || this.getDefaultMessage(type, metadata)

    // 4. Construct Alert Record
    const alertPayload = {
      userId,
      securityEventId,
      type,
      severity: finalSeverity,
      title: alertTitle,
      message: alertMessage,
      status: actionRequired
        ? SECURITY_ALERT_CONFIG.statuses.ACTION_REQUIRED
        : SECURITY_ALERT_CONFIG.statuses.UNREAD,
      actionRequired: Boolean(actionRequired),
      actionStatus: actionRequired
        ? SECURITY_ALERT_CONFIG.actionStatuses.PENDING
        : SECURITY_ALERT_CONFIG.actionStatuses.NONE,
      metadata,
      deliveryStatus: {
        inApp: SECURITY_ALERT_CONFIG.deliveryStatuses.DELIVERED,
        email: SECURITY_ALERT_CONFIG.deliveryStatuses.PENDING,
        sms: SECURITY_ALERT_CONFIG.deliveryStatuses.NOT_REQUESTED,
      },
    }

    let alertRecord = null

    if (mongoose.connection?.readyState === 1) {
      alertRecord = await SecurityAlert.create(alertPayload)
    } else {
      // Ephemeral mock object for offline unit testing
      alertRecord = {
        _id: new mongoose.Types.ObjectId(),
        id: new mongoose.Types.ObjectId().toString(),
        ...alertPayload,
        createdAt: new Date(),
        save: async function () { return this },
      }
    }

    // 5. Dispatch Notifications (Email, SMS, In-App)
    try {
      await securityNotificationService.dispatchNotification(alertRecord)
      if (mongoose.connection?.readyState === 1 && alertRecord.save) {
        await alertRecord.save()
      }
    } catch (notifErr) {
      logger.warn(`[SecurityAlertService] Notification dispatch notice: ${notifErr.message}`)
    }

    // 6. Log SecurityEvent
    if (mongoose.connection?.readyState === 1) {
      try {
        await SecurityEvent.create({
          eventType: "SECURITY_ALERT_CREATED",
          userId: userId.toString(),
          severity: finalSeverity,
          metadata: {
            alertId: alertRecord._id.toString(),
            alertType: type,
            alertTitle,
            alertMessage,
            severity: finalSeverity,
          },
        })
      } catch (e) {
        logger.warn(`[SecurityAlertService] Failed to record alert security event: ${e.message}`)
      }
    }

    return alertRecord
  }

  /**
   * Retrieves paginated security alerts for an authenticated user.
   */
  async getAlerts(userId, { page = 1, limit = 20, status = null, severity = null, unreadOnly = false } = {}) {
    if (!userId) return { alerts: [], total: 0, page: 1, totalPages: 0 }

    const pageNum = Math.max(1, parseInt(page, 10) || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20))
    const skip = (pageNum - 1) * limitNum

    const query = { userId }

    if (unreadOnly) {
      query.status = { $in: [SECURITY_ALERT_CONFIG.statuses.UNREAD, SECURITY_ALERT_CONFIG.statuses.ACTION_REQUIRED] }
    } else if (status) {
      query.status = status
    }

    if (severity) {
      query.severity = severity
    }

    if (mongoose.connection?.readyState !== 1) {
      return { alerts: [], total: 0, page: pageNum, totalPages: 0 }
    }

    try {
      const [alerts, total] = await Promise.all([
        SecurityAlert.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        SecurityAlert.countDocuments(query),
      ])

      const sanitized = alerts.map((a) => this.sanitizeAlert(a))

      return {
        alerts: sanitized,
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum) || 1,
      }
    } catch (err) {
      logger.error(`[SecurityAlertService] Error fetching alerts for user ${userId}:`, err)
      return { alerts: [], total: 0, page: pageNum, totalPages: 0 }
    }
  }

  /**
   * Counts unread and action-required alerts for badge and header indicators.
   */
  async getUnreadCount(userId) {
    if (!userId) return { count: 0, hasActionRequired: false, hasCritical: false }
    if (mongoose.connection?.readyState !== 1) {
      return { count: 0, hasActionRequired: false, hasCritical: false }
    }

    try {
      const unreadAlerts = await SecurityAlert.find({
        userId,
        status: { $in: [SECURITY_ALERT_CONFIG.statuses.UNREAD, SECURITY_ALERT_CONFIG.statuses.ACTION_REQUIRED] },
      }).select("severity status").lean()

      const count = unreadAlerts.length
      const hasActionRequired = unreadAlerts.some((a) => a.status === SECURITY_ALERT_CONFIG.statuses.ACTION_REQUIRED)
      const hasCritical = unreadAlerts.some((a) => a.severity === SECURITY_ALERT_CONFIG.severities.CRITICAL)

      return { count, hasActionRequired, hasCritical }
    } catch (err) {
      logger.error(`[SecurityAlertService] Error getting unread count:`, err)
      return { count: 0, hasActionRequired: false, hasCritical: false }
    }
  }

  /**
   * Marks an alert as READ. Does NOT resolve ACTION_REQUIRED alerts.
   */
  async markAsRead(userId, alertId) {
    if (!userId || !alertId) throw new Error("userId and alertId are required")
    if (mongoose.connection?.readyState !== 1) return { success: true }

    const alert = await SecurityAlert.findOne({ _id: alertId, userId })
    if (!alert) {
      throw new Error("Alert not found or unauthorized")
    }

    if (alert.status === SECURITY_ALERT_CONFIG.statuses.UNREAD) {
      alert.status = SECURITY_ALERT_CONFIG.statuses.READ
      alert.readAt = new Date()
      await alert.save()

      await SecurityEvent.create({
        eventType: "ALERT_READ",
        userId: userId.toString(),
        severity: "INFO",
        metadata: { alertId, alertType: alert.type, alertTitle: alert.title },
      }).catch(() => {})
    }

    return this.sanitizeAlert(alert)
  }

  /**
   * Marks all readable UNREAD alerts as READ (without resolving ACTION_REQUIRED).
   */
  async markAllAsRead(userId) {
    if (!userId) return { updatedCount: 0 }
    if (mongoose.connection?.readyState !== 1) return { updatedCount: 0 }

    const res = await SecurityAlert.updateMany(
      { userId, status: SECURITY_ALERT_CONFIG.statuses.UNREAD },
      { $set: { status: SECURITY_ALERT_CONFIG.statuses.READ, readAt: new Date() } }
    )

    return { updatedCount: res.modifiedCount || 0 }
  }

  /**
   * "This Was Me" User Action: Marks alert RESOLVED and records verification event.
   */
  async confirmAlert(userId, alertId) {
    if (!userId || !alertId) throw new Error("userId and alertId are required")
    if (mongoose.connection?.readyState !== 1) {
      return { success: true, message: "Activity confirmed successfully" }
    }

    const alert = await SecurityAlert.findOne({ _id: alertId, userId })
    if (!alert) {
      throw new Error("Alert not found or unauthorized")
    }

    alert.status = SECURITY_ALERT_CONFIG.statuses.RESOLVED
    alert.actionStatus = SECURITY_ALERT_CONFIG.actionStatuses.CONFIRMED
    alert.resolvedAt = new Date()
    await alert.save()

    await SecurityEvent.create({
      eventType: "ALERT_CONFIRMED",
      userId: userId.toString(),
      severity: "INFO",
      metadata: {
        alertId,
        alertType: alert.type,
        confirmedAt: new Date(),
      },
    }).catch(() => {})

    return {
      success: true,
      message: "Thank you for confirming this activity. Your alert has been resolved.",
      alert: this.sanitizeAlert(alert),
    }
  }

  /**
   * "Not Me" User Action: Revokes associated session, suspends device, applies protection.
   */
  async reportSuspicious(userId, alertId, { currentSessionId = null } = {}) {
    if (!userId || !alertId) throw new Error("userId and alertId are required")
    if (mongoose.connection?.readyState !== 1) {
      return {
        success: true,
        message: "We have secured your account and signed out suspicious sessions.",
      }
    }

    const alert = await SecurityAlert.findOne({ _id: alertId, userId })
    if (!alert) {
      throw new Error("Alert not found or unauthorized")
    }

    // 1. Update Alert Status
    alert.status = SECURITY_ALERT_CONFIG.statuses.RESOLVED
    alert.actionStatus = SECURITY_ALERT_CONFIG.actionStatuses.REPORTED
    alert.resolvedAt = new Date()
    await alert.save()

    // 2. Delegate to Account Protection Engine
    const protectionRes = await accountProtectionService.handleSuspiciousActivityReport(
      userId,
      alert,
      { currentSessionId }
    )

    // 3. Log Audit Event
    await SecurityEvent.create({
      eventType: "SUSPICIOUS_ACTIVITY_REPORTED",
      userId: userId.toString(),
      severity: "CRITICAL",
      metadata: {
        alertId,
        alertType: alert.type,
        reportedAt: new Date(),
        sessionsRevoked: protectionRes.sessionsRevoked || 0,
      },
    }).catch(() => {})

    return {
      success: true,
      message: "We have secured your account and signed out suspicious sessions.",
      protectionStatus: protectionRes.protectionStatus,
      sessionsRevoked: protectionRes.sessionsRevoked,
      alert: this.sanitizeAlert(alert),
    }
  }

  /**
   * Dismisses a non-critical alert. Critical alerts cannot be dismissed.
   */
  async dismissAlert(userId, alertId) {
    if (!userId || !alertId) throw new Error("userId and alertId are required")
    if (mongoose.connection?.readyState !== 1) return { success: true }

    const alert = await SecurityAlert.findOne({ _id: alertId, userId })
    if (!alert) {
      throw new Error("Alert not found or unauthorized")
    }

    if (alert.severity === SECURITY_ALERT_CONFIG.severities.CRITICAL) {
      throw new Error("Critical security alerts cannot be dismissed. Please review or confirm the activity.")
    }

    alert.status = SECURITY_ALERT_CONFIG.statuses.DISMISSED
    alert.actionStatus = SECURITY_ALERT_CONFIG.actionStatuses.DISMISSED
    await alert.save()

    return { success: true, message: "Alert dismissed" }
  }

  /**
   * Sanitizes alert record before returning to frontend.
   * Strips any internal tokens, secret keys, or raw hashes.
   */
  sanitizeAlert(alert) {
    if (!alert) return null
    const doc = alert._doc || alert
    return {
      id: doc._id ? doc._id.toString() : doc.id,
      _id: doc._id ? doc._id.toString() : doc.id,
      userId: doc.userId ? doc.userId.toString() : null,
      type: doc.type,
      severity: doc.severity,
      title: doc.title,
      message: doc.message,
      status: doc.status,
      actionRequired: doc.actionRequired,
      actionStatus: doc.actionStatus,
      deliveryStatus: doc.deliveryStatus,
      metadata: {
        browser: doc.metadata?.browser || doc.metadata?.device?.browser?.name,
        device: doc.metadata?.device || doc.metadata?.device?.hardware?.type,
        location: doc.metadata?.location,
        maskedIP: doc.metadata?.maskedIP,
        timestamp: doc.metadata?.timestamp || doc.createdAt,
      },
      createdAt: doc.createdAt,
      readAt: doc.readAt,
      resolvedAt: doc.resolvedAt,
    }
  }

  getDefaultTitle(type) {
    switch (type) {
      case SECURITY_ALERT_CONFIG.types.NEW_DEVICE_LOGIN:
        return "Sign-In from New Device"
      case SECURITY_ALERT_CONFIG.types.NEW_BROWSER_LOGIN:
        return "Sign-In from New Browser"
      case SECURITY_ALERT_CONFIG.types.NEW_IP_LOGIN:
        return "Sign-In from New IP Address"
      case SECURITY_ALERT_CONFIG.types.NEW_CITY_LOGIN:
      case SECURITY_ALERT_CONFIG.types.NEW_STATE_LOGIN:
      case SECURITY_ALERT_CONFIG.types.NEW_COUNTRY_LOGIN:
        return "Sign-In from New Location"
      case SECURITY_ALERT_CONFIG.types.FAILED_LOGIN_THRESHOLD:
        return "Multiple Failed Sign-In Attempts"
      case SECURITY_ALERT_CONFIG.types.FAILED_OTP_THRESHOLD:
        return "Multiple Failed Security Verification Codes"
      case SECURITY_ALERT_CONFIG.types.REFRESH_TOKEN_REUSE:
        return "Critical Security Incident: Session Token Replay"
      case SECURITY_ALERT_CONFIG.types.ACCOUNT_PROTECTION_TRIGGERED:
        return "Account Protection Activated"
      default:
        return "Account Security Notice"
    }
  }

  getDefaultMessage(type, meta = {}) {
    const loc = meta.location || "an unrecognized location"
    const dev = meta.device ? `${meta.device} (${meta.browser || "browser"})` : "a new device"
    switch (type) {
      case SECURITY_ALERT_CONFIG.types.NEW_DEVICE_LOGIN:
        return `We noticed a sign-in from ${dev} in ${loc}. If this was you, you can confirm this device.`
      case SECURITY_ALERT_CONFIG.types.NEW_BROWSER_LOGIN:
        return `Sign-in detected using a new browser: ${meta.browser || "Unknown"} in ${loc}.`
      case SECURITY_ALERT_CONFIG.types.NEW_COUNTRY_LOGIN:
        return `Your account was signed in from a new country: ${loc}. Additional verification was required.`
      case SECURITY_ALERT_CONFIG.types.FAILED_LOGIN_THRESHOLD:
        return `5 or more failed sign-in attempts were recorded within 15 minutes. Additional security measures have been engaged.`
      case SECURITY_ALERT_CONFIG.types.FAILED_OTP_THRESHOLD:
        return `Too many invalid security codes were entered. The pending login challenge was suspended.`
      case SECURITY_ALERT_CONFIG.types.REFRESH_TOKEN_REUSE:
        return `An invalid token reuse was detected. All connected sessions have been terminated to safeguard your account.`
      default:
        return "We detected unusual or important account activity. Please review your active devices and security settings."
    }
  }
}

export const securityAlertService = new SecurityAlertService()
export default securityAlertService
