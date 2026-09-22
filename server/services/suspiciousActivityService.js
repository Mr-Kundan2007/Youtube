/**
 * Suspicious Activity Detection Service (Phase 10)
 *
 * Monitors authentication events, tracks failed login/OTP attempt thresholds,
 * detects new login environments and locations, and creates prioritized security alerts.
 */

import mongoose from "mongoose"
import { SECURITY_ALERT_CONFIG } from "../config/securityAlertConfig.js"
import { securityAlertService } from "./securityAlertService.js"
import { accountProtectionService } from "./accountProtectionService.js"
import SecurityEvent from "../Modals/SecurityEvent.js"
import PendingLogin from "../Modals/PendingLogin.js"
import { maskIPAddress } from "../utils/comparisonUtils.js"
import { logger } from "../utils/logger.js"

export class SuspiciousActivityService {
  constructor() {
    // Failure tracking maps: key -> [timestamps]
    this.failedLogins = new Map()
    this.failedOTPs = new Map()
  }

  /**
   * Tracks failed login attempts and triggers FAILED_LOGIN_THRESHOLD alerts when exceeded.
   */
  async trackFailedLogin({ email = null, userId = null, ip = null, loginContext = {}, reason = "INVALID_CREDENTIALS" }) {
    const trackerKey = (userId ? userId.toString() : null) || email || ip || "unknown"
    const now = Date.now()
    const windowMs = SECURITY_ALERT_CONFIG.failedLoginWindowMinutes * 60 * 1000

    const timestamps = (this.failedLogins.get(trackerKey) || []).filter((ts) => ts > now - windowMs)
    timestamps.push(now)
    this.failedLogins.set(trackerKey, timestamps)

    const count = timestamps.length
    const threshold = SECURITY_ALERT_CONFIG.failedLoginAlertThreshold

    if (count >= threshold) {
      logger.warn(`[SuspiciousActivityService] Failed login threshold reached for ${trackerKey} (${count} attempts)`)

      if (userId) {
        // Create HIGH priority alert
        await securityAlertService.createAlert({
          userId,
          type: SECURITY_ALERT_CONFIG.types.FAILED_LOGIN_THRESHOLD,
          severity: SECURITY_ALERT_CONFIG.severities.HIGH,
          title: "Multiple Failed Sign-In Attempts",
          message: `${count} failed sign-in attempts were recorded on your account within ${SECURITY_ALERT_CONFIG.failedLoginWindowMinutes} minutes.`,
          actionRequired: true,
          metadata: {
            attemptCount: count,
            windowMinutes: SECURITY_ALERT_CONFIG.failedLoginWindowMinutes,
            maskedIP: ip ? maskIPAddress(ip) : "Unknown IP",
            device: loginContext?.device?.hardware?.type || "Unknown Device",
            browser: loginContext?.device?.browser?.name || "Unknown Browser",
            timestamp: new Date(),
          },
        })

        // Place account in MONITORING or PROTECTED state
        await accountProtectionService.setProtectionState(
          userId,
          SECURITY_ALERT_CONFIG.protectionStates.MONITORING,
          "Multiple failed sign-in attempts"
        )
      }

      if (mongoose.connection?.readyState === 1 && userId) {
        await SecurityEvent.create({
          eventType: "FAILED_LOGIN_THRESHOLD",
          userId: userId.toString(),
          severity: "WARN",
          metadata: { count, threshold, trackerKey },
        }).catch(() => {})
      }

      return { thresholdReached: true, count }
    }

    return { thresholdReached: false, count }
  }

  /**
   * Tracks failed OTP verification attempts and triggers FAILED_OTP_THRESHOLD alerts when exceeded.
   */
  async trackFailedOTP({ userId, pendingLoginId, reason = "INVALID_OTP" }) {
    if (!userId) return { thresholdReached: false, count: 0 }

    const trackerKey = userId.toString()
    const now = Date.now()
    const windowMs = SECURITY_ALERT_CONFIG.failedOtpWindowMinutes * 60 * 1000

    const timestamps = (this.failedOTPs.get(trackerKey) || []).filter((ts) => ts > now - windowMs)
    timestamps.push(now)
    this.failedOTPs.set(trackerKey, timestamps)

    const count = timestamps.length
    const threshold = SECURITY_ALERT_CONFIG.failedOtpAlertThreshold

    if (count >= threshold) {
      logger.warn(`[SuspiciousActivityService] Failed OTP threshold reached for user ${trackerKey} (${count} attempts)`)

      // Suspend Pending Login challenge
      if (pendingLoginId && mongoose.connection?.readyState === 1) {
        try {
          await PendingLogin.findOneAndUpdate(
            { pendingLoginId, status: "PENDING" },
            { $set: { status: "SUSPENDED" } }
          )
        } catch (e) {
          logger.warn(`[SuspiciousActivityService] Could not suspend pending login: ${e.message}`)
        }
      }

      // Create HIGH priority alert
      await securityAlertService.createAlert({
        userId,
        type: SECURITY_ALERT_CONFIG.types.FAILED_OTP_THRESHOLD,
        severity: SECURITY_ALERT_CONFIG.severities.HIGH,
        title: "Multiple Failed Security Verification Codes",
        message: `${count} consecutive invalid verification codes were entered. The active sign-in challenge has been suspended for security.`,
        actionRequired: true,
        metadata: {
          attemptCount: count,
          pendingLoginId,
          windowMinutes: SECURITY_ALERT_CONFIG.failedOtpWindowMinutes,
          timestamp: new Date(),
        },
      })

      // Set account to MONITORING
      await accountProtectionService.setProtectionState(
        userId,
        SECURITY_ALERT_CONFIG.protectionStates.MONITORING,
        "Repeated OTP verification failures"
      )

      if (mongoose.connection?.readyState === 1) {
        await SecurityEvent.create({
          eventType: "FAILED_OTP_THRESHOLD",
          userId: userId.toString(),
          severity: "WARN",
          metadata: { count, threshold, pendingLoginId },
        }).catch(() => {})
      }

      return { thresholdReached: true, count }
    }

    return { thresholdReached: false, count }
  }

  /**
   * Evaluates post-login environment and signals to create appropriate security alerts.
   */
  async evaluatePostLoginAlerts({ user, loginContext = {}, securityDecision = {}, sessionId = null, trustedDevice = null }) {
    if (!user || !user._id) return null

    const userId = user._id
    const signals = securityDecision.signals || {}
    const isInitial = securityDecision.isInitialBaseline

    // Initial baseline login creates no noisy alerts
    if (isInitial) {
      return null
    }

    const browserName =
      loginContext.device?.browser?.name ||
      loginContext.browser?.name ||
      "Web Browser"
    const deviceType =
      loginContext.device?.hardware?.type ||
      loginContext.device?.type ||
      "Device"
    const osName =
      loginContext.device?.os?.name ||
      loginContext.device?.os ||
      ""
    const deviceDesc = osName ? `${deviceType} (${osName})` : deviceType

    const rawLocation = loginContext.network?.location || {}
    const locationParts = [rawLocation.city, rawLocation.state, rawLocation.country].filter(Boolean)
    const locationString = locationParts.length > 0 ? locationParts.join(", ") : "Unknown Location"

    const maskedIP =
      loginContext.network?.ip?.masked ||
      loginContext.maskedIP ||
      (loginContext.network?.ipAddress ? maskIPAddress(loginContext.network.ipAddress) : "xxx.xxx.xxx.xxx")

    const safeMeta = {
      browser: browserName,
      device: deviceDesc,
      location: locationString,
      maskedIP,
      sessionId,
      trustedDeviceId: trustedDevice?._id || trustedDevice?.id || null,
      deviceComparisonKey: loginContext.device?.comparisonKey || null,
      timestamp: new Date(),
    }

    // 1. High Risk or Suspicious Login
    if (securityDecision.riskLevel === "CRITICAL" || securityDecision.riskScore >= 60) {
      return securityAlertService.createAlert({
        userId,
        type: SECURITY_ALERT_CONFIG.types.SUSPICIOUS_LOGIN,
        severity: SECURITY_ALERT_CONFIG.severities.HIGH,
        title: "Suspicious Sign-In Detected",
        message: `A sign-in attempt from ${browserName} in ${locationString} was flagged with elevated risk factors.`,
        actionRequired: true,
        metadata: safeMeta,
      })
    }

    // 2. New Country Login (HIGH)
    if (signals.isNewCountry) {
      return securityAlertService.createAlert({
        userId,
        type: SECURITY_ALERT_CONFIG.types.NEW_COUNTRY_LOGIN,
        severity: SECURITY_ALERT_CONFIG.severities.HIGH,
        title: "Sign-In from New Country",
        message: `Your account was accessed from a new country: ${rawLocation.country || locationString}.`,
        actionRequired: true,
        metadata: safeMeta,
      })
    }

    // 3. New State Login (HIGH)
    if (signals.isNewState) {
      return securityAlertService.createAlert({
        userId,
        type: SECURITY_ALERT_CONFIG.types.NEW_STATE_LOGIN,
        severity: SECURITY_ALERT_CONFIG.severities.HIGH,
        title: "Sign-In from New Region",
        message: `Your account was accessed from a new state/region: ${locationString}.`,
        actionRequired: false,
        metadata: safeMeta,
      })
    }

    // 4. New Device Login (MEDIUM, actionRequired = true)
    if (signals.isNewDevice) {
      return securityAlertService.createAlert({
        userId,
        type: SECURITY_ALERT_CONFIG.types.NEW_DEVICE_LOGIN,
        severity: SECURITY_ALERT_CONFIG.severities.MEDIUM,
        title: "New Device Sign-In Detected",
        message: `Your account was accessed from a new device: ${browserName} on ${deviceDesc} in ${locationString}.`,
        actionRequired: true,
        metadata: safeMeta,
      })
    }

    // 5. New Browser Login (MEDIUM)
    if (signals.isNewBrowser) {
      return securityAlertService.createAlert({
        userId,
        type: SECURITY_ALERT_CONFIG.types.NEW_BROWSER_LOGIN,
        severity: SECURITY_ALERT_CONFIG.severities.MEDIUM,
        title: "New Browser Sign-In Detected",
        message: `Your account was accessed using a new browser: ${browserName} in ${locationString}.`,
        actionRequired: false,
        metadata: safeMeta,
      })
    }

    // 6. New City Login (MEDIUM)
    if (signals.isNewCity) {
      return securityAlertService.createAlert({
        userId,
        type: SECURITY_ALERT_CONFIG.types.NEW_CITY_LOGIN,
        severity: SECURITY_ALERT_CONFIG.severities.MEDIUM,
        title: "Sign-In from New City",
        message: `Your account was accessed from a new city: ${rawLocation.city || locationString}.`,
        actionRequired: false,
        metadata: safeMeta,
      })
    }

    // 7. New IP Login (MEDIUM)
    if (signals.isNewIP) {
      return securityAlertService.createAlert({
        userId,
        type: SECURITY_ALERT_CONFIG.types.NEW_IP_LOGIN,
        severity: SECURITY_ALERT_CONFIG.severities.MEDIUM,
        title: "Sign-In from New Network",
        message: `Your account was accessed from a new IP address (${maskedIP}) in ${locationString}.`,
        actionRequired: false,
        metadata: safeMeta,
      })
    }

    return null
  }

  /**
   * Handles critical refresh token replay detection:
   * Generates CRITICAL alert, revokes sessions, and elevates account protection.
   */
  async handleRefreshTokenReplay({ userId, sessionId = null, ip = null }) {
    if (!userId) return null

    logger.warn(`[SuspiciousActivityService] Handling CRITICAL refresh token replay for user ${userId}`)

    // 1. Create CRITICAL Alert
    const alert = await securityAlertService.createAlert({
      userId,
      type: SECURITY_ALERT_CONFIG.types.REFRESH_TOKEN_REUSE,
      severity: SECURITY_ALERT_CONFIG.severities.CRITICAL,
      title: "Critical Security Incident: Token Replay Detected",
      message: "An invalidated session token was resubmitted from an unauthorized source. All connected devices have been logged out to protect your account.",
      actionRequired: true,
      metadata: {
        sessionId,
        maskedIP: ip ? maskIPAddress(ip) : "Unknown IP",
        incidentTime: new Date(),
      },
    })

    // 2. Immediate Account Lockdown (Revoke all sessions)
    await accountProtectionService.secureAccount(userId, {
      currentSessionId: null,
      reason: "REFRESH_TOKEN_REUSE_INCIDENT",
    })

    return alert
  }
}

export const suspiciousActivityService = new SuspiciousActivityService()
export default suspiciousActivityService
