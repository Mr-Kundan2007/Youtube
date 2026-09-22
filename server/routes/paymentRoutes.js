import express from "express"
import { requireAuth } from "../middleware/authMiddleware.js"
import {
  createOrderHandler,
  getPaymentStatusHandler,
  cancelPaymentHandler,
  recordPaymentFailureHandler,
  getTransactionDetailsHandler,
  verifyPaymentHandler,
  razorpayWebhookHandler,
} from "../controllers/paymentController.js"

const router = express.Router()

// Authenticated customer payment routes
router.post("/create-order", requireAuth, createOrderHandler)
router.get("/:transactionId/status", requireAuth, getPaymentStatusHandler)
router.get("/transaction/:transactionId", requireAuth, getTransactionDetailsHandler)
router.post("/cancel", requireAuth, cancelPaymentHandler)
router.post("/failure", requireAuth, recordPaymentFailureHandler)
router.post("/verify", requireAuth, verifyPaymentHandler)

// Unauthenticated webhook listener from Razorpay
router.post("/webhook", razorpayWebhookHandler)

export default router
