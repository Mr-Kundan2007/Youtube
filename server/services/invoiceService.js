import crypto from "crypto"
import Invoice from "../Modals/Invoice.js"
import PaymentTransaction from "../Modals/PaymentTransaction.js"
import { getSubscriptionPlan } from "../config/subscriptionPlans.js"
import { ApiError } from "../utils/apiError.js"
import billingInvoiceService from "./billing/invoiceService.js"

export class InvoiceService {
  /**
   * Generates a tax-compliant invoice for a successful payment transaction.
   * Guarantees idempotency so duplicate calls return the existing invoice.
   */
  async generateInvoice({ transaction, user = {} }) {
    if (!transaction || !["success", "successful"].includes(transaction.status)) {
      throw ApiError.badRequest("INVALID_TRANSACTION", "Cannot generate invoice for non-successful transaction")
    }

    // 1. Idempotency check: Return existing invoice if already created
    const existingInvoice = await Invoice.findOne({
      $or: [
        { transactionId: transaction._id },
      ],
    })
    if (existingInvoice) {
      return existingInvoice
    }

    const totalAmount = transaction.amount / 100 // convert paise to rupees (e.g. 199.00)
    const taxRatePercent = 18
    // GST inclusive calculation: Base = Total / 1.18; Tax = Total - Base
    const subtotal = Math.round((totalAmount / 1.18) * 100) / 100
    const taxAmount = Math.round((totalAmount - subtotal) * 100) / 100

    const now = new Date()
    const yearMonthDay = now.toISOString().slice(0, 10).replace(/-/g, "")
    const randomSuffix = crypto.randomBytes(3).toString("hex").toUpperCase()
    const invoiceNumber = `INV-${yearMonthDay}-${randomSuffix}`

    const plan = getSubscriptionPlan(transaction.planKey) || { name: transaction.metadata?.planName || "Subscription" }
    const cycle = (transaction.validityType || transaction.billingCycle || "monthly").toLowerCase()
    const durationDays = cycle === "yearly" || cycle === "annual" ? 365 : cycle === "quarterly" ? 90 : 30
    const billingPeriodStart = transaction.createdAt || now
    const billingPeriodEnd = new Date(billingPeriodStart.getTime() + durationDays * 24 * 60 * 60 * 1000)

    const invoice = await Invoice.create({
      invoiceNumber,
      userId: transaction.userId,
      subscriptionId: transaction.subscriptionId,
      transactionId: transaction._id,
      planKey: transaction.planKey,
      planName: plan.name,
      billingCycle: cycle,
      subtotal,
      taxRatePercent,
      taxAmount,
      amount: totalAmount,
      amountPaid: totalAmount,
      currency: transaction.currency || "INR",
      paymentGateway: transaction.paymentGateway || "razorpay",
      paymentId: transaction.paymentId || "",
      billingPeriodStart,
      billingPeriodEnd,
      customerName: user.name || user.channelname || transaction.metadata?.userName || "Valued Subscriber",
      customerEmail: user.email || transaction.metadata?.userEmail || "",
      status: "paid",
    })

    return invoice
  }

  /**
   * Retrieves paginated billing history for a user.
   */
  async getUserBillingHistory(userId, { page = 1, limit = 10 } = {}) {
    const p = Math.max(1, Number(page) || 1)
    const lim = Math.max(1, Math.min(50, Number(limit) || 10))
    const skip = (p - 1) * lim

    const [invoices, total] = await Promise.all([
      Invoice.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(lim).lean(),
      Invoice.countDocuments({ userId }),
    ])

    return {
      invoices,
      pagination: {
        page: p,
        limit: lim,
        total,
        totalPages: Math.ceil(total / lim) || 1,
      },
    }
  }

  /**
   * Retrieves a single invoice ensuring strict user ownership or admin role.
   */
  async getInvoiceById(invoiceId, userId, isAdmin = false) {
    const invoice = await Invoice.findById(invoiceId).lean()
    if (!invoice) {
      throw ApiError.notFound("INVOICE_NOT_FOUND", "Invoice record not found")
    }

    if (!isAdmin && String(invoice.userId) !== String(userId)) {
      throw ApiError.forbidden("FORBIDDEN", "You do not have permission to view this invoice")
    }

    return invoice
  }

  /**
   * Generates binary PDF buffer by invoice ID or invoice document.
   */
  async generateInvoicePDF(invoiceIdOrDoc, userId, isAdmin = false) {
    let invoice = invoiceIdOrDoc
    if (typeof invoiceIdOrDoc === "string" || (invoiceIdOrDoc && invoiceIdOrDoc._id && !invoiceIdOrDoc.invoiceNumber)) {
      invoice = await this.getInvoiceById(invoiceIdOrDoc, userId, isAdmin)
    }
    return billingInvoiceService.generateInvoicePdf(invoice)
  }

  async generateInvoicePdf(invoice) {
    return billingInvoiceService.generateInvoicePdf(invoice)
  }

  /**
   * Generates formatted, clean HTML receipt suitable for printing or PDF view.
   */
  generateInvoiceHtml(invoice) {
    const formatCurrency = (amount, cur = "INR") => {
      const symbol = cur === "INR" ? "₹" : "$"
      return `${symbol}${Number(amount).toFixed(2)}`
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Receipt ${invoice.invoiceNumber} - YouTube Premium</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 40px; color: #1f2937; background-color: #f9fafb; }
    .invoice-card { max-width: 700px; margin: 0 auto; background: #ffffff; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e5e7eb; padding-bottom: 20px; }
    .logo { font-size: 24px; font-weight: 800; color: #dc2626; display: flex; align-items: center; gap: 8px; }
    .badge { background: #dcfce7; color: #15803d; padding: 4px 12px; border-radius: 9999px; font-weight: 600; font-size: 14px; text-transform: uppercase; }
    .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin: 30px 0; }
    .label { font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: 600; margin-bottom: 4px; }
    .val { font-size: 15px; font-weight: 500; color: #111827; }
    table { width: 100%; border-collapse: collapse; margin: 24px 0; }
    th { text-align: left; padding: 12px; background: #f3f4f6; color: #4b5563; font-size: 13px; font-weight: 600; }
    td { padding: 14px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
    .totals { margin-left: auto; width: 280px; }
    .totals-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
    .total-due { font-size: 18px; font-weight: 700; color: #111827; border-top: 2px solid #e5e7eb; padding-top: 10px; margin-top: 6px; }
    .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #f3f4f6; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="invoice-card">
    <div class="header">
      <div>
        <div class="logo">YouTube Premium</div>
        <div style="color: #6b7280; font-size: 14px; margin-top: 4px;">Tax Invoice / Payment Receipt</div>
      </div>
      <div style="text-align: right;">
        <div class="badge">${invoice.status}</div>
        <div style="font-weight: 700; font-size: 16px; margin-top: 8px;">${invoice.invoiceNumber}</div>
        <div style="color: #6b7280; font-size: 13px;">${new Date(invoice.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}</div>
      </div>
    </div>

    <div class="details-grid">
      <div>
        <div class="label">Billed To</div>
        <div class="val">${invoice.customerName}</div>
        <div class="val" style="color: #4b5563;">${invoice.customerEmail}</div>
      </div>
      <div>
        <div class="label">Payment Details</div>
        <div class="val">Method: Razorpay (${invoice.paymentGateway.toUpperCase()})</div>
        <div class="val" style="color: #4b5563;">ID: ${invoice.paymentId || "N/A"}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th>Billing Period</th>
          <th>Cycle</th>
          <th style="text-align: right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>YouTube ${invoice.planName} Plan</strong></td>
          <td>${new Date(invoice.billingPeriodStart).toLocaleDateString()} - ${new Date(invoice.billingPeriodEnd).toLocaleDateString()}</td>
          <td style="text-transform: capitalize;">${invoice.billingCycle}</td>
          <td style="text-align: right;">${formatCurrency(invoice.subtotal, invoice.currency)}</td>
        </tr>
      </tbody>
    </table>

    <div class="totals">
      <div class="totals-row">
        <span>Subtotal</span>
        <span>${formatCurrency(invoice.subtotal, invoice.currency)}</span>
      </div>
      <div class="totals-row">
        <span>GST (${invoice.taxRatePercent}%)</span>
        <span>${formatCurrency(invoice.taxAmount, invoice.currency)}</span>
      </div>
      <div class="totals-row total-due">
        <span>Total Paid</span>
        <span>${formatCurrency(invoice.amountPaid, invoice.currency)}</span>
      </div>
    </div>

    <div class="footer">
      Thank you for subscribing to YouTube Premium! For support, visit your Subscription Center or contact support@youtube.local.
    </div>
  </div>
</body>
</html>`
  }
}

export const invoiceService = new InvoiceService()
export default invoiceService
