import mongoose from "mongoose"
import { SECURITY_ALERT_CONFIG } from "../config/securityAlertConfig.js"

const securityAlertSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    securityEventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SecurityEvent",
      default: null,
    },
    type: {
      type: String,
      required: true,
      enum: Object.values(SECURITY_ALERT_CONFIG.types),
      index: true,
    },
    severity: {
      type: String,
      enum: Object.values(SECURITY_ALERT_CONFIG.severities),
      default: SECURITY_ALERT_CONFIG.severities.MEDIUM,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(SECURITY_ALERT_CONFIG.statuses),
      default: SECURITY_ALERT_CONFIG.statuses.UNREAD,
      index: true,
    },
    deliveryStatus: {
      email: {
        type: String,
        enum: Object.values(SECURITY_ALERT_CONFIG.deliveryStatuses),
        default: SECURITY_ALERT_CONFIG.deliveryStatuses.NOT_REQUESTED,
      },
      sms: {
        type: String,
        enum: Object.values(SECURITY_ALERT_CONFIG.deliveryStatuses),
        default: SECURITY_ALERT_CONFIG.deliveryStatuses.NOT_REQUESTED,
      },
      inApp: {
        type: String,
        enum: [SECURITY_ALERT_CONFIG.deliveryStatuses.PENDING, SECURITY_ALERT_CONFIG.deliveryStatuses.DELIVERED],
        default: SECURITY_ALERT_CONFIG.deliveryStatuses.DELIVERED,
      },
    },
    actionRequired: {
      type: Boolean,
      default: false,
      index: true,
    },
    actionStatus: {
      type: String,
      enum: Object.values(SECURITY_ALERT_CONFIG.actionStatuses),
      default: SECURITY_ALERT_CONFIG.actionStatuses.NONE,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    readAt: {
      type: Date,
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + SECURITY_ALERT_CONFIG.alertRetentionDays * 24 * 60 * 60 * 1000),
      index: true,
    },
  },
  {
    timestamps: true,
  }
)

// Performance compound indexes
securityAlertSchema.index({ userId: 1, status: 1, createdAt: -1 })
securityAlertSchema.index({ userId: 1, severity: 1 })
securityAlertSchema.index({ userId: 1, type: 1, createdAt: -1 })

const SecurityAlert =
  mongoose.models.SecurityAlert || mongoose.model("SecurityAlert", securityAlertSchema)

export default SecurityAlert
