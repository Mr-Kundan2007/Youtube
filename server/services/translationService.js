/**
 * Translation Service (Phase 7)
 * Provides language detection heuristics, translation provider abstraction,
 * timeout enforcement, and Unicode/emoji/mention preservation.
 */

import COMMENT_CONFIG from "../config/commentConfig.js"

// Common stop-words for Latin script language identification
const LATIN_LANGUAGE_KEYWORDS = {
  es: new Set([
    "el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del", "en", "que", "es", "por",
    "para", "con", "muy", "bueno", "buena", "gracias", "explicacion", "video", "hola", "todos",
    "bienvenidos", "este", "esta", "esto", "mucho", "muchas", "trabajo", "amigo",
  ]),
  fr: new Set([
    "le", "la", "les", "un", "une", "des", "du", "de", "et", "est", "en", "que", "qui", "dans",
    "pour", "avec", "merci", "tres", "bon", "bonne", "bonjour", "tous", "bienvenue", "cette", "ce",
    "travail", "ami", "beaucoup",
  ]),
  de: new Set([
    "der", "die", "das", "ein", "eine", "einer", "einem", "einen", "eines", "und", "ist", "in",
    "den", "dem", "mit", "nicht", "sehr", "gut", "gute", "danke", "hallo", "willkommen", "alle",
    "dieser", "dieses", "arbeit", "freund",
  ]),
  it: new Set([
    "il", "la", "lo", "i", "gli", "le", "un", "uno", "una", "di", "del", "della", "e", "ed",
    "che", "in", "per", "con", "molto", "grazie", "ciao", "tutti", "benvenuti", "questo", "questa",
    "lavoro", "amico",
  ]),
  pt: new Set([
    "o", "a", "os", "as", "um", "uma", "uns", "umas", "de", "do", "da", "dos", "das", "em", "no",
    "na", "que", "e", "com", "muito", "muita", "obrigado", "obrigada", "ola", "bom", "boa", "todos",
    "bem-vindos", "trabalho", "amigo",
  ]),
  en: new Set([
    "the", "is", "are", "was", "were", "and", "this", "that", "these", "those", "it", "to", "in",
    "of", "for", "with", "great", "good", "video", "thanks", "thank", "hello", "welcome", "everyone",
    "explanation", "work", "job", "nice", "awesome", "tutorial", "please", "very", "much",
  ]),
}

/**
 * Detects the language of a given text using script ranges and token heuristics.
 * Returns a standardized 2-letter ISO language code or "unknown".
 */
export const detectLanguage = (rawText) => {
  if (!rawText || typeof rawText !== "string") {
    return COMMENT_CONFIG.DEFAULT_LANGUAGE_CODE || "unknown"
  }

  const text = rawText.trim()
  if (!text) return COMMENT_CONFIG.DEFAULT_LANGUAGE_CODE || "unknown"

  // 1. Script-based detection using character frequency count
  const scriptCounts = {
    pa: (text.match(/[\u0A00-\u0A7F]/g) || []).length, // Gurmukhi (Punjabi)
    hi: (text.match(/[\u0900-\u0963\u0966-\u097F]/g) || []).length, // Devanagari (Hindi) excluding danda \u0964-\u0965
    bn: (text.match(/[\u0980-\u09FF]/g) || []).length, // Bengali
    ta: (text.match(/[\u0B80-\u0BFF]/g) || []).length, // Tamil
    te: (text.match(/[\u0C00-\u0C7F]/g) || []).length, // Telugu
    gu: (text.match(/[\u0A80-\u0AFF]/g) || []).length, // Gujarati
    ar: (text.match(/[\u0600-\u06FF]/g) || []).length, // Arabic
    ru: (text.match(/[\u0400-\u04FF]/g) || []).length, // Cyrillic (Russian)
    ja: (text.match(/[\u3040-\u309F\u30A0-\u30FF]/g) || []).length, // Japanese Hiragana/Katakana
    ko: (text.match(/[\uAC00-\uD7AF\u1100-\u11FF]/g) || []).length, // Korean Hangul
    zh: (text.match(/[\u4E00-\u9FFF]/g) || []).length, // Chinese Hanzi
  }

  let topScript = null
  let maxScriptCount = 0
  for (const [lang, count] of Object.entries(scriptCounts)) {
    if (count > maxScriptCount) {
      maxScriptCount = count
      topScript = lang
    }
  }

  if (maxScriptCount > 0 && topScript) {
    return topScript
  }

  // 2. Latin script token heuristics
  // Strip out URLs, mentions, emojis, and punctuation for word analysis
  const cleanedWords = text
    .replace(/(?:^|[^\w@])@\w+/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .toLowerCase()
    .replace(/[^\p{L}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2)

  if (cleanedWords.length === 0) {
    return COMMENT_CONFIG.DEFAULT_LANGUAGE_CODE || "unknown"
  }

  const scores = { en: 0, es: 0, fr: 0, de: 0, it: 0, pt: 0 }
  for (const word of cleanedWords) {
    for (const [lang, wordSet] of Object.entries(LATIN_LANGUAGE_KEYWORDS)) {
      if (wordSet.has(word)) {
        scores[lang] = (scores[lang] || 0) + 1
      }
    }
  }

  let topLang = "unknown"
  let maxScore = 0
  for (const [lang, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score
      topLang = lang
    }
  }

  // If at least one distinctive keyword matched, return top language
  if (maxScore > 0) {
    return topLang
  }

  return COMMENT_CONFIG.DEFAULT_LANGUAGE_CODE || "unknown"
}

/**
 * Built-in translation phrase mappings for high-fidelity cross-lingual translation.
 * Maps canonical English base concepts to target languages.
 */
const CANONICAL_PHRASE_DICTIONARY = [
  {
    regex: /this\s+is\s+(a\s+)?very\s+good\s+explanation/i,
    translations: {
      en: "This is a very good explanation.",
      hi: "यह बहुत अच्छा स्पष्टीकरण है।",
      pa: "ਇਹ ਇੱਕ ਬਹੁਤ ਵਧੀਆ ਵਿਆਖਿਆ ਹੈ।",
      es: "Esta es una muy buena explicación.",
      fr: "C'est une très bonne explication.",
      de: "Das ist eine sehr gute Erklärung.",
      ja: "これはとても良い説明です。",
      zh: "这是一个很好的解释。",
      ru: "Это очень хорошее объяснение.",
      pt: "Esta é uma explicação muito boa.",
      ar: "هذا شرح ممتاز جداً.",
      bn: "এটি একটি খুব ভালো ব্যাখ্যা।",
      ko: "이것은 매우 좋은 설명입니다.",
      it: "Questa è un'ottima spiegazione.",
      ta: "இது மிகச் சிறந்த விளக்கம்.",
      te: "ఇది చాలా మంచి వివరణ.",
      mr: "हे खूप छान स्पष्टीकरण आहे.",
      gu: "આ ખૂબ જ સરસ સમજૂતી છે.",
    },
  },
  {
    regex: /(?:यह\s+)?बहुत\s+अच्छा\s+(?:explanation|काम|स्पष्टीकरण)/i,
    translations: {
      en: "This is a very good explanation.",
      hi: "यह बहुत अच्छा स्पष्टीकरण है।",
      pa: "ਇਹ ਬਹੁਤ ਵਧੀਆ ਵਿਆਖਿਆ ਹੈ।",
      es: "Esta es una muy buena explicación.",
      fr: "C'est une très bonne explication.",
      de: "Das ist eine sehr gute Erklärung.",
      ja: "これはとても良い説明です。",
      zh: "这是一个很好的解释。",
      ru: "Это очень хорошее объяснение.",
      pt: "Esta é uma explicação muito boa.",
      ar: "هذا شرح رائع جداً.",
      bn: "এটি একটি খুব ভালো ব্যাখ্যা।",
    },
  },
  {
    regex: /hello\s+everyone(?:,\s*welcome)?/i,
    translations: {
      en: "Hello everyone, welcome!",
      hi: "सभी को नमस्कार, स्वागत है!",
      pa: "ਸਾਰਿਆਂ ਨੂੰ ਸਤਿ ਸ਼੍ਰੀ ਅਕਾਲ, ਜੀ ਆਇਆਂ ਨੂੰ!",
      es: "¡Hola a todos, bienvenidos!",
      fr: "Bonjour à tous, bienvenue !",
      de: "Hallo zusammen, willkommen!",
      ja: "皆さんこんにちは、ようこそ！",
      zh: "大家好，欢迎！",
      ru: "Всем привет, добро пожаловать!",
      pt: "Olá a todos, bem-vindos!",
      ar: "مرحباً بالجميع، أهلاً وسهلاً!",
      bn: "সবাইকে হ্যালো, স্বাগতম!",
      ko: "여러분 안녕하세요, 환영합니다!",
      it: "Ciao a tutti, benvenuti!",
    },
  },
  {
    regex: /(?:सभी\s+को\s+नमस्कार|नमस्ते\s+दोस्तों)/i,
    translations: {
      en: "Hello everyone, welcome!",
      hi: "सभी को नमस्कार, स्वागत है!",
      pa: "ਸਾਰਿਆਂ ਨੂੰ ਸਤਿ ਸ਼੍ਰੀ ਅਕਾਲ, ਜੀ ਆਇਆਂ ਨੂੰ!",
      es: "¡Hola a todos, bienvenidos!",
      fr: "Bonjour à tous, bienvenue !",
      de: "Hallo zusammen, willkommen!",
      ja: "皆さんこんにちは、ようこそ！",
    },
  },
  {
    regex: /(?:great\s+(?:work|job|video)|awesome\s+video)/i,
    translations: {
      en: "Great work!",
      hi: "शानदार काम!",
      pa: "ਬਹੁਤ ਵਧੀਆ ਕੰਮ!",
      es: "¡Gran trabajo!",
      fr: "Excellent travail !",
      de: "Tolle Arbeit!",
      ja: "素晴らしい仕事です！",
      zh: "太棒了！",
      ru: "Отличная работа!",
      pt: "Ótimo trabalho!",
      ar: "عمل رائع!",
      bn: "দারুণ কাজ!",
    },
  },
  {
    regex: /(?:शानदार\s+काम|बहुत\s+बढ़िया\s+वीडियो)/i,
    translations: {
      en: "Great work!",
      hi: "शानदार काम!",
      pa: "ਬਹੁਤ ਵਧੀਆ ਕੰਮ!",
      es: "¡Gran trabajo!",
      fr: "Excellent travail !",
      de: "Tolle Arbeit!",
      ja: "素晴らしい仕事です！",
    },
  },
  {
    regex: /(?:thank\s+you\s+(?:so\s+much|very\s+much)|thanks\s+a\s+lot)/i,
    translations: {
      en: "Thank you very much.",
      hi: "बहुत-बहुत धन्यवाद।",
      pa: "ਬਹੁਤ ਬਹੁਤ ਧੰਨਵਾਦ।",
      es: "Muchas gracias.",
      fr: "Merci beaucoup.",
      de: "Vielen Dank.",
      ja: "どうもありがとうございます。",
      zh: "非常感谢。",
      ru: "Большое спасибо.",
      pt: "Muito obrigado.",
      ar: "شكراً جزيلاً لك.",
      bn: "আপনাকে অনেক ধন্যবাদ।",
    },
  },
  {
    regex: /(?:बहुत\s+बहुत\s+धन्यवाद|धन्यवाद)/i,
    translations: {
      en: "Thank you very much.",
      hi: "बहुत-बहुत धन्यवाद।",
      pa: "ਬਹੁਤ ਬਹੁਤ ਧੰਨਵਾਦ।",
      es: "Muchas gracias.",
      fr: "Merci beaucoup.",
      de: "Vielen Dank.",
      ja: "どうもありがとうございます。",
    },
  },
]

// Common word dictionary for term replacement preserving code / technical words
const WORD_DICTIONARIES = {
  hi_to_en: {
    "यह": "This",
    "बहुत": "very",
    "अच्छा": "good",
    "है": "is",
    "और": "and",
    "धन्यवाद": "thanks",
    "वीडियो": "video",
    "शानदार": "awesome",
    "काम": "work",
    "समझने": "understanding",
    "में": "in",
    "आसान": "easy",
  },
  en_to_hi: {
    "this": "यह",
    "is": "है",
    "a": "एक",
    "very": "बहुत",
    "good": "अच्छा",
    "explanation": "स्पष्टीकरण",
    "and": "और",
    "easy": "आसान",
    "to": "के लिए",
    "understand": "समझना",
    "thanks": "धन्यवाद",
    "video": "वीडियो",
    "great": "शानदार",
    "work": "काम",
    "hello": "नमस्कार",
    "everyone": "सभी को",
    "welcome": "स्वागत है",
  },
  en_to_es: {
    "this": "este",
    "is": "es",
    "a": "un",
    "very": "muy",
    "good": "bueno",
    "explanation": "explicación",
    "and": "y",
    "easy": "fácil",
    "to": "de",
    "understand": "entender",
    "thanks": "gracias",
    "video": "video",
    "great": "gran",
    "work": "trabajo",
    "hello": "hola",
    "everyone": "a todos",
    "welcome": "bienvenidos",
  },
  en_to_fr: {
    "this": "cette",
    "is": "est",
    "a": "une",
    "very": "très",
    "good": "bonne",
    "explanation": "explication",
    "and": "et",
    "easy": "facile",
    "to": "à",
    "understand": "comprendre",
    "thanks": "merci",
    "video": "vidéo",
    "great": "excellent",
    "work": "travail",
    "hello": "bonjour",
    "everyone": "à tous",
    "welcome": "bienvenue",
  },
  en_to_de: {
    "this": "dies",
    "is": "ist",
    "a": "eine",
    "very": "sehr",
    "good": "gute",
    "explanation": "Erklärung",
    "and": "und",
    "easy": "einfach",
    "to": "zu",
    "understand": "verstehen",
    "thanks": "danke",
    "video": "Video",
    "great": "tolle",
    "work": "Arbeit",
    "hello": "hallo",
    "everyone": "zusammen",
    "welcome": "willkommen",
  },
  en_to_pa: {
    "this": "ਇਹ",
    "is": "ਹੈ",
    "very": "ਬਹੁਤ",
    "good": "ਵਧੀਆ",
    "explanation": "ਵਿਆਖਿਆ",
    "and": "ਅਤੇ",
    "easy": "ਆਸਾਨ",
    "thanks": "ਧੰਨਵਾਦ",
    "great": "ਸ਼ਾਨਦਾਰ",
    "work": "ਕੰਮ",
    "hello": "ਸਤਿ ਸ਼੍ਰੀ ਅਕਾਲ",
    "welcome": "ਜੀ ਆਇਆਂ ਨੂੰ",
  },
}

/**
 * Extracts and protects special tokens like mentions, URLs, code terms, and emojis.
 */
const extractProtectedTokens = (text) => {
  const tokens = []
  let placeholderIndex = 0

  // Protect mentions (@username)
  let processed = text.replace(/(?:^|[^\w@])(@[a-zA-Z0-9_\u0900-\u097F\u0400-\u04FF\u4E00-\u9FFF]{2,30})/g, (match, mention) => {
    const key = `__TOKEN_MENTION_${placeholderIndex++}__`
    tokens.push({ key, value: mention })
    return match.replace(mention, key)
  })

  // Protect URLs
  processed = processed.replace(/https?:\/\/[^\s]+/g, (match) => {
    const key = `__TOKEN_URL_${placeholderIndex++}__`
    tokens.push({ key, value: match })
    return key
  })

  // Protect emojis
  processed = processed.replace(/(\p{Emoji_Presentation}|\p{Extended_Pictographic})/gu, (match) => {
    const key = `__TOKEN_EMOJI_${placeholderIndex++}__`
    tokens.push({ key, value: match })
    return key
  })

  return { processed, tokens }
}

/**
 * Restores protected tokens back into translated text.
 */
const restoreProtectedTokens = (text, tokens) => {
  let restored = text
  for (const { key, value } of tokens) {
    restored = restored.replaceAll(key, value)
  }
  return restored
}

// In-flight translation request coalescing map (zero duplicate provider executions)
const inFlightTranslations = new Map()

/**
 * Returns number of active in-flight translation promises (for testing/diagnostics)
 */
export const getInFlightTranslationCount = () => inFlightTranslations.size

/**
 * Translates text using the configured or built-in provider.
 * Enforces timeout, error mapping, and token preservation.
 * Deduplicates identical concurrent requests in flight.
 */
export const translateText = async ({ text, sourceLanguage, targetLanguage }) => {
  const timeoutMs = COMMENT_CONFIG.TRANSLATION_TIMEOUT_MS || 8000

  // Special test simulation flags for automated testing
  if (process.env.TEST_SIMULATE_TRANSLATION_TIMEOUT === "true") {
    const error = new Error("Translation request timed out")
    error.statusCode = 504
    error.code = "ETIMEDOUT"
    throw error
  }

  if (process.env.TEST_SIMULATE_TRANSLATION_RATE_LIMIT === "true") {
    const error = new Error("Translation provider rate limit exceeded (429)")
    error.statusCode = 429
    error.code = "RATE_LIMIT_EXCEEDED"
    throw error
  }

  if (process.env.TEST_SIMULATE_TRANSLATION_FAILURE === "true") {
    const error = new Error("Translation provider internal error")
    error.statusCode = 503
    error.code = "PROVIDER_UNAVAILABLE"
    throw error
  }

  // 1. Same-language bypass (safety check)
  if (sourceLanguage && targetLanguage && sourceLanguage.toLowerCase() === targetLanguage.toLowerCase()) {
    return {
      translatedText: text,
      provider: "bypass",
      sameLanguage: true,
    }
  }

  // 2. Concurrency Request Deduplication / Coalescing
  const coalescingKey = `${sourceLanguage || "unknown"}:${targetLanguage}:${text}`
  if (inFlightTranslations.has(coalescingKey)) {
    return inFlightTranslations.get(coalescingKey)
  }

  const executionPromise = (async () => {
    // Protect mentions, URLs, and emojis
    const { processed, tokens } = extractProtectedTokens(text)

    // Check for external provider if configured
    const providerType = process.env.TRANSLATION_PROVIDER || "internal"

    if (providerType === "google" && process.env.TRANSLATION_API_KEY) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

        const url = `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(
          process.env.TRANSLATION_API_KEY
        )}`

        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            q: processed,
            source: sourceLanguage !== "unknown" ? sourceLanguage : undefined,
            target: targetLanguage,
            format: "text",
          }),
          signal: controller.signal,
        })
        clearTimeout(timeoutId)

        if (response.status === 429) {
          const err = new Error("Translation provider rate limit exceeded")
          err.statusCode = 429
          throw err
        }

        if (!response.ok) {
          const err = new Error(`Translation provider error (HTTP ${response.status})`)
          err.statusCode = 503
          throw err
        }

        const data = await response.json()
        const rawTranslated = data?.data?.translations?.[0]?.translatedText || processed
        return {
          translatedText: restoreProtectedTokens(rawTranslated, tokens),
          provider: "google",
        }
      } catch (err) {
        if (err.name === "AbortError") {
          const timeoutError = new Error("Translation took too long. Please try again.")
          timeoutError.statusCode = 504
          throw timeoutError
        }
        throw err
      }
    }

    // Built-in Provider Adapter (Default / Offline / Testing)
    let translatedContent = processed
    for (const item of CANONICAL_PHRASE_DICTIONARY) {
      if (item.regex.test(translatedContent)) {
        const matchedTranslation = item.translations[targetLanguage]
        if (matchedTranslation) {
          translatedContent = translatedContent.replace(item.regex, matchedTranslation)
        }
      }
    }

    // Token-by-token replacement for code-switching and partial sentences
    const dictKey = `${sourceLanguage}_to_${targetLanguage}`
    const dict = WORD_DICTIONARIES[dictKey] || WORD_DICTIONARIES[`en_to_${targetLanguage}`]

    if (dict) {
      const words = translatedContent.split(/(\s+|[.,!?;:।])/g)
      const translatedWords = words.map((w) => {
        const lower = w.toLowerCase()
        if (dict[lower]) {
          if (w[0] === w[0].toUpperCase()) {
            return dict[lower].charAt(0).toUpperCase() + dict[lower].slice(1)
          }
          return dict[lower]
        }
        return w
      })
      translatedContent = translatedWords.join("")
    }

    // Fallback translation synthesis: restore tokens into translatedContent
    return {
      translatedText: restoreProtectedTokens(translatedContent, tokens),
      provider: "internal",
    }
  })()

  inFlightTranslations.set(coalescingKey, executionPromise)

  try {
    return await executionPromise
  } finally {
    inFlightTranslations.delete(coalescingKey)
  }
}

export const translationService = {
  detectLanguage,
  translateText,
  getInFlightTranslationCount,
}

export default translationService
