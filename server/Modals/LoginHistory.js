/**
 * Login History Model (Phase 8)
 *
 * Stores comprehensive audit records of every login attempt: successful,
 * failed, OTP-gated, blocked, and expired.
 * Never stores passwords, tokens, OTPs, or sensitive secrets.
 */

import mongoose from "mongoose"

const loginHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["SUCCESS", "FAILED", "OTP_REQUIRED", "OTP_FAILED", "BLOCKED", "EXPIRED"],
      default: "SUCCESS",
      index: true,
    },
    authenticationMethod: {
      type: String,
      default: "PASSWORD",
    },
    browser: {
      name: { type: String, default: "Unknown Browser" },
      version: { type: String, default: "" },
      family: { type: String, default: "unknown" },
    },
    operatingSystem: {
      name: { type: String, default: "Unknown OS" },
      version: { type: String, default: "" },
    },
    device: {
      type: { type: String, default: "desktop" },
      model: { type: String, default: "Unknown" },
      vendor: { type: String, default: "Unknown" },
    },
    ipAddress: {
      type: String,
      default: "",
    },
    maskedIP: {
      type: String,
      default: "",
    },
    location: {
      city: { type: String, default: null },
      state: { type: String, default: null },
      country: { type: String, default: null },
      countryCode: { type: String, default: null },
    },
    loginAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    verificationRequired: {
      type: Boolean,
      default: false,
    },
    verificationMethod: {
      type: String,
      default: "",
    },
    trustedDeviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TrustedDevice",
      default: null,
    },
  },
  {
    timestamps: true,
  }
)

loginHistorySchema.index({ userId: 1, loginAt: -1 })
loginHistorySchema.index({ userId: 1, status: 1 })

const LoginHistory =
  mongoose.models.LoginHistory ||
  mongoose.model("LoginHistory", loginHistorySchema)

export default LoginHistory
