/**
 * Central Device Normalization & Recognition Service (Phase 4)
 *
 * Normalizes untrusted client device metadata and server request headers
 * into a standardized, privacy-safe technical device metadata object.
 */

import { parseServerUserAgent } from "../utils/userAgentUtils.js"
import {
  validateAndSanitizeClientDevice,
  ALLOWED_DEVICE_TYPES,
} from "../validators/deviceValidator.js"

export class DeviceService {
  /**
   * Normalizes client-provided metadata and server HTTP request headers.
   *
   * @param {Object} clientDeviceInfo - Untrusted deviceInfo object from req.body
   * @param {Object|string} requestHeaders - HTTP headers or user-agent string
   * @returns {Object} Standardized device metadata
   */
  normalizeDeviceInfo(clientDeviceInfo, requestHeaders = {}) {
    try {
      const serverUa =
        typeof requestHeaders === "string"
          ? requestHeaders
          : requestHeaders?.["user-agent"] || ""

      // 1. Parse server-side user agent as reliable baseline
      const serverParsed = parseServerUserAgent(serverUa)

      // 2. Validate and sanitize client metadata
      const { isValid, sanitized } = validateAndSanitizeClientDevice(clientDeviceInfo)

      let browserName = serverParsed.browser.name
      let browserVersion = serverParsed.browser.version
      let osName = serverParsed.operatingSystem.name
      let osVersion = serverParsed.operatingSystem.version
      let deviceType = serverParsed.device.type
      let deviceModel = serverParsed.device.model
      let deviceVendor = serverParsed.device.vendor
      let platform = ""

      if (isValid && sanitized) {
        // Client hints or accurate client checks take precedence if valid & not Unknown
        if (sanitized.browser.name && sanitized.browser.name !== "Unknown") {
          browserName = sanitized.browser.name
        }
        if (sanitized.browser.version && sanitized.browser.version !== "Unknown") {
          browserVersion = sanitized.browser.version
        }

        if (sanitized.operatingSystem.name && sanitized.operatingSystem.name !== "Unknown") {
          osName = sanitized.operatingSystem.name
        }
        if (sanitized.operatingSystem.version && sanitized.operatingSystem.version !== "Unknown") {
          osVersion = sanitized.operatingSystem.version
        }

        if (sanitized.device.type && sanitized.device.type !== "Unknown") {
          deviceType = sanitized.device.type
        }
        if (sanitized.device.model && sanitized.device.model !== "Unknown") {
          deviceModel = sanitized.device.model
        }
        if (sanitized.device.vendor && sanitized.device.vendor !== "Unknown") {
          deviceVendor = sanitized.device.vendor
        }

        platform = sanitized.platform || ""
      }

      // Final sanity fallback for deviceType
      if (!ALLOWED_DEVICE_TYPES.includes(deviceType)) {
        deviceType = "Unknown"
      }

      // Server user-agent is authoritative for raw storage when available
      const finalUserAgent = serverUa || (sanitized ? sanitized.userAgent : "") || "Unknown"

      // Generate privacy-safe device signature
      const signature = this.generateDeviceSignature({
        browserName,
        browserVersion,
        osName,
        osVersion,
        deviceType,
        deviceModel,
      })

      return {
        browser: {
          name: browserName,
          version: browserVersion,
        },
        operatingSystem: {
          name: osName,
          version: osVersion,
        },
        device: {
          type: deviceType,
          model: deviceModel,
          vendor: deviceVendor,
        },
        userAgent: finalUserAgent,
        platform,
        signature,
        detectedAt: new Date().toISOString(),
      }
    } catch (err) {
      console.warn("[DeviceService] Error normalizing device info, falling back to safe defaults:", err)
      return {
        browser: { name: "Unknown", version: "Unknown" },
        operatingSystem: { name: "Unknown", version: "Unknown" },
        device: { type: "Unknown", model: "Unknown", vendor: "Unknown" },
        userAgent: typeof requestHeaders === "string" ? requestHeaders : requestHeaders?.["user-agent"] || "Unknown",
        platform: "",
        signature: "unknown:0:unknown:0:unknown:unknown",
        detectedAt: new Date().toISOString(),
      }
    }
  }

  /**
   * Generates a privacy-safe, deterministic device signature.
   */
  generateDeviceSignature(info = {}) {
    const parts = [
      (info.browserName || "Unknown").toLowerCase().replace(/\s+/g, ""),
      (info.browserVersion || "0").split(".")[0],
      (info.osName || "Unknown").toLowerCase().replace(/\s+/g, ""),
      (info.osVersion || "0").split(".")[0],
      (info.deviceType || "Unknown").toLowerCase(),
      (info.deviceModel || "Unknown").toLowerCase().replace(/\s+/g, ""),
    ]
    return parts.join(":")
  }

  /**
   * Formats standardized device information for user display.
   * Examples:
   * - "Google Chrome on macOS"
   * - "Safari on iPhone"
   * - "Google Chrome 140 • macOS 15 • Desktop"
   */
  formatDeviceName(info = {}, options = {}) {
    const browser = info.browser?.name || "Unknown Browser"
    const browserVer = info.browser?.version
    const os = info.operatingSystem?.name || "Unknown OS"
    const osVer = info.operatingSystem?.version
    const type = info.device?.type || "Unknown Device"
    const model = info.device?.model

    if (options.detailed) {
      const parts = []
      if (browserVer && browserVer !== "Unknown") {
        parts.push(`${browser} ${browserVer.split(".")[0]}`)
      } else {
        parts.push(browser)
      }

      if (osVer && osVer !== "Unknown") {
        parts.push(`${os} ${osVer.split(".")[0]}`)
      } else {
        parts.push(os)
      }

      if (type && type !== "Unknown") {
        parts.push(type)
      }
      return parts.join(" • ")
    }

    if (model && model !== "Unknown" && (type === "Mobile" || type === "Tablet")) {
      return `${browser} on ${model}`
    }

    return `${browser} on ${os}`
  }

  /**
   * Parses arbitrary User-Agent string directly.
   */
  parseUserAgent(ua) {
    return parseServerUserAgent(ua)
  }

  /**
   * Validates client device object.
   */
  validateDeviceInfo(data) {
    return validateAndSanitizeClientDevice(data)
  }
}

export const deviceService = new DeviceService()
export default deviceService
