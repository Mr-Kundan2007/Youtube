/**
 * Trusted Device Model (Phase 8)
 *
 * Stores trusted login environments that have successfully verified via OTP.
 * Includes configurable trust expiration, last active tracking, soft revocation,
 * and user custom renaming.
 */

import mongoose from "mongoose"

const trustedDeviceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    deviceIdentifier: {
      type: String,
      required: true,
      index: true,
    },
    deviceFingerprint: {
      type: String,
      default: "",
    },
    deviceName: {
      type: String,
      default: "Web Browser",
    },
    customName: {
      type: String,
      default: "",
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
    firstVerifiedAt: {
      type: Date,
      default: Date.now,
    },
    lastUsedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    trustedAt: {
      type: Date,
      default: Date.now,
    },
    trustExpiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "EXPIRED", "REVOKED", "SUSPENDED"],
      default: "ACTIVE",
      index: true,
    },
    lastKnownIP: {
      type: String,
      default: "",
    },
    lastKnownLocation: {
      city: { type: String, default: null },
      state: { type: String, default: null },
      country: { type: String, default: null },
      countryCode: { type: String, default: null },
    },
    verificationMethod: {
      type: String,
      default: "OTP",
    },
  },
  {
    timestamps: true,
  }
)

// Compound index to ensure uniqueness per user and device identifier
trustedDeviceSchema.index({ userId: 1, deviceIdentifier: 1 })
trustedDeviceSchema.index({ userId: 1, status: 1, trustExpiresAt: 1 })

const TrustedDevice =
  mongoose.models.TrustedDevice ||
  mongoose.model("TrustedDevice", trustedDeviceSchema)

export default TrustedDevice
