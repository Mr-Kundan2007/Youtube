/**
 * User Session Model (Phase 9)
 *
 * Tracks every authenticated multi-device session with lifecycle status,
 * cryptographic refresh token hash, device metadata, location, and activity timestamps.
 * Preserves backwards-compatibility with existing session fields.
 */

import mongoose from "mongoose"

const sessionSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    trustedDeviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TrustedDevice",
      default: null,
      index: true,
    },
    loginHistoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LoginHistory",
      default: null,
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
      default: "127.0.0.1",
    },
    maskedIP: {
      type: String,
      default: "127.0.xxx.xxx",
    },
    location: {
      city: { type: String, default: null },
      state: { type: String, default: null },
      country: { type: String, default: null },
      countryCode: { type: String, default: null },
    },
    refreshTokenHash: {
      type: String,
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "EXPIRED", "TERMINATED", "REVOKED"],
      default: "ACTIVE",
      index: true,
    },
    logoutReason: {
      type: String,
      default: null,
    },
    terminatedAt: {
      type: Date,
      default: null,
    },
    lastActivityAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },

    // Backwards-compatibility fields for Phase 1-8
    userAgent: {
      type: String,
      default: "Unknown Device",
      trim: true,
    },
    ip: {
      type: String,
      default: "127.0.0.1",
      trim: true,
    },
    lastActiveAt: {
      type: Date,
      default: Date.now,
    },
    revokedAt: {
      type: Date,
      default: null,
      index: true,
    },
    deviceMetadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    networkInfo: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    loginContext: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    detectionResult: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
)

sessionSchema.virtual("isActive").get(function () {
  return (
    this.status === "ACTIVE" &&
    !this.revokedAt &&
    !this.terminatedAt &&
    this.expiresAt > new Date()
  )
})

sessionSchema.index({ userId: 1, status: 1 })
sessionSchema.index({ userId: 1, lastActivityAt: -1 })

export const Session = mongoose.models.Session || mongoose.model("Session", sessionSchema)
export const UserSession = Session

export default Session
