import mongoose from "mongoose"

const downloadPreferenceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    preferredQuality: {
      type: String,
      enum: ["auto", "720p", "1080p", "4k"],
      default: "auto",
    },
    notifyOnComplete: {
      type: Boolean,
      default: true,
    },
    notifyOnFailure: {
      type: Boolean,
      default: true,
    },
    notifyOnQuotaWarning: {
      type: Boolean,
      default: true,
    },
    autoRetryOnFailure: {
      type: Boolean,
      default: false,
    },
    confirmBeforeDownload: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
)

downloadPreferenceSchema.pre("save", function (next) {
  if (this.userId && !this.user_id) {
    this.user_id = this.userId
  } else if (this.user_id && !this.userId) {
    this.userId = this.user_id
  }
  next()
})

const DownloadPreference =
  mongoose.models.DownloadPreference ||
  mongoose.model("DownloadPreference", downloadPreferenceSchema)

export default DownloadPreference
