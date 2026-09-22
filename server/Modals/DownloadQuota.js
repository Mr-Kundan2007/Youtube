import mongoose from "mongoose"

const downloadQuotaSchema = new mongoose.Schema(
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
    plan: {
      type: String,
      enum: ["free", "bronze", "silver", "gold"],
      required: true,
      default: "free",
      index: true,
    },
    subscription_plan: {
      type: String,
      enum: ["free", "bronze", "silver", "gold"],
      default: "free",
      index: true,
    },
    quota_type: {
      type: String,
      enum: ["daily", "monthly", "billing_cycle", "unlimited"],
      default: "daily",
      index: true,
    },
    quota_limit: {
      type: Number,
      required: true,
      min: 0,
    },
    quota_used: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    quota_remaining: {
      type: Number,
      default: function () {
        return Math.max(0, (this.quota_limit || 0) - (this.quota_used || 0))
      },
    },
    period_start: {
      type: Date,
      index: true,
    },
    period_end: {
      type: Date,
      index: true,
    },
    quota_period_start: {
      type: Date,
      required: true,
      index: true,
    },
    quota_period_end: {
      type: Date,
      required: true,
      index: true,
    },
    last_download_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
)

// Ensure bidirectional synchronization of aliases and auto-calculate remaining quota
downloadQuotaSchema.pre("save", function (next) {
  // Sync User IDs
  if (this.userId && !this.user_id) {
    this.user_id = this.userId
  } else if (this.user_id && !this.userId) {
    this.userId = this.user_id
  }

  // Sync Plan aliases
  if (this.plan && !this.subscription_plan) {
    this.subscription_plan = this.plan
  } else if (this.subscription_plan && !this.plan) {
    this.plan = this.subscription_plan
  }

  // Sync Period Start/End aliases
  if (this.quota_period_start && !this.period_start) {
    this.period_start = this.quota_period_start
  } else if (this.period_start && !this.quota_period_start) {
    this.quota_period_start = this.period_start
  }

  if (this.quota_period_end && !this.period_end) {
    this.period_end = this.quota_period_end
  } else if (this.period_end && !this.quota_period_end) {
    this.quota_period_end = this.period_end
  }

  // Recalculate remaining quota
  if (this.quota_type === "unlimited") {
    this.quota_remaining = 999999
  } else {
    this.quota_remaining = Math.max(0, (this.quota_limit || 0) - (this.quota_used || 0))
  }

  next()
})

// Unique compound index preventing duplicate quota period allocations
downloadQuotaSchema.index(
  { userId: 1, quota_type: 1, quota_period_start: 1 },
  { unique: true, sparse: true }
)
downloadQuotaSchema.index(
  { userId: 1, quota_period_start: 1, quota_period_end: 1 },
  { unique: true }
)
downloadQuotaSchema.index({ user_id: 1, period_start: 1, period_end: 1 }, { sparse: true })

const DownloadQuota =
  mongoose.models.DownloadQuota || mongoose.model("DownloadQuota", downloadQuotaSchema)

export default DownloadQuota
