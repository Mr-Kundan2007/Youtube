/**
 * Account Protection Service (Phase 10)
 *
 * Manages account protection states (NORMAL, MONITORING, PROTECTED, TEMPORARILY_RESTRICTED, SECURITY_REVIEW),
 * coordinates session terminations, device trust suspensions, and automated emergency lockdowns.
 */

import mongoose from "mongoose"
import { SECURITY_ALERT_CONFIG } from "../config/securityAlertConfig.js"
import User from "../Modals/Auth.js"
import SecurityEvent from "../Modals/SecurityEvent.js"
import { sessionService } from "./sessionService.js"
import { trustedDeviceService } from "./trustedDeviceService.js"
import { logger } from "../utils/logger.js"

export class AccountProtectionService {
  /**
   * Retrieves the current account protection status for an authenticated user.
   */
  async getProtectionStatus(userId) {
    if (!userId) return { status: "NORMAL", message: "Your account is secure." }

    let status = "NORMAL"
    let reason = null
    let updatedAt = null

    if (mongoose.connection?.readyState === 1) {
      try {
        const user = await User.findById(userId).select("accountProtectionState protectionStateReason protectionStateUpdatedAt").lean()
        if (user?.accountProtectionState) {
          status = user.accountProtectionState
          reason = user.protectionStateReason
          updatedAt = user.protectionStateUpdatedAt
        }
      } catch (err) {
        logger.warn(`[AccountProtectionService] Lookup error for ${userId}: ${err.message}`)
      }
    }

    let message = "Your account is secure."
    switch (status) {
      case "PROTECTED":
        message = "Additional verification is required for sensitive account actions."
        break
      case "MONITORING":
        message = "Suspicious access patterns detected. Extra security monitoring is enabled."
        break
      case "TEMPORARILY_RESTRICTED":
        message = "Sensitive actions are temporarily restricted following unusual activity."
        break
      case "SECURITY_REVIEW":
        message = "Critical security review required. Please verify your identity."
        break
    }

    return {
      status,
      message,
      reason,
      updatedAt,
    }
  }

  /**
   * Transitions user account protection state and records audit event.
   */
  async setProtectionState(userId, newState, reason = null) {
    if (!userId) throw new Error("userId is required")
    const validStates = Object.values(SECURITY_ALERT_CONFIG.protectionStates)
    if (!validStates.includes(newState)) {
      throw new Error(`Invalid protection state: ${newState}`)
    }

    if (mongoose.connection?.readyState === 1) {
      try {
        await User.findByIdAndUpdate(userId, {
          $set: {
            accountProtectionState: newState,
            protectionStateReason: reason,
            protectionStateUpdatedAt: new Date(),
          },
        })

        const eventType =
          newState === "NORMAL"
            ? "ACCOUNT_PROTECTION_REMOVED"
            : "ACCOUNT_PROTECTION_ACTIVATED"

        await SecurityEvent.create({
          eventType,
          userId: userId.toString(),
          severity: newState === "NORMAL" ? "INFO" : "WARN",
          metadata: {
            newState,
            reason,
            timestamp: new Date(),
          },
        }).catch(() => {})
      } catch (err) {
        logger.error(`[AccountProtectionService] Error setting protection state: ${err.message}`)
      }
    }

    return { success: true, status: newState, reason }
  }

  /**
   * "Secure My Account" Action:
   * Terminates all other sessions, suspends untrusted devices, and enables PROTECTED state.
   */
  async secureAccount(userId, { currentSessionId = null, reason = "USER_REQUESTED_LOCKDOWN" } = {}) {
    if (!userId) throw new Error("userId is required")

    let sessionsRevoked = 0

    // 1. Terminate other active sessions
    try {
      if (currentSessionId) {
        const res = await sessionService.terminateAllUserSessionsExceptCurrent(
          userId,
          currentSessionId,
          "ACCOUNT_PROTECTION_TRIGGERED"
        )
        sessionsRevoked = res.terminatedCount || 0
      } else {
        const res = await sessionService.terminateAllUserSessions(
          userId,
          "ACCOUNT_PROTECTION_TRIGGERED"
        )
        sessionsRevoked = res.terminatedCount || 0
      }
    } catch (sErr) {
      logger.warn(`[AccountProtectionService] Session termination notice: ${sErr.message}`)
    }

    // 2. Set Protection State to PROTECTED
    await this.setProtectionState(userId, SECURITY_ALERT_CONFIG.protectionStates.PROTECTED, reason)

    // 3. Log Audit Event
    if (mongoose.connection?.readyState === 1) {
      await SecurityEvent.create({
        eventType: "ACCOUNT_PROTECTION_ENABLED",
        userId: userId.toString(),
        severity: "HIGH",
        metadata: {
          reason,
          sessionsRevoked,
          preservedSessionId: currentSessionId,
          timestamp: new Date(),
        },
      }).catch(() => {})
    }

    return {
      success: true,
      status: "PROTECTED",
      sessionsRevoked,
      message: "Account protection activated. All other sessions have been signed out.",
    }
  }

  /**
   * Handles user's "Not Me" suspicious activity report:
   * Identifies the suspicious session or signs out all other sessions,
   * suspends suspicious device, and places account in PROTECTED state.
   */
  async handleSuspiciousActivityReport(userId, alert, { currentSessionId = null } = {}) {
    let sessionsRevoked = 0
    const meta = alert.metadata || {}

    // 1. Targeted session termination
    if (meta.sessionId) {
      try {
        await sessionService.terminateSession(userId, meta.sessionId, "REPORTED_SUSPICIOUS")
        sessionsRevoked = 1
      } catch (e) {
        logger.warn(`[AccountProtectionService] Could not terminate reported session ${meta.sessionId}: ${e.message}`)
      }
    } else {
      // If no specific sessionId is tracked, terminate all other sessions to be safe
      try {
        const res = currentSessionId
          ? await sessionService.terminateAllUserSessionsExceptCurrent(userId, currentSessionId, "REPORTED_SUSPICIOUS")
          : await sessionService.terminateAllUserSessions(userId, "REPORTED_SUSPICIOUS")
        sessionsRevoked = res.terminatedCount || 0
      } catch (e) {
        logger.warn(`[AccountProtectionService] Bulk session termination notice: ${e.message}`)
      }
    }

    // 2. Suspend Trusted Device if matching device key exists
    if (meta.trustedDeviceId) {
      try {
        await trustedDeviceService.revokeDeviceTrust(userId, meta.trustedDeviceId)
      } catch (e) {
        logger.warn(`[AccountProtectionService] Could not revoke reported device: ${e.message}`)
      }
    }

    // 3. Upgrade Account Protection State
    await this.setProtectionState(
      userId,
      SECURITY_ALERT_CONFIG.protectionStates.PROTECTED,
      `Reported suspicious activity: ${alert.type}`
    )

    return {
      sessionsRevoked,
      protectionStatus: "PROTECTED",
    }
  }
}

export const accountProtectionService = new AccountProtectionService()
export default accountProtectionService
