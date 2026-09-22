import IdempotencyKey from "../../Modals/IdempotencyKey.js"

export class IdempotencyService {
  /**
   * Attempts to atomically register or acquire an idempotency key.
   * If key already exists and status === 'completed', returns the cached response.
   * If status === 'processing', indicates duplicate in-flight attempt.
   */
  static async checkOrAcquire(args, actionParam = "default") {
    let key, userId, action, ttlSeconds, requestHash
    if (typeof args === "string") {
      key = args
      action = actionParam
      ttlSeconds = 86400
      userId = null
      requestHash = null
    } else if (typeof args === "object" && args !== null) {
      key = args.key
      userId = args.userId || null
      action = args.action || "default"
      ttlSeconds = args.ttlSeconds || 86400
      requestHash = args.requestHash || null
    }

    if (!key || String(key).trim().length === 0) {
      return { isDuplicate: false, status: "idle", record: null }
    }

    const cleanKey = String(key).trim()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000)

    try {
      // 1. Check if key already exists
      const existing = await IdempotencyKey.findOne({ key: cleanKey })

      if (existing) {
        if (existing.status === "completed") {
          return {
            isDuplicate: true,
            status: "completed",
            statusCode: existing.statusCode || 200,
            payload: existing.responsePayload,
            responsePayload: existing.responsePayload,
          }
        }
        if (existing.status === "processing") {
          return {
            isDuplicate: true,
            status: "processing",
            message: "Request is currently being processed by another worker.",
          }
        }
      }

      // 2. Create lock record
      const record = await IdempotencyKey.create({
        key: cleanKey,
        userId,
        action,
        status: "processing",
        requestHash,
        expiresAt,
      })

      return {
        isDuplicate: false,
        status: "processing",
        record,
      }
    } catch (err) {
      // If concurrent insert occurred (duplicate key error E11000)
      if (err.code === 11000) {
        const raceExisting = await IdempotencyKey.findOne({ key: cleanKey })
        return {
          isDuplicate: true,
          status: raceExisting?.status || "processing",
          statusCode: raceExisting?.statusCode || 200,
          payload: raceExisting?.responsePayload,
          responsePayload: raceExisting?.responsePayload,
        }
      }
      throw err
    }
  }

  /**
   * Marks idempotency key as completed and caches the authoritative response payload.
   */
  static async complete(key, responsePayload, statusCode = 200) {
    if (!key) return null
    return IdempotencyKey.findOneAndUpdate(
      { key: String(key).trim() },
      {
        $set: {
          status: "completed",
          responsePayload,
          statusCode,
        },
      },
      { new: true }
    )
  }

  /**
   * Marks idempotency key as failed or releases it on unrecoverable errors.
   */
  static async release(key, errorReason = null) {
    if (!key) return null
    if (errorReason) {
      return IdempotencyKey.findOneAndUpdate(
        { key: String(key).trim() },
        { $set: { status: "failed", responsePayload: { error: errorReason } } }
      )
    }
    return IdempotencyKey.deleteOne({ key: String(key).trim() })
  }
}

export default IdempotencyService
