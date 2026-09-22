import mongoose from "mongoose"

const deviceSchema = new mongoose.Schema(
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
      index: true,
    },
    device_identifier: {
      type: String,
      required: true,
      index: true,
    },
    device_name: {
      type: String,
      default: "Web Browser",
    },
    device_type: {
      type: String,
      enum: ["desktop", "mobile", "tablet", "unknown"],
      default: "desktop",
    },
    browser: {
      type: String,
      default: "Unknown Browser",
    },
    operating_system: {
      type: String,
      default: "Unknown OS",
    },
    user_agent: {
      type: String,
      default: "",
    },
    first_seen_at: {
      type: Date,
      default: Date.now,
    },
    last_seen_at: {
      type: Date,
      default: Date.now,
    },
    is_trusted: {
      type: Boolean,
      default: true,
    },
    trusted: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "blocked", "revoked"],
      default: "active",
      index: true,
    },
    last_download_at: {
      type: Date,
      default: null,
    },
    last_ip_address: {
      type: String,
      default: "",
    },
    location: {
      city: { type: String, default: null },
      state: { type: String, default: null },
      country: { type: String, default: null },
      countryCode: { type: String, default: null },
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

// Pre-save synchronization for aliases
deviceSchema.pre("save", function (next) {
  if (this.userId && !this.user_id) this.user_id = this.userId
  if (this.user_id && !this.userId) this.userId = this.user_id
  if (this.is_trusted !== undefined && this.trusted === undefined) this.trusted = this.is_trusted
  if (this.trusted !== undefined && this.is_trusted === undefined) this.is_trusted = this.trusted
  next()
})

// Compound unique constraint per user and device identifier
deviceSchema.index({ userId: 1, device_identifier: 1 }, { unique: true })
deviceSchema.index({ user_id: 1, device_identifier: 1 }, { sparse: true })
deviceSchema.index({ userId: 1, status: 1 })

const Device = mongoose.models.Device || mongoose.model("Device", deviceSchema, "devices")
const DownloadDevice =
  mongoose.models.DownloadDevice || mongoose.model("DownloadDevice", deviceSchema, "devices")

export { Device, DownloadDevice }
export default Device
