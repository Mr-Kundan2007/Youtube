import mongoose from "mongoose"

export const DownloadAuditEvents = [
  "DOWNLOAD_REQUESTED",
  "DOWNLOAD_AUTHORIZED",
  "DOWNLOAD_DENIED",
  "DOWNLOAD_DELIVERY_REQUESTED",
  "STORAGE_VALIDATED",
  "SIGNED_URL_GENERATED",
  "DOWNLOAD_READY",
  "DOWNLOAD_PREPARING",
  "DOWNLOAD_STARTED",
  "DOWNLOAD_COMPLETED",
  "DOWNLOAD_FAILED",
  "DOWNLOAD_INTERRUPTED",
  "DOWNLOAD_CANCELLED",
  "DOWNLOAD_BLOCKED_QUOTA",
  "DOWNLOAD_BLOCKED_SUBSCRIPTION",
  "DOWNLOAD_BLOCKED_VIDEO",
  "DOWNLOAD_BLOCKED_DEVICE",
  "VIDEO_FILE_NOT_AVAILABLE",
  "STORAGE_SERVICE_UNAVAILABLE",
  "DOWNLOAD_TOKEN_CREATED",
  "DOWNLOAD_TOKEN_EXPIRED",
  "DOWNLOAD_TOKEN_REVOKED",
  "TOKEN_GENERATED",
  "TOKEN_VALIDATED",
  "TOKEN_EXPIRED",
  "TOKEN_USED",
  "TOKEN_REVOKED",
  "TOKEN_REPLAY_ATTEMPT",
  "QUOTA_CHECKED",
  "QUOTA_RESERVED",
  "QUOTA_CONSUMED",
  "QUOTA_RELEASED",
  "QUOTA_EXPIRED",
  "QUOTA_RESET",
  "QUOTA_EXCEEDED",
  "DUPLICATE_DETECTED",
  "DUPLICATE_REUSED",
  "DOWNLOAD_RETRY_REQUESTED",
  "DOWNLOAD_RETRY_ALLOWED",
  "DOWNLOAD_RETRY_DENIED",
  "DEVICE_REGISTERED",
  "DEVICE_AUTHORIZED",
  "DEVICE_DENIED",
  "DEVICE_LIMIT_REACHED",
  "DEVICE_REVOKED",
  "DEVICE_REACTIVATED",
  "DEVICE_BLOCKED",
  "DEVICE_CHANGED",
  "DEVICE_RECOGNIZED",
  "UNKNOWN_DEVICE_DETECTED",
  "DEVICE_METADATA_CHANGED",
  "DOWNLOAD_DEVICE_VALIDATED",
  "DOWNLOAD_DEVICE_MISMATCH",
  "CONCURRENT_DOWNLOAD_LIMIT_REACHED",
  "DEVICE_CONCURRENT_DOWNLOAD_LIMIT_REACHED",
  "SECURITY_EVENT_CREATED",
  "RISK_SCORE_UPDATED",
  "RESTRICTION_CREATED",
  "RESTRICTION_REMOVED",
  "SECURITY_EVENT_RESOLVED",
  "SECURITY_CHECK_PASSED",
  "SECURITY_CHECK_FLAGGED",
  "SECURITY_CHECK_BLOCKED",
  "RATE_LIMIT_EXCEEDED",
  "RAPID_DEVICE_SWITCH",
  "RAPID_IP_CHANGE",
  "QUOTA_BYPASS_ATTEMPT",
  "ADMIN_VIEWED_DASHBOARD",
  "ADMIN_VIEWED_DOWNLOADS",
  "ADMIN_VIEWED_USER_PROFILE",
  "ADMIN_QUOTA_ADJUSTED",
  "ADMIN_DOWNLOAD_CANCELLED",
  "ADMIN_NOTE_ADDED",
  "ADMIN_REPORT_GENERATED",
  "ADMIN_REPORT_EXPORTED",
]

const downloadAuditLogSchema = new mongoose.Schema(
  {
    download_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DownloadRecord",
      default: null,
    },
    downloadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DownloadRecord",
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    video_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "videofiles",
      default: null,
    },
    videoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "videofiles",
    },
    event: {
      type: String,
      enum: DownloadAuditEvents,
      index: true,
    },
    event_type: {
      type: String,
      enum: DownloadAuditEvents,
      required: true,
      index: true,
    },
    event_timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    ip_address: {
      type: String,
      default: "",
    },
    device_id: {
      type: String,
      default: "",
    },
    browser: {
      type: String,
      default: "",
    },
    operating_system: {
      type: String,
      default: "",
    },
    device_type: {
      type: String,
      default: "desktop",
    },
    user_agent: {
      type: String,
      default: "",
    },
    request_id: {
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

// Pre-save synchronization for camelCase and snake_case references
downloadAuditLogSchema.pre("save", function (next) {
  if (this.download_id && !this.downloadId) this.downloadId = this.download_id
  if (this.downloadId && !this.download_id) this.download_id = this.downloadId

  if (this.user_id && !this.userId) this.userId = this.user_id
  if (this.userId && !this.user_id) this.user_id = this.userId

  if (this.video_id && !this.videoId) this.videoId = this.video_id
  if (this.videoId && !this.video_id) this.video_id = this.videoId

  if (this.event_type && !this.event) this.event = this.event_type
  if (this.event && !this.event_type) this.event_type = this.event

  if (!this.event_timestamp) {
    this.event_timestamp = new Date()
  }

  next()
})

// Query and auditing indexes
downloadAuditLogSchema.index({ download_id: 1, event_timestamp: -1 })
downloadAuditLogSchema.index({ downloadId: 1, event_timestamp: -1 })
downloadAuditLogSchema.index({ user_id: 1, event_timestamp: -1 })
downloadAuditLogSchema.index({ userId: 1, event_timestamp: -1 })
downloadAuditLogSchema.index({ video_id: 1, event_timestamp: -1 })
downloadAuditLogSchema.index({ videoId: 1, event_timestamp: -1 })
downloadAuditLogSchema.index({ event_type: 1, event_timestamp: -1 })
downloadAuditLogSchema.index({ request_id: 1 })
downloadAuditLogSchema.index({ device_id: 1, event_timestamp: -1 }, { sparse: true })

const DownloadAuditLog =
  mongoose.models.DownloadAuditLog ||
  mongoose.model("DownloadAuditLog", downloadAuditLogSchema)

export default DownloadAuditLog
