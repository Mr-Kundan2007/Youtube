import billingService from "../services/billing/billingService.js"
import billingHistoryService from "../services/billing/billingHistoryService.js"
import invoiceService from "../services/billing/invoiceService.js"
import receiptService from "../services/billing/receiptService.js"
import { logBillingAuditEvent } from "../services/billing/billingUtils.js"
import { sendSuccess, sendError } from "../utils/response.js"
import { ApiError } from "../utils/apiError.js"

/**
 * Controller for Advanced Billing, Invoices & Payment Receipts.
 */

export const getBillingSummaryHandler = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id
    if (!userId) throw ApiError.unauthorized("UNAUTHORIZED", "Login required.")

    const summary = await billingService.getBillingSummary(userId)
    return sendSuccess(res, summary, 200, "Billing summary retrieved successfully")
  } catch (err) {
    return sendError(res, err)
  }
}

export const getBillingHistoryHandler = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id
    if (!userId) throw ApiError.unauthorized("UNAUTHORIZED", "Login required.")

    const {
      page,
      limit,
      status,
      plan,
      dateRange,
      startDate,
      endDate,
      search,
      sortBy,
      sortOrder,
    } = req.query

    const history = await billingHistoryService.getBillingHistory(userId, {
      page,
      limit,
      status,
      plan,
      dateRange,
      startDate,
      endDate,
      search,
      sortBy,
      sortOrder,
    })

    return sendSuccess(res, history, 200, "Billing history retrieved successfully")
  } catch (err) {
    return sendError(res, err)
  }
}

export const getTransactionDetailsHandler = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id
    if (!userId) throw ApiError.unauthorized("UNAUTHORIZED", "Login required.")

    const { transactionId } = req.params
    const isAdmin = req.user?.role === "admin"

    const details = await billingHistoryService.getTransactionDetails(
      transactionId,
      userId,
      isAdmin
    )

    return sendSuccess(res, details, 200, "Transaction details retrieved successfully")
  } catch (err) {
    return sendError(res, err)
  }
}

export const getUserInvoicesHandler = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id
    if (!userId) throw ApiError.unauthorized("UNAUTHORIZED", "Login required.")

    const { page, limit, search, status } = req.query
    const result = await invoiceService.getUserInvoices(userId, {
      page,
      limit,
      search,
      status,
    })

    return sendSuccess(res, result, 200, "User invoices retrieved successfully")
  } catch (err) {
    return sendError(res, err)
  }
}

export const getInvoiceDetailsHandler = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id
    if (!userId) throw ApiError.unauthorized("UNAUTHORIZED", "Login required.")

    const { invoiceId } = req.params
    const isAdmin = req.user?.role === "admin"

    const invoice = await invoiceService.getInvoiceById(
      invoiceId,
      userId,
      isAdmin,
      req.ip,
      req.headers["user-agent"]
    )

    return sendSuccess(res, invoice, 200, "Invoice retrieved successfully")
  } catch (err) {
    return sendError(res, err)
  }
}

export const downloadInvoicePdfHandler = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id
    if (!userId) throw ApiError.unauthorized("UNAUTHORIZED", "Login required.")

    const { invoiceId } = req.params
    const isAdmin = req.user?.role === "admin"

    const invoice = await invoiceService.getInvoiceById(
      invoiceId,
      userId,
      isAdmin,
      req.ip,
      req.headers["user-agent"]
    )

    const pdfBuffer = await invoiceService.generateInvoicePdf(invoice)

    await logBillingAuditEvent({
      userId,
      transactionId: invoice.transactionId,
      invoiceId: invoice._id,
      event: "INVOICE_DOWNLOADED",
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      safeMetadata: { invoiceNumber: invoice.invoiceNumber },
    })

    res.setHeader("Content-Type", "application/pdf")
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Invoice-${invoice.invoiceNumber}.pdf"`
    )
    res.setHeader("Content-Length", pdfBuffer.length)

    return res.end(pdfBuffer)
  } catch (err) {
    return sendError(res, err)
  }
}

export const getInvoiceHtmlHandler = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id
    if (!userId) throw ApiError.unauthorized("UNAUTHORIZED", "Login required.")

    const { invoiceId } = req.params
    const isAdmin = req.user?.role === "admin"

    const invoice = await invoiceService.getInvoiceById(
      invoiceId,
      userId,
      isAdmin,
      req.ip,
      req.headers["user-agent"]
    )

    const html = invoiceService.generateInvoiceHtml(invoice)
    res.setHeader("Content-Type", "text/html")
    return res.send(html)
  } catch (err) {
    return sendError(res, err)
  }
}

export const getReceiptDetailsHandler = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id
    if (!userId) throw ApiError.unauthorized("UNAUTHORIZED", "Login required.")

    const { transactionId } = req.params
    const isAdmin = req.user?.role === "admin"

    const receipt = await receiptService.getReceiptByTransaction(
      transactionId,
      userId,
      isAdmin,
      req.ip,
      req.headers["user-agent"]
    )

    return sendSuccess(res, receipt, 200, "Receipt retrieved successfully")
  } catch (err) {
    return sendError(res, err)
  }
}

export const downloadReceiptPdfHandler = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id
    if (!userId) throw ApiError.unauthorized("UNAUTHORIZED", "Login required.")

    const { transactionId } = req.params
    const isAdmin = req.user?.role === "admin"

    const receipt = await receiptService.getReceiptByTransaction(
      transactionId,
      userId,
      isAdmin,
      req.ip,
      req.headers["user-agent"]
    )

    const pdfBuffer = await receiptService.generateReceiptPdf(receipt)

    await logBillingAuditEvent({
      userId,
      transactionId,
      event: "RECEIPT_DOWNLOADED",
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      safeMetadata: { receiptNumber: receipt.receiptNumber },
    })

    res.setHeader("Content-Type", "application/pdf")
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Receipt-${receipt.receiptNumber}.pdf"`
    )
    res.setHeader("Content-Length", pdfBuffer.length)

    return res.end(pdfBuffer)
  } catch (err) {
    return sendError(res, err)
  }
}

export const getReceiptHtmlHandler = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id
    if (!userId) throw ApiError.unauthorized("UNAUTHORIZED", "Login required.")

    const { transactionId } = req.params
    const isAdmin = req.user?.role === "admin"

    const receipt = await receiptService.getReceiptByTransaction(
      transactionId,
      userId,
      isAdmin,
      req.ip,
      req.headers["user-agent"]
    )

    const html = receiptService.generateReceiptHtml(receipt)
    res.setHeader("Content-Type", "text/html")
    return res.send(html)
  } catch (err) {
    return sendError(res, err)
  }
}
