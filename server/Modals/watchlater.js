import mongoose from "mongoose"

const watchLaterSchema = mongoose.Schema(
  {
    videoid: {
      type: String,
      required: true,
    },
    videoId: {
      type: String,
    },
    viewer: {
      type: String,
      required: true,
    },
    userId: {
      type: String,
    },
    savedon: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
)

const WatchLater =
  mongoose.models.watchLater ||
  mongoose.models.WatchLater ||
  mongoose.model("watchLater", watchLaterSchema)

export default WatchLater
