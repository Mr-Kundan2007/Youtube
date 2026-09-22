/**
 * Account Security & Trusted Devices Controller (Phase 8)
 *
 * Exposes authenticated endpoints for:
 * - Viewing trusted devices
 * - Renaming trusted devices
 * - Revoking trusted devices
 * - Viewing paginated login history (with filters)
 * - Viewing security activity stream
 */

import trustedDeviceService from "../services/trustedDeviceService.js"
import loginHistoryService from "../services/loginHistoryService.js"
import securityActivityService from "../services/securityActivityService.js"
import { TRUSTED_DEVICE_CONFIG } from "../config/trustedDeviceConfig.js"
import { deviceService } from "../services/deviceService.js"

export const getTrustedDevices = async (req, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" })
    }

    // Try to detect current device signature from request headers
    let currentSignature = ""
    try {
      const dev = deviceService.normalizeDeviceInfo({}, req.headers)
      currentSignature = dev.signature || ""
    } catch (e) {}

    const devices = await trustedDeviceService.getTrustedDevices(userId, currentSignature)

    return res.status(200).json({
      success: true,
      devices,
      count: devices.length,
      maxLimit: TRUSTED_DEVICE_CONFIG.maxPerUser,
      durationDays: TRUSTED_DEVICE_CONFIG.durationDays,
    })
  } catch (err) {
    console.error("[SecurityController] getTrustedDevices error:", err)
    return res.status(500).json({ message: "Error fetching trusted devices" })
  }
}

export const renameTrustedDevice = async (req, res) => {
  try {
    const userId = req.user?.id
    const { deviceId } = req.params
    const { customName } = req.body

    if (!userId) {
      return res.status(401).json({ message: "Authentication required" })
    }

    if (!deviceId) {
      return res.status(400).json({ message: "Device ID is required" })
    }

    if (customName === undefined) {
      return res.status(400).json({ message: "Custom name is required" })
    }

    const updated = await trustedDeviceService.renameTrustedDevice(userId, deviceId, customName)

    return res.status(200).json({
      success: true,
      message: "Device renamed successfully",
      device: {
        id: updated._id.toString(),
        customName: updated.customName,
        deviceName: updated.customName || updated.deviceName,
      },
    })
  } catch (err) {
    console.error("[SecurityController] renameTrustedDevice error:", err)
    return res.status(400).json({ message: err.message || "Error renaming trusted device" })
  }
}

export const revokeTrustedDevice = async (req, res) => {
  try {
    const userId = req.user?.id
    const { deviceId } = req.params

    if (!userId) {
      return res.status(401).json({ message: "Authentication required" })
    }

    if (!deviceId) {
      return res.status(400).json({ message: "Device ID is required" })
    }

    await trustedDeviceService.revokeTrustedDevice(userId, deviceId)

    return res.status(200).json({
      success: true,
      message: "Device trust revoked successfully",
    })
  } catch (err) {
    console.error("[SecurityController] revokeTrustedDevice error:", err)
    return res.status(400).json({ message: err.message || "Error revoking device trust" })
  }
}

export const getLoginHistory = async (req, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" })
    }

    const { page, limit, status, deviceType } = req.query
    const result = await loginHistoryService.getLoginHistory(userId, {
      page,
      limit,
      status,
      deviceType,
    })

    return res.status(200).json({
      success: true,
      ...result,
    })
  } catch (err) {
    console.error("[SecurityController] getLoginHistory error:", err)
    return res.status(500).json({ message: "Error fetching login history" })
  }
}

export const getSecurityActivity = async (req, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" })
    }

    const { page, limit, severity } = req.query
    const result = await securityActivityService.getSecurityActivity(userId, {
      page,
      limit,
      severity,
    })

    return res.status(200).json({
      success: true,
      ...result,
    })
  } catch (err) {
    console.error("[SecurityController] getSecurityActivity error:", err)
    return res.status(500).json({ message: "Error fetching security activity" })
  }
}

export default {
  getTrustedDevices,
  renameTrustedDevice,
  revokeTrustedDevice,
  getLoginHistory,
  getSecurityActivity,
}
