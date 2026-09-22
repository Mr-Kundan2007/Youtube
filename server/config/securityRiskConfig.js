/**
 * Security Risk Configuration (Phase 6)
 *
 * Centralized risk weights, thresholds, limits, and decision rules for
 * login security comparison and verification.
 */

export const RISK_WEIGHTS = {
  NEW_DEVICE: 40,
  NEW_COUNTRY: 40,
  NEW_BROWSER: 25,
  NEW_STATE: 20,
  NEW_CITY: 10,
  NEW_IP: 10,
}

export const RISK_LEVEL_THRESHOLDS = {
  LOW: { min: 0, max: 24 },
  MEDIUM: { min: 25, max: 59 },
  HIGH: { min: 60, max: Infinity },
}

export const BASELINE_LIMITS = {
  MAX_VERIFIED_BROWSERS: 10,
  MAX_VERIFIED_DEVICES: 10,
  MAX_VERIFIED_IPS: 20,
  MAX_VERIFIED_LOCATIONS: 10,
}

export const SECURITY_POLICIES = {
  // TTL for pending verification login attempts (in milliseconds)
  PENDING_LOGIN_TTL_MS: 10 * 60 * 1000, // 10 minutes
  PENDING_LOGIN_TTL_SECONDS: 10 * 60, // 600 seconds

  // Mandatory verification triggers: any of these signals force VERIFICATION_REQUIRED
  MANDATORY_VERIFICATION_SIGNALS: [
    "isNewBrowser",
    "isNewDevice",
    "isNewIP",
    "isNewCity",
    "isNewState",
    "isNewCountry",
  ],

  // Decisions
  DECISIONS: {
    ALLOW: "ALLOW",
    VERIFICATION_REQUIRED: "VERIFICATION_REQUIRED",
    HIGH_RISK: "HIGH_RISK",
  },
}

export default {
  RISK_WEIGHTS,
  RISK_LEVEL_THRESHOLDS,
  BASELINE_LIMITS,
  SECURITY_POLICIES,
}
