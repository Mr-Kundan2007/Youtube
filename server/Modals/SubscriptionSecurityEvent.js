import mongoose from "mongoose"

/**
 * SubscriptionSecurityEvent Schema
 * Tracks security events, payment replay attempts, fraud signals, rate limit violations,
 * and administrative security actions with zero sensitive credential leakage.
 */
const subscriptionSecurityEventSchema = new mongoose.Schema(
  {
    eventType: {
      type: String,
      required: true,
      index: true,
      enum: [
        "PAYMENT_DUPLICATE_ATTEMPT",
        "INVALID_PAYMENT_AMOUNT",
        "INVALID_SIGNATURE",
        "PAYMENT_REPLAY_ATTEMPT",
        "RATE_LIMIT_TRIGGERED",
        "UNAUTHORIZED_ADMIN_ACCESS",
        "PREMIUM_ACCESS_BYPASS_ATTEMPT",
        "SUSPICIOUS_SUBSCRIPTION_CHANGE",
        "WEBHOOK_INVALID_SIGNATURE",
        "PAYMENT_ANOMALY_DETECTED",
        "API_ABUSE_DETECTED",
        "JOB_FAILURE_ALERT",
        "SUSPICIOUS_ACTIVITY",
        "SECURITY_ALERT",
      ],
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    severity: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      default: "LOW",
      index: true,
    },
    status: {
      type: String,
      enum: ["OPEN", "REVIEWED", "RESOLVED", "IGNORED"],
      default: "OPEN",
      index: true,
    },
    riskScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
      index: true,
    },
    safeMetadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    relatedTransactionId: {
      type: String,
      default: null,
      index: true,
    },
    relatedSubscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
      default: null,
      index: true,
    },
    orderId: {
      type: String,
      default: null,
      index: true,
    },
    ipHash: {
      type: String,
      default: null,
    },
    ip: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
    requestId: {
      type: String,
      default: null,
      index: true,
    },
    adminNotes: {
      type: String,
      default: null,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
)

subscriptionSecurityEventSchema.index({ eventType: 1, createdAt: -1 })
subscriptionSecurityEventSchema.index({ severity: 1, status: 1 })
subscriptionSecurityEventSchema.index({ userId: 1, createdAt: -1 })

const SubscriptionSecurityEvent =
  mongoose.models.SubscriptionSecurityEvent ||
  mongoose.model("SubscriptionSecurityEvent", subscriptionSecurityEventSchema)

export default SubscriptionSecurityEvent
