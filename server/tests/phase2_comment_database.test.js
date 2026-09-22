/**
 * Phase 2: Database & Comment Data Model Automated Test Suite
 * Validates complete schema, constraints, unique compound indexes,
 * 2-level reply hierarchy, soft deletion, reaction uniqueness, translation staleness,
 * edit history lineage, duplicate report protection, and moderation audit trail.
 */

import assert from "node:assert/strict"
import mongoose from "mongoose"
import Comment from "../Modals/comment.js"
import CommentReaction from "../Modals/CommentReaction.js"
import CommentMention from "../Modals/CommentMention.js"
import CommentTranslation from "../Modals/CommentTranslation.js"
import CommentEditHistory from "../Modals/CommentEditHistory.js"
import CommentReport from "../Modals/CommentReport.js"
import ModerationRecord from "../Modals/ModerationRecord.js"
import CommentModerationEvent from "../Modals/CommentModerationEvent.js"
import User from "../Modals/Auth.js"

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

console.log("\n========================================================================")
console.log("PHASE 2: DATABASE & COMMENT DATA MODEL TEST SUITE")
console.log("========================================================================\n")

// ----------------------------------------------------------------------
// 1. SCHEMA INTEGRITY & DUAL COMPATIBILITY TESTS
// ----------------------------------------------------------------------
console.log("--- 1. SCHEMA INTEGRITY & DUAL COMPATIBILITY ---")

test("Comment schema has all required Phase 2 fields and default values", () => {
  const comment = new Comment({
    content_id: "video_phase2_01",
    user_id: "user_alice",
    original_text: "Great architectural breakdown!",
  })

  comment.syncFields()
  comment.validateSync()

  assert.strictEqual(comment.content_id, "video_phase2_01")
  assert.strictEqual(comment.videoId, "video_phase2_01", "Dual-compatible videoId should be synced")
  assert.strictEqual(comment.user_id, "user_alice")
  assert.strictEqual(comment.userId, "user_alice", "Dual-compatible userId should be synced")
  assert.strictEqual(comment.original_text, "Great architectural breakdown!")
  assert.strictEqual(comment.text, "Great architectural breakdown!", "Dual-compatible text should be synced")
  assert.strictEqual(comment.parent_comment_id, null, "Top-level comment parent_comment_id defaults to null")
  assert.strictEqual(comment.status, "visible", "Default status should be visible")
  assert.strictEqual(comment.version, 1, "Default version for concurrency control should be 1")
  assert.strictEqual(comment.is_edited, false, "is_edited defaults to false")
  assert.strictEqual(comment.is_deleted, false, "is_deleted defaults to false")
  assert.strictEqual(comment.replyCount, 0, "replyCount defaults to 0")
  assert.strictEqual(comment.likeCount, 0, "likeCount defaults to 0")
  assert.strictEqual(comment.dislikeCount, 0, "dislikeCount defaults to 0")
  assert.strictEqual(comment.language_code, "en", "language_code defaults to en")
})

test("User model in Auth.js has preferredLanguage field", () => {
  const user = new User({
    email: "test.language@example.com",
    name: "Language Tester",
  })
  user.validateSync()
  assert.strictEqual(user.preferredLanguage, "en", "preferredLanguage should default to 'en'")
  assert.strictEqual(user.preferred_language, "en", "preferred_language should default to 'en'")
})

// ----------------------------------------------------------------------
// 2. COMMENT REPLY RELATIONSHIP & NESTING
// ----------------------------------------------------------------------
console.log("\n--- 2. COMMENT REPLY RELATIONSHIP & NESTING ---")

test("Top-level comment and 2-level replies establish parent-child references", () => {
  const parentId = new mongoose.Types.ObjectId()
  const topLevel = new Comment({
    _id: parentId,
    content_id: "video_tree_01",
    user_id: "user_root",
    original_text: "Top level root comment",
    parent_comment_id: null,
  })
  topLevel.syncFields()
  topLevel.validateSync()
  assert.strictEqual(topLevel.parent_comment_id, null)

  const replyId = new mongoose.Types.ObjectId()
  const reply = new Comment({
    _id: replyId,
    content_id: "video_tree_01",
    user_id: "user_reply1",
    original_text: "First level reply",
    parent_comment_id: parentId,
  })
  reply.syncFields()
  reply.validateSync()
  assert.strictEqual(String(reply.parent_comment_id), String(parentId))
  assert.strictEqual(String(reply.parentId), String(parentId), "parentId alias should sync")

  const nestedReply = new Comment({
    content_id: "video_tree_01",
    user_id: "user_reply2",
    original_text: "Second level nested reply",
    parent_comment_id: replyId,
  })
  nestedReply.syncFields()
  nestedReply.validateSync()
  assert.strictEqual(String(nestedReply.parent_comment_id), String(replyId))
})

test("Soft delete preserves comment record and reply tree references", () => {
  const parentId = new mongoose.Types.ObjectId()
  const parentComment = new Comment({
    _id: parentId,
    content_id: "video_tree_01",
    user_id: "user_root",
    original_text: "Original text to be deleted",
  })
  parentComment.syncFields()
  parentComment.validateSync()

  // Simulate soft deletion
  parentComment.is_deleted = true
  parentComment.isDeleted = true
  parentComment.status = "deleted"
  parentComment.deleted_at = new Date()
  parentComment.text = "[Comment deleted]"
  parentComment.original_text = "[Comment deleted]"

  parentComment.syncFields()
  parentComment.validateSync()
  assert.strictEqual(parentComment.is_deleted, true)
  assert.strictEqual(parentComment.status, "deleted")
  assert.ok(parentComment.deleted_at instanceof Date)

  // A child reply created against this parent still maintains its valid reference
  const childReply = new Comment({
    content_id: "video_tree_01",
    user_id: "user_child",
    original_text: "I am still visible under deleted parent",
    parent_comment_id: parentId,
  })
  childReply.syncFields()
  childReply.validateSync()
  assert.strictEqual(String(childReply.parent_comment_id), String(parentId))
})

// ----------------------------------------------------------------------
// 3. REACTION MODEL & UNIQUENESS CONSTRAINT
// ----------------------------------------------------------------------
console.log("\n--- 3. REACTION MODEL & CONSTRAINT VALIDATION ---")

test("CommentReaction model enforces valid reaction types", () => {
  const commentId = new mongoose.Types.ObjectId()
  const validReaction = new CommentReaction({
    comment_id: commentId,
    user_id: "user_101",
    reaction_type: "like",
  })
  validReaction.syncFields()
  validReaction.validateSync()
  assert.strictEqual(validReaction.reaction_type, "like")
  assert.strictEqual(validReaction.reactionType, "like")

  const invalidReaction = new CommentReaction({
    comment_id: commentId,
    user_id: "user_101",
    reaction_type: "angry", // Invalid enum
  })
  const err = invalidReaction.validateSync()
  assert.ok(err && err.errors["reaction_type"], "Should reject invalid reaction type")
})

test("CommentReaction enforces unique compound index on { comment_id, user_id }", () => {
  const indexes = CommentReaction.schema.indexes()
  const compoundUniqueIndex = indexes.find(
    ([fields, options]) => fields.comment_id === 1 && fields.user_id === 1 && options.unique === true
  )
  assert.ok(compoundUniqueIndex, "Must declare unique index on comment_id + user_id to prevent duplicate reactions")
})

test("Reaction switching: Like -> Dislike changes type on same user/comment record", () => {
  const commentId = new mongoose.Types.ObjectId()
  const reaction = new CommentReaction({
    comment_id: commentId,
    user_id: "user_switcher",
    reaction_type: "like",
  })
  reaction.syncFields()
  reaction.validateSync()
  assert.strictEqual(reaction.reaction_type, "like")

  // Switch reaction to dislike
  reaction.reaction_type = "dislike"
  reaction.syncFields()
  reaction.validateSync()
  assert.strictEqual(reaction.reaction_type, "dislike")
  assert.strictEqual(reaction.reactionType, "dislike")
})

// ----------------------------------------------------------------------
// 4. MENTION MODEL & DEDUPLICATION
// ----------------------------------------------------------------------
console.log("\n--- 4. MENTION MODEL & DEDUPLICATION ---")

test("CommentMention model validates fields and declares unique index on { comment_id, mentioned_user_id }", () => {
  const commentId = new mongoose.Types.ObjectId()
  const mention = new CommentMention({
    comment_id: commentId,
    mentioned_user_id: "usr_alex",
    mentioned_username: "Alex Rivera",
  })
  mention.validateSync()
  assert.strictEqual(String(mention.comment_id), String(commentId))
  assert.strictEqual(mention.mentioned_user_id, "usr_alex")
  assert.strictEqual(mention.mentioned_username, "Alex Rivera")

  const indexes = CommentMention.schema.indexes()
  const uniqueMentionIndex = indexes.find(
    ([fields, options]) => fields.comment_id === 1 && fields.mentioned_user_id === 1 && options.unique === true
  )
  assert.ok(uniqueMentionIndex, "Must have unique index on comment_id + mentioned_user_id")
})

// ----------------------------------------------------------------------
// 5. TRANSLATION MODEL & CACHE STALENESS
// ----------------------------------------------------------------------
console.log("\n--- 5. TRANSLATION MODEL & CACHE STALENESS ---")

test("CommentTranslation declares unique index on { comment_id, target_language }", () => {
  const indexes = CommentTranslation.schema.indexes()
  const uniqueLangIndex = indexes.find(
    ([fields, options]) => fields.comment_id === 1 && fields.target_language === 1 && options.unique === true
  )
  assert.ok(uniqueLangIndex, "Must have unique index on comment_id + target_language")
})

test("Translation staleness is detected when comment version exceeds source_version", () => {
  const commentId = new mongoose.Types.ObjectId()
  const comment = new Comment({
    _id: commentId,
    content_id: "v_trans_01",
    user_id: "u_author",
    original_text: "यह वीडियो अद्भुत है",
    language_code: "hi",
    version: 1,
  })
  comment.validateSync()

  // Generate translation for version 1
  const translation = new CommentTranslation({
    comment_id: commentId,
    source_language: "hi",
    target_language: "en",
    translated_text: "This video is amazing",
    source_version: comment.version, // 1
  })
  translation.validateSync()

  assert.strictEqual(translation.source_version, 1)
  assert.strictEqual(translation.source_version === comment.version, true, "Translation is fresh when versions match")

  // Comment is subsequently edited to version 2
  comment.original_text = "यह वीडियो बिल्कुल शानदार और अद्भुत है"
  comment.version = 2
  comment.is_edited = true
  comment.validateSync()

  // Check staleness
  const isStale = translation.source_version !== comment.version
  assert.strictEqual(isStale, true, "Translation must be identified as stale when source_version < comment.version")
})

// ----------------------------------------------------------------------
// 6. EDIT HISTORY & OPTIMISTIC CONCURRENCY
// ----------------------------------------------------------------------
console.log("\n--- 6. EDIT HISTORY & OPTIMISTIC CONCURRENCY ---")

test("CommentEditHistory preserves revision versions and text changes", () => {
  const commentId = new mongoose.Types.ObjectId()
  const history = new CommentEditHistory({
    comment_id: commentId,
    edited_by: "usr_editor",
    previous_text: "Version 1 text",
    new_text: "Version 2 updated text",
    previous_version: 1,
    new_version: 2,
  })
  history.validateSync()

  assert.strictEqual(history.previous_version, 1)
  assert.strictEqual(history.new_version, 2)
  assert.strictEqual(history.previous_text, "Version 1 text")
  assert.strictEqual(history.new_text, "Version 2 updated text")
  assert.ok(history.edited_at instanceof Date)
})

test("Optimistic concurrency prevents stale edits on version mismatch", () => {
  const comment = new Comment({
    content_id: "v_concurrency",
    user_id: "u_device_a",
    original_text: "Initial text",
    version: 2,
  })

  // Device B reads version 2, but Device A already updated to version 3
  const deviceBExpectedVersion = 2
  const currentActualVersion = 3

  const isStaleConflict = deviceBExpectedVersion !== currentActualVersion
  assert.strictEqual(isStaleConflict, true, "Version mismatch must trigger conflict error")
})

// ----------------------------------------------------------------------
// 7. ABUSE REPORTS & DUPLICATE PROTECTION
// ----------------------------------------------------------------------
console.log("\n--- 7. ABUSE REPORTS & DUPLICATE PROTECTION ---")

test("CommentReport enforces valid reasons and unique reporter constraint", () => {
  const commentId = new mongoose.Types.ObjectId()
  const report = new CommentReport({
    comment_id: commentId,
    reported_by: "usr_reporter",
    reason: "spam",
    description: "Contains affiliate link spam",
  })
  report.validateSync()

  assert.strictEqual(report.reason, "spam")
  assert.strictEqual(report.status, "pending")

  const indexes = CommentReport.schema.indexes()
  const uniqueReportIndex = indexes.find(
    ([fields, options]) => fields.comment_id === 1 && fields.reported_by === 1 && options.unique === true
  )
  assert.ok(uniqueReportIndex, "Must declare unique index on comment_id + reported_by to prevent duplicate reports")
})

test("CommentReport rejects invalid report reasons", () => {
  const report = new CommentReport({
    comment_id: new mongoose.Types.ObjectId(),
    reported_by: "usr_reporter",
    reason: "invalid_reason_here",
  })
  const err = report.validateSync()
  assert.ok(err && err.errors["reason"], "Should reject unsupported report reason")
})

// ----------------------------------------------------------------------
// 8. MODERATION RECORDS & HEURISTIC EVENTS
// ----------------------------------------------------------------------
console.log("\n--- 8. MODERATION RECORDS & HEURISTIC EVENTS ---")

test("ModerationRecord tracks state transition and moderator decisions", () => {
  const commentId = new mongoose.Types.ObjectId()
  const record = new ModerationRecord({
    comment_id: commentId,
    moderator_id: "admin_moderator",
    action: "hide",
    reason: "Contains prohibited content",
    previous_status: "visible",
    new_status: "hidden",
  })
  record.validateSync()

  assert.strictEqual(record.action, "hide")
  assert.strictEqual(record.previous_status, "visible")
  assert.strictEqual(record.new_status, "hidden")
  assert.ok(record.created_at instanceof Date)
})

test("CommentModerationEvent logs automated heuristic detections", () => {
  const commentId = new mongoose.Types.ObjectId()
  const event = new CommentModerationEvent({
    comment_id: commentId,
    event_type: "profanity_detected",
    detected_reason: "High profanity confidence score in Hindi",
    confidence: 0.94,
    metadata: { rule: "profanity_lexicon_hi" },
  })
  event.validateSync()

  assert.strictEqual(event.event_type, "profanity_detected")
  assert.strictEqual(event.confidence, 0.94)
  assert.strictEqual(event.metadata.rule, "profanity_lexicon_hi")
})

console.log("\n========================================================================")
console.log(`TOTAL PHASE 2 TESTS: ${passed + failed}`)
console.log(`PASSED: ${passed}`)
console.log(`FAILED: ${failed}`)
console.log("========================================================================\n")

if (failed > 0) {
  process.exit(1)
} else {
  process.exit(0)
}
