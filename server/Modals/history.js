import mongoose from "mongoose"

const historySchema = mongoose.Schema(
  {
    viewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    videoid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "videofiles",
      required: true,
    },
    viewedon: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
)

export default mongoose.models.history || mongoose.model("history", historySchema)
