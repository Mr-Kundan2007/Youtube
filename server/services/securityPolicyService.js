import { downloadSecurityConfig } from "../config/index.js"

/**
 * Service evaluating security policies, risk level thresholds, and security decisions.
 */
export class SecurityPolicyService {
  constructor(config = downloadSecurityConfig) {
    this.config = config
  }

  /**
   * Resolves categorical risk level from numerical risk score.
   */
  getRiskLevel(score = 0) {
    const s = Number(score) || 0
    const thresholds = this.config?.riskThresholds || {
      low: 20,
      medium: 50,
      high: 75,
      critical: 76,
    }

    if (s <= thresholds.low) return "low"
    if (s <= thresholds.medium) return "medium"
    if (s <= thresholds.high) return "high"
    return "critical"
  }

  /**
   * Evaluates security policy and produces a standardized security decision object.
   */
  evaluateSecurityPolicy({ riskScore = 0, activeRestriction = null, flags = [], metadata = {} } = {}) {
    const score = Math.max(0, Number(riskScore) || 0)
    const riskLevel = this.getRiskLevel(score)

    // 1. Explicit active restriction check
    if (activeRestriction) {
      return {
        allowed: false,
        action: "BLOCK",
        riskLevel: "high",
        riskScore: score,
        flags: [...flags, "RESTRICTION_ACTIVE"],
        reason: "DOWNLOAD_RESTRICTED",
        message: activeRestriction.reason || "Download access is restricted on this account or device.",
        restrictionId: activeRestriction._id || activeRestriction.id,
        expiresAt: activeRestriction.expiresAt,
      }
    }

    // 2. Critical risk threshold reached -> automated temporary restriction
    if (riskLevel === "critical" || score > 75) {
      return {
        allowed: false,
        action: "TEMPORARY_RESTRICT",
        riskLevel: "critical",
        riskScore: score,
        flags: [...flags, "CRITICAL_RISK_THRESHOLD"],
        reason: "DOWNLOAD_RESTRICTED",
        message: "Download access temporarily restricted due to suspicious activity.",
        shouldRestrict: true,
      }
    }

    // 3. Medium or High risk -> Allow request but flag and audit
    if (score > 20 || (flags && flags.length > 0)) {
      return {
        allowed: true,
        action: "ALLOW_AND_FLAG",
        riskLevel,
        riskScore: score,
        flags,
        metadata,
      }
    }

    // 4. Normal request -> Low risk allowed
    return {
      allowed: true,
      action: "ALLOW",
      riskLevel: "low",
      riskScore: score,
      flags: [],
    }
  }
}

export const securityPolicyService = new SecurityPolicyService()
export default securityPolicyService
