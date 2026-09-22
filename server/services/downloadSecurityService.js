import downloadAbuseService from "./downloadAbuseService.js"
import restrictionService from "./restrictionService.js"
import riskAssessmentService from "./riskAssessmentService.js"
import securityPolicyService from "./securityPolicyService.js"
import securityEventService from "./securityEventService.js"
import downloadAuditService, { DownloadEvents } from "./downloadAuditService.js"

/**
 * Central security orchestrator coordinating rate limiting, active restrictions,
 * behavioral abuse detection, dynamic risk scoring, and policy enforcement.
 */
export class DownloadSecurityService {
  /**
   * Main download security analysis pipeline called prior to quota deduction and token issuance.
   */
  async analyzeDownloadSecurity({
    userId,
    user = null,
    deviceId = "web",
    clientIp = "127.0.0.1",
    userAgent = "",
    browser = "unknown",
  } = {}) {
    // 1. Rate Limit Enforcement
    const rateCheck = downloadAbuseService.checkRateLimits({
      userId,
      deviceId,
      clientIp,
    })

    if (rateCheck.limited) {
      await securityEventService.recordEvent({
        userId,
        deviceId,
        eventType: "RATE_LIMIT_EXCEEDED",
        ipAddress: clientIp,
        browser,
        userAgent,
        metadata: {
          limitType: rateCheck.limitType,
          current: rateCheck.current,
          max: rateCheck.max,
        },
      })

      downloadAuditService.logEvent(DownloadEvents.RATE_LIMIT_EXCEEDED, {
        userId,
        deviceId,
        ip: clientIp,
        reason: "RATE_LIMIT_EXCEEDED",
        metadata: { limitType: rateCheck.limitType },
      })

      return {
        allowed: false,
        statusCode: 429,
        reason: "RATE_LIMIT_EXCEEDED",
        message: "Download request rate limit exceeded. Please wait a moment before retrying.",
        retryAfter: rateCheck.retryAfter || 60,
      }
    }

    // 2. Active Restriction Check (User, Device, or IP)
    const { isRestricted, restriction } = await restrictionService.checkActiveRestrictions({
      userId,
      deviceId,
      ipAddress: clientIp,
    })

    if (isRestricted) {
      downloadAuditService.logEvent(DownloadEvents.SECURITY_CHECK_BLOCKED, {
        userId,
        deviceId,
        ip: clientIp,
        reason: "DOWNLOAD_RESTRICTED",
        metadata: {
          restrictionId: restriction?.id,
          restrictionType: restriction?.restrictionType,
          expiresAt: restriction?.expiresAt,
        },
      })

      return {
        allowed: false,
        statusCode: 403,
        reason: "DOWNLOAD_RESTRICTED",
        message: restriction?.reason || "Download access is currently restricted on this account or device.",
        expiresAt: restriction?.expiresAt,
      }
    }

    // 3. Abuse Pattern Detection
    const flags = []

    // A. Rapid Device Switching
    const deviceSwitchResult = await downloadAbuseService.detectRapidDeviceSwitch(userId, deviceId)
    if (deviceSwitchResult.detected) {
      flags.push("RAPID_DEVICE_SWITCH")
      await securityEventService.recordEvent({
        userId,
        deviceId,
        eventType: "RAPID_DEVICE_SWITCH",
        ipAddress: clientIp,
        browser,
        userAgent,
        metadata: {
          count: deviceSwitchResult.count,
          devices: deviceSwitchResult.devices,
        },
      })
      downloadAuditService.logEvent(DownloadEvents.RAPID_DEVICE_SWITCH, {
        userId,
        deviceId,
        ip: clientIp,
        metadata: { count: deviceSwitchResult.count },
      })
    }

    // B. Rapid IP Address Switching
    const ipChangeResult = await downloadAbuseService.detectRapidIpChange(userId, clientIp)
    if (ipChangeResult.detected) {
      flags.push("RAPID_IP_CHANGE")
      await securityEventService.recordEvent({
        userId,
        deviceId,
        eventType: "RAPID_IP_CHANGE",
        ipAddress: clientIp,
        browser,
        userAgent,
        metadata: {
          count: ipChangeResult.count,
          ips: ipChangeResult.ips,
        },
      })
      downloadAuditService.logEvent(DownloadEvents.RAPID_IP_CHANGE, {
        userId,
        deviceId,
        ip: clientIp,
        metadata: { count: ipChangeResult.count },
      })
    }

    // 4. Dynamic Risk Assessment
    const riskAssessment = await riskAssessmentService.calculateRiskScore({
      userId,
      deviceId,
    })

    const combinedFlags = Array.from(new Set([...flags, ...riskAssessment.activeFlags]))

    // 5. Policy Decision Evaluation
    const decision = securityPolicyService.evaluateSecurityPolicy({
      riskScore: riskAssessment.riskScore,
      flags: combinedFlags,
      activeRestriction: null,
    })

    // If critical threshold reached, automatically enforce temporary restriction
    if (decision.shouldRestrict) {
      const newRestriction = await restrictionService.createRestriction({
        userId,
        deviceId,
        ipAddress: clientIp,
        restrictionType: "DOWNLOAD_RESTRICTED",
        reason: "Automatic restriction triggered by high risk activity score (>75)",
        durationMinutes: 30,
        createdBy: "system",
      })

      downloadAuditService.logEvent(DownloadEvents.SECURITY_CHECK_BLOCKED, {
        userId,
        deviceId,
        ip: clientIp,
        reason: "CRITICAL_RISK_THRESHOLD",
        metadata: {
          riskScore: decision.riskScore,
          restrictionId: newRestriction._id,
        },
      })

      return {
        allowed: false,
        statusCode: 403,
        reason: "DOWNLOAD_RESTRICTED",
        message: "Download access temporarily restricted due to suspicious activity.",
        expiresAt: newRestriction.expiresAt,
      }
    }

    if (!decision.allowed) {
      return {
        allowed: false,
        statusCode: 403,
        reason: decision.reason || "DOWNLOAD_RESTRICTED",
        message: decision.message || "Download request blocked by security policy.",
      }
    }

    // Allowed (either clean or flagged)
    if (decision.action === "ALLOW_AND_FLAG") {
      downloadAuditService.logEvent(DownloadEvents.SECURITY_CHECK_FLAGGED, {
        userId,
        deviceId,
        ip: clientIp,
        metadata: {
          riskLevel: decision.riskLevel,
          riskScore: decision.riskScore,
          flags: decision.flags,
        },
      })
    } else {
      downloadAuditService.logEvent(DownloadEvents.SECURITY_CHECK_PASSED, {
        userId,
        deviceId,
        ip: clientIp,
      })
    }

    return {
      allowed: true,
      action: decision.action,
      riskLevel: decision.riskLevel,
      riskScore: decision.riskScore,
      flags: decision.flags,
    }
  }
}

export const downloadSecurityService = new DownloadSecurityService()
export default downloadSecurityService
