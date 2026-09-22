/**
 * Pagination & Keyset Cursor Utilities (Phase 11)
 *
 * Provides secure, deterministic, tamper-resistant cursor encoding,
 * decoding, validation, and query generation for comment feeds.
 */

import mongoose from "mongoose"

const MIN_VALID_TIMESTAMP = 946684800000 // 2000-01-01T00:00:00.000Z
const MAX_FUTURE_DRIFT_MS = 86400000 // +1 day tolerance for clock drift

/**
 * Encodes cursor components into a URL-safe opaque string.
 */
export function encodeCursor({ sortBy = "newest", timestamp, id, secondaryValue } = {}) {
  if (!id || timestamp === undefined || timestamp === null) {
    return null
  }

  const rawTime = timestamp instanceof Date ? timestamp.getTime() : Number(timestamp)
  if (isNaN(rawTime)) {
    return null
  }

  const payload = {
    v: 1,
    s: String(sortBy).toLowerCase(),
    t: rawTime,
    id: String(id),
  }

  if (secondaryValue !== undefined && secondaryValue !== null) {
    payload.val = Number(secondaryValue)
  }

  return Buffer.from(JSON.stringify(payload)).toString("base64url")
}

/**
 * Decodes and rigorously validates an incoming cursor.
 * Protects against tampering, out-of-range timestamps, invalid IDs, and sort mismatches.
 */
export function decodeAndValidateCursor(cursorString, expectedSortBy = null) {
  if (!cursorString || typeof cursorString !== "string") {
    return null
  }

  const trimmed = cursorString.trim()
  if (trimmed.length > 512) {
    return null // Oversized cursor rejected
  }

  try {
    const rawJson = Buffer.from(trimmed, "base64url").toString("utf8")
    const parsed = JSON.parse(rawJson)

    if (!parsed || typeof parsed !== "object") {
      return null
    }

    // 1. Version check
    if (parsed.v !== 1) {
      return null
    }

    // 2. Sort mode check
    const allowedSorts = ["newest", "oldest", "top", "relevant", "most_liked", "most_relevant"]
    const sort = String(parsed.s || "").toLowerCase()
    if (!allowedSorts.includes(sort)) {
      return null
    }

    if (expectedSortBy) {
      const normExpected = String(expectedSortBy).toLowerCase()
      // Normalize aliases
      const match =
        (normExpected === "top" && ["top", "most_liked"].includes(sort)) ||
        (normExpected === "most_liked" && ["top", "most_liked"].includes(sort)) ||
        (normExpected === "relevant" && ["relevant", "most_relevant"].includes(sort)) ||
        (normExpected === "most_relevant" && ["relevant", "most_relevant"].includes(sort)) ||
        normExpected === sort

      if (!match) {
        return null // Cursor generated for different sort mode
      }
    }

    // 3. Timestamp bounds validation
    const t = Number(parsed.t)
    if (isNaN(t) || t < MIN_VALID_TIMESTAMP || t > Date.now() + MAX_FUTURE_DRIFT_MS) {
      return null
    }

    // 4. Identifier validation (safe hex or alphanumeric string)
    const id = String(parsed.id || "").trim()
    if (!id || id.length > 64 || !/^[a-zA-Z0-9_-]+$/.test(id)) {
      return null
    }

    // 5. Optional secondary value validation
    let val = undefined
    if (parsed.val !== undefined && parsed.val !== null) {
      const numVal = Number(parsed.val)
      if (isNaN(numVal) || numVal < 0) {
        return null
      }
      val = numVal
    }

    return {
      valid: true,
      sortBy: sort,
      timestamp: t,
      date: new Date(t),
      id,
      secondaryValue: val,
    }
  } catch {
    return null // Malformed JSON or base64 decoding failure
  }
}

/**
 * Builds deterministic MongoDB query predicates based on validated cursor.
 */
export function buildCursorQuery({ sortBy = "newest", cursorData, baseQuery = {} } = {}) {
  if (!cursorData || !cursorData.date || !cursorData.id) {
    return baseQuery
  }

  const cursorDate = cursorData.date
  const rawId = cursorData.id
  const targetId = mongoose.Types.ObjectId.isValid(rawId)
    ? new mongoose.Types.ObjectId(rawId)
    : rawId

  const normSort = String(sortBy).toLowerCase()

  if (normSort === "oldest") {
    // Oldest: createdAt ASC, _id ASC
    return {
      ...baseQuery,
      $or: [
        { createdAt: { $gt: cursorDate } },
        { createdAt: cursorDate, _id: { $gt: targetId } },
      ],
    }
  }

  if (normSort === "top" || normSort === "most_liked") {
    // Top: likeCount DESC, createdAt DESC, _id DESC
    const cursorLikes = typeof cursorData.secondaryValue === "number" ? cursorData.secondaryValue : 0
    return {
      ...baseQuery,
      $or: [
        { likeCount: { $lt: cursorLikes } },
        { likeCount: cursorLikes, createdAt: { $lt: cursorDate } },
        { likeCount: cursorLikes, createdAt: cursorDate, _id: { $lt: targetId } },
      ],
    }
  }

  // Default: newest & relevant (createdAt DESC, _id DESC)
  return {
    ...baseQuery,
    $or: [
      { createdAt: { $lt: cursorDate } },
      { createdAt: cursorDate, _id: { $lt: targetId } },
    ],
  }
}

export default {
  encodeCursor,
  decodeAndValidateCursor,
  buildCursorQuery,
}
