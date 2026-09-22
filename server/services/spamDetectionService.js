import Comment from "../Modals/comment.js"
import { COMMENT_CONFIG } from "../config/commentConfig.js"

/**
 * Spam, Flooding & Pattern Abuse Detection Service
 *
 * Evaluates comment submissions across multiple spam signals:
 * - Repeated character abuse (e.g., "heyyyyyyyyyyyy")
 * - Excessive special character ratios (e.g., "!?!?!?!?!?!?")
 * - Emoji abuse (e.g., 20 flame emojis with no substantive text)
 * - Mention spam (> 5 mentions)
 * - Promotional spam patterns
 * - High-frequency user flooding
 *
 * Produces a composite score from 0 to 100 with clear ALLOW / FLAG / REJECT thresholds.
 */

// Regex matching 10 or more consecutive identical characters
const EXCESSIVE_REPEAT_REGEX = /(.)\1{9,}/u

// Extended emoji regex covering standard Unicode emojis and variation selectors
const EMOJI_REGEX = /(?:\p{Extended_Pictographic}|\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDE4F]|\uD83E[\uDD00-\uDFFF])/gu

// Mention matching pattern (matching Phase 5 regex)
const MENTION_REGEX = /(?:^|[^\w@])(@[a-zA-Z0-9_\u0900-\u097F\u0400-\u04FF\u4E00-\u9FFF]{2,30})/g

// Promotional spam phrases
const PROMOTIONAL_SPAM_PATTERNS = [
  /\bbuy now\b/i,
  /\bclick here\b/i,
  /\bfree money\b/i,
  /\bclaim your prize\b/i,
  /\bwork from home earn\b/i,
  /\bwhatsapp on \+?[0-9]/i,
  /\bdm me on (telegram|whatsapp|instagram)\b/i,
  /\bcrypto investment\b/i,
  /\bguaranteed profit\b/i,
  /\bsubscribe for free cash\b/i,
  /\bmake \$[0-9]+ daily\b/i,
]

/**
 * Evaluates text for spam signals and flooding patterns.
 * @param {object} params
 * @param {string} params.text - Raw comment text
 * @param {string} params.userId - Author user ID
 * @param {string} [params.contentId] - Content ID
 * @returns {Promise<{ spamScore: number, isSpam: boolean, isFlooding: boolean, signals: object, reasons: string[] }>}
 */
export const checkSpamAndFlooding = async ({ text = "", userId = "", contentId = "" }) => {
  if (!COMMENT_CONFIG.ENABLE_SPAM_DETECTION || !text || typeof text !== "string") {
    return {
      spamScore: 0,
      isSpam: false,
      isFlooding: false,
      signals: {},
      reasons: [],
    }
  }

  const reasons = []
  let score = 0
  const trimmed = text.trim()
  const charCount = trimmed.length

  const signals = {
    repetition: false,
    specialCharAbuse: false,
    emojiAbuse: false,
    mentionSpam: false,
    promotionalPattern: false,
    flooding: false,
  }

  // 1. Character repetition check (10 or more identical consecutive characters)
  if (EXCESSIVE_REPEAT_REGEX.test(trimmed)) {
    signals.repetition = true
    reasons.push("REPEATED_CHARACTER_ABUSE")
    score += 75
  }

  // 2. Special character abuse check
  if (charCount > 10) {
    const specialChars = trimmed.match(/[!@#$%^&*()_+=[\]{}|\\:;"'<>,.?/~`–—-]/g) || []
    const specialRatio = specialChars.length / charCount
    const maxSpecialRatio = COMMENT_CONFIG.MAX_SPECIAL_CHARACTER_RATIO || 0.6

    if (specialRatio > maxSpecialRatio) {
      signals.specialCharAbuse = true
      reasons.push("SPECIAL_CHARACTER_ABUSE")
      score += 75
    }
  }

  // 3. Emoji abuse check
  if (COMMENT_CONFIG.ENABLE_EMOJI_ABUSE_DETECTION) {
    const emojis = trimmed.match(EMOJI_REGEX) || []
    const emojiCount = emojis.length

    if (emojiCount > 0 && charCount > 10) {
      // Calculate length contributed by emojis
      const nonEmojiText = trimmed.replace(EMOJI_REGEX, "").trim()
      const maxEmojiRatio = COMMENT_CONFIG.MAX_EMOJI_RATIO || 0.6

      if (nonEmojiText.length === 0 && emojiCount > 10) {
        // Pure emoji flood
        signals.emojiAbuse = true
        reasons.push("EMOJI_FLOOD_ABUSE")
        score += 75
      } else if (emojiCount > 15 && nonEmojiText.length < 15) {
        // Heavy emoji ratio with minimal text
        signals.emojiAbuse = true
        reasons.push("EXCESSIVE_EMOJIS")
        score += 35
      }
    }
  }

  // 4. Mention spam check
  const mentions = trimmed.match(MENTION_REGEX) || []
  const maxMentions = COMMENT_CONFIG.MAX_MENTIONS_COUNT || 5
  if (mentions.length > maxMentions) {
    signals.mentionSpam = true
    reasons.push("MENTION_SPAM")
    score += 30
  }

  // 5. Promotional spam pattern check
  for (const pattern of PROMOTIONAL_SPAM_PATTERNS) {
    if (pattern.test(trimmed)) {
      signals.promotionalPattern = true
      reasons.push("PROMOTIONAL_SPAM_PATTERN")
      score += 35
      break
    }
  }

  // 6. User flooding check (posting frequency)
  if (COMMENT_CONFIG.ENABLE_FLOODING_DETECTION && userId) {
    const floodingWindowSec = COMMENT_CONFIG.FLOODING_WINDOW_SECONDS || 30
    const floodingMaxComments = COMMENT_CONFIG.FLOODING_MAX_COMMENTS || 5
    const cutoff = new Date(Date.now() - floodingWindowSec * 1000)

    try {
      const recentCount = await Comment.countDocuments({
        $or: [{ user_id: String(userId) }, { userId: String(userId) }],
        createdAt: { $gte: cutoff },
        is_deleted: { $ne: true },
      })

      if (recentCount >= floodingMaxComments) {
        signals.flooding = true
        reasons.push("USER_FLOODING_TRIGGERED")
        score += 45
      }
    } catch (err) {
      console.warn("[spamDetectionService] Flooding check query warning:", err?.message)
    }
  }

  // Cap score at 100
  const finalScore = Math.min(score, 100)
  const isSpam = finalScore >= (COMMENT_CONFIG.SPAM_SCORE_THRESHOLD_FLAG || 40)

  return {
    spamScore: finalScore,
    isSpam,
    isFlooding: signals.flooding,
    signals,
    reasons,
  }
}

export default {
  checkSpamAndFlooding,
}
