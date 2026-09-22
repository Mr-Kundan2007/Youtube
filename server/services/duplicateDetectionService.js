import crypto from "crypto"
import Comment from "../Modals/comment.js"
import { COMMENT_CONFIG } from "../config/commentConfig.js"

/**
 * Duplicate Comment Detection Service
 *
 * Normalizes comment text into a deterministic SHA-256 fingerprint
 * and checks for identical or near-duplicate comments posted by the same user
 * within a configurable time window (DUPLICATE_WINDOW_SECONDS).
 */

/**
 * Normalizes text for duplicate and near-duplicate detection.
 * Strips superficial whitespace, collapses repeated punctuation, and standardizes Unicode.
 * @param {string} text - Raw comment text
 * @returns {string} Normalized string
 */
export const normalizeForDuplicate = (text = "") => {
  if (!text || typeof text !== "string") return ""

  return (
    text
      .normalize("NFKC")
      .toLowerCase()
      .trim()
      // Collapse multiple whitespace characters into a single space
      .replace(/\s+/g, " ")
      // Collapse trailing repeated punctuation (e.g. "!!!" -> "!", "???" -> "?")
      .replace(/([!?,.;:])\1+/g, "$1")
      // Remove punctuation attached to boundaries for near-duplicate comparison
      .replace(/^[!?,.;:\s]+|[!?,.;:\s]+$/g, "")
  )
}

/**
 * Generates a deterministic SHA-256 hash of the normalized comment text.
 * @param {string} text - Raw comment text
 * @returns {string} SHA-256 hex digest
 */
export const generateDuplicateHash = (text = "") => {
  const normalized = normalizeForDuplicate(text)
  return crypto.createHash("sha256").update(normalized).digest("hex")
}

/**
 * Checks whether the current submission is a duplicate or near-duplicate of a recently posted comment.
 * @param {object} params
 * @param {string} params.userId - Authenticated author user ID
 * @param {string} [params.contentId] - Content / Video ID
 * @param {string} params.text - Submitted comment text
 * @param {string} [params.excludeCommentId] - Optional comment ID to exclude (used during edits)
 * @param {number} [params.timeWindowSeconds] - Configurable window in seconds
 * @returns {Promise<{ isDuplicate: boolean, duplicateHash: string, matchedCommentId?: string }>}
 */
export const checkDuplicate = async ({
  userId,
  contentId,
  text,
  excludeCommentId = null,
  timeWindowSeconds = COMMENT_CONFIG.DUPLICATE_WINDOW_SECONDS || 60,
}) => {
  if (!COMMENT_CONFIG.ENABLE_DUPLICATE_DETECTION || !text || !userId) {
    const hash = generateDuplicateHash(text)
    return { isDuplicate: false, duplicateHash: hash }
  }

  const duplicateHash = generateDuplicateHash(text)
  if (!duplicateHash) {
    return { isDuplicate: false, duplicateHash: "" }
  }

  const windowMs = (timeWindowSeconds || 60) * 1000
  const cutoffTime = new Date(Date.now() - windowMs)

  try {
    const query = {
      $or: [{ user_id: String(userId) }, { userId: String(userId) }],
      $and: [
        {
          $or: [
            { duplicate_hash: duplicateHash },
            { duplicateHash: duplicateHash },
          ],
        },
        {
          createdAt: { $gte: cutoffTime },
        },
        {
          is_deleted: { $ne: true },
        },
      ],
    }

    // Exclude current comment ID during edit check
    if (excludeCommentId) {
      query._id = { $ne: excludeCommentId }
    }

    const existingMatch = await Comment.findOne(query).select("_id createdAt original_text").lean()

    if (existingMatch) {
      return {
        isDuplicate: true,
        duplicateHash,
        matchedCommentId: String(existingMatch._id),
      }
    }

    // Secondary fallback: near-duplicate check by comparing normalized text against recent user comments
    const recentUserComments = await Comment.find({
      $or: [{ user_id: String(userId) }, { userId: String(userId) }],
      createdAt: { $gte: cutoffTime },
      is_deleted: { $ne: true },
      ...(excludeCommentId ? { _id: { $ne: excludeCommentId } } : {}),
    })
      .select("_id original_text text duplicate_hash")
      .limit(10)
      .lean()

    const normalizedNew = normalizeForDuplicate(text)
    for (const recent of recentUserComments) {
      const recentText = recent.original_text || recent.text || ""
      const normalizedRecent = normalizeForDuplicate(recentText)
      if (normalizedNew && normalizedNew === normalizedRecent) {
        return {
          isDuplicate: true,
          duplicateHash,
          matchedCommentId: String(recent._id),
        }
      }
    }
  } catch (err) {
    // If DB check encounters error, fail safely without crashing creation
    console.warn("[duplicateDetectionService] DB lookup warning:", err?.message)
  }

  return {
    isDuplicate: false,
    duplicateHash,
  }
}

export default {
  normalizeForDuplicate,
  generateDuplicateHash,
  checkDuplicate,
}
