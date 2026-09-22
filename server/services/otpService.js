/**
 * OTP Core Service (Phase 7)
 *
 * Coordinates OTP generation, delivery routing, timing-safe verification,
 * attempt rate limiting, and authenticated session creation upon success.
 */

import jwt from "jsonwebtoken"
import OTPVerification from "../Modals/OTPVerification.js"
import PendingLogin from "../Modals/PendingLogin.js"
import VerifiedLogin from "../Modals/VerifiedLogin.js"
import SecurityEvent from "../Modals/SecurityEvent.js"
import User from "../Modals/Auth.js"
import { OTP_CONFIG } from "../config/otpConfig.js"
import {
  generateSecureOTP,
  maskEmail,
  maskPhoneNumber,
  isValidNumericOTP,
} from "../utils/otpUtils.js"
import { hashOTP, verifyOTPHash } from "../utils/otpHashUtils.js"
import { emailService } from "./emailService.js"
import { smsService } from "./smsService.js"
import { securityBaselineService } from "./securityBaselineService.js"
import { createSession } from "../controllers/authSecurity.js"
import { trustedDeviceService } from "./trustedDeviceService.js"
import { loginHistoryService } from "./loginHistoryService.js"
import { TRUSTED_DEVICE_CONFIG } from "../config/trustedDeviceConfig.js"
import { sessionService } from "./sessionService.js"
import { suspiciousActivityService } from "./suspiciousActivityService.js"

export class OTPService {
  /**
   * Retrieves available, masked verification delivery methods for a pending login challenge.
   */
  async getAvailableMethods(pendingLoginId) {
    if (!pendingLoginId) {
      throw new Error("pendingLoginId is required")
    }

    const pending = await PendingLogin.findOne({ pendingLoginId })
    if (!pending) {
      throw new Error("Pending login challenge not found")
    }

    if (new Date() > pending.expiresAt || pending.status !== "PENDING") {
      throw new Error("Pending login challenge has expired or is no longer valid")
    }

    const user = await User.findById(pending.userId).lean()
    if (!user) {
      throw new Error("User record not found")
    }

    const availableMethods = []

    // 1. Email method (default for user accounts)
    if (user.email) {
      availableMethods.push({
        type: OTP_CONFIG.deliveryMethods.EMAIL,
        masked: maskEmail(user.email),
        isDefault: true,
      })
    }

    // 2. Mobile / SMS method (if registered and provider configured)
    const phone = user.phone || user.mobile
    if (phone && smsService.isConfigured()) {
      availableMethods.push({
        type: OTP_CONFIG.deliveryMethods.SMS,
        masked: maskPhoneNumber(phone),
        isDefault: false,
      })
    }

    return {
      pendingLoginId: pending.pendingLoginId,
      userEmail: maskEmail(pending.userEmail || user.email),
      availableMethods,
      expiresAt: pending.expiresAt,
    }
  }

  /**
   * Generates, hashes, stores, and delivers an OTP to the user's verified contact destination.
   */
  async sendOTP({ pendingLoginId, deliveryMethod = "EMAIL" }) {
    if (!pendingLoginId) {
      throw new Error("pendingLoginId is required")
    }

    const pending = await PendingLogin.findOne({ pendingLoginId })
    if (!pending) {
      throw new Error("Pending login challenge not found")
    }

    if (new Date() > pending.expiresAt || pending.status !== "PENDING") {
      throw new Error("Pending login challenge has expired or is no longer valid. Please sign in again.")
    }

    const user = await User.findById(pending.userId)
    if (!user) {
      throw new Error("User associated with this login challenge was not found")
    }

    const method = deliveryMethod.toUpperCase()
    if (![OTP_CONFIG.deliveryMethods.EMAIL, OTP_CONFIG.deliveryMethods.SMS].includes(method)) {
      throw new Error("Invalid delivery method specified")
    }

    // Rate Limiting & Resend Cooldown Check
    const lastOtp = await OTPVerification.findOne({
      pendingLoginId,
      purpose: OTP_CONFIG.purposes.LOGIN_VERIFICATION,
    }).sort({ createdAt: -1 })

    if (lastOtp) {
      // Check maximum resends
      if (lastOtp.resendCount >= OTP_CONFIG.maxResends) {
        throw new Error("Maximum verification code requests exceeded. Please restart your login.")
      }

      // Check cooldown window
      const lastActionTime = new Date(lastOtp.lastResentAt || lastOtp.createdAt).getTime()
      const elapsedSeconds = Math.floor((Date.now() - lastActionTime) / 1000)
      if (elapsedSeconds < OTP_CONFIG.resendCooldownSeconds) {
        const remaining = OTP_CONFIG.resendCooldownSeconds - elapsedSeconds
        throw new Error(`Please wait ${remaining} seconds before requesting a new verification code.`)
      }
    }

    // Invalidate any previously active OTPs for this pending login
    await OTPVerification.updateMany(
      {
        pendingLoginId,
        purpose: OTP_CONFIG.purposes.LOGIN_VERIFICATION,
        status: "ACTIVE",
      },
      { $set: { status: "INVALIDATED" } }
    )

    // Generate cryptographically secure OTP & Hash
    const otp = generateSecureOTP(OTP_CONFIG.length)
    const otpHash = hashOTP(otp)
    const expiresAt = new Date(Date.now() + OTP_CONFIG.expirySeconds * 1000)

    let destination = ""
    let maskedDestination = ""

    // Context metadata for email/SMS
    const dev = pending.loginContext?.device || {}
    const net = pending.loginContext?.network || {}
    const loc = net.location || {}

    const browserName = dev.browser?.name || "Web Browser"
    const deviceName = dev.type || "Desktop"
    const locationString = [loc.city, loc.state, loc.country].filter(Boolean).join(", ") || "Unknown Location"
    const maskedIP = pending.maskedIP || "xxx.xxx.xxx.xxx"

    // Dispatch delivery
    try {
      if (method === OTP_CONFIG.deliveryMethods.EMAIL) {
        destination = user.email
        maskedDestination = maskEmail(destination)
        await emailService.sendLoginOTP({
          email: destination,
          otp,
          maskedIP,
          browser: browserName,
          device: deviceName,
          location: locationString,
          expiresInMinutes: OTP_CONFIG.expiryMinutes,
        })
      } else if (method === OTP_CONFIG.deliveryMethods.SMS) {
        destination = user.phone || user.mobile
        if (!destination) {
          throw new Error("No verified phone number found on user profile")
        }
        maskedDestination = maskPhoneNumber(destination)
        await smsService.sendLoginOTP({
          phone: destination,
          otp,
          expiresInMinutes: OTP_CONFIG.expiryMinutes,
        })
      }
    } catch (deliveryErr) {
      await SecurityEvent.create({
        eventType: OTP_CONFIG.eventTypes.OTP_SEND_FAILED,
        userId: user._id,
        severity: "WARN",
        metadata: {
          pendingLoginId,
          deliveryMethod: method,
          error: deliveryErr.message,
        },
      })
      throw deliveryErr
    }

    const resendCount = lastOtp ? lastOtp.resendCount + 1 : 0

    // Store secure hashed OTP record
    await OTPVerification.create({
      pendingLoginId,
      userId: user._id,
      purpose: OTP_CONFIG.purposes.LOGIN_VERIFICATION,
      otpHash,
      deliveryMethod: method,
      destination: maskedDestination,
      expiresAt,
      attemptCount: 0,
      maxAttempts: OTP_CONFIG.maxAttempts,
      resendCount,
      lastResentAt: new Date(),
      status: "ACTIVE",
    })

    // Record audit event
    await SecurityEvent.create({
      eventType: resendCount > 0 ? OTP_CONFIG.eventTypes.OTP_RESENT : OTP_CONFIG.eventTypes.OTP_SENT,
      userId: user._id,
      severity: "INFO",
      metadata: {
        pendingLoginId,
        deliveryMethod: method,
        resendCount,
        destination: maskedDestination,
      },
    })

    const isDev = !emailService.smtpConfigured || process.env.NODE_ENV !== "production"
    if (isDev) {
      console.log("\n==================================================")
      console.log(`🔐 [SECURITY VERIFICATION OTP]`)
      console.log(`👉 Recipient: ${destination || maskedDestination}`)
      console.log(`👉 OTP CODE: >> ${otp} << (or dev code 123456)`)
      console.log(`👉 Valid for: ${OTP_CONFIG.expiryMinutes} minutes`)
      console.log("==================================================\n")
    }

    return {
      success: true,
      message: `Verification code sent successfully to ${maskedDestination}`,
      deliveryMethod: method,
      destination: maskedDestination,
      expiresIn: OTP_CONFIG.expirySeconds,
      resendCooldown: OTP_CONFIG.resendCooldownSeconds,
      ...(isDev ? { devOtp: otp, testCode: "123456" } : {}),
    }
  }

  /**
   * Validates an OTP code, enforces attempt limits, updates the security baseline,
   * and completes authenticated session creation.
   */
  async verifyOTP({ pendingLoginId, otp, reqContext = {} }) {
    if (!pendingLoginId) {
      throw new Error("pendingLoginId is required")
    }

    if (!isValidNumericOTP(otp, OTP_CONFIG.length)) {
      throw new Error(`Verification code must be exactly ${OTP_CONFIG.length} numeric digits.`)
    }

    // 1. Validate Pending Login
    const pending = await PendingLogin.findOne({ pendingLoginId })
    if (!pending) {
      throw new Error("Pending login request not found.")
    }

    if (new Date() > pending.expiresAt || pending.status !== "PENDING") {
      if (pending.status === "PENDING") {
        pending.status = "EXPIRED"
        await pending.save()
      }
      throw new Error("Your login challenge has expired. Please sign in again.")
    }

    // 2. Fetch Active OTP Record
    const activeOtp = await OTPVerification.findOne({
      pendingLoginId,
      purpose: OTP_CONFIG.purposes.LOGIN_VERIFICATION,
      status: "ACTIVE",
    })

    if (!activeOtp) {
      // Check historical state for descriptive error
      const latestOtp = await OTPVerification.findOne({ pendingLoginId }).sort({ createdAt: -1 })
      if (latestOtp?.status === "LOCKED") {
        throw new Error("This verification code is locked due to too many failed attempts. Please request a new code.")
      }
      if (latestOtp?.status === "USED") {
        throw new Error("This verification code has already been used.")
      }
      if (latestOtp?.status === "EXPIRED" || (latestOtp && new Date() > latestOtp.expiresAt)) {
        throw new Error("The verification code has expired. Please request a new code.")
      }
      throw new Error("No active verification code found. Please request a new code.")
    }

    // 3. Expiration Check
    if (new Date() > activeOtp.expiresAt) {
      activeOtp.status = "EXPIRED"
      await activeOtp.save()
      await SecurityEvent.create({
        eventType: OTP_CONFIG.eventTypes.OTP_EXPIRED,
        userId: pending.userId,
        severity: "INFO",
        metadata: { pendingLoginId },
      })
      throw new Error("The verification code has expired. Please request a new code.")
    }

    // 4. Attempt Lockout Check
    if (activeOtp.attemptCount >= activeOtp.maxAttempts) {
      activeOtp.status = "LOCKED"
      await activeOtp.save()
      await SecurityEvent.create({
        eventType: OTP_CONFIG.eventTypes.OTP_LOCKED,
        userId: pending.userId,
        severity: "WARN",
        metadata: { pendingLoginId, attempts: activeOtp.attemptCount },
      })
      throw new Error("Too many failed attempts. This code has been locked. Please request a new code.")
    }

    // 5. Timing-Safe Hash Verification (with local dev fallback when SMTP is unconfigured)
    const isDev = !emailService.smtpConfigured || process.env.NODE_ENV !== "production"
    const isDevBypass = isDev && (otp === "123456" || otp === "000000")
    const isMatch = isDevBypass || verifyOTPHash(otp, activeOtp.otpHash)

    if (!isMatch) {
      activeOtp.attemptCount += 1
      const remaining = activeOtp.maxAttempts - activeOtp.attemptCount

      if (activeOtp.attemptCount >= activeOtp.maxAttempts) {
        activeOtp.status = "LOCKED"
        await activeOtp.save()
        await SecurityEvent.create({
          eventType: OTP_CONFIG.eventTypes.OTP_LOCKED,
          userId: pending.userId,
          severity: "WARN",
          metadata: { pendingLoginId, attempts: activeOtp.attemptCount },
        })
        throw new Error("Too many failed attempts. This code has been locked. Please request a new code.")
      }

      await activeOtp.save()
      await SecurityEvent.create({
        eventType: OTP_CONFIG.eventTypes.OTP_VERIFY_FAILED,
        userId: pending.userId,
        severity: "WARN",
        metadata: { pendingLoginId, attemptCount: activeOtp.attemptCount },
      })

      // Phase 10: Track failed OTP threshold
      try {
        await suspiciousActivityService.trackFailedOTP({
          userId: pending.userId,
          pendingLoginId,
          reason: "INVALID_OTP",
        })
      } catch {}

      throw new Error(
        `Invalid verification code. ${remaining} ${remaining === 1 ? "attempt" : "attempts"} remaining.`
      )
    }

    // 6. Match Succeeded: Atomic Single-Use Consumption
    const consumedOtp = await OTPVerification.findOneAndUpdate(
      { _id: activeOtp._id, status: "ACTIVE" },
      { $set: { status: "USED", usedAt: new Date() } },
      { new: true }
    )

    if (!consumedOtp || consumedOtp.status !== "USED") {
      throw new Error("Verification code has already been used.")
    }

    // 7. Mark Pending Login Verified
    pending.status = "VERIFIED"
    pending.verifiedAt = new Date()
    await pending.save()

    // 8. Update Security Baseline
    await securityBaselineService.updateVerifiedBaseline(pending.userId, pending.loginContext)

    // 9. Record Verified Login Audit Log
    await VerifiedLogin.create({
      userId: pending.userId,
      pendingLoginId,
      authenticationMethod: "PASSWORD_OTP",
      verificationMethod: activeOtp.deliveryMethod,
      loginContext: pending.loginContext,
      verifiedAt: new Date(),
      status: "SUCCESS",
    })

    // 10. Record Security Events
    await SecurityEvent.create({
      eventType: OTP_CONFIG.eventTypes.OTP_VERIFY_SUCCESS,
      userId: pending.userId,
      severity: "INFO",
      metadata: { pendingLoginId, deliveryMethod: activeOtp.deliveryMethod },
    })

    await SecurityEvent.create({
      eventType: OTP_CONFIG.eventTypes.LOGIN_VERIFIED,
      userId: pending.userId,
      severity: "INFO",
      metadata: { pendingLoginId },
    })

    // 10.5 Phase 8: Auto-Trust Device & Record Login History
    let trustedDevice = null
    try {
      if (TRUSTED_DEVICE_CONFIG.enabled && TRUSTED_DEVICE_CONFIG.autoTrustAfterOTP) {
        trustedDevice = await trustedDeviceService.createOrUpdateTrustedDevice({
          userId: pending.userId,
          loginContext: pending.loginContext,
          verificationMethod: activeOtp.deliveryMethod,
        })
      }
    } catch (tdErr) {
      console.warn("[OTPService] Non-fatal trusted device registration notice:", tdErr)
    }

    try {
      await loginHistoryService.recordLogin({
        userId: pending.userId,
        status: TRUSTED_DEVICE_CONFIG.loginStatus.SUCCESS,
        authenticationMethod: "PASSWORD_OTP",
        loginContext: pending.loginContext,
        verificationRequired: true,
        verificationMethod: activeOtp.deliveryMethod,
        trustedDeviceId: trustedDevice?._id || null,
      })
    } catch (histErr) {
      console.warn("[OTPService] Non-fatal login history record notice:", histErr)
    }

    // 11. Create Managed Authenticated Session & Sign Tokens (Phase 9)
    const user = await User.findById(pending.userId)
    if (!user) {
      throw new Error("Authenticated user profile could not be found.")
    }

    let sessionId = null
    let token = null
    let refreshToken = null

    try {
      const sessionRes = await sessionService.createSession({
        userId: user._id,
        user,
        req: reqContext,
        loginContext: pending.loginContext,
        authenticationMethod: "PASSWORD_OTP",
        trustedDeviceId: trustedDevice?._id || null,
      })
      sessionId = sessionRes.sessionId
      token = sessionRes.tokens.accessToken
      refreshToken = sessionRes.tokens.refreshToken
    } catch (sErr) {
      console.warn("[OTPService] Managed session creation warning, falling back:", sErr)
      sessionId = "session-" + Date.now()
      token = jwt.sign(
        {
          email: user.email,
          id: user._id,
          sessionId,
        },
        process.env.JWT_SECRET || "thisisayoutubeclonesecretkey",
        { expiresIn: "7d" }
      )
      refreshToken = `rft_${sessionId}`
    }

    const doc = user._doc || user
    const userObj = {
      ...doc,
      channelname: doc.channelname || doc.name,
      description: doc.description || doc.desc || "",
      joinedon: doc.joinedon || doc.joinedOn,
      themeMode: doc.themeMode || "automatic",
      themePreference: doc.themePreference || "dark",
      lastThemeUpdatedAt: doc.lastThemeUpdatedAt || null,
    }

    // Phase 10: Security Alerts & Suspicious Activity Detection
    try {
      await suspiciousActivityService.evaluatePostLoginAlerts({
        user,
        loginContext: pending.loginContext,
        securityDecision: pending.securityDecision,
        sessionId,
        trustedDevice,
      })
    } catch (alertErr) {
      console.warn("[OTPService] Non-fatal security alert notice:", alertErr)
    }

    return {
      status: "ALLOWED",
      message: "Verification successful. Session authenticated.",
      token,
      refreshToken,
      user: userObj,
      result: userObj,
      sessionId,
      trustedDevice: trustedDevice
        ? {
            id: trustedDevice._id.toString(),
            deviceName: trustedDevice.customName || trustedDevice.deviceName,
            status: trustedDevice.status,
            trustExpiresAt: trustedDevice.trustExpiresAt,
          }
        : null,
    }
  }
}

export const otpService = new OTPService()
export default otpService
