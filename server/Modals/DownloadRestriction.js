import mongoose from "mongoose"

export const RestrictionTypes = [
  "DOWNLOAD_RESTRICTED",
  "DEVICE_RESTRICTED",
  "ACCOUNT_RESTRICTED",
  "TOKEN_REQUEST_RESTRICTED",
  "TEMPORARY_RATE_LIMIT",
]

const downloadRestrictionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
      default: null,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
      default: null,
    },
    deviceId: {
      type: String,
      index: true,
      default: "",
    },
    device_id: {
      type: String,
      index: true,
      default: "",
    },
    ipAddress: {
      type: String,
      default: "",
      index: true,
    },
    restrictionType: {
      type: String,
      enum: RestrictionTypes,
      default: "DOWNLOAD_RESTRICTED",
      index: true,
    },
    reason: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "expired", "removed"],
      default: "active",
      index: true,
    },
    expiresAt: {
      type: Date,
      index: true,
      required: true,
    },
    createdBy: {
      type: String,
      default: "system", // "system" or admin userId
    },
    securityEventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DownloadSecurityEvent",
      default: null,
    },
    removedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    removedAt: {
      type: Date,
      default: null,
    },
    removalReason: {
      type: String,
      default: "",
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
)

// Pre-save synchronization for aliases
downloadRestrictionSchema.pre("save", function (next) {
  if (this.userId && !this.user_id) this.user_id = this.userId
  if (this.user_id && !this.userId) this.userId = this.user_id
  if (this.deviceId && !this.device_id) this.device_id = this.deviceId
  if (this.device_id && !this.deviceId) this.deviceId = this.device_id
  next()
})

// Compound indexes
downloadRestrictionSchema.index({ userId: 1, status: 1, expiresAt: 1 })
downloadRestrictionSchema.index({ deviceId: 1, status: 1, expiresAt: 1 })
downloadRestrictionSchema.index({ ipAddress: 1, status: 1, expiresAt: 1 })

export const DownloadRestriction =
  mongoose.models.DownloadRestriction ||
  mongoose.model("DownloadRestriction", downloadRestrictionSchema)

export default DownloadRestriction
