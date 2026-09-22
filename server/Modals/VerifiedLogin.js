/**
 * Verified Login Model (Phase 7)
 *
 * Stores immutable audit logs of successful secondary authentication verifications.
 * Prepared for future Login History, Trusted Devices, and Security dashboards.
 */

import mongoose from "mongoose"

const verifiedLoginSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    pendingLoginId: {
      type: String,
      required: true,
      index: true,
    },
    authenticationMethod: {
      type: String,
      default: "PASSWORD_OTP",
    },
    verificationMethod: {
      type: String,
      enum: ["EMAIL", "SMS"],
      default: "EMAIL",
    },
    loginContext: {
      device: { type: mongoose.Schema.Types.Mixed, default: {} },
      network: { type: mongoose.Schema.Types.Mixed, default: {} },
      userAgent: { type: String, default: "" },
      clientIp: { type: String, default: "" },
    },
    verifiedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    status: {
      type: String,
      default: "SUCCESS",
    },
  },
  {
    timestamps: true,
  }
)

verifiedLoginSchema.index({ userId: 1, verifiedAt: -1 })

const VerifiedLogin =
  mongoose.models.VerifiedLogin ||
  mongoose.model("VerifiedLogin", verifiedLoginSchema)

export default VerifiedLogin
