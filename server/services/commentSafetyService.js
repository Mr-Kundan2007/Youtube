import { COMMENT_CONFIG } from "../config/commentConfig.js"
import { checkProfanity } from "./profanityService.js"
import { checkLinkSafety } from "./linkSafetyService.js"
import { checkDuplicate, generateDuplicateHash } from "./duplicateDetectionService.js"
import { checkSpamAndFlooding } from "./spamDetectionService.js"
import { recordSuspiciousActivity } from "./rateLimitService.js"

/**
 * Centralized Comment Safety & Content Protection Pipeline
 *
 * Coordinates:
 * 1. Basic length & content validation
 * 2. Multilingual profanity detection
 * 3. Duplicate and near-duplicate detection
 * 4. Spam patterns, repetition, emoji, and mention abuse
 * 5. URL count and malicious link protection
 * 6. User flooding detection
 *
 * Produces an immutable, unified safety decision: ALLOW, FLAG, or REJECT.
 */

export const evaluateCommentSafety = async ({
  text = "",
  userId = "",
  contentId = "",
  isEdit = false,
  excludeCommentId = null,
  currentComment = null,
}) => {
  const trimmed = String(text || "").trim()

  // 1. Basic validation
  if (!trimmed) {
    return {
      decision: "REJECT",
      score: 100,
      reasons: ["EMPTY_CONTENT"],
      signals: {},
      userMessage: "Comment text cannot be empty",
      duplicateHash: "",
    }
  }

  const maxLength = COMMENT_CONFIG.MAX_COMMENT_LENGTH || 2000
  if (trimmed.length > maxLength) {
    return {
      decision: "REJECT",
      score: 100,
      reasons: ["LENGTH_EXCEEDED"],
      signals: {},
      userMessage: `Comment exceeds maximum allowed length of ${maxLength} characters`,
      duplicateHash: "",
    }
  }

  const duplicateHash = generateDuplicateHash(trimmed)
  const allReasons = []
  let totalScore = 0

  // 2. Profanity check
  const profanityResult = checkProfanity(trimmed)
  if (profanityResult.isProfane) {
    if (profanityResult.severity === "reject") {
      allReasons.push(...profanityResult.detectedWords.map((w) => `PROFANITY_${w.toUpperCase()}`))
      return {
        decision: "REJECT",
        score: 100,
        reasons: allReasons,
        signals: { profanity: true },
        userMessage: "This comment contains language that is not allowed.",
        duplicateHash,
      }
    } else {
      // Mild term
      allReasons.push("MILD_PROFANITY_DETECTED")
      totalScore += 45
    }
  }

  // 3. Link safety & malicious URL check
  const linkResult = checkLinkSafety(trimmed)
  if (linkResult.hasUnsafeScheme) {
    allReasons.push(...linkResult.reasons)
    return {
      decision: "REJECT",
      score: 100,
      reasons: allReasons,
      signals: { unsafeScheme: true },
      userMessage: "This comment contains an unsupported or unsafe link.",
      duplicateHash,
    }
  }

  if (linkResult.reasons.includes("EXCESSIVE_URL_COUNT")) {
    allReasons.push("EXCESSIVE_URL_COUNT")
    return {
      decision: "REJECT",
      score: 90,
      reasons: allReasons,
      signals: { excessiveUrls: true },
      userMessage: "This comment contains too many links.",
      duplicateHash,
    }
  }

  if (linkResult.isSuspicious) {
    allReasons.push(...linkResult.reasons)
    totalScore += 40
  }

  // 4. Duplicate comment detection
  // For edits, if text is identical to current comment, editComment handles no-op.
  // If user submits a different text that duplicates another recent comment, checkDuplicate detects it.
  const duplicateResult = await checkDuplicate({
    userId,
    contentId,
    text: trimmed,
    excludeCommentId: excludeCommentId || (currentComment ? currentComment._id : null),
  })

  if (duplicateResult.isDuplicate) {
    allReasons.push("DUPLICATE_CONTENT_DETECTED")
    return {
      decision: "REJECT",
      score: 100,
      reasons: allReasons,
      signals: { duplicate: true },
      userMessage: "You have already posted this comment recently.",
      duplicateHash,
    }
  }

  // 5. Spam and flooding detection
  const spamResult = await checkSpamAndFlooding({
    text: trimmed,
    userId,
    contentId,
  })

  totalScore += spamResult.spamScore
  if (spamResult.reasons.length > 0) {
    allReasons.push(...spamResult.reasons)
  }

  // Flooding is an immediate REJECT
  if (spamResult.isFlooding) {
    recordSuspiciousActivity({
      userId,
      action: isEdit ? "comment_edit" : "comment_create",
      score: 50,
      reason: "Flooding detected",
    }).catch(() => {})

    return {
      decision: "REJECT",
      score: 100,
      reasons: allReasons,
      signals: { flooding: true, ...spamResult.signals },
      userMessage: "You are posting comments too quickly. Please try again later.",
      duplicateHash,
    }
  }

  // Hard spam threshold check
  const rejectThreshold = COMMENT_CONFIG.SPAM_SCORE_THRESHOLD_REJECT || 70
  if (totalScore >= rejectThreshold) {
    recordSuspiciousActivity({
      userId,
      action: isEdit ? "comment_edit" : "comment_create",
      score: 30,
      reason: "Hard spam threshold exceeded",
    }).catch(() => {})

    return {
      decision: "REJECT",
      score: totalScore,
      reasons: allReasons,
      signals: { spam: true, ...spamResult.signals },
      userMessage: "This comment appears to be spam.",
      duplicateHash,
    }
  }

  // Soft flag threshold check
  const flagThreshold = COMMENT_CONFIG.SPAM_SCORE_THRESHOLD_FLAG || 40
  if (totalScore >= flagThreshold || allReasons.length > 0) {
    return {
      decision: "FLAG",
      score: totalScore,
      reasons: allReasons,
      signals: { flagged: true, ...spamResult.signals },
      userMessage: "Comment posted and flagged for review.",
      duplicateHash,
    }
  }

  // All safety checks passed
  return {
    decision: "ALLOW",
    score: 0,
    reasons: [],
    signals: {
      profanity: false,
      duplicate: false,
      excessiveUrls: false,
      unsafeScheme: false,
      repetition: false,
      specialCharAbuse: false,
      emojiAbuse: false,
      mentionSpam: false,
      flooding: false,
    },
    userMessage: "",
    duplicateHash,
  }
}

export default {
  evaluateCommentSafety,
}
