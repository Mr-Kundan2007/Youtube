/**
 * Security Alert Configuration (Phase 10)
 *
 * Centralized constants, severities, delivery statuses, protection states,
 * attempt thresholds, duplicate suppression windows, and rate limits.
 */

export const SECURITY_ALERT_CONFIG = {
  // Alert Severities
  severities: {
    LOW: "LOW",
    MEDIUM: "MEDIUM",
    HIGH: "HIGH",
    CRITICAL: "CRITICAL",
  },

  // Alert Lifecycle Statuses
  statuses: {
    UNREAD: "UNREAD",
    READ: "READ",
    ACTION_REQUIRED: "ACTION_REQUIRED",
    RESOLVED: "RESOLVED",
    DISMISSED: "DISMISSED",
    EXPIRED: "EXPIRED",
  },

  // User Security Action Responses
  actionStatuses: {
    NONE: "NONE",
    PENDING: "PENDING",
    CONFIRMED: "CONFIRMED",
    REPORTED: "REPORTED",
    DISMISSED: "DISMISSED",
  },

  // Account Protection States
  protectionStates: {
    NORMAL: "NORMAL",
    MONITORING: "MONITORING",
    PROTECTED: "PROTECTED",
    TEMPORARILY_RESTRICTED: "TEMPORARILY_RESTRICTED",
    SECURITY_REVIEW: "SECURITY_REVIEW",
  },

  // Standardized Alert Types
  types: {
    NEW_DEVICE_LOGIN: "NEW_DEVICE_LOGIN",
    NEW_BROWSER_LOGIN: "NEW_BROWSER_LOGIN",
    NEW_IP_LOGIN: "NEW_IP_LOGIN",
    NEW_CITY_LOGIN: "NEW_CITY_LOGIN",
    NEW_STATE_LOGIN: "NEW_STATE_LOGIN",
    NEW_COUNTRY_LOGIN: "NEW_COUNTRY_LOGIN",
    SUSPICIOUS_LOGIN: "SUSPICIOUS_LOGIN",
    FAILED_LOGIN_THRESHOLD: "FAILED_LOGIN_THRESHOLD",
    FAILED_OTP_THRESHOLD: "FAILED_OTP_THRESHOLD",
    TRUSTED_DEVICE_SUSPENDED: "TRUSTED_DEVICE_SUSPENDED",
    SESSION_REVOKED: "SESSION_REVOKED",
    SESSION_REMOTE_LOGOUT: "SESSION_REMOTE_LOGOUT",
    ALL_SESSIONS_LOGGED_OUT: "ALL_SESSIONS_LOGGED_OUT",
    REFRESH_TOKEN_REUSE: "REFRESH_TOKEN_REUSE",
    PASSWORD_CHANGED: "PASSWORD_CHANGED",
    EMAIL_CHANGED: "EMAIL_CHANGED",
    PHONE_CHANGED: "PHONE_CHANGED",
    SECURITY_SETTINGS_CHANGED: "SECURITY_SETTINGS_CHANGED",
    ACCOUNT_PROTECTION_TRIGGERED: "ACCOUNT_PROTECTION_TRIGGERED",
  },

  // Delivery Channels
  channels: {
    IN_APP: "inApp",
    EMAIL: "email",
    SMS: "sms",
  },

  // Delivery Statuses
  deliveryStatuses: {
    NOT_REQUESTED: "NOT_REQUESTED",
    PENDING: "PENDING",
    SENT: "SENT",
    DELIVERED: "DELIVERED",
    FAILED: "FAILED",
  },

  // Thresholds & Windows
  failedLoginAlertThreshold: parseInt(process.env.FAILED_LOGIN_ALERT_THRESHOLD || "5", 10),
  failedLoginWindowMinutes: parseInt(process.env.FAILED_LOGIN_WINDOW_MINUTES || "15", 10),

  failedOtpAlertThreshold: parseInt(process.env.FAILED_OTP_ALERT_THRESHOLD || "5", 10),
  failedOtpWindowMinutes: parseInt(process.env.FAILED_OTP_WINDOW_MINUTES || "30", 10),

  // Duplicate notification storm prevention window
  duplicateAlertWindowMinutes: parseInt(process.env.SECURITY_ALERT_DUPLICATE_WINDOW_MINUTES || "10", 10),

  // Rate Limiting
  maxSecurityEmailsPerHour: parseInt(process.env.MAX_SECURITY_EMAILS_PER_HOUR || "10", 10),
  maxSecuritySmsPerHour: parseInt(process.env.MAX_SECURITY_SMS_PER_HOUR || "3", 10),
  maxNotificationRetries: parseInt(process.env.SECURITY_NOTIFICATION_MAX_RETRIES || "3", 10),

  // Retention
  alertRetentionDays: parseInt(process.env.SECURITY_ALERT_RETENTION_DAYS || "365", 10),
}

export default SECURITY_ALERT_CONFIG
