import PDFDocument from "pdfkit"
import PaymentTransaction from "../../Modals/PaymentTransaction.js"
import { getSubscriptionPlan } from "../../config/subscriptionPlans.js"
import { ApiError } from "../../utils/apiError.js"
import {
  generateReceiptNumber,
  formatCurrency,
  logBillingAuditEvent,
} from "./billingUtils.js"

export class ReceiptService {
  /**
   * Retrieves and formats payment receipt details for a transaction.
   * Strictly enforces that receipts can only be generated for successful transactions.
   */
  async getReceiptByTransaction(transactionId, userId, isAdmin = false, ip = null, userAgent = null) {
    const transaction = await PaymentTransaction.findById(transactionId).lean()
    if (!transaction) {
      throw ApiError.notFound("TRANSACTION_NOT_FOUND", "Transaction record not found")
    }

    if (!isAdmin && String(transaction.userId) !== String(userId)) {
      throw ApiError.forbidden(
        "FORBIDDEN",
        "You do not have permission to view this receipt"
      )
    }

    if (!["success", "successful"].includes(transaction.status)) {
      throw ApiError.badRequest(
        "RECEIPT_NOT_AVAILABLE",
        "Payment receipts are only generated for successful transactions"
      )
    }

    const plan =
      getSubscriptionPlan(transaction.planKey) || {
        name: transaction.metadata?.planName || (transaction.planKey ? transaction.planKey.toUpperCase() : "Subscription"),
      }

    const amountRupees =
      transaction.amount > 1000 && !transaction.amountInRupees
        ? transaction.amount / 100
        : transaction.amount

    const receiptNumber =
      transaction.receiptNumber ||
      (transaction.orderId ? `rcpt_${transaction.orderId}` : generateReceiptNumber(transaction.createdAt))

    const receiptData = {
      receiptNumber,
      transactionId: transaction._id,
      orderId: transaction.orderId || "N/A",
      paymentId: transaction.paymentId || "N/A",
      planKey: (transaction.planKey || "bronze").toLowerCase(),
      planName: plan.name || "Premium Plan",
      amount: amountRupees,
      currency: transaction.currency || "INR",
      paymentDate: transaction.paymentVerifiedAt || transaction.updatedAt || transaction.createdAt,
      paymentStatus: "Successful",
      provider: (transaction.paymentGateway || transaction.provider || "Razorpay").toUpperCase(),
      paymentMethod: transaction.paymentMethod || "Online",
      customerName: transaction.metadata?.userName || "Subscriber",
      customerEmail: transaction.metadata?.userEmail || "",
    }

    await logBillingAuditEvent({
      userId,
      transactionId: transaction._id,
      event: "RECEIPT_CREATED",
      ip,
      userAgent,
      safeMetadata: { receiptNumber, amount: amountRupees },
    })

    return receiptData
  }

  /**
   * Generates a binary PDF buffer for the payment receipt using pdfkit.
   */
  async generateReceiptPdf(receipt) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 40, size: "A5", layout: "portrait" })
        const buffers = []

        doc.on("data", (chunk) => buffers.push(chunk))
        doc.on("end", () => resolve(Buffer.concat(buffers)))
        doc.on("error", (err) => reject(err))

        // Header
        doc.fillColor("#dc2626").fontSize(18).font("Helvetica-Bold").text("YOUTUBE PREMIUM", 40, 35)
        doc.fillColor("#6b7280").fontSize(9).font("Helvetica").text("Official Payment Confirmation", 40, 58)

        // Status pill
        doc.rect(260, 32, 120, 22).fillAndStroke("#dcfce7", "#86efac")
        doc.fillColor("#15803d").fontSize(10).font("Helvetica-Bold").text("PAYMENT SUCCESS", 270, 38)

        doc.strokeColor("#e5e7eb").lineWidth(1).moveTo(40, 75).lineTo(380, 75).stroke()

        // Key-value rows
        const startY = 90
        const rowHeight = 22
        const rows = [
          ["Receipt Number:", receipt.receiptNumber],
          ["Date & Time:", new Date(receipt.paymentDate).toLocaleString("en-IN")],
          ["Payment Gateway:", `${receipt.provider} (${receipt.paymentMethod})`],
          ["Payment ID:", receipt.paymentId],
          ["Order ID:", receipt.orderId],
          ["Plan Purchased:", receipt.planName],
          ["Status:", "Paid / Verified"],
        ]

        rows.forEach(([label, val], idx) => {
          const y = startY + idx * rowHeight
          doc.font("Helvetica").fontSize(9).fillColor("#6b7280").text(label, 40, y)
          doc.font("Helvetica-Bold").fontSize(9).fillColor("#111827").text(String(val), 150, y, { width: 230 })
        })

        // Amount Box
        const amountBoxY = startY + rows.length * rowHeight + 15
        doc.rect(40, amountBoxY, 340, 48).fill("#f8fafc")
        doc.strokeColor("#cbd5e1").lineWidth(1).rect(40, amountBoxY, 340, 48).stroke()

        doc.fillColor("#475569").fontSize(9).font("Helvetica").text("Total Amount Paid", 55, amountBoxY + 12)
        doc.fillColor("#dc2626").fontSize(16).font("Helvetica-Bold").text(
          formatCurrency(receipt.amount, receipt.currency),
          55,
          amountBoxY + 26
        )

        // Footer note
        doc.fillColor("#94a3b8").fontSize(8).font("Helvetica").text(
          "Thank you for your business! For inquiries, visit /subscription/dashboard.",
          40,
          amountBoxY + 65,
          { align: "center", width: 340 }
        )

        doc.end()
      } catch (err) {
        reject(err)
      }
    })
  }

  /**
   * Generates clean, printable HTML representation of the payment receipt.
   */
  generateReceiptHtml(receipt) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Receipt ${receipt.receiptNumber} - YouTube Premium</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 30px; color: #1f2937; background: #f3f4f6; }
    .card { max-width: 500px; margin: 0 auto; background: #fff; padding: 32px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
    .header { text-align: center; border-bottom: 2px dashed #e5e7eb; padding-bottom: 20px; }
    .brand { font-size: 20px; font-weight: 800; color: #dc2626; }
    .badge { display: inline-block; background: #dcfce7; color: #15803d; padding: 4px 12px; border-radius: 9999px; font-weight: 700; font-size: 12px; margin-top: 10px; }
    .rows { margin: 24px 0; }
    .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-size: 13px; }
    .label { color: #6b7280; }
    .val { font-weight: 600; color: #111827; }
    .amount-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; text-align: center; margin: 20px 0; }
    .amount-label { font-size: 12px; color: #991b1b; text-transform: uppercase; font-weight: 600; }
    .amount-val { font-size: 24px; font-weight: 800; color: #dc2626; margin-top: 4px; }
    .footer { text-align: center; font-size: 11px; color: #9ca3af; margin-top: 24px; }
    @media print {
      body { background: #fff; padding: 0; }
      .card { box-shadow: none; border: none; padding: 0; }
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="brand">YouTube Premium</div>
      <div style="color: #6b7280; font-size: 13px; margin-top: 2px;">Official Payment Receipt</div>
      <div class="badge">PAYMENT SUCCESSFUL</div>
    </div>

    <div class="rows">
      <div class="row">
        <span class="label">Receipt Number</span>
        <span class="val">${receipt.receiptNumber}</span>
      </div>
      <div class="row">
        <span class="label">Date & Time</span>
        <span class="val">${new Date(receipt.paymentDate).toLocaleString("en-IN")}</span>
      </div>
      <div class="row">
        <span class="label">Payment Provider</span>
        <span class="val">${receipt.provider}</span>
      </div>
      <div class="row">
        <span class="label">Payment ID</span>
        <span class="val">${receipt.paymentId}</span>
      </div>
      <div class="row">
        <span class="label">Order ID</span>
        <span class="val">${receipt.orderId}</span>
      </div>
      <div class="row">
        <span class="label">Plan</span>
        <span class="val">${receipt.planName}</span>
      </div>
    </div>

    <div class="amount-box">
      <div class="amount-label">Amount Paid</div>
      <div class="amount-val">${formatCurrency(receipt.amount, receipt.currency)}</div>
    </div>

    <div class="footer">
      Thank you for your payment. For support or invoice requests, visit your account dashboard.
    </div>
  </div>
</body>
</html>`
  }
}

export const receiptService = new ReceiptService()
export default receiptService
