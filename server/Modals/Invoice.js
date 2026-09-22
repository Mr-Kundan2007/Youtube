import mongoose from "mongoose"

/**
 * Invoice Schema
 * Generates accounting and user-facing billing records with GST / tax itemization.
 */
const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
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
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
      default: null,
    },
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PaymentTransaction",
      required: true,
      index: true,
    },
    planKey: {
      type: String,
      enum: ["free", "bronze", "silver", "gold"],
      default: "bronze",
    },
    planName: {
      type: String,
      required: true,
    },
    billingCycle: {
      type: String,
      enum: ["monthly", "quarterly", "annual", "yearly", "lifetime"],
      default: "monthly",
    },
    amount: {
      type: Number,
      default: 0,
    },
    amountPaid: {
      type: Number,
      default: 0,
    },
    subtotal: {
      type: Number,
      default: 0,
    },
    taxRatePercent: {
      type: Number,
      default: 18, // 18% GST standard
    },
    taxAmount: {
      type: Number,
      default: 0,
    },
    currency: {
      type: String,
      default: "INR",
      uppercase: true,
    },
    paymentGateway: {
      type: String,
      default: "razorpay",
    },
    paymentId: {
      type: String,
      default: "",
    },
    billingPeriodStart: {
      type: Date,
      default: Date.now,
    },
    billingPeriodEnd: {
      type: Date,
      default: Date.now,
    },
    customerName: {
      type: String,
      default: "Valued Customer",
    },
    customerEmail: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "paid", "failed", "cancelled", "refunded", "void"],
      default: "paid",
      index: true,
    },
    issuedAt: {
      type: Date,
      default: Date.now,
    },
    dueDate: {
      type: Date,
      default: Date.now,
    },
    paidAt: {
      type: Date,
      default: Date.now,
    },
    pdfUrl: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
)

invoiceSchema.pre("validate", function (next) {
  if (this.amount && !this.amountPaid) {
    this.amountPaid = this.amount
  }
  if (this.amountPaid && !this.amount) {
    this.amount = this.amountPaid
  }
  if (!this.subtotal && this.amount) {
    const taxRate = (this.taxRatePercent || 18) / 100
    this.subtotal = Number((this.amount / (1 + taxRate)).toFixed(2))
    this.taxAmount = Number((this.amount - this.subtotal).toFixed(2))
  }
  next()
})

const Invoice = mongoose.models.Invoice || mongoose.model("Invoice", invoiceSchema)

export default Invoice
