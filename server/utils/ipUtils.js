/**
 * IP Address & Network Utility (Phase 5)
 *
 * Provides IPv4/IPv6 normalization, private/reserved address classification,
 * and secure client IP detection respecting trusted proxy configurations.
 */

/**
 * Normalizes an IP string: strips whitespace and handles IPv4-mapped IPv6 addresses (::ffff:x.x.x.x).
 */
export function normalizeIP(rawIp = "") {
  if (!rawIp || typeof rawIp !== "string") {
    return { ipAddress: "127.0.0.1", ipVersion: "IPv4" }
  }

  let cleaned = rawIp.trim()

  // Handle IPv4-mapped IPv6 address (e.g., "::ffff:192.168.1.1" or "::ffff:127.0.0.1")
  if (cleaned.startsWith("::ffff:")) {
    const candidate = cleaned.slice(7)
    if (isValidIPv4(candidate)) {
      cleaned = candidate
    }
  }

  // Detect IP version
  const ipVersion = cleaned.includes(":") ? "IPv6" : "IPv4"

  return {
    ipAddress: cleaned,
    ipVersion,
  }
}

/**
 * Simple IPv4 regex validation.
 */
export function isValidIPv4(ip = "") {
  const parts = ip.split(".")
  if (parts.length !== 4) return false
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return false
    const num = parseInt(part, 10)
    if (num < 0 || num > 255) return false
    // Disallow leading zeros (e.g. 01)
    if (part.length > 1 && part.startsWith("0")) return false
  }
  return true
}

/**
 * Checks whether an IP address belongs to RFC 1918 private ranges, loopback,
 * link-local, or reserved blocks that should not be queried against public geolocators.
 */
export function isPrivateIP(rawIp = "") {
  const { ipAddress } = normalizeIP(rawIp)

  // IPv6 checks
  if (ipAddress.includes(":")) {
    const lower = ipAddress.toLowerCase()
    if (lower === "::1" || lower === "0:0:0:0:0:0:0:1" || lower === "::") {
      return true
    }
    // Link-local: fe80::/10
    if (lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) {
      return true
    }
    // Unique local: fc00::/7 (fc00:: - fdff::)
    if (lower.startsWith("fc") || lower.startsWith("fd")) {
      return true
    }
    return false
  }

  // IPv4 checks
  const parts = ipAddress.split(".").map((p) => parseInt(p, 10))
  if (parts.length !== 4 || parts.some((p) => isNaN(p))) {
    return true // Malformed -> treat safely as private
  }

  const [p0, p1] = parts

  // 127.0.0.0/8 (Loopback / Localhost)
  if (p0 === 127) return true

  // 10.0.0.0/8 (Private)
  if (p0 === 10) return true

  // 172.16.0.0/12 (172.16.0.0 - 172.31.255.255) (Private)
  if (p0 === 172 && p1 >= 16 && p1 <= 31) return true

  // 192.168.0.0/16 (Private)
  if (p0 === 192 && p1 === 168) return true

  // 169.254.0.0/16 (Link-local)
  if (p0 === 169 && p1 === 254) return true

  // 0.0.0.0/8 (Current network)
  if (p0 === 0) return true

  // 255.255.255.255 (Broadcast)
  if (parts.every((p) => p === 255)) return true

  return false
}

/**
 * Extracts and normalizes client IP address from an incoming request.
 * Evaluates trusted proxy headers safely without blindly trusting spoofed headers.
 */
export function getClientIPAddress(req = {}, options = {}) {
  const headers = req.headers || {}
  const isTrustedProxy = options.trustProxy !== undefined ? options.trustProxy : true

  let rawIp = ""
  let source = "socket"

  if (isTrustedProxy) {
    // 1. Cloudflare header
    if (headers["cf-connecting-ip"]) {
      rawIp = headers["cf-connecting-ip"].trim()
      source = "cf-connecting-ip"
    }
    // 2. Nginx / reverse proxy single real IP header
    else if (headers["x-real-ip"]) {
      rawIp = headers["x-real-ip"].trim()
      source = "x-real-ip"
    }
    // 3. Standard multi-hop proxy header: X-Forwarded-For: <client>, <proxy1>, <proxy2>
    else if (headers["x-forwarded-for"]) {
      const hops = headers["x-forwarded-for"].split(",").map((h) => h.trim())
      // Leftmost IP is the original client IP reported by the proxies
      if (hops.length > 0 && hops[0]) {
        rawIp = hops[0]
        source = "x-forwarded-for"
      }
    }
    // 4. RFC 7239 Forwarded header: for=192.0.2.60;proto=http;by=203.0.113.43
    else if (headers["forwarded"]) {
      const match = headers["forwarded"].match(/for=(?:"?\[?)([\w.:]+)(?:"?\]?)/i)
      if (match && match[1]) {
        rawIp = match[1]
        source = "forwarded"
      }
    }
  }

  // Fallback to socket / direct connection
  if (!rawIp) {
    rawIp =
      req.socket?.remoteAddress ||
      req.connection?.remoteAddress ||
      req.ip ||
      "127.0.0.1"
    source = "socket"
  }

  const { ipAddress, ipVersion } = normalizeIP(rawIp)
  const isPublic = !isPrivateIP(ipAddress)

  return {
    ipAddress,
    ipVersion,
    source,
    isPublic,
  }
}
