/**
 * Security Comparison Utilities (Phase 6)
 *
 * Provides normalized string comparison, browser family grouping (to avoid
 * false positives across version updates), device comparison key generation,
 * IP masking for privacy, and location reliability checks.
 */

import { normalizeIP, isPrivateIP } from "./ipUtils.js"

/**
 * Normalizes a string for security comparisons: trims and converts to lowercase.
 */
export function normalizeString(str) {
  if (str === null || str === undefined) return ""
  return String(str).trim().toLowerCase()
}

/**
 * Normalizes a browser name into its canonical browser family.
 * Ensures version bumps (e.g. Chrome 140 -> 141) and minor distribution names
 * (e.g. "Mobile Chrome", "Chrome Headless") map to the same family.
 */
export function canonicalBrowserFamily(browserName = "") {
  const norm = normalizeString(browserName)
  if (!norm) return "unknown"

  if (norm.includes("chrome") || norm.includes("chromium") || norm.includes("crios")) {
    return "chrome"
  }
  if (norm.includes("safari") && !norm.includes("chrome") && !norm.includes("chromium")) {
    return "safari"
  }
  if (norm.includes("firefox") || norm.includes("fxios")) {
    return "firefox"
  }
  if (norm.includes("edg") || norm.includes("edge")) {
    return "edge"
  }
  if (norm.includes("opera") || norm.includes("opr")) {
    return "opera"
  }
  if (norm.includes("brave")) {
    return "brave"
  }
  if (norm.includes("samsung")) {
    return "samsung internet"
  }
  if (norm.includes("ucbrowser") || norm.includes("uc browser")) {
    return "uc browser"
  }
  if (norm.includes("msie") || norm.includes("trident")) {
    return "ie"
  }

  return norm
}

/**
 * Checks if two browser representations belong to the same browser family.
 */
export function isSameBrowserFamily(browserA = "", browserB = "") {
  const famA = canonicalBrowserFamily(browserA)
  const famB = canonicalBrowserFamily(browserB)
  return famA === famB && famA !== "unknown"
}

/**
 * Generates a privacy-conscious device comparison key.
 * Format: `deviceType|deviceModel|vendor|osName`
 * Does NOT rely on invasive canvas/audio fingerprinting.
 */
export function createDeviceComparisonKey(deviceInfo = {}) {
  const deviceType = normalizeString(deviceInfo.type || deviceInfo.deviceType || "desktop") || "desktop"
  const model = normalizeString(deviceInfo.model || "unknown") || "unknown"
  const vendor = normalizeString(deviceInfo.vendor || "unknown") || "unknown"
  const osName = normalizeString(deviceInfo.os?.name || deviceInfo.osName || "unknown") || "unknown"

  return `${deviceType}|${model}|${vendor}|${osName}`
}

/**
 * Masks an IP address for privacy-compliant display and security logging.
 * IPv4: 203.0.113.195 -> 203.0.xxx.xxx
 * IPv6: 2001:0db8:85a3:: -> 2001:0db8:xxxx:xxxx:...
 */
export function maskIPAddress(rawIp = "") {
  if (!rawIp || !String(rawIp).trim()) return "xxx.xxx.xxx.xxx"
  const { ipAddress } = normalizeIP(rawIp)
  if (!ipAddress) return "xxx.xxx.xxx.xxx"

  if (ipAddress.includes(":")) {
    // IPv6
    const parts = ipAddress.split(":")
    if (parts.length >= 2) {
      return `${parts[0]}:${parts[1]}:xxxx:xxxx`
    }
    return "xxxx:xxxx:xxxx:xxxx"
  }

  // IPv4
  const parts = ipAddress.split(".")
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.xxx.xxx`
  }

  return "xxx.xxx.xxx.xxx"
}

/**
 * Checks whether location data is reliable enough to trigger geo-alerts.
 * Returns false if location lookup timed out, private IP, insufficient data, or missing country.
 */
export function isReliableLocation(location = null) {
  if (!location || typeof location !== "object") return false
  if (location.status === "insufficient_data" || location.status === "private_ip" || location.status === "failed") {
    return false
  }

  const country = normalizeString(location.country || location.countryCode)
  if (!country) return false

  return true
}

export default {
  normalizeString,
  canonicalBrowserFamily,
  isSameBrowserFamily,
  createDeviceComparisonKey,
  maskIPAddress,
  isReliableLocation,
}
