import mongoose from "mongoose"

export const SecurityEventTypes = [
  "RATE_LIMIT_EXCEEDED",
  "INVALID_DOWNLOAD_TOKEN",
  "TOKEN_REPLAY_ATTEMPT",
  "TOKEN_DEVICE_MISMATCH",
  "TOKEN_USER_MISMATCH",
  "REPEATED_AUTH_FAILURE",
  "DEVICE_LIMIT_ABUSE",
  "CONCURRENT_DOWNLOAD_ABUSE",
  "RAPID_DEVICE_SWITCH",
  "RAPID_IP_CHANGE",
  "UNUSUAL_DOWNLOAD_VOLUME",
  "RAPID_DOWNLOAD_PATTERN",
  "POSSIBLE_ACCOUNT_SHARING",
  "BLOCKED_DEVICE_ACCESS",
  "REVOKED_DEVICE_ACCESS",
  "DUPLICATE_DOWNLOAD_ABUSE_PATTERN",
  "QUOTA_BYPASS_ATTEMPT",
  "POSSIBLE_AUTOMATION",
  "SUSPICIOUS_DOWNLOAD_REPORTED",
]

const adminNoteSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    adminEmail: {
      type: String,
      default: "",
    },
    note: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      default: "",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
)

const downloadSecurityEventSchema = new mongoose.Schema(
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
    downloadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DownloadRecord",
      default: null,
      index: true,
    },
    download_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DownloadRecord",
      default: null,
    },
    eventType: {
      type: String,
      required: true,
      enum: SecurityEventTypes,
      index: true,
    },
    riskLevel: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "low",
      index: true,
    },
    riskPoints: {
      type: Number,
      default: 0,
      min: 0,
    },
    ipAddress: {
      type: String,
      default: "",
      index: true,
    },
    browser: {
      type: String,
      default: "unknown",
    },
    userAgent: {
      type: String,
      default: "",
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    event_count: {
      type: Number,
      default: 1,
      min: 1,
    },
    first_seen_at: {
      type: Date,
      default: Date.now,
    },
    last_seen_at: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["open", "investigating", "resolved", "false_positive", "blocked"],
      default: "open",
      index: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    resolution: {
      type: String,
      enum: ["NO_ACTION", "WARNING", "TEMPORARY_RESTRICT", "DEVICE_BLOCKED", "ACCOUNT_BLOCKED", "FALSE_POSITIVE", null],
      default: null,
    },
    adminNotes: [adminNoteSchema],
  },
  {
    timestamps: true,
  }
)

// Pre-save synchronization for aliases
downloadSecurityEventSchema.pre("save", function (next) {
  if (this.userId && !this.user_id) this.user_id = this.userId
  if (this.user_id && !this.userId) this.userId = this.user_id
  if (this.deviceId && !this.device_id) this.device_id = this.deviceId
  if (this.device_id && !this.deviceId) this.deviceId = this.device_id
  if (this.downloadId && !this.download_id) this.download_id = this.downloadId
  if (this.download_id && !this.downloadId) this.downloadId = this.download_id
  next()
})

// Compound indexes for querying and deduplication
downloadSecurityEventSchema.index({ userId: 1, eventType: 1, status: 1, createdAt: -1 })
downloadSecurityEventSchema.index({ deviceId: 1, eventType: 1, status: 1, createdAt: -1 })
downloadSecurityEventSchema.index({ status: 1, riskLevel: 1, createdAt: -1 })

export const DownloadSecurityEvent =
  mongoose.models.DownloadSecurityEvent ||
  mongoose.model("DownloadSecurityEvent", downloadSecurityEventSchema)

export default DownloadSecurityEvent
