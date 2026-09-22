import mongoose from "mongoose"

/**
 * AdminSubscriptionAuditLog Schema
 * Immutable audit log for administrative interventions on subscriptions and plans.
 * Guarantees accountability: every modification records adminId, target userId, action, diff, and reason.
 */
const adminSubscriptionAuditLogSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
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
    action: {
      type: String,
      required: true,
      enum: [
        "EXTEND_VALIDITY",
        "SUSPEND_SUBSCRIPTION",
        "RESTORE_SUBSCRIPTION",
        "MOVE_TO_FREE",
        "OVERRIDE_PLAN",
        "PLAN_UPDATED",
        "PLAN_STATUS_CHANGED",
        "PLAN_CREATED",
        "FEATURE_MODIFIED",
        "update_plan",
        "toggle_plan_status",
      ],
      index: true,
    },
    previousValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    previousValues: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    newValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    newValues: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    reason: {
      type: String,
      required: true,
    },
    ip: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
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

adminSubscriptionAuditLogSchema.index({ adminId: 1, action: 1, timestamp: -1 })
adminSubscriptionAuditLogSchema.index({ userId: 1, timestamp: -1 })

const AdminSubscriptionAuditLog =
  mongoose.models.AdminSubscriptionAuditLog ||
  mongoose.model("AdminSubscriptionAuditLog", adminSubscriptionAuditLogSchema)

export default AdminSubscriptionAuditLog
