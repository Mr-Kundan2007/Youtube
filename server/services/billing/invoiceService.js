import PDFDocument from "pdfkit"
import Invoice from "../../Modals/Invoice.js"
import PaymentTransaction from "../../Modals/PaymentTransaction.js"
import { getSubscriptionPlan } from "../../config/subscriptionPlans.js"
import { ApiError } from "../../utils/apiError.js"
import {
  calculateGstBreakdown,
  generateInvoiceNumber,
  formatCurrency,
  logBillingAuditEvent,
} from "./billingUtils.js"

export class InvoiceService {
  /**
   * Generates or retrieves an authoritative tax-compliant invoice for a transaction.
   * Guarantees strict idempotency so duplicate calls return the existing invoice.
   */
  async createInvoice({ transaction, user = {} }) {
    if (!transaction || !["success", "successful"].includes(transaction.status)) {
      throw ApiError.badRequest(
        "INVALID_TRANSACTION",
        "Cannot generate invoice for non-successful transaction"
      )
    }

    // 1. Idempotency check: Return existing invoice if already created
    const existingInvoice = await Invoice.findOne({
      $or: [
        { transactionId: transaction._id },
        ...(transaction.invoiceNumber ? [{ invoiceNumber: transaction.invoiceNumber }] : []),
      ],
    })

    if (existingInvoice) {
      if (!transaction.invoiceNumber) {
        transaction.invoiceNumber = existingInvoice.invoiceNumber
        await transaction.save()
      }
      return existingInvoice
    }

    // Amount in rupees (convert paise if >= 1000 and not already converted)
    const totalAmount =
      transaction.amount > 1000 && !transaction.amountInRupees
        ? transaction.amount / 100
        : transaction.amount

    const { subtotal, taxRatePercent, taxAmount } = calculateGstBreakdown(totalAmount, 18)

    const now = new Date()
    const invoiceNumber = transaction.invoiceNumber || generateInvoiceNumber(now)

    const plan =
      getSubscriptionPlan(transaction.planKey) || {
        name: transaction.metadata?.planName || (transaction.planKey ? transaction.planKey.toUpperCase() : "Subscription"),
      }

    const cycle = (transaction.validityType || transaction.billingCycle || "monthly").toLowerCase()
    const durationDays =
      cycle === "yearly" || cycle === "annual" ? 365 : cycle === "quarterly" ? 90 : 30
    const billingPeriodStart = transaction.createdAt || now
    const billingPeriodEnd = new Date(
      billingPeriodStart.getTime() + durationDays * 24 * 60 * 60 * 1000
    )

    const customerName =
      user.name || user.channelname || transaction.metadata?.userName || "Valued Subscriber"
    const customerEmail = user.email || transaction.metadata?.userEmail || ""

    const invoice = await Invoice.create({
      invoiceNumber,
      userId: transaction.userId,
      subscriptionId: transaction.subscriptionId,
      transactionId: transaction._id,
      planKey: (transaction.planKey || "bronze").toLowerCase(),
      planName: plan.name || "Premium Plan",
      billingCycle: cycle,
      subtotal,
      taxRatePercent,
      taxAmount,
      amount: totalAmount,
      amountPaid: totalAmount,
      currency: transaction.currency || "INR",
      paymentGateway: transaction.paymentGateway || transaction.provider || "razorpay",
      paymentId: transaction.paymentId || "",
      billingPeriodStart,
      billingPeriodEnd,
      customerName,
      customerEmail,
      status: "paid",
    })

    // Synchronize transaction record
    if (transaction.invoiceNumber !== invoiceNumber) {
      transaction.invoiceNumber = invoiceNumber
      await transaction.save()
    }

    // Audit log
    await logBillingAuditEvent({
      userId: transaction.userId,
      transactionId: transaction._id,
      invoiceId: invoice._id,
      event: "INVOICE_CREATED",
      safeMetadata: { invoiceNumber, amount: totalAmount, currency: invoice.currency },
    })

    return invoice
  }

  /**
   * Retrieves an invoice by ID ensuring strict ownership or admin privileges.
   */
  async getInvoiceById(invoiceId, userId, isAdmin = false, ip = null, userAgent = null) {
    const invoice = await Invoice.findById(invoiceId).lean()
    if (!invoice) {
      throw ApiError.notFound("INVOICE_NOT_FOUND", "Invoice record not found")
    }

    if (!isAdmin && String(invoice.userId) !== String(userId)) {
      throw ApiError.forbidden(
        "FORBIDDEN",
        "You do not have permission to view this invoice"
      )
    }

    await logBillingAuditEvent({
      userId,
      transactionId: invoice.transactionId,
      invoiceId: invoice._id,
      event: "INVOICE_VIEWED",
      ip,
      userAgent,
      safeMetadata: { invoiceNumber: invoice.invoiceNumber },
    })

    return invoice
  }

  /**
   * Retrieves an invoice by transaction ID.
   */
  async getInvoiceByTransaction(transactionId, userId, isAdmin = false) {
    const invoice = await Invoice.findOne({ transactionId }).lean()
    if (!invoice) {
      return null
    }

    if (!isAdmin && String(invoice.userId) !== String(userId)) {
      throw ApiError.forbidden(
        "FORBIDDEN",
        "You do not have permission to access this invoice"
      )
    }

    return invoice
  }

  /**
   * Retrieves paginated invoices for a user with search and filtering.
   */
  async getUserInvoices(userId, { page = 1, limit = 10, search = "", status = "" } = {}) {
    const p = Math.max(1, Number(page) || 1)
    const lim = Math.max(1, Math.min(50, Number(limit) || 10))
    const skip = (p - 1) * lim

    const query = { userId }
    if (status && status !== "all") {
      query.status = status.toLowerCase()
    }

    if (search) {
      const term = String(search).trim()
      query.$or = [
        { invoiceNumber: { $regex: term, $options: "i" } },
        { planName: { $regex: term, $options: "i" } },
        { paymentId: { $regex: term, $options: "i" } },
      ]
    }

    const [invoices, total] = await Promise.all([
      Invoice.find(query).sort({ createdAt: -1 }).skip(skip).limit(lim).lean(),
      Invoice.countDocuments(query),
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
   * Generates a binary PDF buffer for the invoice using pdfkit.
   */
  async generateInvoicePdf(invoice) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 40, size: "A4" })
        const buffers = []

        doc.on("data", (chunk) => buffers.push(chunk))
        doc.on("end", () => resolve(Buffer.concat(buffers)))
        doc.on("error", (err) => reject(err))

        // Brand Header
        doc.fillColor("#dc2626").fontSize(22).font("Helvetica-Bold").text("YOUTUBE PREMIUM", 40, 40)
        doc.fillColor("#6b7280").fontSize(10).font("Helvetica").text("Digital Streaming & Learning Services", 40, 68)

        // Invoice Badge
        doc.rect(420, 36, 135, 24).fillAndStroke("#dcfce7", "#86efac")
        doc.fillColor("#15803d").fontSize(11).font("Helvetica-Bold").text("TAX INVOICE - PAID", 432, 43)

        // Horizontal Rule
        doc.strokeColor("#e5e7eb").lineWidth(1).moveTo(40, 95).lineTo(555, 95).stroke()

        // Metadata grid
        doc.fillColor("#111827").fontSize(12).font("Helvetica-Bold").text("INVOICE DETAILS", 40, 110)
        doc.fontSize(9).font("Helvetica").fillColor("#6b7280")
        doc.text("Invoice Number:", 40, 130)
        doc.text("Invoice Date:", 40, 145)
        doc.text("Status:", 40, 160)
        doc.text("Payment Method:", 40, 175)

        doc.font("Helvetica-Bold").fillColor("#111827")
        doc.text(invoice.invoiceNumber, 130, 130)
        doc.text(new Date(invoice.createdAt || invoice.issuedAt).toLocaleDateString("en-IN", { dateStyle: "long" }), 130, 145)
        doc.text("PAID", 130, 160)
        doc.text(`Razorpay (${(invoice.paymentGateway || "ONLINE").toUpperCase()})`, 130, 175)

        // Customer Info
        doc.fillColor("#111827").fontSize(12).font("Helvetica-Bold").text("BILLED TO", 320, 110)
        doc.fontSize(9).font("Helvetica").fillColor("#6b7280")
        doc.text("Customer:", 320, 130)
        doc.text("Email:", 320, 145)
        doc.text("Payment ID:", 320, 160)

        doc.font("Helvetica-Bold").fillColor("#111827")
        doc.text(invoice.customerName || "Valued Subscriber", 380, 130)
        doc.text(invoice.customerEmail || "N/A", 380, 145)
        doc.text(invoice.paymentId || "N/A", 380, 160)

        // Table Header
        const tableTop = 210
        doc.rect(40, tableTop, 515, 22).fill("#f3f4f6")
        doc.fillColor("#374151").fontSize(9).font("Helvetica-Bold")
        doc.text("DESCRIPTION", 50, tableTop + 6)
        doc.text("VALIDITY PERIOD", 240, tableTop + 6)
        doc.text("CYCLE", 410, tableTop + 6)
        doc.text("AMOUNT", 490, tableTop + 6, { align: "right", width: 55 })

        // Table Row
        const rowTop = tableTop + 30
        doc.fillColor("#111827").fontSize(9).font("Helvetica-Bold")
        doc.text(`YouTube ${invoice.planName} Plan`, 50, rowTop)
        doc.font("Helvetica").fontSize(8).fillColor("#6b7280")
        doc.text("4K Ultra HD, Ad-Free Streaming, Unlimited Downloads", 50, rowTop + 14)

        const startFormatted = new Date(invoice.billingPeriodStart).toLocaleDateString()
        const endFormatted = new Date(invoice.billingPeriodEnd).toLocaleDateString()
        doc.font("Helvetica").fontSize(9).fillColor("#111827").text(`${startFormatted} - ${endFormatted}`, 240, rowTop)
        doc.text(invoice.billingCycle.toUpperCase(), 410, rowTop)
        doc.text(formatCurrency(invoice.subtotal, invoice.currency), 490, rowTop, { align: "right", width: 55 })

        // Divider
        doc.strokeColor("#e5e7eb").lineWidth(1).moveTo(40, rowTop + 35).lineTo(555, rowTop + 35).stroke()

        // Totals Box
        const totalsTop = rowTop + 50
        const formatTax = (amount) => formatCurrency(amount, invoice.currency)

        doc.fontSize(9).font("Helvetica").fillColor("#4b5563")
        doc.text("Subtotal (Exclusive of GST):", 340, totalsTop)
        doc.text(`GST (${invoice.taxRatePercent || 18}% Standard):`, 340, totalsTop + 18)
        doc.font("Helvetica-Bold").fillColor("#111827")
        doc.text("Total Paid:", 340, totalsTop + 38)

        doc.font("Helvetica").text(formatTax(invoice.subtotal), 470, totalsTop, { align: "right", width: 75 })
        doc.text(formatTax(invoice.taxAmount), 470, totalsTop + 18, { align: "right", width: 75 })
        doc.font("Helvetica-Bold").fontSize(12).fillColor("#dc2626")
        doc.text(formatTax(invoice.amountPaid), 470, totalsTop + 38, { align: "right", width: 75 })

        // Footer & Support Notice
        doc.strokeColor("#e5e7eb").lineWidth(1).moveTo(40, 450).lineTo(555, 450).stroke()
        doc.fontSize(8).font("Helvetica").fillColor("#9ca3af")
        doc.text("This is an electronically generated tax invoice that does not require a physical signature.", 40, 465, { align: "center" })
        doc.text("For questions regarding this invoice, contact billing@youtube.local or visit your Subscription Center.", 40, 480, { align: "center" })

        doc.end()
      } catch (err) {
        reject(err)
      }
    })
  }

  /**
   * Generates clean, printable HTML representation of the invoice.
   */
  generateInvoiceHtml(invoice) {
    const { subtotal, taxAmount, taxRatePercent } = invoice
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Invoice ${invoice.invoiceNumber} - YouTube Premium</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 40px; color: #1f2937; background: #f9fafb; }
    .card { max-width: 750px; margin: 0 auto; background: #fff; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e5e7eb; padding-bottom: 20px; }
    .brand { font-size: 24px; font-weight: 800; color: #dc2626; letter-spacing: -0.5px; }
    .badge { background: #dcfce7; color: #15803d; padding: 4px 12px; border-radius: 9999px; font-weight: 700; font-size: 13px; text-transform: uppercase; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin: 30px 0; }
    .label { font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: 600; margin-bottom: 4px; }
    .val { font-size: 15px; font-weight: 600; color: #111827; }
    table { width: 100%; border-collapse: collapse; margin: 24px 0; }
    th { text-align: left; padding: 12px; background: #f3f4f6; color: #4b5563; font-size: 12px; font-weight: 700; text-transform: uppercase; }
    td { padding: 16px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
    .totals { margin-left: auto; width: 300px; margin-top: 20px; }
    .totals-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
    .grand-total { font-size: 18px; font-weight: 800; color: #dc2626; border-top: 2px solid #e5e7eb; padding-top: 10px; margin-top: 6px; }
    .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #f3f4f6; padding-top: 20px; }
    @media print {
      body { background: #fff; padding: 0; }
      .card { box-shadow: none; border: none; padding: 0; }
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div>
        <div class="brand">YouTube Premium</div>
        <div style="color: #6b7280; font-size: 13px; margin-top: 4px;">Tax Invoice & Official Payment Receipt</div>
      </div>
      <div style="text-align: right;">
        <span class="badge">PAID</span>
        <div style="font-weight: 700; font-size: 16px; margin-top: 8px;">${invoice.invoiceNumber}</div>
        <div style="color: #6b7280; font-size: 13px;">${new Date(invoice.createdAt).toLocaleDateString("en-IN", { dateStyle: "long" })}</div>
      </div>
    </div>

    <div class="grid">
      <div>
        <div class="label">Billed To</div>
        <div class="val">${invoice.customerName || "Valued Subscriber"}</div>
        <div style="color: #4b5563; font-size: 14px;">${invoice.customerEmail || ""}</div>
      </div>
      <div>
        <div class="label">Payment Details</div>
        <div class="val">Method: Razorpay (${(invoice.paymentGateway || "ONLINE").toUpperCase()})</div>
        <div style="color: #4b5563; font-size: 14px;">Payment ID: ${invoice.paymentId || "N/A"}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th>Validity Period</th>
          <th>Cycle</th>
          <th style="text-align: right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <strong>YouTube ${invoice.planName} Plan</strong>
            <div style="color: #6b7280; font-size: 12px;">Full HD/4K Streaming, Offline Downloads & Ad-Free</div>
          </td>
          <td>${new Date(invoice.billingPeriodStart).toLocaleDateString()} - ${new Date(invoice.billingPeriodEnd).toLocaleDateString()}</td>
          <td style="text-transform: capitalize;">${invoice.billingCycle}</td>
          <td style="text-align: right;">${formatCurrency(subtotal, invoice.currency)}</td>
        </tr>
      </tbody>
    </table>

    <div class="totals">
      <div class="totals-row">
        <span>Subtotal</span>
        <span>${formatCurrency(subtotal, invoice.currency)}</span>
      </div>
      <div class="totals-row">
        <span>GST (${taxRatePercent}%)</span>
        <span>${formatCurrency(taxAmount, invoice.currency)}</span>
      </div>
      <div class="totals-row grand-total">
        <span>Total Paid</span>
        <span>${formatCurrency(invoice.amountPaid, invoice.currency)}</span>
      </div>
    </div>

    <div class="footer">
      Thank you for subscribing to YouTube Premium! This is a computer-generated tax invoice.
      For inquiries, contact support@youtube.local.
    </div>
  </div>
</body>
</html>`
  }
}

export const invoiceService = new InvoiceService()
export default invoiceService
