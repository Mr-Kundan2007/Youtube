import { COMMENT_CONFIG } from "../config/commentConfig.js"

/**
 * Multilingual Profanity & Abusive Content Detection Service
 *
 * Provides normalized, boundary-aware token matching across multiple supported languages
 * with strict false-positive protection (Scunthorpe problem prevention).
 */

// Safe legitimate words that contain potential profanity substrings but MUST NEVER be blocked
const SAFE_WHITELIST_WORDS = new Set([
  "classic",
  "classical",
  "class",
  "pass",
  "passed",
  "passing",
  "passport",
  "compass",
  "assistant",
  "assist",
  "assistance",
  "document",
  "documentation",
  "analysis",
  "analyst",
  "analytic",
  "analytics",
  "hello",
  "mass",
  "massive",
  "bass",
  "assume",
  "assumption",
  "cocktail",
  "technique",
  "shuttle",
  "butter",
  "button",
  "title",
  "titan",
  "assembly",
  "assemble",
  "association",
  "associate",
  "grass",
  "glass",
  "brass",
  "brassiere",
  "assignment",
  "assess",
  "assessment",
  "assets",
  "asset",
  "cucumber",
  "penistone",
  "scunthorpe",
  // Multilingual safe words
  "sach",
  "kam",
  "chalo",
  "bhai",
  "sab",
  "pani",
  "namaste",
  "shukriya",
  "dhanyavad",
  "sat sri akal",
  "salaam",
  "marhaba",
  "bonjour",
  "merci",
  "hola",
  "gracias",
])

// Severe profanity / hate speech / abusive terms that warrant immediate REJECT
const SEVERE_PROFANITY_TERMS = [
  // English abusive/slur terms
  "fuck",
  "fucker",
  "fucking",
  "fack",
  "fck",
  "fuk",
  "shit",
  "bullshit",
  "asshole",
  "bitch",
  "cunt",
  "dickhead",
  "motherfucker",
  "bastard",
  "nigger",
  "faggot",
  "kill yourself",
  // Hindi / Hinglish abusive terms
  "madarchod",
  "behenchod",
  "bhenchod",
  "chutiya",
  "chutiye",
  "gandu",
  "harami",
  "bhadwe",
  "bhosdike",
  "bhosadike",
  "kamina",
  "kutta",
  "kaminey",
  "randi",
  "gaand",
  // Punjabi abusive terms
  "kanjar",
  "kutiya",
  "khotta",
  // Spanish abusive terms
  "mierda",
  "puta",
  "hijo de puta",
  "cabron",
  "pendejo",
  // French abusive terms
  "merde",
  "putain",
  "connard",
  "salope",
  // Arabic abusive terms
  "sharmouta",
  "kuss",
  "ibn el kalb",
]

// Mild / borderline terms that warrant FLAG for human moderation
const MILD_FLAG_TERMS = [
  "damn",
  "crap",
  "hell",
  "stupid",
  "idiot",
  "moron",
  "dumb",
  "loser",
  "pagal",
  "ullu",
  "bakwas",
  "fool",
]

/**
 * Normalizes input text for profanity inspection without modifying original storage.
 * Handles Unicode, leetspeak, spaced/dotted letters, and trailing punctuation.
 * @param {string} text - Raw input text
 * @returns {{ rawTokens: string[], deobfuscated: string, joinedSingleChars: string }}
 */
export const normalizeForProfanity = (text = "") => {
  if (!text || typeof text !== "string") {
    return { rawTokens: [], deobfuscated: "", joinedSingleChars: "" }
  }

  // Unicode normalization (NFKC) + lowercase
  const unicodeNormalized = text.normalize("NFKC").toLowerCase().trim()

  // Replace internal exclamation or digits inside words: e.g. sh!t -> shit, b!tch -> bitch, f@ck -> fack
  const deobfuscated = unicodeNormalized
    .replace(/([a-z])!([a-z])/gi, "$1i$2")
    .replace(/([a-z])1([a-z])/gi, "$1i$2")
    .replace(/([a-z])@([a-z])/gi, "$1a$2")
    .replace(/([a-z])\$([a-z])/gi, "$1s$2")
    .replace(/([a-z])0([a-z])/gi, "$1o$2")
    .replace(/([a-z])3([a-z])/gi, "$1e$2")
    .replace(/@/g, "a")
    .replace(/\$/g, "s")

  // 1. Collapse single letters separated by dots, hyphens, underscores, asterisks (e.g. "b.i.t.c.h" -> "bitch", "f-u-c-k" -> "fuck")
  const joinedPunctuation = deobfuscated.replace(
    /([a-z0-9])[._\-*]+(?=[a-z0-9](?:[._\-*]|$))/gi,
    "$1"
  )

  // 2. Collapse single letters separated by spaces: e.g. "f u c k" -> "fuck"
  const joinedSpaces = deobfuscated.replace(
    /(?:\b[a-z]\b\s+){2,}\b[a-z]\b/gi,
    (m) => m.replace(/\s+/g, "")
  )

  // Split into tokens and strip leading/trailing punctuation from each token
  const rawTokens = deobfuscated
    .split(/[\s,.;:!?()[\]{}"'`~@#$%^&*+=<>\\/|_—–-]+/)
    .map((t) => t.replace(/^[!?,.;:\s]+|[!?,.;:\s]+$/g, "").trim())
    .filter(Boolean)

  const punctTokens = joinedPunctuation
    .split(/[\s,.;:!?()[\]{}"'`~@#$%^&*+=<>\\/|_—–-]+/)
    .map((t) => t.replace(/^[!?,.;:\s]+|[!?,.;:\s]+$/g, "").trim())
    .filter(Boolean)

  const spaceTokens = joinedSpaces
    .split(/[\s,.;:!?()[\]{}"'`~@#$%^&*+=<>\\/|_—–-]+/)
    .map((t) => t.replace(/^[!?,.;:\s]+|[!?,.;:\s]+$/g, "").trim())
    .filter(Boolean)

  const combinedTokens = Array.from(new Set([...rawTokens, ...punctTokens, ...spaceTokens]))

  return {
    rawTokens: combinedTokens,
    deobfuscated,
    joinedPunctuation,
    joinedSpaces,
  }
}

/**
 * Checks if a specific term is present with proper word boundary respect
 * and safe whitelist filtering.
 */
const termMatches = (term, normalizedContext, rawTokens) => {
  // If the term itself is in the whitelist, skip
  if (SAFE_WHITELIST_WORDS.has(term)) return false

  // 1. Check exact token matches and normalized variations
  for (const token of rawTokens) {
    if (SAFE_WHITELIST_WORDS.has(token)) continue

    // Exact match
    if (token === term) return true

    // Substring match for terms >= 4 chars, provided token is not a whitelisted word
    if (term.length >= 4 && token.includes(term) && !SAFE_WHITELIST_WORDS.has(token)) {
      return true
    }

    // Collapsed repeated characters match (e.g. "fuuuuck" -> "fuck", "shiiiit" -> "shit")
    const tokenSingle = token.replace(/(.)\1+/g, "$1")
    const termSingle = term.replace(/(.)\1+/g, "$1")
    if (tokenSingle === termSingle && !SAFE_WHITELIST_WORDS.has(tokenSingle)) {
      return true
    }

    // Token with repeats reduced to 2
    const tokenTwo = token.replace(/(.)\1{2,}/g, "$1$1")
    if (tokenTwo === term) return true
  }

  // 2. Multi-word phrase check (e.g., "kill yourself", "hijo de puta")
  if (term.includes(" ")) {
    if (
      normalizedContext.deobfuscated?.includes(term) ||
      normalizedContext.joinedPunctuation?.includes(term) ||
      normalizedContext.joinedSpaces?.includes(term)
    ) {
      return true
    }
  }

  // 3. Boundary-aware regex match on deobfuscated and joined text
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const regex = new RegExp(`(^|[^a-zA-Z0-9\u0900-\u097F])${escaped}([^a-zA-Z0-9\u0900-\u097F]|$)`, "i")

  if (
    regex.test(normalizedContext.deobfuscated) ||
    regex.test(normalizedContext.joinedPunctuation || "") ||
    regex.test(normalizedContext.joinedSpaces || "")
  ) {
    // Check if any matched candidate is a substring of an active safe whitelist word
    for (const token of rawTokens) {
      if (token.includes(term) && SAFE_WHITELIST_WORDS.has(token)) {
        return false // Whitelisted word detected!
      }
    }
    return true
  }

  return false
}

/**
 * Evaluates text against profanity and abusive language rules.
 * @param {string} text - Raw comment text
 * @returns {{ isProfane: boolean, severity: "reject" | "flag" | "none", detectedWords: string[], confidence: number }}
 */
export const checkProfanity = (text = "") => {
  if (!COMMENT_CONFIG.ENABLE_PROFANITY_FILTER || !text || typeof text !== "string") {
    return {
      isProfane: false,
      severity: "none",
      detectedWords: [],
      confidence: 0,
    }
  }

  const normalized = normalizeForProfanity(text)
  const detectedSevere = []
  const detectedMild = []

  // Check severe terms
  for (const term of SEVERE_PROFANITY_TERMS) {
    if (termMatches(term, normalized, normalized.rawTokens)) {
      detectedSevere.push(term)
    }
  }

  if (detectedSevere.length > 0) {
    return {
      isProfane: true,
      severity: "reject",
      detectedWords: detectedSevere,
      confidence: 1.0,
    }
  }

  // Check mild terms
  for (const term of MILD_FLAG_TERMS) {
    if (termMatches(term, normalized, normalized.rawTokens)) {
      detectedMild.push(term)
    }
  }

  if (detectedMild.length > 0) {
    return {
      isProfane: true,
      severity: "flag",
      detectedWords: detectedMild,
      confidence: 0.8,
    }
  }

  return {
    isProfane: false,
    severity: "none",
    detectedWords: [],
    confidence: 0,
  }
}

export default {
  checkProfanity,
  normalizeForProfanity,
}
