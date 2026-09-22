/**
 * Phase 7: Multilingual Comment Translation System Test Suite
 * Tests language detection, provider abstraction, version-aware caching,
 * user preferred language priority, same-language bypass, reply translation,
 * soft-deleted comment rejection, token preservation (emojis, mentions, code),
 * and provider error resilience.
 */

import assert from "node:assert/strict"
import mongoose from "mongoose"
import COMMENT_CONFIG from "../config/commentConfig.js"
import {
  detectLanguage,
  translateText,
} from "../services/translationService.js"
import {
  createComment,
  createReply,
  editComment,
  softDeleteComment,
  translateComment,
} from "../services/commentService.js"
import Comment from "../Modals/comment.js"
import CommentTranslation from "../Modals/CommentTranslation.js"
import User from "../Modals/Auth.js"
import { connectTestDb, disconnectTestDb } from "./helpers/testDatabase.js"

let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
    console.log(`  ✓ [PASS] ${name}`)
    passed++
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}`)
    console.error(`    ${err.message}`)
    failed++
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn()
    console.log(`  ✓ [PASS] ${name}`)
    passed++
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}`)
    console.error(`    ${err.message}`)
    failed++
  }
}

const createdTestCommentIds = []
const createdTestUserIds = []

// In-memory mock storage for fallback simulation mode
const mockComments = new Map()
const mockTranslations = new Map()

async function cleanupTestData(isDbConnected) {
  if (isDbConnected) {
    try {
      if (createdTestCommentIds.length > 0) {
        await Comment.deleteMany({ _id: { $in: createdTestCommentIds } })
        await CommentTranslation.deleteMany({ comment_id: { $in: createdTestCommentIds } })
      }
      if (createdTestUserIds.length > 0) {
        await User.deleteMany({ _id: { $in: createdTestUserIds } })
      }
    } catch (err) {
      // Best-effort cleanup
    }
  } else {
    mockComments.clear()
    mockTranslations.clear()
  }
}

async function main() {
  console.log("\n========================================================================")
  console.log("PHASE 7: MULTILINGUAL COMMENT TRANSLATION TEST SUITE")
  console.log("========================================================================\n")

  let isDbConnected = false
  try {
    await connectTestDb()
    isDbConnected = true
    console.log("  [INFO] Connected to test database successfully.\n")
  } catch (err) {
    console.log(`  [INFO] Running in mock simulation mode (live database unavailable: ${err.message}).\n`)
  }

  // Setup mock simulation adapters if MongoDB is not connected
  if (!isDbConnected) {
    Comment.findById = async (id) => {
      const doc = mockComments.get(String(id))
      return doc || null
    }

    Comment.findOne = async (query = {}) => {
      const id = query?._id || query?.id || (query?.$or && query.$or.find((c) => c._id || c.id)?._id)
      if (id && mockComments.has(String(id))) {
        return mockComments.get(String(id))
      }
      for (const doc of mockComments.values()) {
        if (query.content_id && doc.content_id === query.content_id) return doc
      }
      return null
    }

    const originalSave = Comment.prototype.save
    Comment.prototype.save = async function () {
      if (!this._id) {
        this._id = new mongoose.Types.ObjectId()
      }
      if (typeof this.syncFields === "function") {
        this.syncFields()
      }
      mockComments.set(String(this._id), this)
      return this
    }

    CommentTranslation.findOne = (query = {}) => {
      let commentId = query?.comment_id || query?.commentId
      let targetLang = query?.target_language
      if (!commentId && Array.isArray(query?.$or)) {
        for (const clause of query.$or) {
          if (clause?.comment_id || clause?.commentId) {
            commentId = clause.comment_id || clause.commentId
            targetLang = clause.target_language || targetLang
            break
          }
        }
      }
      const key = `${String(commentId)}_${targetLang}`
      const found = mockTranslations.get(key)
      const resultDoc = found ? { ...found } : null

      const promise = Promise.resolve(resultDoc)
      promise.lean = () => Promise.resolve(resultDoc)
      return promise
    }

    CommentTranslation.findOneAndUpdate = async (filter, update) => {
      let commentId = filter?.comment_id || filter?.commentId
      let targetLang = filter?.target_language
      if (!commentId && Array.isArray(filter?.$or)) {
        for (const clause of filter.$or) {
          if (clause?.comment_id || clause?.commentId) {
            commentId = clause.comment_id || clause.commentId
            targetLang = clause.target_language || targetLang
            break
          }
        }
      }
      const key = `${String(commentId)}_${targetLang}`
      const existing = mockTranslations.get(key) || {}
      const setFields = update.$set || update
      const merged = { ...existing, ...setFields }
      mockTranslations.set(key, merged)
      return merged
    }
  }

  // ----------------------------------------------------------------------
  // 1. CONFIGURATION INTEGRITY
  // ----------------------------------------------------------------------
  console.log("--- 1. CONFIGURATION INTEGRITY ---")

  test("COMMENT_CONFIG declares supported languages and translation constants", () => {
    assert.ok(Array.isArray(COMMENT_CONFIG.SUPPORTED_COMMENT_TRANSLATION_LANGUAGES))
    assert.ok(COMMENT_CONFIG.SUPPORTED_COMMENT_TRANSLATION_LANGUAGES.includes("en"))
    assert.ok(COMMENT_CONFIG.SUPPORTED_COMMENT_TRANSLATION_LANGUAGES.includes("hi"))
    assert.ok(COMMENT_CONFIG.SUPPORTED_COMMENT_TRANSLATION_LANGUAGES.includes("pa"))
    assert.ok(COMMENT_CONFIG.SUPPORTED_COMMENT_TRANSLATION_LANGUAGES.includes("es"))
    assert.ok(COMMENT_CONFIG.SUPPORTED_COMMENT_TRANSLATION_LANGUAGES.includes("fr"))
    assert.strictEqual(COMMENT_CONFIG.DEFAULT_TRANSLATION_LANGUAGE, "en")
    assert.ok(typeof COMMENT_CONFIG.TRANSLATION_TIMEOUT_MS === "number")
    assert.ok(COMMENT_CONFIG.TRANSLATION_TIMEOUT_MS > 0)
    assert.ok(Array.isArray(COMMENT_CONFIG.TRANSLATION_STATUSES))
  })

  // ----------------------------------------------------------------------
  // 2. LANGUAGE DETECTION HEURISTICS
  // ----------------------------------------------------------------------
  console.log("\n--- 2. LANGUAGE DETECTION ENGINE ---")

  test("Requirement 1: Devanagari script detected as Hindi ('hi')", () => {
    const lang = detectLanguage("यह वीडियो बहुत अच्छा है और समझने में आसान है।")
    assert.strictEqual(lang, "hi")
  })

  test("Requirement 2: Gurmukhi script detected as Punjabi ('pa')", () => {
    const lang = detectLanguage("ਇਹ ਇੱਕ ਬਹੁਤ ਵਧੀਆ ਵੀਡੀਓ ਹੈ, ਬਹੁਤ ਧੰਨਵਾਦ।")
    assert.strictEqual(lang, "pa")
  })

  test("Requirement 3: Arabic script detected as Arabic ('ar')", () => {
    const lang = detectLanguage("هذا فيديو رائع جداً ومفيد للغاية.")
    assert.strictEqual(lang, "ar")
  })

  test("Requirement 4: Japanese script detected as Japanese ('ja')", () => {
    const lang = detectLanguage("このチュートリアルは本当に素晴らしいです！")
    assert.strictEqual(lang, "ja")
  })

  test("Requirement 5: Cyrillic script detected as Russian ('ru')", () => {
    const lang = detectLanguage("Это отличное видео, спасибо большое за урок!")
    assert.strictEqual(lang, "ru")
  })

  test("Requirement 6: Latin scripts identified using token heuristics (Spanish / French / English)", () => {
    const es = detectLanguage("Hola a todos, este es un video muy bueno y la explicacion es excelente.")
    assert.strictEqual(es, "es")

    const fr = detectLanguage("Bonjour à tous, merci beaucoup pour cette excellente vidéo.")
    assert.strictEqual(fr, "fr")

    const en = detectLanguage("Hello everyone, this is a very good explanation of the tutorial.")
    assert.strictEqual(en, "en")
  })

  test("Requirement 7: Empty, whitespace, or ambiguous text safely returns 'unknown'", () => {
    assert.strictEqual(detectLanguage(""), "unknown")
    assert.strictEqual(detectLanguage("   "), "unknown")
    assert.strictEqual(detectLanguage(null), "unknown")
    assert.strictEqual(detectLanguage("12345 67890"), "unknown")
  })

  // ----------------------------------------------------------------------
  // 3. TARGET LANGUAGE PRIORITY & SAME-LANGUAGE BYPASS
  // ----------------------------------------------------------------------
  console.log("\n--- 3. TARGET LANGUAGE PRIORITY & SAME-LANGUAGE BYPASS ---")

  await runAsyncTest("Requirement 8: Same-language request bypasses provider and returns original text", async () => {
    const comment = new Comment({
      _id: new mongoose.Types.ObjectId(),
      content_id: "test_vid_p7_same",
      user_id: "usr_p7_01",
      original_text: "This is already in English.",
      language_code: "en",
      version: 1,
    })
    comment.syncFields()
    await comment.save()
    createdTestCommentIds.push(comment._id)

    const result = await translateComment({
      commentId: comment._id,
      targetLanguage: "en",
    })

    assert.strictEqual(result.sameLanguage, true)
    assert.strictEqual(result.translatedText, "This is already in English.")
    assert.strictEqual(result.cached, false)
    assert.strictEqual(result.provider, "bypass")
  })

  // ----------------------------------------------------------------------
  // 4. ORIGINAL TEXT PRESERVATION & UNCACHED TRANSLATION
  // ----------------------------------------------------------------------
  console.log("\n--- 4. ORIGINAL TEXT PRESERVATION & UNCACHED TRANSLATION ---")

  let hindiComment = null
  await runAsyncTest("Requirement 9: Uncached translation creates CommentTranslation record without modifying original comment text", async () => {
    hindiComment = new Comment({
      _id: new mongoose.Types.ObjectId(),
      content_id: "test_vid_p7_hindi",
      user_id: "usr_p7_author",
      original_text: "यह बहुत अच्छा explanation है।",
      language_code: "hi",
      version: 1,
    })
    hindiComment.syncFields()
    await hindiComment.save()
    createdTestCommentIds.push(hindiComment._id)

    const result = await translateComment({
      commentId: hindiComment._id,
      targetLanguage: "en",
      userPreferredLanguage: "en",
    })

    assert.strictEqual(result.sourceLanguage, "hi")
    assert.strictEqual(result.targetLanguage, "en")
    assert.strictEqual(result.sourceVersion, 1)
    assert.ok(result.translatedText.length > 0)
    assert.strictEqual(result.cached, false)
    assert.strictEqual(result.status, "completed")

    // Verify original comment remains completely unchanged!
    const refreshedComment = await Comment.findById(hindiComment._id)
    assert.strictEqual(refreshedComment.original_text, "यह बहुत अच्छा explanation है।")
    assert.strictEqual(refreshedComment.text, "यह बहुत अच्छा explanation है।")
    assert.strictEqual(refreshedComment.commentbody, "यह बहुत अच्छा explanation है।")

    // Verify stored record in CommentTranslation
    const transDoc = await CommentTranslation.findOne({
      comment_id: hindiComment._id,
      target_language: "en",
    })
    assert.ok(transDoc, "CommentTranslation record must exist")
    assert.strictEqual(transDoc.source_version, 1)
    assert.strictEqual(transDoc.source_language, "hi")
  })

  // ----------------------------------------------------------------------
  // 5. CACHED TRANSLATION RETRIEVAL
  // ----------------------------------------------------------------------
  console.log("\n--- 5. CACHED TRANSLATION RETRIEVAL ---")

  await runAsyncTest("Requirement 10: Second translation request returns cached translation with cached: true", async () => {
    assert.ok(hindiComment, "hindiComment must exist")

    const result = await translateComment({
      commentId: hindiComment._id,
      targetLanguage: "en",
    })

    assert.strictEqual(result.cached, true)
    assert.strictEqual(result.sourceVersion, 1)
    assert.strictEqual(result.targetLanguage, "en")
    assert.ok(result.translatedText)
  })

  // ----------------------------------------------------------------------
  // 6. VERSION STALENESS ON COMMENT EDIT (PHASE 6 INTEGRATION)
  // ----------------------------------------------------------------------
  console.log("\n--- 6. VERSION STALENESS & CACHE INVALIDATION ---")

  await runAsyncTest("Requirement 11: Editing comment to Version 2 invalidates Version 1 cached translation and generates new Version 2 translation", async () => {
    assert.ok(hindiComment, "hindiComment must exist")

    // Update comment version directly or via edit
    hindiComment.original_text = "सभी को नमस्कार, स्वागत है!"
    hindiComment.text = "सभी को नमस्कार, स्वागत है!"
    hindiComment.commentbody = "सभी को नमस्कार, स्वागत है!"
    hindiComment.version = 2
    hindiComment.is_edited = true
    await hindiComment.save()

    // Old translation has source_version = 1
    const oldCached = await CommentTranslation.findOne({
      comment_id: hindiComment._id,
      target_language: "en",
    })
    assert.strictEqual(oldCached.source_version, 1)
    assert.ok(oldCached.source_version < 2, "Old cache source_version is strictly less than comment version")

    // Request translation again for the updated comment
    const freshTranslation = await translateComment({
      commentId: hindiComment._id,
      targetLanguage: "en",
    })

    // Must generate fresh translation for version 2 (cached: false)
    assert.strictEqual(freshTranslation.cached, false)
    assert.strictEqual(freshTranslation.sourceVersion, 2)
    assert.ok(
      freshTranslation.translatedText.toLowerCase().includes("welcome") ||
      freshTranslation.translatedText.toLowerCase().includes("hello")
    )

    // Verify CommentTranslation now stores updated source_version = 2
    const updatedCacheDoc = await CommentTranslation.findOne({
      comment_id: hindiComment._id,
      target_language: "en",
    })
    assert.strictEqual(updatedCacheDoc.source_version, 2)
  })

  // ----------------------------------------------------------------------
  // 7. MULTIPLE TARGET LANGUAGES
  // ----------------------------------------------------------------------
  console.log("\n--- 7. MULTIPLE TARGET LANGUAGES ---")

  await runAsyncTest("Requirement 12: Translating into different target languages creates independent cached records", async () => {
    assert.ok(hindiComment, "hindiComment must exist")

    // Translate to Spanish
    const esResult = await translateComment({
      commentId: hindiComment._id,
      targetLanguage: "es",
    })
    assert.strictEqual(esResult.targetLanguage, "es")
    assert.strictEqual(esResult.cached, false)

    // Translate to French
    const frResult = await translateComment({
      commentId: hindiComment._id,
      targetLanguage: "fr",
    })
    assert.strictEqual(frResult.targetLanguage, "fr")
    assert.strictEqual(frResult.cached, false)

    // Verify both exist independently
    const esDoc = await CommentTranslation.findOne({ comment_id: hindiComment._id, target_language: "es" })
    const frDoc = await CommentTranslation.findOne({ comment_id: hindiComment._id, target_language: "fr" })
    const enDoc = await CommentTranslation.findOne({ comment_id: hindiComment._id, target_language: "en" })

    assert.ok(esDoc, "Spanish translation record exists")
    assert.ok(frDoc, "French translation record exists")
    assert.ok(enDoc, "English translation record exists")
  })

  // ----------------------------------------------------------------------
  // 8. REPLY TRANSLATION & NESTED HIERARCHY
  // ----------------------------------------------------------------------
  console.log("\n--- 8. REPLY TRANSLATION SUPPORT ---")

  await runAsyncTest("Requirement 13: Child replies can be translated identically to top-level comments", async () => {
    assert.ok(hindiComment, "hindiComment must exist")

    const reply = new Comment({
      _id: new mongoose.Types.ObjectId(),
      parent_comment_id: hindiComment._id,
      content_id: hindiComment.content_id,
      user_id: "usr_p7_reply_author",
      original_text: "ਇਹ ਇੱਕ ਬਹੁਤ ਵਧੀਆ ਵਿਆਖਿਆ ਹੈ।",
      language_code: "pa",
      depth: 2,
      version: 1,
    })
    reply.syncFields()
    await reply.save()
    createdTestCommentIds.push(reply._id)

    const replyTranslation = await translateComment({
      commentId: reply._id,
      targetLanguage: "en",
    })

    assert.strictEqual(replyTranslation.sourceLanguage, "pa")
    assert.strictEqual(replyTranslation.targetLanguage, "en")
    assert.strictEqual(replyTranslation.status, "completed")
    assert.ok(replyTranslation.translatedText.length > 0)
  })

  // ----------------------------------------------------------------------
  // 9. SOFT-DELETED COMMENT REJECTION & ACCESS RULES
  // ----------------------------------------------------------------------
  console.log("\n--- 9. DELETED COMMENTS & ACCESS RESTRICTIONS ---")

  await runAsyncTest("Requirement 14: Soft-deleted comments reject translation with 400", async () => {
    const delComment = new Comment({
      _id: new mongoose.Types.ObjectId(),
      content_id: "test_vid_p7_del",
      user_id: "usr_p7_deleter",
      original_text: "Text to be deleted",
      is_deleted: true,
      status: "deleted",
      version: 1,
    })
    delComment.syncFields()
    await delComment.save()
    createdTestCommentIds.push(delComment._id)

    let caught = null
    try {
      await translateComment({
        commentId: delComment._id,
        targetLanguage: "en",
      })
    } catch (err) {
      caught = err
    }

    assert.ok(caught, "Should reject translation of deleted comment")
    assert.strictEqual(caught.statusCode, 400)
    assert.strictEqual(caught.message, "Cannot translate a deleted comment")
  })

  await runAsyncTest("Requirement 15: Non-existent comment ID rejects with 404", async () => {
    let caught = null
    try {
      await translateComment({
        commentId: new mongoose.Types.ObjectId(),
        targetLanguage: "en",
      })
    } catch (err) {
      caught = err
    }

    assert.ok(caught)
    assert.strictEqual(caught.statusCode, 404)
    assert.strictEqual(caught.message, "Comment not found")
  })

  await runAsyncTest("Requirement 16: Unsupported target language rejects with 400", async () => {
    assert.ok(hindiComment, "hindiComment must exist")

    let caught = null
    try {
      await translateComment({
        commentId: hindiComment._id,
        targetLanguage: "klingon_xyz",
      })
    } catch (err) {
      caught = err
    }

    assert.ok(caught)
    assert.strictEqual(caught.statusCode, 400)
    assert.ok(caught.message.includes("not supported"))
  })

  // ----------------------------------------------------------------------
  // 10. TOKEN PRESERVATION: MENTIONS, EMOJIS & CODE
  // ----------------------------------------------------------------------
  console.log("\n--- 10. TOKEN PRESERVATION (MENTIONS, EMOJIS, CODE) ---")

  await runAsyncTest("Requirement 17: Preserves @mentions and emojis byte-for-byte in translated text", async () => {
    const mixedInput = "Hello @rahul, शानदार काम! 🔥👏"
    const result = await translateText({
      text: mixedInput,
      sourceLanguage: "hi",
      targetLanguage: "en",
    })

    assert.ok(result.translatedText.includes("@rahul"), "Must preserve @rahul mention intact")
    assert.ok(result.translatedText.includes("🔥"), "Must preserve fire emoji")
    assert.ok(result.translatedText.includes("👏"), "Must preserve clapping hands emoji")
  })

  await runAsyncTest("Requirement 18: Preserves technical keywords (React, JavaScript, API)", async () => {
    const technicalInput = "React और JavaScript का यह explanation बहुत अच्छा है"
    const result = await translateText({
      text: technicalInput,
      sourceLanguage: "hi",
      targetLanguage: "en",
    })

    assert.ok(result.translatedText.includes("React"), "Must preserve React")
    assert.ok(result.translatedText.includes("JavaScript"), "Must preserve JavaScript")
  })

  // ----------------------------------------------------------------------
  // 11. PROVIDER TIMEOUT & RATE LIMIT ERROR HANDLING
  // ----------------------------------------------------------------------
  console.log("\n--- 11. PROVIDER TIMEOUT & ERROR RESILIENCE ---")

  await runAsyncTest("Requirement 19: Provider timeout triggers 504 and leaves comment unaffected", async () => {
    assert.ok(hindiComment, "hindiComment must exist")
    process.env.TEST_SIMULATE_TRANSLATION_TIMEOUT = "true"

    let caught = null
    try {
      await translateComment({
        commentId: hindiComment._id,
        targetLanguage: "de", // uncached language
      })
    } catch (err) {
      caught = err
    } finally {
      delete process.env.TEST_SIMULATE_TRANSLATION_TIMEOUT
    }

    assert.ok(caught)
    assert.strictEqual(caught.statusCode, 504)
    assert.ok(caught.message.includes("took too long"))
  })

  await runAsyncTest("Requirement 20: Provider rate limit triggers 429 and preserves clean application error", async () => {
    assert.ok(hindiComment, "hindiComment must exist")
    process.env.TEST_SIMULATE_TRANSLATION_RATE_LIMIT = "true"

    let caught = null
    try {
      await translateComment({
        commentId: hindiComment._id,
        targetLanguage: "it", // uncached language
      })
    } catch (err) {
      caught = err
    } finally {
      delete process.env.TEST_SIMULATE_TRANSLATION_RATE_LIMIT
    }

    assert.ok(caught)
    assert.strictEqual(caught.statusCode, 429)
    assert.ok(caught.message.includes("temporarily unavailable"))
  })

  // Clean up test data
  await cleanupTestData(isDbConnected)
  if (isDbConnected) {
    await disconnectTestDb()
  }

  console.log("\n========================================================================")
  console.log(`TOTAL PHASE 7 TESTS: ${passed + failed}`)
  console.log(`PASSED: ${passed}`)
  console.log(`FAILED: ${failed}`)
  console.log("========================================================================\n")

  if (failed > 0) {
    process.exit(1)
  } else {
    process.exit(0)
  }
}

main().catch((err) => {
  console.error("Fatal error running Phase 7 tests:", err)
  process.exit(1)
})
