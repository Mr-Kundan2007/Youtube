/**
 * Trusted Device Service (Phase 8)
 *
 * Manages trusted device registration, renewal, automatic trust expiration,
 * device capacity enforcement (max 10), soft revocation, and renaming.
 */

import TrustedDevice from "../Modals/TrustedDevice.js"
import SecurityEvent from "../Modals/SecurityEvent.js"
import { TRUSTED_DEVICE_CONFIG } from "../config/trustedDeviceConfig.js"
import { maskIPAddress } from "../utils/comparisonUtils.js"

export class TrustedDeviceService {
  /**
   * Retrieves all non-revoked trusted devices for a user with safe formatted metadata.
   */
  async getTrustedDevices(userId, currentSignature = "") {
    if (!userId) return []

    try {
      const devices = await TrustedDevice.find({
        userId,
        status: { $ne: TRUSTED_DEVICE_CONFIG.status.REVOKED },
      })
        .sort({ lastUsedAt: -1 })
        .lean()

      const now = new Date()
      const formatted = []

      for (const dev of devices) {
        // Auto-check expiration state
        let status = dev.status
        if (status === TRUSTED_DEVICE_CONFIG.status.ACTIVE && now > new Date(dev.trustExpiresAt)) {
          status = TRUSTED_DEVICE_CONFIG.status.EXPIRED
          // Update in background
          TrustedDevice.findByIdAndUpdate(dev._id, { status: TRUSTED_DEVICE_CONFIG.status.EXPIRED }).exec()
        }

        const isCurrentDevice = Boolean(
          currentSignature && dev.deviceIdentifier === currentSignature
        )

        formatted.push({
          id: dev._id.toString(),
          _id: dev._id.toString(),
          deviceName: dev.customName || dev.deviceName || "Web Browser",
          customName: dev.customName || "",
          browser: {
            name: dev.browser?.name || "Unknown Browser",
            version: dev.browser?.version || "",
          },
          operatingSystem: {
            name: dev.operatingSystem?.name || "Unknown OS",
            version: dev.operatingSystem?.version || "",
          },
          device: {
            type: dev.device?.type || "desktop",
            model: dev.device?.model || "Unknown",
          },
          location: {
            city: dev.lastKnownLocation?.city || null,
            state: dev.lastKnownLocation?.state || null,
            country: dev.lastKnownLocation?.country || null,
            countryCode: dev.lastKnownLocation?.countryCode || null,
          },
          lastKnownIP: dev.lastKnownIP ? maskIPAddress(dev.lastKnownIP) : null,
          firstVerifiedAt: dev.firstVerifiedAt,
          lastUsedAt: dev.lastUsedAt,
          trustedAt: dev.trustedAt,
          trustExpiresAt: dev.trustExpiresAt,
          status,
          isCurrentDevice,
        })
      }

      return formatted
    } catch (err) {
      console.error("[TrustedDeviceService] Error fetching trusted devices:", err)
      return []
    }
  }

  /**
   * Finds an actively trusted, non-expired device by user and device signature.
   */
  async findActiveTrustedDevice(userId, deviceIdentifier) {
    if (!userId || !deviceIdentifier) return null

    try {
      const device = await TrustedDevice.findOne({
        userId,
        deviceIdentifier,
      })

      if (!device) return null

      // If status is revoked or suspended
      if (device.status !== TRUSTED_DEVICE_CONFIG.status.ACTIVE) {
        return null
      }

      // Check trust expiration
      if (new Date() > new Date(device.trustExpiresAt)) {
        device.status = TRUSTED_DEVICE_CONFIG.status.EXPIRED
        await device.save()

        await SecurityEvent.create({
          eventType: TRUSTED_DEVICE_CONFIG.eventTypes.TRUSTED_DEVICE_EXPIRED,
          userId,
          severity: TRUSTED_DEVICE_CONFIG.severity.LOW,
          metadata: { deviceId: device._id, deviceIdentifier },
        })

        return null
      }

      return device
    } catch (err) {
      console.error("[TrustedDeviceService] Error checking active trusted device:", err)
      return null
    }
  }

  /**
   * Creates or updates a trusted device record after successful OTP verification.
   */
  async createOrUpdateTrustedDevice({ userId, loginContext = {}, verificationMethod = "OTP" }) {
    if (!userId) return null

    try {
      const dev = loginContext.device || {}
      const net = loginContext.network || {}
      const loc = net.location || {}

      const deviceIdentifier =
        dev.signature ||
        `${dev.type || "desktop"}:${dev.browser?.name || "browser"}:${dev.os?.name || "os"}`

      const trustDurationMs = TRUSTED_DEVICE_CONFIG.durationDays * 24 * 60 * 60 * 1000
      const trustExpiresAt = new Date(Date.now() + trustDurationMs)
      const clientIp = net.ipAddress || net.ip?.address || loginContext.clientIp || ""

      // Check if device already exists
      let existing = await TrustedDevice.findOne({ userId, deviceIdentifier })

      if (existing) {
        // Renew trust and update activity
        existing.status = TRUSTED_DEVICE_CONFIG.status.ACTIVE
        existing.trustExpiresAt = trustExpiresAt
        existing.lastUsedAt = new Date()
        existing.lastKnownIP = clientIp
        existing.lastKnownLocation = {
          city: loc.city || existing.lastKnownLocation?.city || null,
          state: loc.state || existing.lastKnownLocation?.state || null,
          country: loc.country || existing.lastKnownLocation?.country || null,
          countryCode: loc.countryCode || existing.lastKnownLocation?.countryCode || null,
        }
        existing.browser = {
          name: dev.browser?.name || existing.browser?.name || "Unknown Browser",
          version: dev.browser?.version || existing.browser?.version || "",
          family: dev.browser?.family || existing.browser?.family || "unknown",
        }
        existing.operatingSystem = {
          name: dev.os?.name || existing.operatingSystem?.name || "Unknown OS",
          version: dev.os?.version || existing.operatingSystem?.version || "",
        }
        existing.verificationMethod = verificationMethod

        await existing.save()

        await SecurityEvent.create({
          eventType: TRUSTED_DEVICE_CONFIG.eventTypes.TRUSTED_DEVICE_UPDATED,
          userId,
          severity: TRUSTED_DEVICE_CONFIG.severity.LOW,
          metadata: { deviceId: existing._id, deviceIdentifier },
        })

        return existing
      }

      // Check device limits per user (max 10)
      const count = await TrustedDevice.countDocuments({
        userId,
        status: TRUSTED_DEVICE_CONFIG.status.ACTIVE,
      })

      if (count >= TRUSTED_DEVICE_CONFIG.maxPerUser) {
        // Evict oldest inactive / least recently used device
        const oldest = await TrustedDevice.findOne({
          userId,
          status: TRUSTED_DEVICE_CONFIG.status.ACTIVE,
          deviceIdentifier: { $ne: deviceIdentifier },
        }).sort({ lastUsedAt: 1 })

        if (oldest) {
          oldest.status = TRUSTED_DEVICE_CONFIG.status.REVOKED
          await oldest.save()

          await SecurityEvent.create({
            eventType: TRUSTED_DEVICE_CONFIG.eventTypes.TRUSTED_DEVICE_REVOKED,
            userId,
            severity: TRUSTED_DEVICE_CONFIG.severity.LOW,
            metadata: {
              deviceId: oldest._id,
              reason: "DEVICE_LIMIT_EXCEEDED",
            },
          })
        }
      }

      const defaultDeviceName = `${dev.vendor || ""} ${dev.model || dev.type || "Device"}`.trim() || "Web Browser"

      const newDevice = await TrustedDevice.create({
        userId,
        deviceIdentifier,
        deviceName: defaultDeviceName,
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
        firstVerifiedAt: new Date(),
        lastUsedAt: new Date(),
        trustedAt: new Date(),
        trustExpiresAt,
        status: TRUSTED_DEVICE_CONFIG.status.ACTIVE,
        lastKnownIP: clientIp,
        lastKnownLocation: {
          city: loc.city || null,
          state: loc.state || null,
          country: loc.country || null,
          countryCode: loc.countryCode || null,
        },
        verificationMethod,
      })

      await SecurityEvent.create({
        eventType: TRUSTED_DEVICE_CONFIG.eventTypes.TRUSTED_DEVICE_CREATED,
        userId,
        severity: TRUSTED_DEVICE_CONFIG.severity.LOW,
        metadata: {
          deviceId: newDevice._id,
          deviceIdentifier,
          trustExpiresAt,
        },
      })

      return newDevice
    } catch (err) {
      console.error("[TrustedDeviceService] Error creating/updating trusted device:", err)
      return null
    }
  }

  /**
   * Soft-revokes a user's trusted device.
   */
  async revokeTrustedDevice(userId, deviceId) {
    if (!userId || !deviceId) {
      throw new Error("userId and deviceId are required")
    }

    const device = await TrustedDevice.findOne({ _id: deviceId, userId })
    if (!device) {
      throw new Error("Trusted device not found or does not belong to user")
    }

    device.status = TRUSTED_DEVICE_CONFIG.status.REVOKED
    await device.save()

    await SecurityEvent.create({
      eventType: TRUSTED_DEVICE_CONFIG.eventTypes.TRUSTED_DEVICE_REVOKED,
      userId,
      severity: TRUSTED_DEVICE_CONFIG.severity.MEDIUM,
      metadata: { deviceId: device._id, deviceName: device.customName || device.deviceName },
    })

    return device
  }

  /**
   * Renames a user's trusted device with sanitized custom display name.
   */
  async renameTrustedDevice(userId, deviceId, customName) {
    if (!userId || !deviceId) {
      throw new Error("userId and deviceId are required")
    }

    const device = await TrustedDevice.findOne({ _id: deviceId, userId })
    if (!device) {
      throw new Error("Trusted device not found or does not belong to user")
    }

    // Sanitize custom name (strip HTML tags, clamp length to 50)
    const sanitized = String(customName || "")
      .replace(/<[^>]*>?/gm, "")
      .trim()
      .slice(0, 50)

    device.customName = sanitized
    await device.save()

    await SecurityEvent.create({
      eventType: TRUSTED_DEVICE_CONFIG.eventTypes.TRUSTED_DEVICE_RENAMED,
      userId,
      severity: TRUSTED_DEVICE_CONFIG.severity.LOW,
      metadata: { deviceId: device._id, newName: sanitized },
    })

    return device
  }
}

export const trustedDeviceService = new TrustedDeviceService()
export default trustedDeviceService
