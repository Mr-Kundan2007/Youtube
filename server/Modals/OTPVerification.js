/**
 * OTP Verification Model (Phase 7)
 *
 * Stores hashed one-time passwords for login verification challenges.
 * Plaintext OTPs are NEVER stored in the database.
 * Uses MongoDB TTL indexing for automatic background cleanup.
 */

import mongoose from "mongoose"

const otpVerificationSchema = new mongoose.Schema(
  {
    pendingLoginId: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    purpose: {
      type: String,
      enum: [
        "LOGIN_VERIFICATION",
        "EMAIL_VERIFICATION",
        "PASSWORD_RESET",
        "MOBILE_VERIFICATION",
        "ACCOUNT_RECOVERY",
      ],
      default: "LOGIN_VERIFICATION",
      index: true,
    },
    otpHash: {
      type: String,
      required: true,
    },
    deliveryMethod: {
      type: String,
      enum: ["EMAIL", "SMS"],
      required: true,
    },
    destination: {
      type: String,
      default: "",
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // MongoDB TTL index to automatically purge expired records
    },
    attemptCount: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: 5,
    },
    resendCount: {
      type: Number,
      default: 0,
    },
    lastResentAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "USED", "EXPIRED", "LOCKED", "INVALIDATED"],
      default: "ACTIVE",
      index: true,
    },
    usedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
)

// Compound indexes for quick lookup
otpVerificationSchema.index({ pendingLoginId: 1, purpose: 1, status: 1 })
otpVerificationSchema.index({ userId: 1, createdAt: -1 })

const OTPVerification =
  mongoose.models.OTPVerification ||
  mongoose.model("OTPVerification", otpVerificationSchema)

export default OTPVerification
