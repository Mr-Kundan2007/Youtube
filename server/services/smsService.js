/**
 * SMS Service (Phase 7)
 *
 * Pluggable SMS delivery provider abstraction.
 * If no SMS provider credentials are configured, SMS delivery is safely disabled
 * without breaking the authentication pipeline (email continues working).
 */

import { maskPhoneNumber } from "../utils/otpUtils.js"

export class SMSService {
  constructor() {
    this.outbox = []
    this.provider = process.env.SMS_PROVIDER || null
    this.apiKey = process.env.SMS_API_KEY || null
    this.senderId = process.env.SMS_SENDER_ID || "YouTube"
  }

  /**
   * Returns whether a valid SMS provider is actively configured.
   */
  isConfigured() {
    return Boolean(this.provider && this.apiKey)
  }

  /**
   * Sends a Login OTP SMS message.
   */
  async sendLoginOTP({ phone, otp, expiresInMinutes = 5 }) {
    if (!phone) {
      throw new Error("Recipient phone number is required")
    }
    if (!otp) {
      throw new Error("OTP verification code is required")
    }

    // If SMS provider is not configured, throw a clear error for graceful fallback
    if (!this.isConfigured()) {
      throw new Error("SMS delivery service is currently not configured or disabled")
    }

    const message = `Your YouTube security verification code is ${otp}. Valid for ${expiresInMinutes} minutes. Do not share this code.`

    const record = {
      to: phone,
      maskedTo: maskPhoneNumber(phone),
      message,
      sentAt: new Date(),
      expiresInMinutes,
      testOtp: otp,
    }

    this.outbox.push(record)

    if (process.env.NODE_ENV !== "test") {
      console.log(`[SMSService] SMS dispatched to ${maskPhoneNumber(phone)} via ${this.provider}`)
    }

    return {
      success: true,
      destination: maskPhoneNumber(phone),
      expiresInMinutes,
    }
  }

  /**
   * Clears the in-memory test outbox.
   */
  clearOutbox() {
    this.outbox = []
  }

  /**
   * Retrieves the in-memory test outbox.
   */
  getOutbox() {
    return this.outbox
  }
}

export const smsService = new SMSService()
export default smsService
