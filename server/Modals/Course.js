import mongoose from "mongoose"

const lessonSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: "",
  },
  videoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "videofiles",
    default: null,
  },
  duration: {
    type: String,
    default: "15:00",
  },
  isPreview: {
    type: Boolean,
    default: false,
  },
  order: {
    type: Number,
    default: 1,
  },
})

const courseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    thumbnailUrl: {
      type: String,
      default: "/video/snowglobe.jpg",
    },
    instructor: {
      type: String,
      default: "Platform Instructor",
    },
    courseAccessType: {
      type: String,
      enum: ["free", "bronze", "silver", "gold", "premium", "exclusive"],
      default: "free",
      index: true,
    },
    requiredPlan: {
      type: String,
      enum: ["free", "bronze", "silver", "gold"],
      default: "free",
      index: true,
    },
    isPremium: {
      type: Boolean,
      default: false,
    },
    isExclusive: {
      type: Boolean,
      default: false,
    },
    priorityAccess: {
      type: Boolean,
      default: false,
    },
    lessons: [lessonSchema],
  },
  {
    timestamps: true,
  }
)

const Course = mongoose.models.Course || mongoose.model("Course", courseSchema)

export default Course
