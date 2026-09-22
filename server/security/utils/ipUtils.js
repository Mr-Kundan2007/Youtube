import crypto from "crypto"

/**
 * Extracts client IP from request headers or socket.
 */
export const getClientIp = (req) => {
  if (!req) return "127.0.0.1"
  const forwarded = req.headers["x-forwarded-for"]
  if (forwarded) {
    const ip = typeof forwarded === "string" ? forwarded.split(",")[0].trim() : forwarded[0]
    if (ip) return ip
  }
  return req.socket?.remoteAddress || req.ip || "127.0.0.1"
}

/**
 * Anonymizes client IP with a one-way salt hash to protect personal data.
 */
export const hashIp = (ip, salt = "antigravity_security_ip_salt") => {
  if (!ip) return null
  return crypto.createHmac("sha256", salt).update(String(ip)).digest("hex")
}

/**
 * Extracts a concise, safe summary of user-agent (browser and OS).
 */
export const parseUserAgent = (req) => {
  const ua = req?.headers?.["user-agent"] || "unknown"
  let browser = "Other"
  if (ua.includes("Firefox")) browser = "Firefox"
  else if (ua.includes("Chrome")) browser = "Chrome"
  else if (ua.includes("Safari")) browser = "Safari"
  else if (ua.includes("Edge")) browser = "Edge"
  else if (ua.includes("curl") || ua.includes("Postman")) browser = "API Client"

  let os = "Unknown OS"
  if (ua.includes("Mac OS")) os = "macOS"
  else if (ua.includes("Windows")) os = "Windows"
  else if (ua.includes("Linux")) os = "Linux"
  else if (ua.includes("Android")) os = "Android"
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS"

  return {
    raw: ua.slice(0, 256),
    browser,
    os,
    summary: `${browser} on ${os}`,
  }
}
