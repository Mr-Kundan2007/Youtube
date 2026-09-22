import mongoose from "mongoose"

const subscriptionSchema = new mongoose.Schema(
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
      index: true,
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubscriptionPlan",
      default: null,
      index: true,
    },
    previousPlanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubscriptionPlan",
      default: null,
    },
    plan: {
      type: String,
      enum: ["free", "bronze", "silver", "gold"],
      default: "free",
      index: true,
    },
    status: {
      type: String,
      enum: [
        "active",
        "pending",
        "expired",
        "cancelled",
        "cancel_scheduled",
        "grace_period",
        "expiring_soon",
        "renewal_pending",
        "suspended",
        "payment_pending",
        "payment_failed",
        "past_due",
      ],
      default: "active",
      index: true,
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
      default: null, // null means never expires (for free), or valid until date for paid
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    expiryDate: {
      type: Date,
      default: null,
    },
    autoRenew: {
      type: Boolean,
      default: true,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancelReason: {
      type: String,
      default: null,
    },
    // Phase 7 Lifecycle fields
    cancelScheduled: {
      type: Boolean,
      default: false,
      index: true,
    },
    cancelRequestedAt: {
      type: Date,
      default: null,
    },
    cancelEffectiveAt: {
      type: Date,
      default: null,
    },
    cancellationReason: {
      type: String,
      default: null,
    },
    cancelledBy: {
      type: String,
      default: "user",
    },
    gracePeriodStart: {
      type: Date,
      default: null,
    },
    gracePeriodEnd: {
      type: Date,
      default: null,
    },
    remindersSent: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    lastLifecycleProcessedAt: {
      type: Date,
      default: null,
    },
    isLifecycleLocked: {
      type: Boolean,
      default: false,
    },
    lifecycleLockedAt: {
      type: Date,
      default: null,
    },
    paymentId: {
      type: String,
      default: "",
    },
    paymentGateway: {
      type: String,
      default: "razorpay",
    },
    billingCycle: {
      type: String,
      enum: ["monthly", "quarterly", "annual", "yearly", "lifetime"],
      default: "monthly",
    },
    amountPaid: {
      type: Number,
      default: 0,
    },
    currency: {
      type: String,
      default: "INR",
    },
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false,
    },
    downgradeToPlan: {
      type: String,
      enum: ["free", "bronze", "silver", "gold"],
      default: null,
    },
    lastBillingDate: {
      type: Date,
      default: null,
    },
    nextBillingDate: {
      type: Date,
      default: null,
    },
    validityType: {
      type: String,
      enum: ["monthly", "quarterly", "annual", "yearly", "lifetime"],
      default: "monthly",
    },
    lastTransactionId: {
      type: String,
      default: null,
      index: true,
    },
    // Plan entitlement configuration and snapshot fields
    download_limit: {
      type: Number,
      default: null,
    },
    download_quota_type: {
      type: String,
      enum: ["daily", "monthly", "billing_cycle", "unlimited"],
      default: null,
    },
    download_enabled: {
      type: Boolean,
      default: true,
    },
    max_download_devices: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: true,
  }
)

// Pre-save hook to synchronize user references, dates, and aliases
subscriptionSchema.pre("save", function (next) {
  if (this.userId && !this.user_id) this.user_id = this.userId
  if (this.user_id && !this.userId) this.userId = this.user_id

  // Synchronize expiry aliases
  if (this.expiryDate && !this.expiresAt) this.expiresAt = this.expiryDate
  if (this.expiresAt && !this.expiryDate) this.expiryDate = this.expiresAt
  if (this.expiresAt && !this.endDate) this.endDate = this.expiresAt

  // Synchronize renewal aliases
  if (this.nextRenewalDate && !this.nextBillingDate) this.nextBillingDate = this.nextRenewalDate
  if (this.nextBillingDate && !this.nextRenewalDate) this.nextRenewalDate = this.nextBillingDate

  next()
})

const Subscription =
  mongoose.models.Subscription || mongoose.model("Subscription", subscriptionSchema)

export default Subscription
