import mongoose from "mongoose"

const downloadRecordSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    videoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "videofiles",
      required: true,
      index: true,
    },
    video_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "videofiles",
    },
    videoTitle: {
      type: String,
      default: "",
    },
    thumbnailUrl: {
      type: String,
      default: "",
    },
    subscription_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
      default: null,
    },
    subscription_plan: {
      type: String,
      enum: ["free", "bronze", "silver", "gold"],
      default: "free",
      index: true,
    },
    download_requested_at: {
      type: Date,
      default: Date.now,
    },
    download_authorized_at: {
      type: Date,
      default: null,
    },
    download_started_at: {
      type: Date,
      default: null,
    },
    download_completed_at: {
      type: Date,
      default: null,
    },
    download_status: {
      type: String,
      enum: [
        "pending",
        "authorized",
        "preparing",
        "ready",
        "started",
        "downloading",
        "completed",
        "interrupted",
        "failed",
        "cancelled",
        "expired",
        "blocked",
      ],
      default: "authorized",
      index: true,
    },
    file_name: {
      type: String,
      default: "",
    },
    file_size: {
      type: Number,
      default: 0,
      min: 0,
    },
    file_type: {
      type: String,
      default: "video/mp4",
    },
    mime_type: {
      type: String,
      default: "video/mp4",
    },
    file_extension: {
      type: String,
      default: "mp4",
    },
    storage_provider: {
      type: String,
      default: "local",
    },
    storage_path: {
      type: String,
      default: "",
    },
    ip_address: {
      type: String,
      default: "",
    },
    device_id: {
      type: String,
      default: "",
      index: true,
    },
    device_type: {
      type: String,
      default: "desktop",
    },
    operating_system: {
      type: String,
      default: "unknown",
    },
    browser: {
      type: String,
      default: "unknown",
    },
    user_agent: {
      type: String,
      default: "",
    },
    request_id: {
      type: String,
      default: "",
    },
    idempotency_key: {
      type: String,
      default: "",
    },
    download_token_id: {
      type: String,
      default: "",
      index: true,
    },
    failure_reason: {
      type: String,
      default: "",
    },
    failure_code: {
      type: String,
      default: "",
    },
    quota_before_download: {
      type: Number,
      default: 0,
    },
    quota_after_download: {
      type: Number,
      default: 0,
    },
    quota_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DownloadQuota",
      default: null,
    },
    is_duplicate: {
      type: Boolean,
      default: false,
    },
    original_download_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DownloadRecord",
      default: null,
    },
    retry_of_download_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DownloadRecord",
      default: null,
    },
    retry_count: {
      type: Number,
      default: 0,
      min: 0,
    },
    duplicate_window: {
      type: Number,
      default: 24, // in hours
    },
    quota_released: {
      type: Boolean,
      default: false,
    },
    securityFlagged: {
      type: Boolean,
      default: false,
      index: true,
    },
    riskLevel: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "low",
      index: true,
    },
    security_flags: {
      type: [String],
      default: [],
    },
    security_event_ids: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "DownloadSecurityEvent",
      },
    ],
    deleted_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
)

// Synchronize camelCase and snake_case references and validate lifecycle timestamps
downloadRecordSchema.pre("save", function (next) {
  if (this.userId && !this.user_id) this.user_id = this.userId
  if (this.user_id && !this.userId) this.userId = this.user_id
  if (this.videoId && !this.video_id) this.video_id = this.videoId
  if (this.video_id && !this.videoId) this.videoId = this.video_id

  if (!this.download_requested_at) {
    this.download_requested_at = this.createdAt || new Date()
  }

  // Integrity validation: completed timestamp cannot precede started timestamp
  if (
    this.download_completed_at &&
    this.download_started_at &&
    this.download_completed_at < this.download_started_at
  ) {
    return next(
      new Error("download_completed_at cannot be earlier than download_started_at")
    )
  }

  next()
})

// Lifecycle and querying indexes
downloadRecordSchema.index({ userId: 1, createdAt: -1 })
downloadRecordSchema.index({ userId: 1, videoId: 1, createdAt: -1 })
downloadRecordSchema.index({ download_status: 1, createdAt: -1 })
downloadRecordSchema.index({ idempotency_key: 1 })
downloadRecordSchema.index({ request_id: 1 })
downloadRecordSchema.index({ subscription_id: 1 })
downloadRecordSchema.index({ original_download_id: 1 })
downloadRecordSchema.index({ retry_of_download_id: 1 })
downloadRecordSchema.index({ securityFlagged: 1, riskLevel: 1, createdAt: -1 })

const DownloadRecord =
  mongoose.models.DownloadRecord || mongoose.model("DownloadRecord", downloadRecordSchema)

// Provide alias Download model if not registered
const Download =
  mongoose.models.Download || mongoose.model("Download", downloadRecordSchema)

export { DownloadRecord, Download }
export default DownloadRecord
