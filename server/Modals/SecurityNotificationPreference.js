import mongoose from "mongoose"

const securityNotificationPreferenceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    inAppEnabled: {
      type: Boolean,
      default: true,
    },
    emailNewLoginEnabled: {
      type: Boolean,
      default: true,
    },
    emailHighRiskEnabled: {
      type: Boolean,
      default: true,
    },
    smsCriticalEnabled: {
      type: Boolean,
      default: false,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
)

const SecurityNotificationPreference =
  mongoose.models.SecurityNotificationPreference ||
  mongoose.model("SecurityNotificationPreference", securityNotificationPreferenceSchema)

export default SecurityNotificationPreference
