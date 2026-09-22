import express from "express"
import { requireAuth } from "../middleware/authMiddleware.js"
import {
  getBillingSummaryHandler,
  getBillingHistoryHandler,
  getTransactionDetailsHandler,
  getUserInvoicesHandler,
  getInvoiceDetailsHandler,
  downloadInvoicePdfHandler,
  getInvoiceHtmlHandler,
  getReceiptDetailsHandler,
  downloadReceiptPdfHandler,
  getReceiptHtmlHandler,
} from "../controllers/billingController.js"

export const billingRouter = express.Router()
export const invoiceRouter = express.Router()
export const receiptRouter = express.Router()

// 1. Billing summary & history routes
billingRouter.get("/summary", requireAuth, getBillingSummaryHandler)
billingRouter.get("/history", requireAuth, getBillingHistoryHandler)
billingRouter.get("/transaction/:transactionId", requireAuth, getTransactionDetailsHandler)

// 2. Dedicated Invoices routes
invoiceRouter.get("/", requireAuth, getUserInvoicesHandler)
invoiceRouter.get("/:invoiceId", requireAuth, getInvoiceDetailsHandler)
invoiceRouter.get("/:invoiceId/download", requireAuth, downloadInvoicePdfHandler)
invoiceRouter.get("/:invoiceId/html", requireAuth, getInvoiceHtmlHandler)

// 3. Dedicated Receipts routes
receiptRouter.get("/:transactionId", requireAuth, getReceiptDetailsHandler)
receiptRouter.get("/:transactionId/download", requireAuth, downloadReceiptPdfHandler)
receiptRouter.get("/:transactionId/html", requireAuth, getReceiptHtmlHandler)

export default {
  billingRouter,
  invoiceRouter,
  receiptRouter,
}
