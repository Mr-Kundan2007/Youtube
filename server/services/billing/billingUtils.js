import crypto from "crypto"
import BillingAuditLog from "../../Modals/BillingAuditLog.js"
import { logger } from "../../utils/logger.js"

/**
 * Billing Utilities
 * Centralized tax calculations, number generators, sanitizers, and audit logging.
 */

/**
 * Calculates GST inclusive breakdown (subtotal, CGST, SGST/IGST, total).
 */
export function calculateGstBreakdown(totalAmount, taxRatePercent = 18) {
  const numericTotal = Math.max(0, Number(totalAmount) || 0)
  const rateFraction = (taxRatePercent || 18) / 100

  // Inclusive calculation: Total = Base * (1 + rate)
  const subtotal = Math.round((numericTotal / (1 + rateFraction)) * 100) / 100
  const taxAmount = Math.round((numericTotal - subtotal) * 100) / 100
  const cgst = Math.round((taxAmount / 2) * 100) / 100
  const sgst = Math.round((taxAmount - cgst) * 100) / 100

  return {
    total: numericTotal,
    subtotal,
    taxRatePercent,
    taxAmount,
    cgst,
    sgst,
  }
}

/**
 * Formats monetary amounts in INR currency symbols.
 */
export function formatCurrency(amount, currency = "INR") {
  const symbol = currency === "INR" ? "₹" : "$"
  return `${symbol}${Number(amount || 0).toFixed(2)}`
}

/**
 * Generates unique, consistent, human-readable invoice numbers: INV-YYYYMMDD-XXXXXX
 */
export function generateInvoiceNumber(date = new Date()) {
  const yearMonthDay = date.toISOString().slice(0, 10).replace(/-/g, "")
  const randomSuffix = crypto.randomBytes(3).toString("hex").toUpperCase()
  return `INV-${yearMonthDay}-${randomSuffix}`
}

/**
 * Generates unique, consistent, human-readable receipt numbers: RCPT-YYYYMMDD-XXXXXX
 */
export function generateReceiptNumber(date = new Date()) {
  const yearMonthDay = date.toISOString().slice(0, 10).replace(/-/g, "")
  const randomSuffix = crypto.randomBytes(3).toString("hex").toUpperCase()
  return `RCPT-${yearMonthDay}-${randomSuffix}`
}

/**
 * Sanitizes transaction documents for client consumption, completely scrubbing secrets.
 */
export function sanitizeTransactionForClient(transaction) {
  if (!transaction) return null
  const raw = transaction.toObject ? transaction.toObject() : { ...transaction }

  const amountRupees = raw.amount > 1000 && !raw.amountInRupees ? raw.amount / 100 : raw.amount

  return {
    _id: raw._id,
    id: raw._id,
    transactionId: raw._id,
    orderId: raw.orderId || raw.razorpayOrderId || null,
    paymentId: raw.paymentId || raw.razorpayPaymentId || null,
    invoiceNumber: raw.invoiceNumber || null,
    receiptNumber: raw.receiptNumber || (raw.orderId ? `rcpt_${raw.orderId}` : null),
    amount: amountRupees,
    currency: raw.currency || "INR",
    planKey: (raw.planKey || "bronze").toLowerCase(),
    planName: raw.metadata?.planName || raw.planKey?.toUpperCase() || "Subscription",
    actionType: raw.actionType || "new_subscription",
    status: raw.status || "pending",
    paymentMethod: raw.paymentMethod || "online",
    paymentGateway: raw.paymentGateway || raw.provider || "razorpay",
    billingCycle: raw.billingCycle || raw.validityType || "monthly",
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    paymentVerifiedAt: raw.paymentVerifiedAt || null,
    hasInvoice: Boolean(raw.invoiceNumber),
    hasReceipt: ["success", "successful"].includes(raw.status),
  }
}

/**
 * Safely logs a billing audit event without interrupting critical execution.
 */
export async function logBillingAuditEvent({
  userId,
  transactionId = null,
  invoiceId = null,
  event,
  ip = null,
  userAgent = null,
  safeMetadata = {},
}) {
  try {
    if (!userId || !event) return null
    return await BillingAuditLog.create({
      userId,
      transactionId,
      invoiceId,
      event,
      ip,
      userAgent,
      safeMetadata,
      timestamp: new Date(),
    })
  } catch (err) {
    logger.warn(`Failed to record BillingAuditLog: ${err.message}`)
    return null
  }
}
