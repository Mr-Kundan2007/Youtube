import mongoose from "mongoose"

export const QuotaAdjustmentTypes = [
  "ADD_CREDIT",
  "REMOVE_CREDIT",
  "TEMPORARY_LIMIT",
  "CUSTOM_RESTRICTION",
]

const quotaAdjustmentSchema = new mongoose.Schema(
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
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    admin_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    adminEmail: {
      type: String,
      default: "",
    },
    adjustmentType: {
      type: String,
      enum: QuotaAdjustmentTypes,
      required: true,
      default: "ADD_CREDIT",
    },
    value: {
      type: Number,
      required: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    quotaBefore: {
      type: Number,
      default: 0,
    },
    quotaAfter: {
      type: Number,
      default: 0,
    },
    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "expired", "reverted"],
      default: "active",
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

// Pre-save synchronization for aliases
quotaAdjustmentSchema.pre("save", function (next) {
  if (this.userId && !this.user_id) this.user_id = this.userId
  if (this.user_id && !this.userId) this.userId = this.user_id
  if (this.adminId && !this.admin_id) this.admin_id = this.adminId
  if (this.admin_id && !this.adminId) this.adminId = this.admin_id
  next()
})

quotaAdjustmentSchema.index({ userId: 1, createdAt: -1 })
quotaAdjustmentSchema.index({ status: 1, expiresAt: 1 })

export const QuotaAdjustment =
  mongoose.models.QuotaAdjustment || mongoose.model("QuotaAdjustment", quotaAdjustmentSchema)

export default QuotaAdjustment
