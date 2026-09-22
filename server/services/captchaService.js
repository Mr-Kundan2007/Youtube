import COMMENT_CONFIG from "../config/commentConfig.js"

// In-memory store for consumed tokens to prevent replay attacks
// Key: token -> Value: timestamp consumed
const consumedTokens = new Map()

// In-memory cache for valid tokens with timestamp creation
const tokenRegistry = new Map()

/**
 * Cleanup expired tokens periodically to prevent memory leaks
 */
function purgeExpiredTokens() {
  const now = Date.now()
  const ttlMs = (COMMENT_CONFIG.CAPTCHA_TOKEN_EXPIRY_SECONDS || 300) * 1000

  for (const [token, timestamp] of consumedTokens.entries()) {
    if (now - timestamp > ttlMs) {
      consumedTokens.delete(token)
    }
  }

  for (const [token, data] of tokenRegistry.entries()) {
    if (now - data.createdAt > ttlMs) {
      tokenRegistry.delete(token)
    }
  }
}

// Run periodic cleanup every 60 seconds
const purgeInterval = setInterval(purgeExpiredTokens, 60000)
if (purgeInterval.unref) {
  purgeInterval.unref()
}

/**
 * Returns public CAPTCHA configuration for frontend clients
 */
export function getCaptchaPublicConfig() {
  return {
    enabled: COMMENT_CONFIG.CAPTCHA_ENABLED,
    provider: COMMENT_CONFIG.CAPTCHA_PROVIDER || "mock",
    siteKey: COMMENT_CONFIG.CAPTCHA_SITE_KEY || "mock-site-key",
  }
}

/**
 * Generates a mock CAPTCHA token for testing / development
 * @param {Object} options
 * @param {string} [options.action]
 * @param {number} [options.ttlMs]
 * @returns {string}
 */
export function generateMockCaptchaToken(options = {}) {
  const rand = Math.random().toString(36).substring(2, 10)
  const token = `mock-captcha-valid-${rand}`
  tokenRegistry.set(token, {
    createdAt: Date.now(),
    action: options.action || "comment",
    ttlMs: options.ttlMs || (COMMENT_CONFIG.CAPTCHA_TOKEN_EXPIRY_SECONDS || 300) * 1000,
  })
  return token
}

/**
 * Verify Cloudflare Turnstile token
 */
async function verifyTurnstile(token, ip, secretKey) {
  try {
    const formData = new URLSearchParams()
    formData.append("secret", secretKey)
    formData.append("response", token)
    if (ip) formData.append("remoteip", ip)

    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: formData,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    })

    const data = await res.json()
    return {
      success: !!data.success,
      score: data.success ? 1.0 : 0.0,
      action: data.action || null,
      error: data.success ? null : (data["error-codes"] ? data["error-codes"].join(",") : "turnstile_verification_failed"),
    }
  } catch (err) {
    return {
      success: false,
      score: 0,
      error: `turnstile_network_error: ${err.message}`,
    }
  }
}

/**
 * Verify Google reCAPTCHA v2 / v3 token
 */
async function verifyRecaptcha(token, ip, secretKey) {
  try {
    const formData = new URLSearchParams()
    formData.append("secret", secretKey)
    formData.append("response", token)
    if (ip) formData.append("remoteip", ip)

    const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      body: formData,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    })

    const data = await res.json()
    return {
      success: !!data.success,
      score: typeof data.score === "number" ? data.score : (data.success ? 1.0 : 0.0),
      action: data.action || null,
      error: data.success ? null : (data["error-codes"] ? data["error-codes"].join(",") : "recaptcha_verification_failed"),
    }
  } catch (err) {
    return {
      success: false,
      score: 0,
      error: `recaptcha_network_error: ${err.message}`,
    }
  }
}

/**
 * Verify Mock / Simulated CAPTCHA token
 */
function verifyMockToken(token, action) {
  if (!token || typeof token !== "string") {
    return { success: false, error: "invalid_token_format" }
  }

  // Check if registered mock token
  const registered = tokenRegistry.get(token)
  if (registered) {
    const now = Date.now()
    if (now - registered.createdAt > registered.ttlMs) {
      tokenRegistry.delete(token)
      return { success: false, error: "token_expired" }
    }
    return {
      success: true,
      score: 1.0,
      action: registered.action || action || "comment",
      error: null,
    }
  }

  // Standard mock convention: token starts with "mock-captcha-valid-"
  if (token.startsWith("mock-captcha-valid-")) {
    return {
      success: true,
      score: 1.0,
      action: action || "comment",
      error: null,
    }
  }

  return {
    success: false,
    score: 0.0,
    error: "invalid_mock_captcha_token",
  }
}

/**
 * Verifies a CAPTCHA token against the configured provider
 * Enforces single-use replay prevention and expiry.
 * 
 * @param {Object} params
 * @param {string} params.token - The client response token
 * @param {string} [params.ip] - The client remote IP address
 * @param {string} [params.action] - The action being performed (e.g. comment_create)
 * @returns {Promise<{ success: boolean, provider: string, score: number, action?: string, error: string | null }>}
 */
export async function verifyCaptchaToken({ token, ip, action } = {}) {
  if (!COMMENT_CONFIG.CAPTCHA_ENABLED) {
    return {
      success: true,
      provider: "disabled",
      score: 1.0,
      action: action || "comment",
      error: null,
    }
  }

  if (!token || typeof token !== "string" || token.trim().length === 0) {
    return {
      success: false,
      provider: COMMENT_CONFIG.CAPTCHA_PROVIDER || "mock",
      score: 0,
      error: "missing_captcha_token",
    }
  }

  const cleanToken = token.trim()

  // Replay Attack Prevention: Verify if token was already consumed
  if (consumedTokens.has(cleanToken)) {
    return {
      success: false,
      provider: COMMENT_CONFIG.CAPTCHA_PROVIDER || "mock",
      score: 0,
      error: "token_replayed",
    }
  }

  const provider = (COMMENT_CONFIG.CAPTCHA_PROVIDER || "mock").toLowerCase()
  let result

  if (provider === "turnstile") {
    result = await verifyTurnstile(cleanToken, ip, COMMENT_CONFIG.CAPTCHA_SECRET_KEY)
  } else if (provider === "recaptcha") {
    result = await verifyRecaptcha(cleanToken, ip, COMMENT_CONFIG.CAPTCHA_SECRET_KEY)
  } else {
    // Default to mock / simulation provider
    result = verifyMockToken(cleanToken, action)
  }

  // If verification succeeded, mark token as consumed so it cannot be replayed
  if (result.success) {
    consumedTokens.set(cleanToken, Date.now())
    if (tokenRegistry.has(cleanToken)) {
      tokenRegistry.delete(cleanToken)
    }
  }

  return {
    success: result.success,
    provider,
    score: result.score ?? (result.success ? 1.0 : 0.0),
    action: result.action || action || "comment",
    error: result.error || null,
  }
}

/**
 * Reset all in-memory caches (for testing purposes)
 */
export function resetCaptchaState() {
  consumedTokens.clear()
  tokenRegistry.clear()
}

export default {
  getCaptchaPublicConfig,
  generateMockCaptchaToken,
  verifyCaptchaToken,
  resetCaptchaState,
}
