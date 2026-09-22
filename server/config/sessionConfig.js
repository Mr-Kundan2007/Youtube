/**
 * Active Session Management Configuration (Phase 9)
 *
 * Centralized settings for token lifetimes, session duration, capacity limits,
 * activity update throttling, statuses, and security event types.
 */

export const SESSION_CONFIG = {
  // Token Lifetimes (defaults to 24 hours for stable user experience)
  accessTokenExpiryMinutes: parseInt(process.env.ACCESS_TOKEN_EXPIRY_MINUTES, 10) || 1440,
  refreshTokenExpiryDays: parseInt(process.env.REFRESH_TOKEN_EXPIRY_DAYS, 10) || 30,
  sessionExpiryDays: parseInt(process.env.SESSION_EXPIRY_DAYS, 10) || 30,

  // Capacity Limits & Throttling
  sessionMaxPerUser: parseInt(process.env.SESSION_MAX_PER_USER, 10) || 10,
  sessionActivityUpdateMinutes: parseInt(process.env.SESSION_ACTIVITY_UPDATE_MINUTES, 10) || 5,
  sessionIdleTimeoutDays: parseInt(process.env.SESSION_IDLE_TIMEOUT_DAYS, 10) || 7,
  sensitiveActionAuthMinutes: parseInt(process.env.SENSITIVE_ACTION_AUTH_MINUTES, 10) || 10,
  logoutAllOnPasswordChange: process.env.LOGOUT_ALL_ON_PASSWORD_CHANGE !== "false",

  // Session Status Enum
  status: {
    ACTIVE: "ACTIVE",
    EXPIRED: "EXPIRED",
    TERMINATED: "TERMINATED",
    REVOKED: "REVOKED",
  },

  // Logout Reasons
  logoutReason: {
    USER_LOGOUT: "USER_LOGOUT",
    USER_REMOTE_LOGOUT: "USER_REMOTE_LOGOUT",
    LOGOUT_OTHERS: "LOGOUT_OTHERS",
    LOGOUT_ALL: "LOGOUT_ALL",
    SESSION_LIMIT_REACHED: "SESSION_LIMIT_REACHED",
    SECURITY_REVOCATION: "SECURITY_REVOCATION",
    PASSWORD_CHANGE: "PASSWORD_CHANGE",
    IDLE_TIMEOUT: "IDLE_TIMEOUT",
  },

  // Security Event Types
  eventTypes: {
    SESSION_CREATED: "SESSION_CREATED",
    SESSION_TERMINATED: "SESSION_TERMINATED",
    SESSION_REVOKED: "SESSION_REVOKED",
    SESSION_EXPIRED: "SESSION_EXPIRED",
    SESSION_REMOTE_LOGOUT: "SESSION_REMOTE_LOGOUT",
    SESSION_LOGOUT_ALL: "SESSION_LOGOUT_ALL",
    SESSION_LOGOUT_OTHERS: "SESSION_LOGOUT_OTHERS",
    SESSION_LIMIT_REACHED: "SESSION_LIMIT_REACHED",
    SESSION_AUTO_TERMINATED: "SESSION_AUTO_TERMINATED",
    REFRESH_TOKEN_REUSED: "REFRESH_TOKEN_REUSED",
    REFRESH_TOKEN_ROTATED: "REFRESH_TOKEN_ROTATED",
  },
}

export default SESSION_CONFIG
