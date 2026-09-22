/**
 * Phase 3 Comment Configuration
 * Centralized boundaries, limits, and defaults for the comment system.
 */

export const COMMENT_CONFIG = {
  // Maximum character length for a single comment
  MAX_COMMENT_LENGTH: 2000,

  // Pagination defaults & limits
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 50,

  // Initial lifecycle states
  DEFAULT_STATUS: "visible",
  ALLOWED_STATUSES: ["visible", "pending_review", "flagged", "hidden", "deleted", "removed"],

  // Language identification default
  DEFAULT_LANGUAGE_CODE: "unknown",

  // Concurrency version start
  INITIAL_VERSION: 1,

  // Threading and nesting limits (Phase 4)
  MAX_COMMENT_DEPTH: 3,
  DEFAULT_REPLY_PAGE_SIZE: 10,
  MAX_REPLY_PAGE_SIZE: 50,

  // Text masking for soft-deleted comments
  DELETED_COMMENT_TEXT: "[Comment deleted]",

  // Edit & Delete Window Limits (Phase 6)
  COMMENT_EDIT_WINDOW_MINUTES: parseInt(process.env.COMMENT_EDIT_WINDOW_MINUTES, 10) || 15,
  COMMENT_DELETE_WINDOW_MINUTES: parseInt(process.env.COMMENT_DELETE_WINDOW_MINUTES, 10) || 0,

  // Multilingual Translation Configuration (Phase 7)
  SUPPORTED_COMMENT_TRANSLATION_LANGUAGES: [
    "en", "hi", "pa", "es", "fr", "de", "ja", "zh", "ru", "pt", "ar", "bn", "ko", "it", "ta", "te", "mr", "gu",
  ],
  DEFAULT_TRANSLATION_LANGUAGE: "en",
  TRANSLATION_TIMEOUT_MS: parseInt(process.env.TRANSLATION_TIMEOUT_MS, 10) || 8000,
  TRANSLATION_CACHE_TTL_DAYS: 30,
  TRANSLATION_STATUSES: ["pending", "completed", "failed", "stale"],

  // Comment Safety & Content Protection (Phase 8)
  ENABLE_PROFANITY_FILTER: process.env.ENABLE_PROFANITY_FILTER !== "false",
  ENABLE_SPAM_DETECTION: process.env.ENABLE_SPAM_DETECTION !== "false",
  ENABLE_DUPLICATE_DETECTION: process.env.ENABLE_DUPLICATE_DETECTION !== "false",
  ENABLE_LINK_SAFETY: process.env.ENABLE_LINK_SAFETY !== "false",
  ENABLE_EMOJI_ABUSE_DETECTION: process.env.ENABLE_EMOJI_ABUSE_DETECTION !== "false",
  ENABLE_FLOODING_DETECTION: process.env.ENABLE_FLOODING_DETECTION !== "false",

  PROFANITY_THRESHOLD: 0.7,
  DUPLICATE_WINDOW_SECONDS: parseInt(process.env.COMMENT_DUPLICATE_WINDOW_SECONDS, 10) || 60,
  MAX_REPEATED_CHARACTERS: 10,
  MAX_EMOJI_RATIO: 0.6,
  MAX_SPECIAL_CHARACTER_RATIO: 0.6,
  MAX_URL_COUNT: 2,
  MAX_MENTIONS_COUNT: 5,
  FLOODING_WINDOW_SECONDS: 30,
  FLOODING_MAX_COMMENTS: 5,
  SPAM_SCORE_THRESHOLD_FLAG: 40,
  SPAM_SCORE_THRESHOLD_REJECT: 70,
  BLOCKED_URL_SCHEMES: ["javascript:", "data:", "vbscript:", "file:", "blob:"],
  ALLOWED_URL_SCHEMES: ["http:", "https:"],

  // Rate Limiting & CAPTCHA (Phase 9)
  RATE_LIMIT_ENABLED: process.env.COMMENT_RATE_LIMIT_ENABLED !== "false",
  CAPTCHA_ENABLED: process.env.COMMENT_CAPTCHA_ENABLED !== "false",
  CAPTCHA_PROVIDER: process.env.COMMENT_CAPTCHA_PROVIDER || "mock", // "turnstile" | "recaptcha" | "mock"
  CAPTCHA_SITE_KEY: process.env.COMMENT_CAPTCHA_SITE_KEY || "mock-site-key",
  CAPTCHA_SECRET_KEY: process.env.COMMENT_CAPTCHA_SECRET_KEY || "mock-secret-key",
  CAPTCHA_TOKEN_EXPIRY_SECONDS: parseInt(process.env.COMMENT_CAPTCHA_TOKEN_EXPIRY_SECONDS, 10) || 300, // 5 min
  CAPTCHA_TRIGGER_THRESHOLD: parseInt(process.env.COMMENT_CAPTCHA_TRIGGER_THRESHOLD, 10) || 2, // violations within window before requiring captcha

  COMMENT_RATE_LIMITS: {
    comment_create: {
      burst: { limit: 5, windowSeconds: 10 },
      sustained: { limit: 30, windowSeconds: 3600 },
    },
    reply_create: {
      burst: { limit: 5, windowSeconds: 10 },
      sustained: { limit: 30, windowSeconds: 3600 },
    },
    comment_edit: {
      burst: { limit: 5, windowSeconds: 30 },
      sustained: { limit: 20, windowSeconds: 3600 },
    },
    comment_reaction: {
      burst: { limit: 15, windowSeconds: 10 },
      sustained: { limit: 120, windowSeconds: 600 },
    },
    comment_translate: {
      burst: { limit: 10, windowSeconds: 60 },
      sustained: { limit: 60, windowSeconds: 3600 },
    },
    mention_search: {
      burst: { limit: 30, windowSeconds: 60 },
      sustained: { limit: 150, windowSeconds: 600 },
    },
    comment_report: {
      burst: { limit: 5, windowSeconds: 60 },
      sustained: { limit: 20, windowSeconds: 3600 },
    },
  },

  // Reporting & Admin Moderation (Phase 10)
  REPORT_REASONS: [
    "SPAM",
    "HARASSMENT",
    "OFFENSIVE",
    "HATEFUL_OR_ABUSIVE",
    "MALICIOUS_LINK",
    "MISINFORMATION",
    "IMPERSONATION",
    "OTHER",
    "spam",
    "harassment",
    "offensive",
    "hateful_or_abusive",
    "malicious_link",
    "misinformation",
    "impersonation",
    "other",
  ],
  REPORT_MAX_DESCRIPTION_LENGTH: 500,
  REPORT_STATUSES: ["pending", "reviewing", "under_review", "resolved", "dismissed"],
  MODERATION_ACTIONS: [
    "hide",
    "restore",
    "delete",
    "dismiss_report",
    "flag",
    "approve",
    "resolve",
    "HIDE_COMMENT",
    "RESTORE_COMMENT",
    "DELETE_COMMENT",
    "DISMISS_REPORT",
    "RESOLVE_REPORT",
  ],

  // Sorting, Performance & Scalability (Phase 11)
  SUPPORTED_SORT_OPTIONS: ["newest", "oldest", "top", "relevant", "most_liked", "most_relevant"],
  DEFAULT_SORT_OPTION: "newest",
  MAX_REPLY_DEPTH: 3,
  DEFAULT_CURSOR_EXPIRY_SECONDS: 86400,
  RELEVANCE_WEIGHTS: {
    PINNED: 100,
    LIKE: 2,
    REPLY: 3,
    RECENCY_24H: 30,
    RECENCY_7D: 15,
    RECENCY_30D: 5,
  },
}

export default COMMENT_CONFIG
