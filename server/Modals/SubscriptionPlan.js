import mongoose from "mongoose"

/**
 * SubscriptionPlan Schema
 * Defines tier definitions, pricing, validity, features, and limits.
 */
const subscriptionPlanSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    description: {
      type: String,
      default: "",
    },
    price: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    currency: {
      type: String,
      default: "INR",
      uppercase: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isPopular: {
      type: Boolean,
      default: false,
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
    validityType: {
      type: String,
      enum: ["monthly", "quarterly", "yearly", "lifetime"],
      default: "monthly",
    },
    validityDays: {
      type: Number,
      default: 30, // null or number of days
    },
    features: {
      premiumVideoAccess: { type: Boolean, default: false },
      premiumCourses: { type: Boolean, default: false },
      priorityContent: { type: Boolean, default: false },
      adFree: { type: Boolean, default: false },
      offlineDownloads: { type: Boolean, default: false },
      fastStreaming: { type: Boolean, default: false },
      exclusiveContent: { type: Boolean, default: false },
    },
    limits: {
      streamingQuality: {
        type: String,
        enum: ["720p", "1080p", "1440p", "4k"],
        default: "720p",
      },
      dailyWatchTime: {
        type: Number,
        default: null, // in minutes; null represents unlimited
      },
      dailyUsageLimit: {
        type: Number,
        default: null, // in minutes/data units; null represents unlimited
      },
      dailyDownloadLimit: {
        type: Number,
        default: 1,
      },
      maxDownloadQuality: {
        type: String,
        enum: ["720p", "1080p", "1440p", "4k"],
        default: "720p",
      },
      maxDevices: {
        type: Number,
        default: 1,
      },
      maxConcurrentStreams: {
        type: Number,
        default: 1,
      },
    },
  },
  {
    timestamps: true,
  }
)

const SubscriptionPlan =
  mongoose.models.SubscriptionPlan ||
  mongoose.model("SubscriptionPlan", subscriptionPlanSchema)

export default SubscriptionPlan
