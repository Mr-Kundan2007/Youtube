/**
 * Device Metadata Validator (Phase 4)
 *
 * Validates untrusted client device metadata before normalization.
 * Sanitizes input strings, checks field lengths, and ensures safe fallbacks.
 */

export const ALLOWED_DEVICE_TYPES = ["Desktop", "Mobile", "Tablet", "Unknown"]

const MAX_STRING_LENGTHS = {
  browserName: 50,
  browserVersion: 30,
  osName: 50,
  osVersion: 30,
  deviceType: 20,
  deviceModel: 50,
  deviceVendor: 50,
  platform: 50,
  userAgent: 1000,
  signature: 100,
}

/**
 * Sanitizes an untrusted string: strips non-printable control characters and trims.
 */
export function sanitizeString(val, maxLength = 50, fallback = "Unknown") {
  if (val === null || val === undefined) return fallback
  if (typeof val !== "string") {
    if (typeof val === "number") val = String(val)
    else return fallback
  }

  // Remove ASCII control codes and excessive whitespace
  const cleaned = val.replace(/[\x00-\x1F\x7F]/g, "").trim()
  if (!cleaned) return fallback

  return cleaned.slice(0, maxLength)
}

/**
 * Validates and sanitizes untrusted client device metadata.
 * Never throws errors — sanitizes invalid values into safe defaults.
 */
export function validateAndSanitizeClientDevice(clientData) {
  if (!clientData || typeof clientData !== "object" || Array.isArray(clientData)) {
    return {
      isValid: false,
      sanitized: null,
    }
  }

  const browserName = sanitizeString(clientData.browser?.name, MAX_STRING_LENGTHS.browserName, "Unknown")
  const browserVersion = sanitizeString(clientData.browser?.version, MAX_STRING_LENGTHS.browserVersion, "Unknown")
  const osName = sanitizeString(clientData.operatingSystem?.name, MAX_STRING_LENGTHS.osName, "Unknown")
  const osVersion = sanitizeString(clientData.operatingSystem?.version, MAX_STRING_LENGTHS.osVersion, "Unknown")

  // Validate device type against allowed enum
  let rawType = sanitizeString(clientData.device?.type, MAX_STRING_LENGTHS.deviceType, "Unknown")
  // Capitalize first letter to match Enum
  if (rawType.length > 0) {
    rawType = rawType.charAt(0).toUpperCase() + rawType.slice(1).toLowerCase()
  }
  const deviceType = ALLOWED_DEVICE_TYPES.includes(rawType) ? rawType : "Unknown"

  const deviceModel = sanitizeString(clientData.device?.model, MAX_STRING_LENGTHS.deviceModel, "Unknown")
  const deviceVendor = sanitizeString(clientData.device?.vendor, MAX_STRING_LENGTHS.deviceVendor, "Unknown")

  const userAgent = sanitizeString(clientData.userAgent, MAX_STRING_LENGTHS.userAgent, "")
  const platform = sanitizeString(clientData.platform, MAX_STRING_LENGTHS.platform, "")

  return {
    isValid: true,
    sanitized: {
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
      userAgent,
      platform,
    },
  }
}
