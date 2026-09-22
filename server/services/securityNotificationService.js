/**
 * Security Notification Service (Phase 10)
 *
 * Coordinates multi-channel notification delivery (In-App, Email, SMS)
 * with user preference evaluation, rate limiting, and delivery status tracking.
 */

import mongoose from "mongoose"
import { SECURITY_ALERT_CONFIG } from "../config/securityAlertConfig.js"
import SecurityNotificationPreference from "../Modals/SecurityNotificationPreference.js"
import User from "../Modals/Auth.js"
import SecurityEvent from "../Modals/SecurityEvent.js"
import { emailService } from "./emailService.js"
import { smsService } from "./smsService.js"
import { logger } from "../utils/logger.js"

export class SecurityNotificationService {
  constructor() {
    // In-memory hourly rate limit trackers: userId -> [timestamp, ...]
    this.emailDispatches = new Map()
    this.smsDispatches = new Map()
  }

  /**
   * Evaluates if an action is within hourly rate limits.
   */
  checkRateLimit(map, userId, maxPerHour) {
    const now = Date.now()
    const oneHourAgo = now - 60 * 60 * 1000
    const history = (map.get(userId.toString()) || []).filter((ts) => ts > oneHourAgo)
    map.set(userId.toString(), history)

    if (history.length >= maxPerHour) {
      return false
    }
    history.push(now)
    return true
  }

  /**
   * Retrieves or initializes default notification preferences for a user.
   */
  async getPreferences(userId) {
    if (!userId) return null
    if (mongoose.connection?.readyState !== 1) {
      return {
        userId: userId.toString(),
        inAppEnabled: true,
        emailNewLoginEnabled: true,
        emailHighRiskEnabled: true,
        smsCriticalEnabled: false,
      }
    }

    try {
      let pref = await SecurityNotificationPreference.findOne({ userId })
      if (!pref) {
        pref = await SecurityNotificationPreference.create({
          userId,
          inAppEnabled: true,
          emailNewLoginEnabled: true,
          emailHighRiskEnabled: true,
          smsCriticalEnabled: false,
        })
      }
      return pref
    } catch (err) {
      logger.warn(`[SecurityNotificationService] Error getting preferences for ${userId}: ${err.message}`)
      return {
        userId: userId.toString(),
        inAppEnabled: true,
        emailNewLoginEnabled: true,
        emailHighRiskEnabled: true,
        smsCriticalEnabled: false,
      }
    }
  }

  /**
   * Dispatches notifications across eligible channels for a security alert.
   */
  async dispatchNotification(alert) {
    if (!alert || !alert.userId) return alert

    const userId = alert.userId.toString()
    const severity = alert.severity || "MEDIUM"
    const isCritical = severity === "CRITICAL"

    // 1. In-App is always delivered
    alert.deliveryStatus = alert.deliveryStatus || {}
    alert.deliveryStatus.inApp = SECURITY_ALERT_CONFIG.deliveryStatuses.DELIVERED

    // 2. Fetch User & Preferences
    let user = null
    let prefs = null
    try {
      if (mongoose.connection?.readyState === 1) {
        user = await User.findById(userId).lean()
      }
      prefs = await this.getPreferences(userId)
    } catch (e) {
      logger.warn(`[SecurityNotificationService] Lookup error: ${e.message}`)
    }

    const userEmail = user?.email || alert.metadata?.email
    const userPhone = user?.phone || user?.mobile || alert.metadata?.phone

    // 3. Email Channel Evaluation
    // Rules:
    // - CRITICAL alerts ALWAYS attempt email (mandatory delivery)
    // - HIGH alerts attempt email if prefs.emailHighRiskEnabled
    // - MEDIUM/LOW alerts attempt email if prefs.emailNewLoginEnabled
    const shouldSendEmail =
      isCritical ||
      (severity === "HIGH" && prefs?.emailHighRiskEnabled !== false) ||
      (prefs?.emailNewLoginEnabled !== false && alert.type.includes("LOGIN"))

    if (shouldSendEmail && userEmail) {
      // Check rate limit (critical alerts bypass rate limits)
      const allowed = isCritical || this.checkRateLimit(
        this.emailDispatches,
        userId,
        SECURITY_ALERT_CONFIG.maxSecurityEmailsPerHour
      )

      if (!allowed) {
        alert.deliveryStatus.email = SECURITY_ALERT_CONFIG.deliveryStatuses.FAILED
        logger.warn(`[SecurityNotificationService] Email rate limit exceeded for user ${userId}`)
      } else {
        alert.deliveryStatus.email = SECURITY_ALERT_CONFIG.deliveryStatuses.PENDING

        // Retry loop
        let attempts = 0
        let sent = false
        while (attempts < SECURITY_ALERT_CONFIG.maxNotificationRetries && !sent) {
          attempts++
          try {
            await emailService.sendSecurityAlert({
              email: userEmail,
              alertType: alert.type,
              title: alert.title,
              message: alert.message,
              severity: alert.severity,
              metadata: alert.metadata || {},
            })
            sent = true
            alert.deliveryStatus.email = SECURITY_ALERT_CONFIG.deliveryStatuses.SENT

            if (mongoose.connection?.readyState === 1) {
              await SecurityEvent.create({
                eventType: "SECURITY_NOTIFICATION_SENT",
                userId,
                severity: "INFO",
                metadata: {
                  channel: "email",
                  alertType: alert.type,
                  alertId: alert._id ? alert._id.toString() : alert.id,
                },
              }).catch(() => {})
            }
          } catch (sendErr) {
            logger.warn(`[SecurityNotificationService] Email send attempt ${attempts} failed: ${sendErr.message}`)
          }
        }

        if (!sent) {
          alert.deliveryStatus.email = SECURITY_ALERT_CONFIG.deliveryStatuses.FAILED
          if (mongoose.connection?.readyState === 1) {
            await SecurityEvent.create({
              eventType: "SECURITY_NOTIFICATION_FAILED",
              userId,
              severity: "WARN",
              metadata: {
                channel: "email",
                alertType: alert.type,
                reason: "MAX_RETRIES_EXCEEDED",
              },
            }).catch(() => {})
          }
        }
      }
    } else {
      alert.deliveryStatus.email = SECURITY_ALERT_CONFIG.deliveryStatuses.NOT_REQUESTED
    }

    // 4. SMS Channel Evaluation
    // Rules:
    // - Only for CRITICAL alerts and if smsService is configured and user enabled or critical policy
    const shouldSendSms =
      isCritical &&
      (prefs?.smsCriticalEnabled || isCritical) &&
      smsService.isConfigured() &&
      userPhone

    if (shouldSendSms) {
      const allowed = this.checkRateLimit(
        this.smsDispatches,
        userId,
        SECURITY_ALERT_CONFIG.maxSecuritySmsPerHour
      )

      if (allowed) {
        try {
          alert.deliveryStatus.sms = SECURITY_ALERT_CONFIG.deliveryStatuses.PENDING
          // Reuse sms service
          const text = `YouTube Security Alert [${severity}]: ${alert.title}. Review at /account/security`
          const record = {
            to: userPhone,
            message: text,
            sentAt: new Date(),
          }
          smsService.outbox.push(record)
          alert.deliveryStatus.sms = SECURITY_ALERT_CONFIG.deliveryStatuses.SENT

          if (mongoose.connection?.readyState === 1) {
            await SecurityEvent.create({
              eventType: "SECURITY_NOTIFICATION_SENT",
              userId,
              severity: "INFO",
              metadata: {
                channel: "sms",
                alertType: alert.type,
              },
            }).catch(() => {})
          }
        } catch (smsErr) {
          alert.deliveryStatus.sms = SECURITY_ALERT_CONFIG.deliveryStatuses.FAILED
          logger.warn(`[SecurityNotificationService] SMS dispatch failed: ${smsErr.message}`)
        }
      } else {
        alert.deliveryStatus.sms = SECURITY_ALERT_CONFIG.deliveryStatuses.FAILED
      }
    } else {
      alert.deliveryStatus.sms = SECURITY_ALERT_CONFIG.deliveryStatuses.NOT_REQUESTED
    }

    return alert
  }
}

export const securityNotificationService = new SecurityNotificationService()
export default securityNotificationService
