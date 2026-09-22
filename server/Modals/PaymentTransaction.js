import mongoose from "mongoose"

/**
 * PaymentTransaction Schema
 * Records all monetary checkout events, payment signatures, orders, and statuses.
 */
const paymentTransactionSchema = new mongoose.Schema(
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
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
      default: null,
      index: true,
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubscriptionPlan",
      default: null,
      index: true,
    },
    provider: {
      type: String,
      default: "razorpay",
      index: true,
    },
    orderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    internalTransactionId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    paymentAttemptId: {
      type: String,
      default: null,
      index: true,
    },
    paymentId: {
      type: String,
      default: null,
      index: true,
    },
    invoiceNumber: {
      type: String,
      default: null,
      index: true,
    },
    signature: {
      type: String,
      default: null,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "INR",
      uppercase: true,
    },
    planKey: {
      type: String,
      enum: ["free", "bronze", "silver", "gold"],
      default: "bronze",
    },
    billingCycle: {
      type: String,
      enum: ["monthly", "quarterly", "annual", "yearly", "lifetime"],
      default: "monthly",
    },
    validityType: {
      type: String,
      enum: ["monthly", "quarterly", "annual", "yearly", "lifetime"],
      default: "monthly",
    },
    actionType: {
      type: String,
      enum: ["new_subscription", "upgrade", "downgrade", "renew"],
      default: "new_subscription",
    },
    status: {
      type: String,
      enum: [
        "created",
        "pending",
        "processing",
        "verification_pending",
        "verification_failed",
        "payment_verified_activation_pending",
        "success",
        "successful",
        "failed",
        "cancelled",
        "refunded",
      ],
      default: "pending",
      index: true,
    },
    paymentGateway: {
      type: String,
      default: "razorpay",
    },
    paymentMethod: {
      type: String,
      default: "unknown",
    },
    receiptNumber: {
      type: String,
      default: null,
      index: true,
    },
    signatureVerified: {
      type: Boolean,
      default: false,
    },
    paymentVerifiedAt: {
      type: Date,
      default: null,
    },
    verificationStartedAt: {
      type: Date,
      default: null,
    },
    verificationFailedAt: {
      type: Date,
      default: null,
    },
    transactionCompletedAt: {
      type: Date,
      default: null,
    },
    failureCode: {
      type: String,
      default: null,
    },
    failureReason: {
      type: String,
      default: null,
    },
    failedAt: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    orderCreatedAt: {
      type: Date,
      default: Date.now,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    transactionMetadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
)

// Pre-save hook to synchronize metadata and userId aliases
paymentTransactionSchema.pre("save", function (next) {
  if (this.userId && !this.user_id) this.user_id = this.userId
  if (this.user_id && !this.userId) this.userId = this.user_id

  if (!this.provider && this.paymentGateway) this.provider = this.paymentGateway
  if (!this.paymentGateway && this.provider) this.paymentGateway = this.provider

  if (!this.validityType && this.billingCycle) this.validityType = this.billingCycle
  if (!this.billingCycle && this.validityType) this.billingCycle = this.validityType
  if (this.billingCycle === "annual") this.billingCycle = "yearly"
  if (this.validityType === "annual") this.validityType = "yearly"

  if (!this.receiptNumber && this.orderId) this.receiptNumber = `rcpt_${this.orderId}`
  if (!this.transactionMetadata && this.metadata) this.transactionMetadata = this.metadata
  if (!this.metadata && this.transactionMetadata) this.metadata = this.transactionMetadata

  next()
})

const PaymentTransaction =
  mongoose.models.PaymentTransaction ||
  mongoose.model("PaymentTransaction", paymentTransactionSchema)

export default PaymentTransaction
