import mongoose from "mongoose"
import rateLimitService from "../services/rateLimitService.js"
import captchaService from "../services/captchaService.js"
import CommentTranslation from "../Modals/CommentTranslation.js"
import Comment from "../Modals/comment.js"

/**
 * Extract client IP securely
 */
function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"]
  if (forwarded) {
    return forwarded.split(",")[0].trim()
  }
  return req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || "127.0.0.1"
}

/**
 * Express middleware for Comment Rate Limiting and Adaptive CAPTCHA.
 * 
 * @param {string} action - e.g. "comment_create", "reply_create", "comment_edit", "comment_reaction", "comment_translate", "mention_search"
 */
export function commentRateLimit(action) {
  return async (req, res, next) => {
    const userId = req.user?._id ? String(req.user._id) : (req.user?.id ? String(req.user.id) : (req.userId ? String(req.userId) : null))
    const ip = getClientIp(req)

    // Check if CAPTCHA token was supplied in headers or body/query
    const captchaToken =
      req.headers["x-captcha-token"] ||
      req.body?.captchaToken ||
      req.body?.captcha_token ||
      req.query?.captchaToken ||
      req.query?.captcha_token

    // If client supplied a CAPTCHA token, attempt verification
    if (captchaToken) {
      const captchaResult = await captchaService.verifyCaptchaToken({
        token: captchaToken,
        ip,
        action,
      })

      if (!captchaResult.success) {
        return res.status(403).json({
          success: false,
          code: "CAPTCHA_FAILED",
          message: "CAPTCHA verification failed. Please try again.",
          error: captchaResult.error,
        })
      }

      // Token is valid! Unlock user/IP for this action
      await rateLimitService.unlockCaptcha({ userId, ip, action })
    }

    // Optimization: If this is a translation request, check if it is already cached or same language
    if (action === "comment_translate") {
      const commentId = req.params?.id || req.params?.commentId
      const targetLanguage =
        req.body?.targetLanguage ||
        req.body?.target_language ||
        req.query?.targetLanguage ||
        req.query?.language ||
        req.query?.lang

      if (commentId && targetLanguage && mongoose.connection && mongoose.connection.readyState === 1) {
        try {
          // Check comment & cached translation
          const comment = await Comment.findById(commentId).select("language_code languageCode version").lean()
          if (comment) {
            const sourceLang = (comment.language_code || comment.languageCode || "en").toLowerCase()
            const targetLang = String(targetLanguage).toLowerCase().trim()

            // If same language or cached, bypass rate limit consumption
            if (sourceLang === targetLang) {
              return next()
            }

            const currentVersion = comment.version || 1
            const cachedDoc = await CommentTranslation.findOne({
              $or: [
                { comment_id: comment._id, target_language: targetLang },
                { commentId: comment._id, target_language: targetLang },
              ],
            }).lean()

            if (cachedDoc && cachedDoc.source_version === currentVersion && cachedDoc.translation_status === "completed") {
              // Cache hit bypasses rate limiter quota!
              return next()
            }
          }
        } catch (err) {
          // Ignore and continue with rate limit check
        }
      }
    }

    // Evaluate sliding window rate limits
    const result = await rateLimitService.checkRateLimit({ userId, ip, action })

    // Set standard rate limit headers
    res.setHeader("X-RateLimit-Limit", result.limit)
    res.setHeader("X-RateLimit-Remaining", result.remaining)
    res.setHeader("X-RateLimit-Reset", result.resetSeconds)

    if (!result.allowed) {
      res.setHeader("Retry-After", result.retryAfter)

      const isCaptcha = result.code === "CAPTCHA_REQUIRED"
      return res.status(429).json({
        success: false,
        code: result.code,
        message: isCaptcha
          ? "Unusual activity detected. Please complete the CAPTCHA to continue."
          : `You are doing that too fast. Please wait ${result.retryAfter} seconds before trying again.`,
        retryAfter: result.retryAfter,
        captchaRequired: result.captchaRequired,
      })
    }

    req.rateLimit = result
    next()
  }
}

export default commentRateLimit
