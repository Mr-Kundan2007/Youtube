import mongoose from "mongoose"

const downloadTokenSchema = new mongoose.Schema(
  {
    download_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DownloadRecord",
      required: true,
    },
    downloadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DownloadRecord",
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    video_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "videofiles",
      required: true,
    },
    videoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "videofiles",
    },
    token_hash: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "used", "expired", "revoked", "cancelled"],
      default: "active",
      index: true,
    },
    expires_at: {
      type: Date,
      required: true,
      index: true,
    },
    used_at: {
      type: Date,
      default: null,
    },
    revoked_at: {
      type: Date,
      default: null,
    },
    revocation_reason: {
      type: String,
      default: null,
    },
    max_uses: {
      type: Number,
      default: 1,
      min: 1,
    },
    use_count: {
      type: Number,
      default: 0,
      min: 0,
    },
    ip_address: {
      type: String,
      default: "",
    },
    user_agent: {
      type: String,
      default: "",
    },
    device_id: {
      type: String,
      default: "",
      index: true,
    },
    deviceId: {
      type: String,
      default: "",
    },
    deleted_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
)

// Pre-save synchronization for camelCase and snake_case references
downloadTokenSchema.pre("save", function (next) {
  if (this.download_id && !this.downloadId) this.downloadId = this.download_id
  if (this.downloadId && !this.download_id) this.download_id = this.downloadId

  if (this.user_id && !this.userId) this.userId = this.user_id
  if (this.userId && !this.user_id) this.user_id = this.userId

  if (this.video_id && !this.videoId) this.videoId = this.video_id
  if (this.videoId && !this.video_id) this.video_id = this.videoId

  if (this.device_id && !this.deviceId) this.deviceId = this.device_id
  if (this.deviceId && !this.device_id) this.device_id = this.deviceId

  next()
})

// Query and security indexes
downloadTokenSchema.index({ token_hash: 1 }, { unique: true })
downloadTokenSchema.index({ user_id: 1, expires_at: -1 })
downloadTokenSchema.index({ userId: 1, expires_at: -1 })
downloadTokenSchema.index({ device_id: 1, status: 1 })
downloadTokenSchema.index({ download_id: 1 })
downloadTokenSchema.index({ downloadId: 1 })
downloadTokenSchema.index({ video_id: 1 })
downloadTokenSchema.index({ videoId: 1 })
downloadTokenSchema.index({ status: 1, expires_at: 1 })

const DownloadToken =
  mongoose.models.DownloadToken || mongoose.model("DownloadToken", downloadTokenSchema)

export default DownloadToken
