/**
 * OTP Configuration (Phase 7)
 *
 * Centralized settings for OTP generation, expiration, rate limiting, and hashing.
 */

export const OTP_CONFIG = {
  length: parseInt(process.env.OTP_LENGTH, 10) || 6,
  expiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES, 10) || 5,
  expirySeconds: (parseInt(process.env.OTP_EXPIRY_MINUTES, 10) || 5) * 60,
  maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS, 10) || 5,
  resendCooldownSeconds: parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS, 10) || 60,
  maxResends: parseInt(process.env.OTP_MAX_RESENDS, 10) || 3,
  pendingLoginExpiryMinutes: parseInt(process.env.PENDING_LOGIN_EXPIRY_MINUTES, 10) || 10,
  otpSecret: process.env.OTP_SECRET || "youtube_clone_super_secure_otp_secret_key_2026",
  purposes: {
    LOGIN_VERIFICATION: "LOGIN_VERIFICATION",
    EMAIL_VERIFICATION: "EMAIL_VERIFICATION",
    PASSWORD_RESET: "PASSWORD_RESET",
    MOBILE_VERIFICATION: "MOBILE_VERIFICATION",
    ACCOUNT_RECOVERY: "ACCOUNT_RECOVERY",
  },
  deliveryMethods: {
    EMAIL: "EMAIL",
    SMS: "SMS",
  },
  eventTypes: {
    OTP_SENT: "OTP_SENT",
    OTP_RESENT: "OTP_RESENT",
    OTP_SEND_FAILED: "OTP_SEND_FAILED",
    OTP_VERIFY_SUCCESS: "OTP_VERIFY_SUCCESS",
    OTP_VERIFY_FAILED: "OTP_VERIFY_FAILED",
    OTP_EXPIRED: "OTP_EXPIRED",
    OTP_LOCKED: "OTP_LOCKED",
    LOGIN_VERIFIED: "LOGIN_VERIFIED",
  },
}

export default OTP_CONFIG
