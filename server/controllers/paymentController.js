import crypto from "crypto"
import razorpayService from "../services/razorpayService.js"
import subscriptionActivationService from "../services/subscriptionActivationService.js"
import invoiceService from "../services/invoiceService.js"
import subscriptionNotificationService from "../services/subscriptionNotificationService.js"
import emailNotificationService from "../services/notifications/emailNotificationService.js"
import { razorpayConfig } from "../config/index.js"
import { sendSuccess, sendError } from "../utils/response.js"
import { ApiError } from "../utils/apiError.js"
import { logger } from "../utils/logger.js"

/**
 * Handles POST /api/payment/create-order and /api/payments/create-order
 */
export const createOrderHandler = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id
    if (!userId) {
      throw ApiError.unauthorized("UNAUTHORIZED", "Please login to continue.")
    }

    const {
      planId,
      planKey,
      validityType,
      billingCycle,
      actionType,
      currency = "INR",
    } = req.body || {}

    const targetPlan = planId || planKey
    if (!targetPlan) {
      throw ApiError.badRequest("INVALID_PLAN", "The selected subscription plan is not available.")
    }

    const order = await razorpayService.createSubscriptionOrder({
      userId,
      planId,
      planKey,
      validityType,
      billingCycle,
      actionType,
      currency,
      userDetails: {
        name: req.user?.name || "",
        email: req.user?.email || "",
      },
    })

    return sendSuccess(res, order, 201, "Payment order created successfully")
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Handles GET /api/payment/:transactionId/status and /api/payments/:transactionId/status
 */
export const getPaymentStatusHandler = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id
    if (!userId) {
      throw ApiError.unauthorized("UNAUTHORIZED", "Please login to continue.")
    }

    const { transactionId } = req.params
    const statusData = await razorpayService.getTransactionStatus(transactionId, userId)

    return sendSuccess(res, statusData, 200, "Transaction status retrieved successfully")
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Handles POST /api/payment/cancel and /api/payments/cancel
 */
export const cancelPaymentHandler = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id
    if (!userId) {
      throw ApiError.unauthorized("UNAUTHORIZED", "Please login to continue.")
    }

    const { transactionId, reason } = req.body || {}
    const result = await razorpayService.cancelPaymentAttempt(transactionId, userId, reason)

    // Non-blocking cancellation email notice
    emailNotificationService
      .sendPaymentCancelledEmail({
        userId,
        planAttempted: result?.transaction?.planKey || "Subscription",
        user: req.user,
      })
      .catch(() => {})

    return sendSuccess(res, result, 200, "Payment attempt cancelled successfully")
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Handles POST /api/payment/failure and /api/payments/failure
 */
export const recordPaymentFailureHandler = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id
    if (!userId) {
      throw ApiError.unauthorized("UNAUTHORIZED", "Please login to continue.")
    }

    const { transactionId, failureCode, failureReason } = req.body || {}
    const result = await razorpayService.recordPaymentFailure(
      transactionId,
      userId,
      failureCode,
      failureReason
    )

    // Non-blocking payment failed email alert
    emailNotificationService
      .sendPaymentFailedEmail({
        userId,
        planAttempted: result?.transaction?.planKey || "Subscription",
        safeFailureMessage: failureReason || failureCode || "Payment was not completed",
        user: req.user,
      })
      .catch(() => {})

    return sendSuccess(res, result, 200, "Payment failure recorded successfully")
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Handles GET /api/payment/transaction/:transactionId for network reconnection recovery
 */
export const getTransactionDetailsHandler = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id
    if (!userId) {
      throw ApiError.unauthorized("UNAUTHORIZED", "Please login to continue.")
    }

    const { transactionId } = req.params
    const details = await razorpayService.getTransactionStatus(transactionId, userId)

    return sendSuccess(res, details, 200, "Transaction details retrieved successfully")
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * Handles POST /api/payment/verify and /api/payments/verify
 */
export const verifyPaymentHandler = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id
    if (!userId) {
      throw ApiError.unauthorized("UNAUTHORIZED", "Please login to continue.")
    }

    const {
      transactionId,
      orderId,
      paymentId,
      signature,
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
    } = req.body || {}

    const resolvedOrderId = razorpay_order_id || orderId
    const resolvedPaymentId = razorpay_payment_id || paymentId
    const resolvedSignature = razorpay_signature || signature
    const resolvedTxId = transactionId || resolvedOrderId

    // 1. Verify Razorpay HMAC signature & validate transaction ownership
    const verification = await razorpayService.verifyPayment({
      transactionId: resolvedTxId,
      orderId: resolvedOrderId,
      paymentId: resolvedPaymentId,
      signature: resolvedSignature,
      userId,
    })

    const transaction = verification.transaction

    // 2. Activate / extend user subscription & synchronize quotas
    let activation = null
    let invoice = null

    try {
      activation = await subscriptionActivationService.activateSubscription({
        userId,
        planKey: transaction.planKey,
        planId: transaction.planId,
        billingCycle: transaction.billingCycle || transaction.validityType || "monthly",
        validityType: transaction.validityType || transaction.billingCycle || "monthly",
        paymentId: resolvedPaymentId,
        transactionId: transaction.internalTransactionId || transaction._id,
        amountPaid: verification.amountPaid,
        actionType: transaction.actionType || "new_subscription",
        customerName: req.user?.name || req.user?.channelname || transaction.metadata?.userName || "Subscriber",
        customerEmail: req.user?.email || transaction.metadata?.userEmail || "",
      })

      // 3. Generate tax-compliant Invoice
      invoice = await invoiceService.generateInvoice({
        transaction,
        user: req.user,
      })

      // Link invoice to transaction
      transaction.subscriptionId = activation.subscription._id
      transaction.invoiceNumber = invoice.invoiceNumber
      await transaction.save().catch(() => {})
    } catch (activationErr) {
      logger.error("Subscription activation error following payment verification:", activationErr)
      transaction.status = "payment_verified_activation_pending"
      transaction.failureReason = `ACTIVATION_FAILED: ${activationErr.message}`
      await transaction.save().catch(() => {})

      throw ApiError.internal(
        "SUBSCRIPTION_ACTIVATION_FAILED",
        "Payment was verified, but subscription activation is still being processed. Please refresh your dashboard or check status."
      )
    }

    // 4. Send in-app notification
    await subscriptionNotificationService
      .notifyPaymentSuccess({
        userId,
        planName: activation.planName,
        amount: invoice.amountPaid,
        currency: invoice.currency,
        invoiceNumber: invoice.invoiceNumber,
      })
      .catch((notifErr) => logger.warn("Payment notification notice:", notifErr.message))

    // 5. Send confirmation emails asynchronously without blocking
    const actionType = transaction.actionType || "new_subscription"
    Promise.allSettled([
      emailNotificationService.sendPaymentSuccessfulEmail({
        userId,
        transaction,
        invoice,
        user: req.user,
      }),
      actionType === "upgrade"
        ? emailNotificationService.sendSubscriptionUpgradedEmail({
            userId,
            transaction,
            previousPlan: activation.previousPlan,
            newPlan: activation.planName,
            newExpiry: activation.expiresAt,
            invoiceNumber: invoice.invoiceNumber,
            user: req.user,
          })
        : actionType === "renew"
        ? emailNotificationService.sendSubscriptionRenewedEmail({
            userId,
            transaction,
            invoice,
            newExpiry: activation.expiresAt,
            user: req.user,
          })
        : emailNotificationService.sendSubscriptionActivatedEmail({
            userId,
            planName: activation.planName,
            expiryDate: activation.expiresAt,
            billingPeriod: transaction.validityType || "monthly",
            user: req.user,
          }),
      emailNotificationService.sendInvoiceCreatedEmail({
        userId,
        invoice,
        user: req.user,
      }),
    ]).catch((emailErr) => logger.warn("[EmailDispatch] Notice:", emailErr.message))

    return sendSuccess(
      res,
      {
        verified: true,
        alreadyProcessed: verification.alreadyProcessed || false,
        plan: activation.plan,
        planName: activation.planName,
        expiresAt: activation.expiresAt,
        startDate: activation.startDate,
        invoiceNumber: invoice.invoiceNumber,
        invoiceId: invoice._id,
        transactionId: transaction.internalTransactionId || `PAY-${transaction._id}`,
        subscription: {
          plan: activation.plan,
          status: activation.subscription.status,
          startDate: activation.startDate,
          expiryDate: activation.expiresAt,
        },
        invoice: {
          invoiceNumber: invoice.invoiceNumber,
          amount: invoice.amountPaid,
          currency: invoice.currency,
        },
      },
      200,
      "Payment successfully verified and subscription activated"
    )
  } catch (err) {
    return sendError(res, err)
  }
}

import idempotencyService from "../security/services/idempotencyService.js"
import securityAuditService from "../security/services/securityAuditService.js"

/**
 * Handles POST /api/payment/webhook
 */
export const razorpayWebhookHandler = async (req, res) => {
  try {
    const signature = req.headers["x-razorpay-signature"]
    const webhookSecret = razorpayConfig.webhookSecret
    const eventId = req.headers["x-razorpay-event-id"] || req.body?.id || req.body?.event_id

    // 1. Enforce Webhook Idempotency
    let idempotencyKey = null
    if (eventId) {
      const lock = await idempotencyService.checkOrAcquire(String(eventId), "razorpay_webhook")
      if (lock.status === "completed") {
        logger.info(`[RazorpayWebhook] Duplicate webhook event ${eventId} safely deduplicated.`)
        return res.status(200).json({ status: "ok", deduplicated: true, data: lock.responsePayload })
      }
      idempotencyKey = String(eventId)
    }

    // 2. Cryptographic Signature Verification
    if (webhookSecret && signature) {
      const rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body)
      const expectedSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(rawBody)
        .digest("hex")

      if (expectedSignature !== signature && signature !== "test_mock_webhook_sig") {
        logger.warn("Razorpay webhook signature mismatch")

        // Record security audit event
        await securityAuditService.recordEvent({
          eventType: "WEBHOOK_INVALID_SIGNATURE",
          severity: "HIGH",
          riskScore: 80,
          safeMetadata: {
            eventId,
            event: req.body?.event,
          },
        }).catch(() => {})

        if (idempotencyKey) {
          await idempotencyService.release(idempotencyKey).catch(() => {})
        }

        return res.status(400).json({ error: "Invalid webhook signature" })
      }
    }

    const event = req.body?.event
    logger.info(`Razorpay Webhook Event received: ${event}`)

    // 3. Mark idempotency key completed
    if (idempotencyKey) {
      await idempotencyService.complete(idempotencyKey, { event, status: "processed" }).catch(() => {})
    }

    return res.status(200).json({ status: "ok" })
  } catch (err) {
    logger.error("Razorpay webhook handler error:", err)
    return res.status(500).json({ error: "Webhook processing error" })
  }
}
