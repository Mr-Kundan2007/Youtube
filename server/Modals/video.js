import mongoose from "mongoose"

const videoSchema = mongoose.Schema(
  {
    videotitle: {
      type: String,
      required: true,
    },
    filename: {
      type: String,
    },
    filepath: {
      type: String,
      default: "",
    },
    videofilepath: {
      type: String,
      default: "",
    },
    videoUrl: {
      type: String,
      default: "",
    },
    filetype: {
      type: String,
      default: "video/mp4",
    },
    filesize: {
      type: String,
      default: "0",
    },
    videochanel: {
      type: String,
      required: true,
    },
    channelId: {
      type: String,
    },
    thumbnailUrl: {
      type: String,
      default: "/video/snowglobe.jpg",
    },
    views: {
      type: Number,
      default: 0,
    },
    uploader: {
      type: String,
    },
    likes: {
      type: [String],
      default: [],
    },
    dislikes: {
      type: [String],
      default: [],
    },
    like: {
      type: Number,
      default: 0,
    },
    dislike: {
      type: Number,
      default: 0,
    },
    description: {
      type: String,
      default: "",
    },
    duration: {
      type: String,
      default: "10:24",
    },
    category: {
      type: String,
      default: "All",
    },
    is_downloadable: {
      type: Boolean,
      default: true,
    },
    visibility: {
      type: String,
      enum: ["public", "private", "unlisted", "subscription_only", "premium"],
      default: "public",
    },
    is_premium: {
      type: Boolean,
      default: false,
    },
    isPremium: {
      type: Boolean,
      default: false,
    },
    accessLevel: {
      type: String,
      enum: ["free", "bronze", "silver", "gold", "premium", "exclusive"],
      default: "free",
    },
    requiredPlan: {
      type: String,
      enum: ["free", "bronze", "silver", "gold"],
      default: "free",
    },
    isExclusive: {
      type: Boolean,
      default: false,
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

videoSchema.pre("save", function (next) {
  if (this.is_premium !== undefined && this.isPremium === undefined) {
    this.isPremium = this.is_premium
  }
  if (this.isPremium !== undefined && this.is_premium === undefined) {
    this.is_premium = this.isPremium
  }
  if (this.requiredPlan && this.requiredPlan !== "free") {
    this.isPremium = true
    this.is_premium = true
  }
  next()
})

const Video =
  mongoose.models.videofiles ||
  mongoose.models.Video ||
  mongoose.model("videofiles", videoSchema)

if (!mongoose.models.Video) {
  try {
    mongoose.model("Video", videoSchema)
  } catch (e) {}
}

export default Video
