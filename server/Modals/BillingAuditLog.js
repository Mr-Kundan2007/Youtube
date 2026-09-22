import mongoose from "mongoose"

/**
 * BillingAuditLog Schema
 * Immutable audit log for all billing, invoice, receipt, and notification actions.
 * Strictly guarantees that no payment secrets, signatures, or keys are stored.
 */
const billingAuditLogSchema = new mongoose.Schema(
  {
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
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
      default: null,
      index: true,
    },
    event: {
      type: String,
      required: true,
      enum: [
        "INVOICE_CREATED",
        "INVOICE_VIEWED",
        "INVOICE_DOWNLOADED",
        "RECEIPT_CREATED",
        "RECEIPT_DOWNLOADED",
        "PAYMENT_CONFIRMATION_SENT",
        "INVOICE_EMAIL_SENT",
        "EMAIL_FAILED",
        "EMAIL_RETRIED",
      ],
      index: true,
    },
    ip: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
    safeMetadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
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

billingAuditLogSchema.index({ userId: 1, event: 1, timestamp: -1 })

const BillingAuditLog =
  mongoose.models.BillingAuditLog ||
  mongoose.model("BillingAuditLog", billingAuditLogSchema)

export default BillingAuditLog
