import mongoose from "mongoose"

/**
 * SubscriptionHistory Schema
 * Immutable audit trail tracking every subscription lifecycle event, plan change,
 * renewal, cancellation, and expiration.
 */
const subscriptionHistorySchema = new mongoose.Schema(
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
      required: true,
      index: true,
    },
    previousPlanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubscriptionPlan",
      default: null,
    },
    newPlanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubscriptionPlan",
      default: null,
      index: true,
    },
    action: {
      type: String,
      enum: [
        "subscription_created",
        "plan_upgraded",
        "plan_downgraded",
        "subscription_renewed",
        "subscription_cancelled",
        "cancellation_scheduled",
        "cancellation_restored",
        "expiry_reminder_sent",
        "subscription_expired",
        "downgraded_to_free",
        "grace_period_started",
        "grace_period_ended",
        "subscription_activated",
        "subscription_suspended",
        "payment_failed",
      ],
      required: true,
      index: true,
    },
    reason: {
      type: String,
      default: "",
    },
    performedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
)

const SubscriptionHistory =
  mongoose.models.SubscriptionHistory ||
  mongoose.model("SubscriptionHistory", subscriptionHistorySchema)

export default SubscriptionHistory
