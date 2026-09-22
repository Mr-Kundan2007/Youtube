/**
 * Login History Service (Phase 8)
 *
 * Records and queries comprehensive audit logs for user login attempts.
 * Supports pagination, status filtering, device filtering, and safe masking.
 */

import LoginHistory from "../Modals/LoginHistory.js"
import SecurityEvent from "../Modals/SecurityEvent.js"
import { TRUSTED_DEVICE_CONFIG } from "../config/trustedDeviceConfig.js"
import { maskIPAddress } from "../utils/comparisonUtils.js"

export class LoginHistoryService {
  /**
   * Records a login attempt (successful, failed, OTP required, or blocked).
   */
  async recordLogin({
    userId,
    status = TRUSTED_DEVICE_CONFIG.loginStatus.SUCCESS,
    authenticationMethod = "PASSWORD",
    loginContext = {},
    verificationRequired = false,
    verificationMethod = "",
    trustedDeviceId = null,
  }) {
    if (!userId) return null

    try {
      const dev = loginContext.device || {}
      const net = loginContext.network || {}
      const loc = net.location || {}
      const rawIp = net.ipAddress || net.ip?.address || loginContext.clientIp || ""
      const masked = rawIp ? maskIPAddress(rawIp) : "Unknown IP"

      const record = await LoginHistory.create({
        userId,
        status,
        authenticationMethod,
        browser: {
          name: dev.browser?.name || "Unknown Browser",
          version: dev.browser?.version || "",
          family: dev.browser?.family || "unknown",
        },
        operatingSystem: {
          name: dev.os?.name || "Unknown OS",
          version: dev.os?.version || "",
        },
        device: {
          type: dev.type || "desktop",
          model: dev.model || "Unknown",
          vendor: dev.vendor || "Unknown",
        },
        ipAddress: rawIp,
        maskedIP: masked,
        location: {
          city: loc.city || null,
          state: loc.state || null,
          country: loc.country || null,
          countryCode: loc.countryCode || null,
        },
        loginAt: new Date(),
        verificationRequired,
        verificationMethod,
        trustedDeviceId,
      })

      // Emit corresponding security event for the activity feed
      let eventType = TRUSTED_DEVICE_CONFIG.eventTypes.LOGIN_SUCCESS
      let severity = TRUSTED_DEVICE_CONFIG.severity.LOW

      if (status === TRUSTED_DEVICE_CONFIG.loginStatus.FAILED) {
        eventType = TRUSTED_DEVICE_CONFIG.eventTypes.LOGIN_FAILED
        severity = TRUSTED_DEVICE_CONFIG.severity.MEDIUM
      } else if (status === TRUSTED_DEVICE_CONFIG.loginStatus.OTP_REQUIRED) {
        eventType = TRUSTED_DEVICE_CONFIG.eventTypes.LOGIN_OTP_REQUIRED
        severity = TRUSTED_DEVICE_CONFIG.severity.LOW
      } else if (status === TRUSTED_DEVICE_CONFIG.loginStatus.BLOCKED) {
        eventType = TRUSTED_DEVICE_CONFIG.eventTypes.LOGIN_BLOCKED
        severity = TRUSTED_DEVICE_CONFIG.severity.HIGH
      }

      await SecurityEvent.create({
        eventType,
        userId: userId.toString(),
        severity,
        ip: masked,
        metadata: {
          browser: dev.browser?.name,
          os: dev.os?.name,
          deviceType: dev.type,
          city: loc.city,
          country: loc.country,
          verificationRequired,
          loginHistoryId: record._id,
        },
        timestamp: new Date(),
      })

      return record
    } catch (err) {
      console.error("[LoginHistoryService] Error recording login attempt:", err)
      return null
    }
  }

  /**
   * Retrieves paginated login history for a user with optional status and device filtering.
   */
  async getLoginHistory(userId, { page = 1, limit = 20, status = null, deviceType = null } = {}) {
    if (!userId) return { history: [], total: 0, page: 1, totalPages: 0 }

    try {
      const pageNum = Math.max(1, parseInt(page, 10) || 1)
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20))
      const skip = (pageNum - 1) * limitNum

      const query = { userId }
      if (status && Object.values(TRUSTED_DEVICE_CONFIG.loginStatus).includes(status)) {
        query.status = status
      }
      if (deviceType) {
        query["device.type"] = deviceType
      }

      const [items, total] = await Promise.all([
        LoginHistory.find(query)
          .sort({ loginAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .select("-ipAddress") // Never leak unmasked IP to client
          .lean(),
        LoginHistory.countDocuments(query),
      ])

      const formatted = items.map((item) => ({
        id: item._id.toString(),
        _id: item._id.toString(),
        status: item.status,
        authenticationMethod: item.authenticationMethod,
        browser: item.browser,
        operatingSystem: item.operatingSystem,
        device: item.device,
        maskedIP: item.maskedIP || "Unknown IP",
        location: item.location,
        loginAt: item.loginAt,
        verificationRequired: item.verificationRequired,
        verificationMethod: item.verificationMethod,
        trustedDeviceId: item.trustedDeviceId ? item.trustedDeviceId.toString() : null,
      }))

      return {
        history: formatted,
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum) || 1,
      }
    } catch (err) {
      console.error("[LoginHistoryService] Error fetching login history:", err)
      return { history: [], total: 0, page: 1, totalPages: 0 }
    }
  }
}

export const loginHistoryService = new LoginHistoryService()
export default loginHistoryService
