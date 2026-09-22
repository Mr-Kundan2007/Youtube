import crypto from "crypto"

const REDACT_KEYWORDS = [
  "password",
  "token",
  "jwt",
  "secret",
  "key",
  "credential",
  "authorization",
  "signature",
  "private",
  "hash",
  "salt",
]

/**
 * Timing-safe string comparison to prevent timing side-channel attacks.
 */
export const constantTimeCompare = (a, b) => {
  if (typeof a !== "string" || typeof b !== "string") return false
  const bufA = Buffer.from(a, "utf8")
  const bufB = Buffer.from(b, "utf8")
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

/**
 * Deeply sanitizes metadata objects by replacing sensitive keys with [REDACTED].
 */
export const sanitizeMetadata = (data) => {
  if (!data || typeof data !== "object") return data

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeMetadata(item))
  }

  const sanitized = {}
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase()
    const isSensitive = REDACT_KEYWORDS.some((kw) => lowerKey.includes(kw))

    if (isSensitive) {
      sanitized[key] = "[REDACTED]"
    } else if (value && typeof value === "object") {
      sanitized[key] = sanitizeMetadata(value)
    } else {
      sanitized[key] = value
    }
  }

  return sanitized
}

/**
 * Fast SHA-256 hash helper.
 */
export const sha256 = (value) => {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex")
}
