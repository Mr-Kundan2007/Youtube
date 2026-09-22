/**
 * Security Activity Service (Phase 8)
 *
 * Provides a unified security activity stream for the user account.
 * Aggregates authentication events, device changes, verification challenges,
 * and high-severity security alerts into human-readable activity entries.
 */

import SecurityEvent from "../Modals/SecurityEvent.js"
import { TRUSTED_DEVICE_CONFIG } from "../config/trustedDeviceConfig.js"
import { maskIPAddress } from "../utils/comparisonUtils.js"

export class SecurityActivityService {
  /**
   * Formats a raw security event into a user-friendly activity entry.
   */
  formatActivity(event) {
    let title = "Security Event"
    let description = "An account security activity was recorded."
    const meta = event.metadata || {}

    switch (event.eventType) {
      case TRUSTED_DEVICE_CONFIG.eventTypes.TRUSTED_DEVICE_CREATED:
        title = "Trusted Device Added"
        description = `New device was verified and trusted.`
        break
      case TRUSTED_DEVICE_CONFIG.eventTypes.TRUSTED_DEVICE_UPDATED:
        title = "Trusted Device Renewed"
        description = `Trusted device activity was refreshed.`
        break
      case TRUSTED_DEVICE_CONFIG.eventTypes.TRUSTED_DEVICE_REVOKED:
        title = "Device Trust Revoked"
        description = meta.reason === "DEVICE_LIMIT_EXCEEDED"
          ? "Oldest inactive device was revoked because device limit was reached."
          : `Trust was revoked for ${meta.deviceName || "device"}.`
        break
      case TRUSTED_DEVICE_CONFIG.eventTypes.TRUSTED_DEVICE_RENAMED:
        title = "Device Renamed"
        description = `Device renamed to "${meta.newName || "Custom Device"}".`
        break
      case TRUSTED_DEVICE_CONFIG.eventTypes.TRUSTED_DEVICE_EXPIRED:
        title = "Device Trust Expired"
        description = "Device trust expired after 30 days of inactivity or validity window."
        break
      case TRUSTED_DEVICE_CONFIG.eventTypes.LOGIN_SUCCESS:
        title = "Successful Sign-In"
        description = `Signed in using ${meta.browser || "browser"} on ${meta.os || "device"}.`
        break
      case TRUSTED_DEVICE_CONFIG.eventTypes.LOGIN_FAILED:
        title = "Failed Sign-In Attempt"
        description = "An incorrect password or invalid credentials were submitted."
        break
      case TRUSTED_DEVICE_CONFIG.eventTypes.LOGIN_OTP_REQUIRED:
        title = "Verification Challenge Issued"
        description = "A one-time verification code was required to confirm your identity."
        break
      case TRUSTED_DEVICE_CONFIG.eventTypes.LOGIN_BLOCKED:
        title = "Suspicious Login Blocked"
        description = "Sign-in attempt was flagged and blocked by security filters."
        break
      case "OTP_GENERATED":
        title = "Security Code Requested"
        description = `A one-time code was sent via ${meta.deliveryMethod || "email"}.`
        break
      case "OTP_VERIFIED":
        title = "Security Code Verified"
        description = "One-time security code was successfully validated."
        break
      case "NEW_LOCATION_DETECTED":
        title = "Sign-In from New Location"
        description = `Sign-in detected from ${meta.city || "new location"}${meta.country ? `, ${meta.country}` : ""}.`
        break
      case "NEW_DEVICE_DETECTED":
        title = "Sign-In from New Device"
        description = "Sign-in attempt from a new unrecognized device."
        break
      // Phase 10: Security Alerts, Suspicious Activity & Account Protection
      case "SECURITY_ALERT_CREATED":
        title = meta.alertTitle || "Security Alert Created"
        description = meta.alertMessage || `Security alert (${meta.alertType || "NOTICE"}) was generated.`
        break
      case "ALERT_READ":
        title = "Security Alert Viewed"
        description = `Viewed security alert: ${meta.alertTitle || meta.alertType || "Alert"}.`
        break
      case "ALERT_CONFIRMED":
        title = "Security Alert Confirmed"
        description = `Confirmed recognized activity ("This Was Me").`
        break
      case "SUSPICIOUS_ACTIVITY_REPORTED":
        title = "Suspicious Activity Reported"
        description = `Reported unrecognized activity ("Not Me"). Associated session was revoked and protection applied.`
        break
      case "ACCOUNT_PROTECTION_ACTIVATED":
      case "ACCOUNT_PROTECTION_ENABLED":
        title = "Account Protection Activated"
        description = meta.reason ? `Account protection set to ${meta.newState || "PROTECTED"}: ${meta.reason}.` : "Account protection was enabled and remote sessions were secured."
        break
      case "ACCOUNT_PROTECTION_REMOVED":
        title = "Account Protection Restored"
        description = "Account security state was restored to normal."
        break
      case "SECURITY_NOTIFICATION_SENT":
        title = "Security Notice Dispatched"
        description = `Security notice sent via ${meta.channel || "email"}.`
        break
      case "SECURITY_NOTIFICATION_FAILED":
        title = "Security Notice Delivery Issue"
        description = `Failed to deliver security notice via ${meta.channel || "email"}.`
        break
      case "FAILED_LOGIN_THRESHOLD":
        title = "Excessive Failed Login Attempts"
        description = `Multiple failed sign-in attempts were detected within 15 minutes.`
        break
      case "FAILED_OTP_THRESHOLD":
        title = "Excessive Failed Security Codes"
        description = `Multiple invalid verification codes submitted within 30 minutes.`
        break
      case "REFRESH_TOKEN_REUSE":
        title = "Critical Token Replay Detected"
        description = "A previously invalidated session token was resubmitted. Session terminated immediately."
        break
      default:
        title = event.eventType.replace(/_/g, " ").toLowerCase()
        title = title.charAt(0).toUpperCase() + title.slice(1)
        description = `Event ${event.eventType} occurred.`
        break
    }

    return {
      id: event._id.toString(),
      _id: event._id.toString(),
      eventType: event.eventType,
      title,
      description,
      severity: event.severity || "LOW",
      ip: event.ip ? (event.ip.includes("*") ? event.ip : maskIPAddress(event.ip)) : "Unknown IP",
      metadata: meta,
      timestamp: event.timestamp || event.createdAt,
    }
  }

  /**
   * Records an explicit security activity event.
   */
  async recordSecurityActivity({
    userId,
    eventType,
    severity = TRUSTED_DEVICE_CONFIG.severity.LOW,
    metadata = {},
    ip = null,
  }) {
    if (!userId || !eventType) return null

    try {
      const maskedIp = ip ? (ip.includes("*") ? ip : maskIPAddress(ip)) : null
      const event = await SecurityEvent.create({
        eventType,
        userId: userId.toString(),
        severity,
        metadata,
        ip: maskedIp,
        timestamp: new Date(),
      })
      return event
    } catch (err) {
      console.error("[SecurityActivityService] Error recording security activity:", err)
      return null
    }
  }

  /**
   * Retrieves paginated security activity events for an authenticated user.
   */
  async getSecurityActivity(userId, { page = 1, limit = 30, severity = null } = {}) {
    if (!userId) return { activities: [], total: 0, page: 1, totalPages: 0 }

    try {
      const pageNum = Math.max(1, parseInt(page, 10) || 1)
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 30))
      const skip = (pageNum - 1) * limitNum

      const query = { userId: userId.toString() }
      if (severity && ["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(severity)) {
        query.severity = severity
      }

      const [items, total] = await Promise.all([
        SecurityEvent.find(query)
          .sort({ timestamp: -1, createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        SecurityEvent.countDocuments(query),
      ])

      const activities = items.map((item) => this.formatActivity(item))

      return {
        activities,
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum) || 1,
      }
    } catch (err) {
      console.error("[SecurityActivityService] Error fetching security activity:", err)
      return { activities: [], total: 0, page: 1, totalPages: 0 }
    }
  }
}

export const securityActivityService = new SecurityActivityService()
export default securityActivityService
