import mongoose from "mongoose"
import COMMENT_CONFIG from "../config/commentConfig.js"
import CommentRateLimit from "../Modals/CommentRateLimit.js"
import CommentModerationEvent from "../Modals/CommentModerationEvent.js"

// In-memory sliding log store
// Key: string -> Record
const inMemoryStore = new Map()

/**
 * Periodically purge stale in-memory records
 */
function purgeStaleMemoryRecords() {
  const now = Date.now()
  for (const [key, record] of inMemoryStore.entries()) {
    if (record.expiresAt && now > record.expiresAt) {
      inMemoryStore.delete(key)
    }
  }
}

const memoryPurgeInterval = setInterval(purgeStaleMemoryRecords, 60000)
if (memoryPurgeInterval.unref) {
  memoryPurgeInterval.unref()
}

/**
 * Build consistent rate limit identifier key.
 * User ID takes precedence over IP address to prevent spoofing.
 */
export function buildRateLimitKey({ userId, ip, action = "comment_create" } = {}) {
  const safeAction = String(action || "comment_create").toLowerCase().trim()
  if (userId) {
    return {
      key: `user:${String(userId).trim()}:${safeAction}`,
      identifierType: "user",
      identifierValue: String(userId).trim(),
      action: safeAction,
    }
  }

  const safeIp = String(ip || "127.0.0.1").trim()
  return {
    key: `ip:${safeIp}:${safeAction}`,
    identifierType: "ip",
    identifierValue: safeIp,
    action: safeAction,
  }
}

/**
 * Retrieve rate limit configuration for an action
 */
export function getActionLimits(action) {
  const limits = COMMENT_CONFIG.COMMENT_RATE_LIMITS?.[action]
  if (limits) {
    return {
      burst: limits.burst || { limit: 5, windowSeconds: 10 },
      sustained: limits.sustained || { limit: 30, windowSeconds: 3600 },
    }
  }
  // Default fallback limits
  return {
    burst: { limit: 10, windowSeconds: 10 },
    sustained: { limit: 60, windowSeconds: 3600 },
  }
}

/**
 * Retrieve current state from in-memory or database
 */
async function getRateLimitRecord(keyObj) {
  const { key, identifierType, identifierValue, action } = keyObj
  let record = inMemoryStore.get(key)

  if (!record) {
    // If MongoDB is connected, attempt to fetch from collection
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        const doc = await CommentRateLimit.findOne({ key }).lean()
        if (doc) {
          record = {
            key: doc.key,
            action: doc.action,
            identifierType: doc.identifier_type || doc.identifierType || identifierType,
            identifierValue: doc.identifier_value || doc.identifierValue || identifierValue,
            timestamps: Array.isArray(doc.timestamps)
              ? doc.timestamps.map((t) => new Date(t).getTime())
              : [],
            violationCount: doc.violation_count ?? doc.violationCount ?? 0,
            riskScore: doc.risk_score ?? doc.riskScore ?? 0,
            captchaRequired: !!(doc.captcha_required ?? doc.captchaRequired),
            captchaUnlockedUntil: doc.captcha_unlocked_until
              ? new Date(doc.captcha_unlocked_until).getTime()
              : null,
            lastViolationAt: doc.last_violation_at
              ? new Date(doc.last_violation_at).getTime()
              : null,
            expiresAt: doc.expires_at ? new Date(doc.expires_at).getTime() : Date.now() + 3600000,
          }
        }
      } catch (err) {
        // Fall back to memory silently
      }
    }
  }

  if (!record) {
    record = {
      key,
      action,
      identifierType,
      identifierValue,
      timestamps: [],
      violationCount: 0,
      riskScore: 0,
      captchaRequired: false,
      captchaUnlockedUntil: null,
      lastViolationAt: null,
      expiresAt: Date.now() + 3600000,
    }
  }

  return record
}

/**
 * Persist record to memory and optionally MongoDB
 */
async function saveRateLimitRecord(record) {
  inMemoryStore.set(record.key, record)

  if (mongoose.connection && mongoose.connection.readyState === 1) {
    try {
      await CommentRateLimit.findOneAndUpdate(
        { key: record.key },
        {
          $set: {
            action: record.action,
            identifier_type: record.identifierType,
            identifier_value: record.identifierValue,
            timestamps: record.timestamps.map((t) => new Date(t)),
            violation_count: record.violationCount,
            risk_score: record.riskScore,
            captcha_required: record.captchaRequired,
            captcha_unlocked_until: record.captchaUnlockedUntil
              ? new Date(record.captchaUnlockedUntil)
              : null,
            last_violation_at: record.lastViolationAt
              ? new Date(record.lastViolationAt)
              : null,
            expires_at: new Date(record.expiresAt),
          },
        },
        { upsert: true, new: true }
      )
    } catch (err) {
      // Memory store is authoritative fallback
    }
  }
}

/**
 * Check and record a rate-limited action using dual sliding window.
 * 
 * @param {Object} params
 * @param {string} [params.userId]
 * @param {string} [params.ip]
 * @param {string} params.action - e.g. "comment_create", "reply_create", etc.
 * @returns {Promise<{
 *   allowed: boolean,
 *   code: "ALLOWED" | "RATE_LIMITED" | "CAPTCHA_REQUIRED",
 *   limit: number,
 *   remaining: number,
 *   resetSeconds: number,
 *   retryAfter: number,
 *   captchaRequired: boolean,
 *   violationCount: number,
 *   riskScore: number
 * }>}
 */
export async function checkRateLimit({ userId, ip, ipAddress, action } = {}) {
  if (!COMMENT_CONFIG.RATE_LIMIT_ENABLED) {
    return {
      allowed: true,
      isRateLimited: false,
      code: "ALLOWED",
      limit: 9999,
      remaining: 9999,
      resetSeconds: 0,
      retryAfter: 0,
      captchaRequired: false,
      violationCount: 0,
      riskScore: 0,
    }
  }

  const effectiveIp = ip || ipAddress
  const keyObj = buildRateLimitKey({ userId, ip: effectiveIp, action })
  const limits = getActionLimits(keyObj.action)
  const record = await getRateLimitRecord(keyObj)

  const now = Date.now()
  const burstWindowMs = limits.burst.windowSeconds * 1000
  const sustainedWindowMs = limits.sustained.windowSeconds * 1000
  const maxWindowMs = Math.max(burstWindowMs, sustainedWindowMs)

  // Prune timestamps older than the maximum window
  record.timestamps = record.timestamps.filter((t) => now - t <= maxWindowMs)
  record.expiresAt = now + maxWindowMs + 3600000 // Keep record alive beyond window

  // Check if CAPTCHA unlock grace period has expired
  if (record.captchaUnlockedUntil && now >= record.captchaUnlockedUntil) {
    record.captchaUnlockedUntil = null
  }

  // 1. Adaptive CAPTCHA evaluation
  // If CAPTCHA is required and user has NOT unlocked it:
  if (record.captchaRequired && !record.captchaUnlockedUntil) {
    await saveRateLimitRecord(record)
    return {
      allowed: false,
      isRateLimited: true,
      code: "CAPTCHA_REQUIRED",
      limit: limits.burst.limit,
      remaining: 0,
      resetSeconds: limits.sustained.windowSeconds,
      retryAfter: Math.max(1, limits.burst.windowSeconds),
      captchaRequired: true,
      violationCount: record.violationCount,
      riskScore: record.riskScore,
    }
  }

  // 2. Evaluate Burst and Sustained Windows
  const burstHits = record.timestamps.filter((t) => now - t <= burstWindowMs)
  const sustainedHits = record.timestamps.filter((t) => now - t <= sustainedWindowMs)

  const burstExceeded = burstHits.length >= limits.burst.limit
  const sustainedExceeded = sustainedHits.length >= limits.sustained.limit

  if (burstExceeded || sustainedExceeded) {
    // Record violation
    record.violationCount += 1
    record.lastViolationAt = now

    // Calculate retryAfter in seconds
    let retryAfter = 1
    if (burstExceeded && burstHits.length > 0) {
      const oldestBurstHit = burstHits[0]
      const msUntilBurstClear = burstWindowMs - (now - oldestBurstHit)
      retryAfter = Math.max(retryAfter, Math.ceil(msUntilBurstClear / 1000))
    }
    if (sustainedExceeded && sustainedHits.length > 0) {
      const oldestSustainedHit = sustainedHits[0]
      const msUntilSustainedClear = sustainedWindowMs - (now - oldestSustainedHit)
      retryAfter = Math.max(retryAfter, Math.ceil(msUntilSustainedClear / 1000))
    }

    // Adaptive threshold check: if violations reach or exceed threshold, require CAPTCHA
    const threshold = COMMENT_CONFIG.CAPTCHA_TRIGGER_THRESHOLD || 2
    if (record.violationCount >= threshold && COMMENT_CONFIG.CAPTCHA_ENABLED) {
      record.captchaRequired = true
    }

    await saveRateLimitRecord(record)

    // Log moderation event asynchronously if MongoDB ready
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      CommentModerationEvent.create({
        event_type: record.captchaRequired ? "captcha_required" : "rate_limit_triggered",
        detected_reason: record.captchaRequired
          ? `Excessive requests exceeded violation threshold (${record.violationCount})`
          : `Rate limit hit for action ${keyObj.action}`,
        metadata: {
          action: keyObj.action,
          identifierType: keyObj.identifierType,
          identifierValue: keyObj.identifierValue,
          burstHits: burstHits.length,
          sustainedHits: sustainedHits.length,
          violationCount: record.violationCount,
        },
      }).catch(() => {})
    }

    return {
      allowed: false,
      isRateLimited: true,
      code: record.captchaRequired ? "CAPTCHA_REQUIRED" : "RATE_LIMITED",
      limit: limits.burst.limit,
      remaining: 0,
      resetSeconds: limits.sustained.windowSeconds,
      retryAfter,
      captchaRequired: record.captchaRequired,
      violationCount: record.violationCount,
      riskScore: record.riskScore,
    }
  }

  // 3. Request is ALLOWED
  record.timestamps.push(now)
  const remainingBurst = Math.max(0, limits.burst.limit - (burstHits.length + 1))
  const remainingSustained = Math.max(0, limits.sustained.limit - (sustainedHits.length + 1))
  const remaining = Math.min(remainingBurst, remainingSustained)

  await saveRateLimitRecord(record)

  return {
    allowed: true,
    isRateLimited: false,
    code: "ALLOWED",
    limit: limits.burst.limit,
    remaining,
    resetSeconds: limits.sustained.windowSeconds,
    retryAfter: 0,
    captchaRequired: false,
    violationCount: record.violationCount,
    riskScore: record.riskScore,
  }
}

/**
 * Unlock CAPTCHA for a given user or IP after successful verification
 * @param {Object} params
 * @param {string} [params.userId]
 * @param {string} [params.ip]
 * @param {string} params.action
 * @param {number} [params.durationSeconds=600]
 */
export async function unlockCaptcha({ userId, ip, action, durationSeconds = 600 } = {}) {
  const keyObj = buildRateLimitKey({ userId, ip, action })
  const record = await getRateLimitRecord(keyObj)

  record.captchaRequired = false
  record.captchaUnlockedUntil = Date.now() + durationSeconds * 1000
  // When CAPTCHA is verified, clear burst timestamps so the verified user can proceed immediately
  record.timestamps = []
  record.violationCount = 0
  record.riskScore = Math.max(0, record.riskScore - 20)

  await saveRateLimitRecord(record)
  return record
}

/**
 * Record suspicious activity from safety checks (Phase 8 integration)
 * Can escalate risk score and trigger CAPTCHA challenge
 */
export async function recordSuspiciousActivity({ userId, ip, action = "comment_create", score = 30, reason = "" } = {}) {
  const keyObj = buildRateLimitKey({ userId, ip, action })
  const record = await getRateLimitRecord(keyObj)

  record.riskScore += score
  record.violationCount += 1
  record.lastViolationAt = Date.now()

  const threshold = COMMENT_CONFIG.CAPTCHA_TRIGGER_THRESHOLD || 2
  if (record.violationCount >= threshold || record.riskScore >= 60) {
    if (COMMENT_CONFIG.CAPTCHA_ENABLED) {
      record.captchaRequired = true
    }
  }

  await saveRateLimitRecord(record)
  return record
}

/**
 * Reset rate limit counters for a specific user / IP and action (e.g. testing or admin)
 */
export async function resetRateLimits({ userId, ip, action } = {}) {
  const keyObj = buildRateLimitKey({ userId, ip, action })
  inMemoryStore.delete(keyObj.key)

  if (mongoose.connection && mongoose.connection.readyState === 1) {
    try {
      await CommentRateLimit.deleteOne({ key: keyObj.key })
    } catch (err) {}
  }
}

/**
 * Reset all rate limits in memory and database (testing only)
 */
export async function clearAllRateLimits() {
  inMemoryStore.clear()
  if (mongoose.connection && mongoose.connection.readyState === 1) {
    try {
      await CommentRateLimit.deleteMany({})
    } catch (err) {}
  }
}

export default {
  buildRateLimitKey,
  getActionLimits,
  checkRateLimit,
  unlockCaptcha,
  recordSuspiciousActivity,
  resetRateLimits,
  clearAllRateLimits,
}
