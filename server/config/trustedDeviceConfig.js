/**
 * Trusted Device & Account Security Configuration (Phase 8)
 *
 * Centralized settings for trusted device management, trust expiration,
 * device limits per user, login history, and security event severities.
 */

export const TRUSTED_DEVICE_CONFIG = {
  enabled: process.env.TRUSTED_DEVICE_ENABLED !== "false",
  durationDays: parseInt(process.env.TRUSTED_DEVICE_DURATION_DAYS, 10) || 30,
  maxPerUser: parseInt(process.env.TRUSTED_DEVICE_MAX_PER_USER, 10) || 10,
  autoTrustAfterOTP: process.env.TRUSTED_DEVICE_AUTO_TRUST_AFTER_OTP !== "false",
  loginHistoryRetentionDays: parseInt(process.env.LOGIN_HISTORY_RETENTION_DAYS, 10) || 365,
  securityEventRetentionDays: parseInt(process.env.SECURITY_EVENT_RETENTION_DAYS, 10) || 365,

  status: {
    ACTIVE: "ACTIVE",
    EXPIRED: "EXPIRED",
    REVOKED: "REVOKED",
    SUSPENDED: "SUSPENDED",
  },

  loginStatus: {
    SUCCESS: "SUCCESS",
    FAILED: "FAILED",
    OTP_REQUIRED: "OTP_REQUIRED",
    OTP_FAILED: "OTP_FAILED",
    BLOCKED: "BLOCKED",
    EXPIRED: "EXPIRED",
  },

  severity: {
    LOW: "LOW",
    MEDIUM: "MEDIUM",
    HIGH: "HIGH",
    CRITICAL: "CRITICAL",
  },

  eventTypes: {
    TRUSTED_DEVICE_CREATED: "TRUSTED_DEVICE_CREATED",
    TRUSTED_DEVICE_UPDATED: "TRUSTED_DEVICE_UPDATED",
    TRUSTED_DEVICE_REVOKED: "TRUSTED_DEVICE_REVOKED",
    TRUSTED_DEVICE_RENAMED: "TRUSTED_DEVICE_RENAMED",
    TRUSTED_DEVICE_EXPIRED: "TRUSTED_DEVICE_EXPIRED",
    TRUSTED_DEVICE_SUSPENDED: "TRUSTED_DEVICE_SUSPENDED",
    LOGIN_SUCCESS: "LOGIN_SUCCESS",
    LOGIN_FAILED: "LOGIN_FAILED",
    LOGIN_BLOCKED: "LOGIN_BLOCKED",
    LOGIN_OTP_REQUIRED: "LOGIN_OTP_REQUIRED",
    NEW_DEVICE_DETECTED: "NEW_DEVICE_DETECTED",
    NEW_COUNTRY_DETECTED: "NEW_COUNTRY_DETECTED",
  },
}

export default TRUSTED_DEVICE_CONFIG
