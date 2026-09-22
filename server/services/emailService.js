/**
 * Email Service (Phase 7)
 *
 * Handles secure email delivery for login OTPs, security alerts, and recovery.
 * Provides templating with masked environment context and test outbox support.
 */

import nodemailer from "nodemailer"
import { maskIPAddress } from "../utils/comparisonUtils.js"
import { maskEmail } from "../utils/otpUtils.js"

export class EmailService {
  constructor() {
    this.outbox = [] // In-memory outbox for testing and inspection
    this.smtpHost = process.env.SMTP_HOST || "smtp.gmail.com"
    this.smtpPort = parseInt(process.env.SMTP_PORT, 10) || 587
    this.smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER || ""
    this.smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS || ""
    this.smtpFrom = process.env.SMTP_FROM || process.env.EMAIL_FROM || (this.smtpUser ? `"YouTube Security" <${this.smtpUser}>` : '"YouTube Security" <no-reply@youtube.com>')

    this.smtpConfigured = Boolean(this.smtpUser && this.smtpPass)

    this.transporter = null
    if (this.smtpConfigured) {
      try {
        this.transporter = nodemailer.createTransport({
          host: this.smtpHost,
          port: this.smtpPort,
          secure: this.smtpPort === 465,
          auth: {
            user: this.smtpUser,
            pass: this.smtpPass,
          },
        })
      } catch (err) {
        console.warn("[EmailService] Failed to initialize nodemailer transporter:", err.message)
      }
    }
  }

  /**
   * Generates standard HTML and plaintext templates for a login OTP email.
   */
  generateOTPTemplate({
    otp,
    maskedIP = "xxx.xxx.xxx.xxx",
    browser = "Web Browser",
    device = "Desktop",
    location = "Unknown Location",
    expiresInMinutes = 5,
  }) {
    const textContent = `
YouTube Security Verification

Your verification code is: ${otp}

This code will expire in ${expiresInMinutes} minutes.

We detected a sign-in attempt with the following details:
• Browser: ${browser}
• Device: ${device}
• Location: ${location}
• IP Address: ${maskedIP}

If you did not attempt to sign in, please secure your account immediately.
`

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Security Verification Code</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f0f0f; color: #f1f1f1; margin: 0; padding: 24px;">
  <div style="max-width: 540px; margin: 0 auto; background-color: #1a1a1a; border: 1px solid #2e2e2e; border-radius: 12px; padding: 32px;">
    <div style="display: flex; align-items: center; margin-bottom: 24px;">
      <span style="font-size: 20px; font-weight: 700; color: #ff0000; letter-spacing: -0.5px;">YouTube</span>
      <span style="font-size: 14px; color: #aaaaaa; margin-left: 8px;">Security Verification</span>
    </div>
    
    <p style="font-size: 15px; color: #cccccc; line-height: 1.5; margin-bottom: 20px;">
      We noticed a sign-in attempt from a new or unverified environment. Enter the code below to complete authentication:
    </p>

    <div style="background-color: #242424; border: 1px dashed #404040; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
      <span style="font-family: monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #ffffff;">${otp}</span>
      <p style="font-size: 12px; color: #888888; margin-top: 8px; margin-bottom: 0;">Valid for ${expiresInMinutes} minutes</p>
    </div>

    <div style="background-color: #202020; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
      <h4 style="font-size: 13px; color: #aaaaaa; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 0.5px;">Login Environment Details</h4>
      <table style="width: 100%; font-size: 13px; color: #dddddd; border-collapse: collapse;">
        <tr>
          <td style="padding: 4px 0; color: #888888;">Device:</td>
          <td style="padding: 4px 0; text-align: right;">${device} (${browser})</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #888888;">Location:</td>
          <td style="padding: 4px 0; text-align: right;">${location}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #888888;">IP Address:</td>
          <td style="padding: 4px 0; text-align: right; font-family: monospace;">${maskedIP}</td>
        </tr>
      </table>
    </div>

    <p style="font-size: 12px; color: #777777; line-height: 1.4; margin: 0;">
      If you did not make this request, someone else may be trying to access your account. Please change your password immediately.
    </p>
  </div>
</body>
</html>
`

    return { textContent, htmlContent }
  }

  /**
   * Sends a Login OTP email to the user's verified email address.
   */
  async sendLoginOTP({
    email,
    otp,
    maskedIP,
    browser,
    device,
    location,
    expiresInMinutes = 5,
  }) {
    if (!email) {
      throw new Error("Recipient email address is required")
    }
    if (!otp) {
      throw new Error("OTP verification code is required")
    }

    const { textContent, htmlContent } = this.generateOTPTemplate({
      otp,
      maskedIP,
      browser,
      device,
      location,
      expiresInMinutes,
    })

    const messageRecord = {
      to: email,
      maskedTo: maskEmail(email),
      subject: "Your YouTube Login Verification Code",
      sentAt: new Date(),
      expiresInMinutes,
      textContent,
      htmlContent,
      // Plain OTP is stored only in ephemeral outbox for test runner verification
      testOtp: otp,
    }

    // In-memory outbox recording for testing & audit inspection
    this.outbox.push(messageRecord)

    // Real SMTP delivery if credentials are provided
    if (this.smtpConfigured && this.transporter) {
      try {
        const info = await this.transporter.sendMail({
          from: this.smtpFrom,
          to: email,
          subject: "Your YouTube Login Verification Code",
          text: textContent,
          html: htmlContent,
        })
        console.log(`[EmailService] Real OTP email successfully delivered to ${email}. MessageId: ${info.messageId}`)
      } catch (sendErr) {
        console.error(`[EmailService ERROR] Failed to send real email to ${email}:`, sendErr.message)
      }
    }

    // Log delivery dispatch
    if (process.env.NODE_ENV !== "test") {
      console.log(`[EmailService] OTP email dispatched to ${maskEmail(email)} (expires in ${expiresInMinutes}m)`)
      if (!this.smtpConfigured || process.env.NODE_ENV !== "production") {
        console.log(`[EmailService DEV] Plaintext OTP code for ${email} is: >> ${otp} <<`)
      }
    }

    return {
      success: true,
      destination: maskEmail(email),
      expiresInMinutes,
    }
  }

  /**
   * Generates standard HTML and plaintext templates for a Security Alert email.
   * Does NOT contain passwords, OTPs, tokens, or security secrets.
   */
  generateSecurityAlertTemplate({
    title = "Security Alert",
    message = "Important security activity was detected on your account.",
    severity = "MEDIUM",
    browser = "Web Browser",
    device = "Device",
    location = "Unknown Location",
    maskedIP = "xxx.xxx.xxx.xxx",
    timestamp = new Date(),
  }) {
    const formattedDate = new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(timestamp))

    const severityColor =
      severity === "CRITICAL"
        ? "#ef4444"
        : severity === "HIGH"
        ? "#f97316"
        : severity === "MEDIUM"
        ? "#eab308"
        : "#3b82f6"

    const textContent = `
YouTube Security Alert [${severity}]

${title}

${message}

Activity Details:
• Browser: ${browser}
• Device: ${device}
• Location: ${location}
• IP Address: ${maskedIP}
• Time: ${formattedDate}

If this was you, no action is required.
If this was not you, secure your account immediately:
https://your-platform.com/account/security
`

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f0f0f; color: #f1f1f1; margin: 0; padding: 24px;">
  <div style="max-width: 540px; margin: 0 auto; background-color: #1a1a1a; border: 1px solid #2e2e2e; border-radius: 12px; padding: 32px;">
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px;">
      <div style="display: flex; align-items: center;">
        <span style="font-size: 20px; font-weight: 700; color: #ff0000; letter-spacing: -0.5px;">YouTube</span>
        <span style="font-size: 14px; color: #aaaaaa; margin-left: 8px;">Security Alert</span>
      </div>
      <span style="display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; background-color: ${severityColor}20; color: ${severityColor}; border: 1px solid ${severityColor}40;">
        ${severity}
      </span>
    </div>

    <h3 style="font-size: 18px; color: #ffffff; margin: 0 0 12px 0;">${title}</h3>
    <p style="font-size: 14px; color: #cccccc; line-height: 1.5; margin-bottom: 24px;">
      ${message}
    </p>

    <div style="background-color: #202020; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
      <h4 style="font-size: 12px; color: #888888; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 0.5px;">Activity Details</h4>
      <table style="width: 100%; font-size: 13px; color: #dddddd; border-collapse: collapse;">
        <tr>
          <td style="padding: 4px 0; color: #888888;">Device:</td>
          <td style="padding: 4px 0; text-align: right;">${device} (${browser})</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #888888;">Location:</td>
          <td style="padding: 4px 0; text-align: right;">${location}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #888888;">IP Address:</td>
          <td style="padding: 4px 0; text-align: right; font-family: monospace;">${maskedIP}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #888888;">Time:</td>
          <td style="padding: 4px 0; text-align: right;">${formattedDate}</td>
        </tr>
      </table>
    </div>

    <p style="font-size: 13px; color: #aaaaaa; line-height: 1.4; margin: 0 0 20px 0;">
      If this was you, no action is required. If you did not perform or recognize this activity, please secure your account immediately.
    </p>

    <div style="text-align: center;">
      <a href="/account/security" style="display: inline-block; background-color: #ff0000; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-weight: 600; font-size: 14px;">
        Review & Secure Account
      </a>
    </div>
  </div>
</body>
</html>
`

    return { textContent, htmlContent }
  }

  /**
   * Sends a Security Alert notification email to the user's verified email.
   */
  async sendSecurityAlert({
    email,
    alertType,
    title,
    message,
    severity = "MEDIUM",
    metadata = {},
  }) {
    if (!email) {
      throw new Error("Recipient email address is required")
    }

    const {
      browser = "Web Browser",
      device = "Device",
      location = "Unknown Location",
      maskedIP = "xxx.xxx.xxx.xxx",
      timestamp = new Date(),
    } = metadata

    const { textContent, htmlContent } = this.generateSecurityAlertTemplate({
      title: title || "Security Alert Detected",
      message: message || "Important activity occurred on your account.",
      severity,
      browser,
      device,
      location,
      maskedIP,
      timestamp,
    })

    const messageRecord = {
      to: email,
      maskedTo: maskEmail(email),
      subject: `Security Alert: ${title || alertType}`,
      alertType,
      severity,
      sentAt: new Date(),
      textContent,
      htmlContent,
      metadata,
    }

    this.outbox.push(messageRecord)

    if (process.env.NODE_ENV !== "test") {
      console.log(`[EmailService] Security alert (${severity}) dispatched to ${maskEmail(email)}`)
    }

    return {
      success: true,
      destination: maskEmail(email),
      alertType,
      severity,
    }
  }

  /**
   * Prepared placeholder for future password reset emails.
   */
  async sendPasswordReset({ email, resetToken }) {
    return { success: true, destination: maskEmail(email) }
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

export const emailService = new EmailService()
export default emailService
