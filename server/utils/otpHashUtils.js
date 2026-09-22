/**
 * OTP Hash Utilities (Phase 7)
 *
 * Provides cryptographic HMAC-SHA256 hashing and timing-safe verification
 * for OTPs. Plain OTPs are NEVER stored or logged.
 */

import crypto from "crypto"
import { OTP_CONFIG } from "../config/otpConfig.js"

/**
 * Computes an HMAC-SHA256 hash for a given plaintext OTP.
 *
 * @param {string} otp - The 6-digit plain OTP
 * @param {string} [secret] - Optional secret override (defaults to OTP_CONFIG.otpSecret)
 * @returns {string} Hex-encoded HMAC hash
 */
export function hashOTP(otp = "", secret = OTP_CONFIG.otpSecret) {
  if (!otp || typeof otp !== "string") {
    throw new Error("Cannot hash an empty or non-string OTP")
  }
  return crypto.createHmac("sha256", secret).update(otp.trim()).digest("hex")
}

/**
 * Verifies a candidate OTP against a stored HMAC-SHA256 hash in constant time.
 * Uses crypto.timingSafeEqual to eliminate timing side-channel vulnerabilities.
 *
 * @param {string} candidateOtp - The OTP entered by the user
 * @param {string} storedHash - The HMAC hash stored in the database
 * @param {string} [secret] - Optional secret override
 * @returns {boolean} True if matching, false otherwise
 */
export function verifyOTPHash(candidateOtp = "", storedHash = "", secret = OTP_CONFIG.otpSecret) {
  if (!candidateOtp || !storedHash || typeof candidateOtp !== "string" || typeof storedHash !== "string") {
    return false
  }

  try {
    const candidateHash = hashOTP(candidateOtp, secret)
    const candidateBuf = Buffer.from(candidateHash, "hex")
    const storedBuf = Buffer.from(storedHash, "hex")

    if (candidateBuf.length !== storedBuf.length) {
      return false
    }

    return crypto.timingSafeEqual(candidateBuf, storedBuf)
  } catch (err) {
    // Fail secure
    return false
  }
}

export default {
  hashOTP,
  verifyOTPHash,
}
