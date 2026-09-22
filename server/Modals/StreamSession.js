import mongoose from "mongoose"

/**
 * StreamSession Schema
 * Tracks concurrent active playback streams for enforcing per-plan multi-device streaming limits.
 */
const streamSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    deviceId: {
      type: String,
      required: true,
      index: true,
    },
    videoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "videofiles",
      default: null,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    lastActiveAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "ended", "timed_out"],
      default: "active",
      index: true,
    },
  },
  {
    timestamps: true,
  }
)

const StreamSession =
  mongoose.models.StreamSession ||
  mongoose.model("StreamSession", streamSessionSchema)

export default StreamSession
