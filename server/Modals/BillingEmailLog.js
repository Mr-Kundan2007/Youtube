import mongoose from "mongoose"

/**
 * BillingEmailLog Schema
 * Tracks email dispatch lifecycle, delivery statuses, retry counts, and prevents duplicate emails.
 */
const billingEmailLogSchema = new mongoose.Schema(
  {
    notificationId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PaymentTransaction",
      default: null,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        "subscription_activated",
        "payment_successful",
        "subscription_renewed",
        "subscription_upgraded",
        "payment_failed",
        "payment_cancelled",
        "invoice_created",
        "subscription_expired",
      ],
      index: true,
    },
    recipientEmail: {
      type: String,
      required: true,
    },
    subject: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "sending", "sent", "failed", "retrying"],
      default: "pending",
      index: true,
    },
    attemptCount: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: 3,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    failedAt: {
      type: Date,
      default: null,
    },
    failureReason: {
      type: String,
      default: null,
    },
    templateData: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
)

// Compound index for deduplication per transaction + email type
billingEmailLogSchema.index({ transactionId: 1, type: 1 })

const BillingEmailLog =
  mongoose.models.BillingEmailLog ||
  mongoose.model("BillingEmailLog", billingEmailLogSchema)

export default BillingEmailLog
