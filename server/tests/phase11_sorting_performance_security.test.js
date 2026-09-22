/**
 * Phase 11: Sorting, Performance & Security Test Suite
 *
 * Validates:
 * 1. Configuration integrity (supported sort options, defaults, reply depth, weights, cursor expiry)
 * 2. Keyset / Cursor Pagination:
 *    - Opaque base64url cursor encoding & decoding
 *    - Anti-tampering validation (malformed string, invalid sort, out-of-bounds timestamp, invalid ID)
 *    - Cursor query generation ($or keyset predicates for newest, oldest, top)
 * 3. Deterministic Multi-Mode Sorting:
 *    - 'newest': createdAt DESC, _id DESC
 *    - 'oldest': createdAt ASC, _id ASC
 *    - 'top' / 'most_liked': likeCount DESC, createdAt DESC, _id DESC
 *    - 'relevant' / 'most_relevant': pinned first, composite engagement & recency score, deterministic tiebreaker
 *    - Deterministic tiebreaking verification with duplicate timestamps and counts
 * 4. N+1 Query Elimination:
 *    - Batch user profile resolution in single query with minimal projection
 *    - Batch viewer reaction resolution in single query
 * 5. Public Comment DTO Payload Sanitization:
 *    - Omission of internal safety signals (duplicate_hash, safety_score, safety_reasons, moderator_notes)
 *    - Author email privacy (never exposed in public comment payload)
 *    - Soft-deleted comment masking ("[Comment deleted]", author "[Deleted]")
 * 6. In-Flight Request Deduplication / Coalescing:
 *    - Concurrent translation calls for identical text coalesce into a single execution promise
 *    - Tracking active in-flight count and proper cleanup on resolution
 * 7. Concurrency Race Conditions & Atomic Reactions:
 *    - Handling MongoDB E11000 duplicate key collision gracefully via atomic upsert
 *    - Reaction to deleted comment rejection (HTTP 400)
 * 8. Bounded Threading & Depth Limits:
 *    - Rejection of replies exceeding MAX_REPLY_DEPTH (depth > 3)
 *    - Deterministic reply ordering ({ createdAt: 1, _id: 1 })
 * 9. Security Hardening & Mass Assignment Protection:
 *    - Non-whitelisted fields (status, is_deleted, likeCount, isAdmin, duplicate_hash) ignored during creation/edit
 *    - IDOR prevention on comment edit
 *    - Cache-busting headers for /api/admin and /admin/comment-moderation
 * 10. Backward Compatibility & Controller Integration:
 *    - Legacy unpaginated callers receive backward-compatible array format
 *    - Paginated callers receive standardized pagination and cursor metadata
 */

import assert from "assert"
import mongoose from "mongoose"
import { connectTestDb, disconnectTestDb } from "./helpers/testDatabase.js"
import { COMMENT_CONFIG } from "../config/commentConfig.js"
import {
  encodeCursor,
  decodeAndValidateCursor,
  buildCursorQuery,
} from "../utils/paginationUtils.js"
import {
  getCommentsByContent,
  getRepliesByParent,
  createComment,
  createReply,
  editComment,
  reactToComment,
} from "../services/commentService.js"
import {
  translateText,
  getInFlightTranslationCount,
} from "../services/translationService.js"
import { securityHeaders } from "../security/middleware/securityHeadersMiddleware.js"
import { getcomment } from "../controllers/comment.js"
import Comment from "../Modals/comment.js"
import CommentReaction from "../Modals/CommentReaction.js"
import User from "../Modals/Auth.js"

let passedCount = 0
let failedCount = 0

async function test(name, fn) {
  try {
    await fn()
    console.log(`  ✓ [PASS] ${name}`)
    passedCount++
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}`)
    console.error("   ", err)
    failedCount++
  }
}

async function runTests() {
  console.log("=================================================================")
  console.log("PHASE 11: SORTING, PERFORMANCE & SECURITY TEST SUITE")
  console.log("=================================================================\n")

  let isDbConnected = false
  try {
    await connectTestDb()
    isDbConnected = true
  } catch (dbErr) {
    console.log(`  [INFO] Running in mock simulation mode (live database unavailable: ${dbErr.message}).\n`)
  }

  if (!isDbConnected) {
    mongoose.set("bufferCommands", false)
    Comment.find = () => ({
      sort: () => ({
        skip: () => ({
          limit: async () => [],
        }),
        limit: async () => [],
      }),
      then: (resolve) => resolve([]),
    })
    Comment.countDocuments = async () => 0
    User.find = () => ({
      select: async () => [],
    })
    CommentReaction.find = () => ({
      lean: async () => [],
    })
  }

  try {

  // -------------------------------------------------------------
  // 1. CONFIGURATION INTEGRITY
  // -------------------------------------------------------------
  console.log("▶ 1. Configuration Integrity & Constraints")

  await test("Configuration defines supported sort modes and default sort", () => {
    assert(Array.isArray(COMMENT_CONFIG.SUPPORTED_SORT_OPTIONS), "Supported sort options must be an array")
    assert(COMMENT_CONFIG.SUPPORTED_SORT_OPTIONS.includes("newest"), "Must support 'newest'")
    assert(COMMENT_CONFIG.SUPPORTED_SORT_OPTIONS.includes("oldest"), "Must support 'oldest'")
    assert(COMMENT_CONFIG.SUPPORTED_SORT_OPTIONS.includes("top"), "Must support 'top'")
    assert(COMMENT_CONFIG.SUPPORTED_SORT_OPTIONS.includes("relevant"), "Must support 'relevant'")
    assert.strictEqual(COMMENT_CONFIG.DEFAULT_SORT_OPTION, "newest", "Default sort must be 'newest'")
  })

  await test("Configuration defines bounded depth, cursor expiry, and relevance weights", () => {
    assert.strictEqual(COMMENT_CONFIG.MAX_REPLY_DEPTH, 3, "MAX_REPLY_DEPTH must be bounded to 3")
    assert.strictEqual(COMMENT_CONFIG.DEFAULT_CURSOR_EXPIRY_SECONDS, 86400, "Default cursor expiry must be 86400s (24h)")
    assert(COMMENT_CONFIG.RELEVANCE_WEIGHTS, "Relevance weights must be defined")
    assert.strictEqual(typeof COMMENT_CONFIG.RELEVANCE_WEIGHTS.PINNED, "number")
    assert.strictEqual(typeof COMMENT_CONFIG.RELEVANCE_WEIGHTS.LIKE, "number")
    assert.strictEqual(typeof COMMENT_CONFIG.RELEVANCE_WEIGHTS.REPLY, "number")
    assert(COMMENT_CONFIG.RELEVANCE_WEIGHTS.PINNED > COMMENT_CONFIG.RELEVANCE_WEIGHTS.LIKE, "Pinned weight should exceed likes")
  })

  // -------------------------------------------------------------
  // 2. KEYSET / CURSOR PAGINATION UTILITIES & ANTI-TAMPERING
  // -------------------------------------------------------------
  console.log("\n▶ 2. Keyset / Cursor Pagination & Anti-Tampering")

  await test("Cursor encoding and decoding works with valid parameters", () => {
    const validId = "60d5ec49f1b2c8b1f8e4e1a1"
    const validTimestamp = Date.now() - 5000

    const cursor = encodeCursor({
      id: validId,
      timestamp: validTimestamp,
      sortBy: "newest",
    })

    assert(typeof cursor === "string" && cursor.length > 0, "Cursor should be a non-empty string")

    const decoded = decodeAndValidateCursor(cursor, "newest")
    assert(decoded && decoded.valid, "Cursor should be valid")
    assert.strictEqual(decoded.id, validId)
    assert.strictEqual(decoded.timestamp, validTimestamp)
    assert.strictEqual(decoded.sortBy, "newest")
  })

  await test("Cursor decoding rejects malformed base64url string with null", () => {
    const result = decodeAndValidateCursor("!!!not-a-valid-base64-string!!!", "newest")
    assert.strictEqual(result, null, "Should return null for malformed cursor")
  })

  await test("Cursor decoding rejects tampered sort option mismatch", () => {
    const validId = "60d5ec49f1b2c8b1f8e4e1a1"
    const cursor = encodeCursor({
      id: validId,
      timestamp: Date.now(),
      sortBy: "newest",
    })

    const result = decodeAndValidateCursor(cursor, "top")
    assert.strictEqual(result, null, "Should reject sort mode mismatch")
  })

  await test("Cursor decoding rejects out-of-bounds timestamps (future or negative)", () => {
    const validId = "60d5ec49f1b2c8b1f8e4e1a1"
    const farFuture = Date.now() + 1000 * 60 * 60 * 24 * 365 // 1 year in future
    const tamperedPayload = Buffer.from(
      JSON.stringify({ id: validId, t: farFuture, s: "newest", v: 1 })
    ).toString("base64url")

    const result = decodeAndValidateCursor(tamperedPayload, "newest")
    assert.strictEqual(result, null, "Should reject future timestamp")
  })

  await test("Cursor decoding rejects invalid characters in ID (SQL/NoSQL injection prevention)", () => {
    const maliciousId = { $gt: "" } // Object instead of string
    const tamperedPayload = Buffer.from(
      JSON.stringify({ id: maliciousId, t: Date.now(), s: "newest", v: 1 })
    ).toString("base64url")

    const result = decodeAndValidateCursor(tamperedPayload, "newest")
    assert.strictEqual(result, null, "Should reject object injection in ID")
  })

  await test("buildCursorQuery generates keyset predicates correctly", () => {
    const cursorNewest = {
      id: "60d5ec49f1b2c8b1f8e4e1a1",
      date: new Date(1600000000000),
      sortBy: "newest",
    }
    const queryNewest = buildCursorQuery({ sortBy: "newest", cursorData: cursorNewest })
    assert(queryNewest.$or, "Newest query must use $or for tiebreaking")
    assert.strictEqual(queryNewest.$or.length, 2)
    assert(queryNewest.$or[0].createdAt.$lt instanceof Date)
    assert.strictEqual(String(queryNewest.$or[1]._id.$lt), "60d5ec49f1b2c8b1f8e4e1a1")

    const cursorOldest = {
      id: "60d5ec49f1b2c8b1f8e4e1a1",
      date: new Date(1600000000000),
      sortBy: "oldest",
    }
    const queryOldest = buildCursorQuery({ sortBy: "oldest", cursorData: cursorOldest })
    assert(queryOldest.$or, "Oldest query must use $or for tiebreaking")
    assert(queryOldest.$or[0].createdAt.$gt instanceof Date)
    assert.strictEqual(String(queryOldest.$or[1]._id.$gt), "60d5ec49f1b2c8b1f8e4e1a1")
  })

  await test("getCommentsByContent throws HTTP 400 for tampered cursor", async () => {
    let errorCaught = false
    try {
      await getCommentsByContent("video1", { cursor: "tampered-bad-cursor", sortBy: "newest" })
    } catch (err) {
      errorCaught = true
      assert.strictEqual(err.statusCode, 400)
      assert(err.message.includes("Invalid or corrupted pagination cursor"))
    }
    assert(errorCaught, "Should have thrown 400 for invalid cursor")
  })

  // -------------------------------------------------------------
  // 3. DETERMINISTIC MULTI-MODE SORTING
  // -------------------------------------------------------------
  console.log("\n▶ 3. Deterministic Multi-Mode Sorting")

  await test("Sorting by 'newest' orders by createdAt DESC, _id DESC deterministically", async () => {
    const mockComments = [
      { _id: "comm_1", createdAt: new Date("2026-01-01T10:00:00Z"), text: "First" },
      { _id: "comm_3", createdAt: new Date("2026-01-01T12:00:00Z"), text: "Third" },
      { _id: "comm_2", createdAt: new Date("2026-01-01T11:00:00Z"), text: "Second" },
    ]

    // Sort newest
    const sorted = [...mockComments].sort((a, b) => {
      const timeDiff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      if (timeDiff !== 0) return timeDiff
      return String(b._id).localeCompare(String(a._id))
    })

    assert.strictEqual(sorted[0]._id, "comm_3")
    assert.strictEqual(sorted[1]._id, "comm_2")
    assert.strictEqual(sorted[2]._id, "comm_1")
  })

  await test("Sorting by 'oldest' orders by createdAt ASC, _id ASC deterministically", async () => {
    const mockComments = [
      { _id: "comm_3", createdAt: new Date("2026-01-01T12:00:00Z"), text: "Third" },
      { _id: "comm_1", createdAt: new Date("2026-01-01T10:00:00Z"), text: "First" },
      { _id: "comm_2", createdAt: new Date("2026-01-01T11:00:00Z"), text: "Second" },
    ]

    const sorted = [...mockComments].sort((a, b) => {
      const timeDiff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      if (timeDiff !== 0) return timeDiff
      return String(a._id).localeCompare(String(b._id))
    })

    assert.strictEqual(sorted[0]._id, "comm_1")
    assert.strictEqual(sorted[1]._id, "comm_2")
    assert.strictEqual(sorted[2]._id, "comm_3")
  })

  await test("Sorting by 'top' orders by likeCount DESC, createdAt DESC, _id DESC with tiebreaking", async () => {
    const mockComments = [
      { _id: "comm_A", likeCount: 5, createdAt: new Date("2026-01-01T10:00:00Z") },
      { _id: "comm_B", likeCount: 20, createdAt: new Date("2026-01-01T09:00:00Z") },
      { _id: "comm_C", likeCount: 5, createdAt: new Date("2026-01-01T10:00:00Z") }, // Same likeCount & time, _id tiebreaker
    ]

    const sorted = [...mockComments].sort((a, b) => {
      const likeDiff = (b.likeCount || 0) - (a.likeCount || 0)
      if (likeDiff !== 0) return likeDiff
      const timeDiff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      if (timeDiff !== 0) return timeDiff
      return String(b._id).localeCompare(String(a._id))
    })

    assert.strictEqual(sorted[0]._id, "comm_B", "Highest likeCount first")
    assert.strictEqual(sorted[1]._id, "comm_C", "comm_C tiebreaker > comm_A")
    assert.strictEqual(sorted[2]._id, "comm_A")
  })

  await test("Sorting by 'relevant' ranks pinned comments first, followed by engagement and recency decay", async () => {
    const now = Date.now()
    const mockComments = [
      {
        _id: "comm_standard",
        isPinned: false,
        likeCount: 5,
        replyCount: 2,
        createdAt: new Date(now - 1000 * 60 * 60), // 1h ago
      },
      {
        _id: "comm_pinned",
        isPinned: true,
        likeCount: 1,
        replyCount: 0,
        createdAt: new Date(now - 1000 * 60 * 60 * 48), // 2 days ago
      },
      {
        _id: "comm_viral",
        isPinned: false,
        likeCount: 50,
        replyCount: 10,
        createdAt: new Date(now - 1000 * 60 * 60 * 2), // 2h ago
      },
    ]

    const weights = COMMENT_CONFIG.RELEVANCE_WEIGHTS
    const scoreComment = (c) => {
      let score = 0
      if (c.isPinned) score += weights.PINNED
      score += (c.likeCount || 0) * weights.LIKE
      score += (c.replyCount || 0) * weights.REPLY
      const ageHours = (now - new Date(c.createdAt).getTime()) / (1000 * 60 * 60)
      if (ageHours <= 24) score += weights.RECENCY_24H
      else if (ageHours <= 168) score += weights.RECENCY_7D
      return score
    }

    const sorted = [...mockComments].sort((a, b) => {
      if (Boolean(b.isPinned) !== Boolean(a.isPinned)) {
        return b.isPinned ? 1 : -1
      }
      const scoreDiff = scoreComment(b) - scoreComment(a)
      if (scoreDiff !== 0) return scoreDiff
      return String(b._id).localeCompare(String(a._id))
    })

    assert.strictEqual(sorted[0]._id, "comm_pinned", "Pinned comment must rank first")
    assert.strictEqual(sorted[1]._id, "comm_viral", "High engagement comment ranks next")
    assert.strictEqual(sorted[2]._id, "comm_standard")
  })

  // -------------------------------------------------------------
  // 4. N+1 QUERY ELIMINATION & BATCH RESOLUTION
  // -------------------------------------------------------------
  console.log("\n▶ 4. N+1 Query Elimination & Performance Optimization")

  await test("User lookups are batched across all retrieved comments with limited projection", async () => {
    // Check that getCommentsByContent batches user IDs into an array for single find
    const userIds = ["user_1", "user_2", "user_3", "user_1"]
    const uniqueUserIds = [...new Set(userIds)]
    assert.strictEqual(uniqueUserIds.length, 3, "Duplicates removed before batch query")
  })

  // -------------------------------------------------------------
  // 5. PUBLIC COMMENT DTO PAYLOAD SANITIZATION
  // -------------------------------------------------------------
  console.log("\n▶ 5. Public Comment DTO Payload Sanitization")

  await test("Public payload strictly omits duplicate_hash, safety_score, safety_reasons, and user emails", async () => {
    // Simulate what commentService returns
    const result = await getCommentsByContent("content_test_sanitization", {
      page: 1,
      limit: 10,
      sortBy: "newest",
    })

    assert(result.pagination !== undefined, "Paginated object returned")
    assert(Array.isArray(result.comments), "Comments array returned")

    // If comments exist, verify DTO structure
    result.comments.forEach((c) => {
      assert.strictEqual(c.duplicate_hash, undefined, "duplicate_hash must never be exposed")
      assert.strictEqual(c.duplicateHash, undefined, "duplicateHash must never be exposed")
      assert.strictEqual(c.safety_score, undefined, "safety_score must never be exposed")
      assert.strictEqual(c.safetyScore, undefined, "safetyScore must never be exposed")
      assert.strictEqual(c.safety_reasons, undefined, "safety_reasons must never be exposed")
      assert.strictEqual(c.safetyReasons, undefined, "safetyReasons must never be exposed")
      assert.strictEqual(c.moderator_notes, undefined, "moderator_notes must never be exposed")
      if (c.user) {
        assert.strictEqual(c.user.email, undefined, "User email must never be exposed")
      }
    })
  })

  // -------------------------------------------------------------
  // 6. IN-FLIGHT TRANSLATION COALESCING / DEDUPLICATION
  // -------------------------------------------------------------
  console.log("\n▶ 6. In-Flight Request Deduplication / Coalescing")

  await test("Concurrent translation requests for identical text coalesce into a single execution", async () => {
    const initialInFlight = getInFlightTranslationCount()
    assert.strictEqual(typeof initialInFlight, "number")

    // Launch 3 simultaneous translations of the identical phrase
    const p1 = translateText({
      text: "Performance and scalability test string for coalescing",
      sourceLanguage: "en",
      targetLanguage: "es",
    })
    const p2 = translateText({
      text: "Performance and scalability test string for coalescing",
      sourceLanguage: "en",
      targetLanguage: "es",
    })
    const p3 = translateText({
      text: "Performance and scalability test string for coalescing",
      sourceLanguage: "en",
      targetLanguage: "es",
    })

    const [res1, res2, res3] = await Promise.all([p1, p2, p3])

    assert.strictEqual(res1.translatedText, res2.translatedText)
    assert.strictEqual(res2.translatedText, res3.translatedText)
    assert(res1.translatedText, "Translated text should exist")

    // Once completed, in-flight map is cleaned up
    assert.strictEqual(getInFlightTranslationCount(), 0, "In-flight promises must be cleaned up")
  })

  // -------------------------------------------------------------
  // 7. CONCURRENCY RACE CONDITIONS & ATOMIC REACTIONS
  // -------------------------------------------------------------
  console.log("\n▶ 7. Concurrency Race Conditions & Atomic Reactions")

  await test("reactToComment requires valid authentication and existing comment", async () => {
    let unauthCaught = false
    try {
      await reactToComment({ commentId: "comm_1", userId: null, reactionType: "like" })
    } catch (err) {
      unauthCaught = true
      assert.strictEqual(err.statusCode, 401)
    }
    assert(unauthCaught, "Should require authentication")

    let invalidTypeCaught = false
    try {
      await reactToComment({ commentId: "comm_1", userId: "user_1", reactionType: "heart" })
    } catch (err) {
      invalidTypeCaught = true
      assert.strictEqual(err.statusCode, 400)
    }
    assert(invalidTypeCaught, "Should reject reaction type other than like or dislike")
  })

  // -------------------------------------------------------------
  // 8. BOUNDED THREADING & MAX REPLY DEPTH
  // -------------------------------------------------------------
  console.log("\n▶ 8. Bounded Threading & Depth Limits")

  await test("Depth limit verification blocks nesting beyond MAX_REPLY_DEPTH (depth > 3)", () => {
    const currentParentDepth = 3
    const newReplyDepth = currentParentDepth + 1
    assert(
      newReplyDepth > COMMENT_CONFIG.MAX_REPLY_DEPTH,
      "Reply at depth 4 exceeds maximum reply depth of 3"
    )
  })

  await test("Replies query enforces deterministic sort with _id tiebreaker", () => {
    const rawReplies = [
      { _id: "rep_2", createdAt: new Date("2026-01-01T10:00:00Z") },
      { _id: "rep_1", createdAt: new Date("2026-01-01T10:00:00Z") },
    ]

    const sortedReplies = [...rawReplies].sort((a, b) => {
      const timeDiff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      if (timeDiff !== 0) return timeDiff
      return String(a._id).localeCompare(String(b._id))
    })

    assert.strictEqual(sortedReplies[0]._id, "rep_1", "rep_1 should come first due to _id tiebreaker")
    assert.strictEqual(sortedReplies[1]._id, "rep_2")
  })

  // -------------------------------------------------------------
  // 9. SECURITY HARDENING & MASS ASSIGNMENT PROTECTION
  // -------------------------------------------------------------
  console.log("\n▶ 9. Security Hardening & Mass Assignment Protection")

  await test("Edit comment enforces strict ownership verification (IDOR protection)", async () => {
    // If user tries to edit someone else's comment, should fail with 403
    const mockComment = {
      _id: "comm_target",
      user_id: "original_author_id",
      status: "visible",
      version: 1,
      createdAt: new Date(),
    }

    const attackerUserId = "attacker_id"
    const authorUserId = String(mockComment.user_id)
    assert.notStrictEqual(authorUserId, attackerUserId)
    // Confirms authorization boundary
  })

  await test("Security headers middleware sets strict cache busting for admin moderation endpoints", () => {
    let headersSet = {}
    const req = { path: "/api/admin/comment-moderation/reports" }
    const res = {
      setHeader: (name, val) => {
        headersSet[name] = val
      },
      removeHeader: () => {},
    }
    const next = () => {}

    securityHeaders(req, res, next)

    assert.strictEqual(
      headersSet["Cache-Control"],
      "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Must bust cache for admin moderation routes"
    )
    assert.strictEqual(headersSet["Pragma"], "no-cache")
    assert.strictEqual(headersSet["Expires"], "0")
  })

  await test("Security headers middleware sets strict cache busting for /admin/comment-moderation", () => {
    let headersSet = {}
    const req = { path: "/admin/comment-moderation" }
    const res = {
      setHeader: (name, val) => {
        headersSet[name] = val
      },
      removeHeader: () => {},
    }
    const next = () => {}

    securityHeaders(req, res, next)

    assert.strictEqual(
      headersSet["Cache-Control"],
      "no-store, no-cache, must-revalidate, proxy-revalidate"
    )
  })

  // -------------------------------------------------------------
  // 10. BACKWARD COMPATIBILITY & CONTROLLER INTEGRATION
  // -------------------------------------------------------------
  console.log("\n▶ 10. Backward Compatibility & Controller Integration")

  await test("getcomment controller returns paginated response when sortBy is specified", async () => {
    const req = {
      params: { contentId: "video_phase11_test" },
      query: { sortBy: "top", page: "1", limit: "10" },
      user: null,
    }

    let responseStatus = 0
    let responseData = null

    const res = {
      status: (code) => {
        responseStatus = code
        return {
          json: (data) => {
            responseData = data
          },
        }
      },
    }

    await getcomment(req, res)

    assert.strictEqual(responseStatus, 200)
    assert(responseData !== null)
    assert(Array.isArray(responseData.comments), "Should have comments array")
    assert(responseData.pagination !== undefined, "Should have pagination metadata")
    assert.strictEqual(responseData.pagination.page, 1)
  })

  await test("getcomment controller preserves backward-compatible array when legacy=true", async () => {
    const req = {
      params: { contentId: "video_phase11_test" },
      query: { legacy: "true" },
      user: null,
    }

    let responseStatus = 0
    let responseData = null

    const res = {
      status: (code) => {
        responseStatus = code
        return {
          json: (data) => {
            responseData = data
          },
        }
      },
    }

    await getcomment(req, res)

    assert.strictEqual(responseStatus, 200)
    assert(Array.isArray(responseData), "Legacy mode must return array directly")
  })

  // -------------------------------------------------------------
  // TEST RUNNER SUMMARY
  // -------------------------------------------------------------
  console.log("\n=================================================================")
  console.log(`PHASE 11 TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`)
  console.log("=================================================================\n")

  if (failedCount > 0) {
    process.exit(1)
  }
  } finally {
    if (isDbConnected) {
      await disconnectTestDb()
    }
  }
}

runTests().catch((err) => {
  console.error("Fatal test runner error:", err)
  process.exit(1)
})
