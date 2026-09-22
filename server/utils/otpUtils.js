/**
 * OTP Utilities (Phase 7)
 *
 * Provides cryptographically secure OTP generation, safe contact masking,
 * and strict numeric OTP validation.
 */

import crypto from "crypto"

/**
 * Generates a cryptographically secure random numeric OTP.
 * Uses crypto.randomInt to guarantee uniform randomness and unpredictability.
 * NEVER uses Math.random().
 *
 * @param {number} length - Number of digits (default: 6)
 * @returns {string} Zero-padded numeric OTP string
 */
export function generateSecureOTP(length = 6) {
  const max = 10 ** length
  const num = crypto.randomInt(0, max)
  return String(num).padStart(length, "0")
}

/**
 * Masks an email address for privacy-conscious display.
 * Example: "kundank82522@gmail.com" -> "kun***@gmail.com"
 *
 * @param {string} email - Full email address
 * @returns {string} Masked email string
 */
export function maskEmail(email = "") {
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return "***@***.com"
  }

  const [username, domain] = email.split("@")
  if (!username) return `***@${domain}`

  if (username.length <= 3) {
    return `${username.charAt(0)}***@${domain}`
  }

  const visible = username.slice(0, 3)
  return `${visible}***@${domain}`
}

/**
 * Masks a phone number for privacy-conscious display.
 * Example: "+919876543210" -> "+91 ******3210"
 * Example: "9876543210" -> "******3210"
 *
 * @param {string} phone - Full phone number
 * @returns {string} Masked phone number string
 */
export function maskPhoneNumber(phone = "") {
  if (!phone || typeof phone !== "string") {
    return "******0000"
  }

  const cleaned = phone.trim()
  if (cleaned.length < 6) {
    return "******" + cleaned.slice(-2)
  }

  const last4 = cleaned.slice(-4)

  // Preserve country code if present (+91, +1, etc.)
  if (cleaned.startsWith("+")) {
    const spaceIdx = cleaned.indexOf(" ")
    if (spaceIdx > 0 && spaceIdx <= 4) {
      const prefix = cleaned.slice(0, spaceIdx)
      return `${prefix} ******${last4}`
    }
    const prefix = cleaned.slice(0, 3)
    return `${prefix} ******${last4}`
  }

  return `******${last4}`
}

/**
 * Validates whether a provided OTP string consists strictly of N numeric digits.
 *
 * @param {string} otp - Candidate OTP
 * @param {number} length - Expected length (default: 6)
 * @returns {boolean}
 */
export function isValidNumericOTP(otp, length = 6) {
  if (!otp || typeof otp !== "string") return false
  const trimmed = otp.trim()
  if (trimmed.length !== length) return false
  return /^\d+$/.test(trimmed)
}

export default {
  generateSecureOTP,
  maskEmail,
  maskPhoneNumber,
  isValidNumericOTP,
}
