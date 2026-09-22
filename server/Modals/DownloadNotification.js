import mongoose from "mongoose"

const downloadNotificationSchema = new mongoose.Schema(
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
    },
    type: {
      type: String,
      required: true,
      enum: [
        "DOWNLOAD_STARTED",
        "DOWNLOAD_COMPLETED",
        "DOWNLOAD_FAILED",
        "DOWNLOAD_BLOCKED",
        "DOWNLOAD_CANCELLED",
        "QUOTA_WARNING",
        "QUOTA_EXCEEDED",
        "SUBSCRIPTION_EXPIRING",
        "EXPIRY_REMINDER",
        "SUBSCRIPTION_EXPIRING_TODAY",
        "SUBSCRIPTION_EXPIRED",
        "DOWNGRADED_TO_FREE",
        "SUBSCRIPTION_ACTIVATED",
        "SUBSCRIPTION_RENEWED",
        "PLAN_UPGRADED",
        "PLAN_DOWNGRADED",
        "SUBSCRIPTION_CANCELLED",
        "CANCELLATION_SCHEDULED",
        "CANCELLATION_RESTORED",
        "GRACE_PERIOD_STARTED",
        "GRACE_PERIOD_ENDED",
        "PAYMENT_SUCCESSFUL",
        "INVOICE_CREATED",
        "DEVICE_REVOKED",
        "SECURITY_ALERT",
        "COMMENT_MENTION",
      ],
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    actionUrl: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ["unread", "read", "archived"],
      default: "unread",
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
)

// Sync userId and user_id
downloadNotificationSchema.pre("save", function (next) {
  if (this.userId && !this.user_id) {
    this.user_id = this.userId
  } else if (this.user_id && !this.userId) {
    this.userId = this.user_id
  }
  next()
})

// Compound indexes
downloadNotificationSchema.index({ userId: 1, createdAt: -1 })
downloadNotificationSchema.index({ userId: 1, read: 1 })

const DownloadNotification =
  mongoose.models.DownloadNotification ||
  mongoose.model("DownloadNotification", downloadNotificationSchema)

export default DownloadNotification
