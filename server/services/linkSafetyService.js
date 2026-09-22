import { COMMENT_CONFIG } from "../config/commentConfig.js"

/**
 * Link Safety & Malicious URL Protection Service
 *
 * Extracts URLs, blocks dangerous executable/script schemes,
 * detects suspicious IP hosts and malware download extensions,
 * and enforces maximum URL thresholds without SSRF-prone server fetching.
 */

// Dangerous schemes that must NEVER be allowed or rendered
const DANGEROUS_SCHEMES = [
  "javascript:",
  "data:",
  "vbscript:",
  "file:",
  "blob:",
]

// Suspicious executable / dangerous file extensions
const DANGEROUS_EXTENSIONS = [
  ".exe",
  ".scr",
  ".bat",
  ".cmd",
  ".vbs",
  ".vbe",
  ".js",
  ".jse",
  ".wsf",
  ".wsh",
  ".ps1",
  ".sh",
  ".apk",
  ".msi",
  ".jar",
  ".dll",
]

// IPv4 address pattern (e.g. http://192.168.1.1 or http://10.0.0.1)
const IPV4_REGEX = /^(?:https?:\/\/)?(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?(?:\/.*)?$/i

// General URL extraction pattern (supports http, https, and www)
const URL_EXTRACTION_REGEX = /(?:https?:\/\/|www\.)[^\s<>"'`()]+/gi

/**
 * Extracts and inspects URLs found inside a comment.
 * @param {string} text - Raw input text
 * @returns {{ urlCount: number, urls: string[], hasUnsafeScheme: boolean, isSuspicious: boolean, reasons: string[] }}
 */
export const checkLinkSafety = (text = "") => {
  if (!COMMENT_CONFIG.ENABLE_LINK_SAFETY || !text || typeof text !== "string") {
    return {
      urlCount: 0,
      urls: [],
      hasUnsafeScheme: false,
      isSuspicious: false,
      reasons: [],
    }
  }

  const reasons = []
  const lowerText = text.toLowerCase()

  // 1. Direct scan for prohibited / executable schemes anywhere in text
  for (const scheme of DANGEROUS_SCHEMES) {
    if (lowerText.includes(scheme)) {
      reasons.push(`UNSAFE_SCHEME_${scheme.replace(":", "").toUpperCase()}`)
      return {
        urlCount: 1,
        urls: [scheme],
        hasUnsafeScheme: true,
        isSuspicious: true,
        reasons,
      }
    }
  }

  // 2. Extract standard URLs
  const matchedUrls = text.match(URL_EXTRACTION_REGEX) || []
  const urls = Array.from(new Set(matchedUrls.map((u) => u.trim())))
  const urlCount = urls.length

  // Check maximum URL count limit
  const maxUrls = COMMENT_CONFIG.MAX_URL_COUNT || 2
  if (urlCount > maxUrls) {
    reasons.push("EXCESSIVE_URL_COUNT")
  }

  let isSuspicious = false

  // 3. Evaluate each detected URL
  for (const urlStr of urls) {
    const lowerUrl = urlStr.toLowerCase()

    // Check scheme validity if explicitly present
    if (lowerUrl.startsWith("javascript:") || lowerUrl.startsWith("data:") || lowerUrl.startsWith("vbscript:")) {
      reasons.push("UNSAFE_SCHEME")
      return {
        urlCount,
        urls,
        hasUnsafeScheme: true,
        isSuspicious: true,
        reasons,
      }
    }

    // Check raw IP address host (malware/phishing indicator)
    if (IPV4_REGEX.test(lowerUrl)) {
      isSuspicious = true
      reasons.push("IP_ADDRESS_URL")
    }

    // Check executable/dangerous file download extension
    for (const ext of DANGEROUS_EXTENSIONS) {
      if (lowerUrl.includes(ext)) {
        isSuspicious = true
        reasons.push("DANGEROUS_FILE_EXTENSION")
        break
      }
    }

    // Check suspicious ports
    const portMatch = lowerUrl.match(/:(\d+)/)
    if (portMatch) {
      const port = parseInt(portMatch[1], 10)
      if ([6667, 31337, 1337, 4444, 5555].includes(port)) {
        isSuspicious = true
        reasons.push("SUSPICIOUS_PORT")
      }
    }

    // Check excessive percent encoding
    if (lowerUrl.includes("%25%25") || (lowerUrl.match(/%[0-9a-f]{2}/g) || []).length > 8) {
      isSuspicious = true
      reasons.push("EXCESSIVE_URL_ENCODING")
    }
  }

  return {
    urlCount,
    urls,
    hasUnsafeScheme: false,
    isSuspicious: isSuspicious || reasons.includes("EXCESSIVE_URL_COUNT"),
    reasons,
  }
}

export default {
  checkLinkSafety,
}
