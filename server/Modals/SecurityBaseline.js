/**
 * Security Baseline Model (Phase 6)
 *
 * Stores verified security records for each user: verified browsers,
 * devices, IP addresses, and locations.
 */

import mongoose from "mongoose"

const securityBaselineSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    verifiedBrowsers: [
      {
        browserFamily: { type: String, required: true },
        majorVersion: { type: String, default: "" },
        lastSeenAt: { type: Date, default: Date.now },
      },
    ],
    verifiedDevices: [
      {
        deviceComparisonKey: { type: String, required: true },
        deviceType: { type: String, default: "desktop" },
        model: { type: String, default: "Unknown" },
        vendor: { type: String, default: "Unknown" },
        osName: { type: String, default: "Unknown" },
        browserFamily: { type: String, default: "Unknown" },
        lastSeenAt: { type: Date, default: Date.now },
      },
    ],
    verifiedIPs: [
      {
        ipAddress: { type: String, required: true },
        isPublic: { type: Boolean, default: true },
        lastSeenAt: { type: Date, default: Date.now },
      },
    ],
    verifiedLocations: [
      {
        city: { type: String, default: null },
        state: { type: String, default: null },
        stateCode: { type: String, default: null },
        country: { type: String, default: null },
        countryCode: { type: String, default: null },
        lastSeenAt: { type: Date, default: Date.now },
      },
    ],
    lastVerifiedLogin: {
      timestamp: { type: Date, default: Date.now },
      ip: { type: String, default: "" },
      location: { type: mongoose.Schema.Types.Mixed, default: null },
      device: { type: mongoose.Schema.Types.Mixed, default: null },
    },
  },
  {
    timestamps: true,
  }
)

const SecurityBaseline =
  mongoose.models.SecurityBaseline ||
  mongoose.model("SecurityBaseline", securityBaselineSchema)

export default SecurityBaseline
