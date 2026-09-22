import crypto from "crypto"
import { getClientIp } from "./ipUtils.js"

/**
 * Generates an alphanumeric request correlation ID: REQ-<UUID>
 */
export const generateCorrelationId = () => {
  const uuid = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex")
  return `REQ-${uuid}`
}

/**
 * Middleware that assigns and propagates request correlation IDs.
 */
export const requestCorrelationMiddleware = (req, res, next) => {
  const existingId = req.headers["x-request-id"] || req.headers["x-correlation-id"]
  const requestId = existingId ? String(existingId).slice(0, 64) : generateCorrelationId()

  req.id = requestId
  req.requestId = requestId
  res.setHeader("X-Request-Id", requestId)

  next()
}

/**
 * Computes a fast client fingerprint hash from IP and user-agent.
 */
export const computeClientFingerprint = (req) => {
  const ip = getClientIp(req)
  const ua = req?.headers?.["user-agent"] || ""
  const acceptLang = req?.headers?.["accept-language"] || ""
  return crypto
    .createHash("sha256")
    .update(`${ip}|${ua}|${acceptLang}`)
    .digest("hex")
    .slice(0, 24)
}
