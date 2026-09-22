import mongoose from "mongoose"

const watchProgressSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },
    videoId: {
      type: String,
      required: true,
      index: true,
    },
    currentTime: {
      type: Number,
      default: 0,
      min: 0,
    },
    duration: {
      type: Number,
      default: 0,
      min: 0,
    },
    progressPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    isCompleted: {
      type: Boolean,
      default: false,
    },
    playbackRate: {
      type: Number,
      default: 1,
    },
    lastWatchedAt: {
      type: Date,
      default: Date.now,
    },
    deviceInfo: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
)

// Ensure compound index for fast lookups and atomic upserts
watchProgressSchema.index({ user: 1, videoId: 1 }, { unique: true })

export default mongoose.models.WatchProgress || mongoose.model("WatchProgress", watchProgressSchema)
