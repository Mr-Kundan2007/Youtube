/**
 * Pending Login Model (Phase 6)
 *
 * Stores pending authentication state for logins that require multi-signal
 * verification (new browser, new device, new IP, new city/state).
 * Full access tokens (JWT/session) are NOT issued until verification succeeds.
 */

import mongoose from "mongoose"

const pendingLoginSchema = new mongoose.Schema(
  {
    pendingLoginId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    userEmail: {
      type: String,
      default: "",
    },
    loginContext: {
      device: { type: mongoose.Schema.Types.Mixed, default: {} },
      network: { type: mongoose.Schema.Types.Mixed, default: {} },
      userAgent: { type: String, default: "" },
      clientIp: { type: String, default: "" },
    },
    securityDecision: {
      decision: {
        type: String,
        enum: ["ALLOW", "VERIFICATION_REQUIRED", "HIGH_RISK"],
        required: true,
      },
      riskScore: { type: Number, default: 0 },
      riskLevel: {
        type: String,
        enum: ["LOW", "MEDIUM", "HIGH"],
        default: "MEDIUM",
      },
      reasons: [{ type: String }],
      isInitialBaseline: { type: Boolean, default: false },
    },
    securitySignals: {
      isNewBrowser: { type: Boolean, default: false },
      isNewDevice: { type: Boolean, default: false },
      isNewIP: { type: Boolean, default: false },
      isNewCity: { type: Boolean, default: false },
      isNewState: { type: Boolean, default: false },
      isNewCountry: { type: Boolean, default: false },
    },
    maskedIP: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["PENDING", "VERIFIED", "EXPIRED", "REJECTED"],
      default: "PENDING",
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // MongoDB TTL index to automatically purge expired records
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
)

const PendingLogin =
  mongoose.models.PendingLogin ||
  mongoose.model("PendingLogin", pendingLoginSchema)

export default PendingLogin
