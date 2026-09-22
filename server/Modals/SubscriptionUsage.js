import mongoose from "mongoose"

/**
 * SubscriptionUsage Schema
 * Tracks consumption metrics (watch time, downloads, streams) per user per calendar day.
 */
const subscriptionUsageSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
      default: null,
      index: true,
    },
    date: {
      type: String, // Format: YYYY-MM-DD
      required: true,
      index: true,
    },
    watchTimeSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
    downloadCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    streamCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    premiumAccessCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastActiveAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
)

// Ensure one usage document per user per day
subscriptionUsageSchema.index({ userId: 1, date: 1 }, { unique: true })

const SubscriptionUsage =
  mongoose.models.SubscriptionUsage ||
  mongoose.model("SubscriptionUsage", subscriptionUsageSchema)

export default SubscriptionUsage
