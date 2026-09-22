/**
 * Pending Login Service (Phase 6)
 *
 * Manages unverified login states requiring secondary verification.
 * Creates short-lived pending login challenges (10-minute TTL) and prevents
 * session token issuance until verification has been satisfied.
 */

import crypto from "crypto"
import PendingLogin from "../Modals/PendingLogin.js"
import { maskIPAddress } from "../utils/comparisonUtils.js"
import { SECURITY_POLICIES } from "../config/securityRiskConfig.js"

export class PendingLoginService {
  /**
   * Creates a new PendingLogin record for an unverified access attempt.
   */
  async createPendingLogin({ userId, userEmail, loginContext = {}, securityDecision = {} }) {
    try {
      const pendingLoginId = crypto.randomUUID()
      const clientIp =
        loginContext.network?.ipAddress ||
        loginContext.clientIp ||
        loginContext.network?.ip?.address ||
        ""

      const maskedIP = maskIPAddress(clientIp)
      const expiresAt = new Date(Date.now() + SECURITY_POLICIES.PENDING_LOGIN_TTL_MS)

      const pendingRecord = await PendingLogin.create({
        pendingLoginId,
        userId,
        userEmail: userEmail || "",
        loginContext,
        securityDecision: {
          decision: securityDecision.decision || "VERIFICATION_REQUIRED",
          riskScore: securityDecision.riskScore || 0,
          riskLevel: securityDecision.riskLevel || "MEDIUM",
          reasons: securityDecision.reasons || [],
          isInitialBaseline: Boolean(securityDecision.isInitialBaseline),
        },
        securitySignals: securityDecision.signals || {},
        maskedIP,
        status: "PENDING",
        expiresAt,
      })

      return pendingRecord
    } catch (err) {
      console.error("[PendingLoginService] Error creating pending login:", err)
      throw err
    }
  }

  /**
   * Retrieves a pending login record by ID, validating TTL freshness.
   */
  async getPendingLogin(pendingLoginId) {
    if (!pendingLoginId) return null

    try {
      const pending = await PendingLogin.findOne({ pendingLoginId })
      if (!pending) return null

      // Check for expiration
      if (new Date() > pending.expiresAt && pending.status === "PENDING") {
        pending.status = "EXPIRED"
        await pending.save()
        return null
      }

      return pending
    } catch (err) {
      console.error("[PendingLoginService] Error retrieving pending login:", err)
      return null
    }
  }

  /**
   * Marks a pending login as successfully verified.
   */
  async markVerified(pendingLoginId) {
    if (!pendingLoginId) return null

    try {
      const pending = await PendingLogin.findOne({ pendingLoginId })
      if (!pending) return null

      pending.status = "VERIFIED"
      pending.verifiedAt = new Date()
      await pending.save()
      return pending
    } catch (err) {
      console.error("[PendingLoginService] Error marking pending login verified:", err)
      return null
    }
  }
}

export const pendingLoginService = new PendingLoginService()
export default pendingLoginService
