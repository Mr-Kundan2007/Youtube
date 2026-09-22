/**
 * OTP Controller (Phase 7)
 *
 * Exposes endpoints for discovery of available verification methods,
 * OTP dispatch/resend, and timing-safe verification.
 */

import { otpService } from "../services/otpService.js"

/**
 * GET /api/auth/otp/methods/:pendingLoginId
 * Returns available masked verification delivery methods (Email, SMS).
 */
export const getAvailableMethods = async (req, res) => {
  const { pendingLoginId } = req.params
  try {
    const result = await otpService.getAvailableMethods(pendingLoginId)
    return res.status(200).json(result)
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message || "Could not retrieve verification methods.",
    })
  }
}

/**
 * POST /api/auth/otp/send
 * Requests dispatch or resend of an OTP to the chosen delivery destination.
 */
export const sendOTP = async (req, res) => {
  const { pendingLoginId, deliveryMethod = "EMAIL" } = req.body
  try {
    const result = await otpService.sendOTP({ pendingLoginId, deliveryMethod })
    return res.status(200).json(result)
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message || "Failed to send verification code. Please try again.",
    })
  }
}

/**
 * POST /api/auth/otp/verify
 * Validates the user's 6-digit OTP, marks verification complete, and signs auth session.
 */
export const verifyOTP = async (req, res) => {
  const { pendingLoginId, otp } = req.body
  try {
    const result = await otpService.verifyOTP({
      pendingLoginId,
      otp,
      reqContext: req,
    })
    return res.status(200).json(result)
  } catch (err) {
    return res.status(400).json({
      success: false,
      status: "VERIFICATION_FAILED",
      message: err.message || "Invalid or expired verification code.",
    })
  }
}

export default {
  getAvailableMethods,
  sendOTP,
  verifyOTP,
}
