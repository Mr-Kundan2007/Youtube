import PaymentTransaction from "../../Modals/PaymentTransaction.js"
import SubscriptionPlan from "../../Modals/SubscriptionPlan.js"
import {
  PLAN_CONFIGURATIONS,
  calculatePlanPricing,
  BILLING_CYCLES,
} from "../../config/subscriptionConfig.js"
import { getSubscriptionPlan } from "../../config/index.js"
import { ApiError } from "../../utils/apiError.js"
import { logger } from "../../utils/logger.js"
import securityAuditService from "./securityAuditService.js"

export class PaymentSecurityService {
  /**
   * Validates target payment amount authoritatively on the server.
   * Compares provided amount against authoritative calculatePlanPricing calculation.
   * Both rupee amounts and paise amounts are handled safely.
   */
  async validatePaymentAmount(planIdentifier, billingCycle = "monthly", providedAmount) {
    if (!planIdentifier) {
      return {
        isValid: false,
        reason: "Missing plan identifier",
        expectedAmountPaise: 0,
        providedAmount,
      }
    }

    let cycle = (billingCycle || "monthly").toLowerCase()
    if (cycle === "annual") cycle = "yearly"
    if (!BILLING_CYCLES[cycle]) {
      return {
        isValid: false,
        reason: `Invalid billing cycle: ${billingCycle}`,
        expectedAmountPaise: 0,
        providedAmount,
      }
    }

    // Resolve plan configuration
    let plan = null
    const identifierStr = String(planIdentifier).trim()

    if (identifierStr.match(/^[0-9a-fA-F]{24}$/)) {
      plan = await SubscriptionPlan.findById(identifierStr).lean().catch(() => null)
    }

    if (!plan) {
      plan = await SubscriptionPlan.findOne({
        slug: identifierStr.toLowerCase(),
      })
        .lean()
        .catch(() => null)
    }

    if (!plan) {
      const configPlan =
        PLAN_CONFIGURATIONS[identifierStr.toLowerCase()] ||
        getSubscriptionPlan(identifierStr.toLowerCase())
      if (configPlan) {
        plan = {
          slug: configPlan.slug || configPlan.key,
          price: configPlan.price,
        }
      }
    }

    if (!plan || plan.price === undefined || plan.price === null) {
      return {
        isValid: false,
        reason: `Plan '${planIdentifier}' could not be resolved`,
        expectedAmountPaise: 0,
        providedAmount,
      }
    }

    const pricing = calculatePlanPricing(plan.price, cycle)
    const expectedAmountPaise = Math.round(pricing.price * 100)
    const expectedPriceRupees = pricing.price

    if (providedAmount === undefined || providedAmount === null) {
      return {
        isValid: true,
        expectedAmountPaise,
        expectedPriceRupees,
        providedAmount: null,
      }
    }

    const numericProvided = Number(providedAmount)
    // Client may pass either paise or rupees
    const isPaiseMatch = Math.abs(numericProvided - expectedAmountPaise) < 1
    const isRupeeMatch = Math.abs(numericProvided - expectedPriceRupees) < 0.01

    const isValid = isPaiseMatch || isRupeeMatch

    return {
      isValid,
      expectedAmountPaise,
      expectedPriceRupees,
      providedAmount: numericProvided,
      difference: isValid ? 0 : numericProvided - expectedAmountPaise,
      reason: isValid ? null : `Amount mismatch: expected ₹${expectedPriceRupees} (${expectedAmountPaise} paise), received ${providedAmount}`,
    }
  }

  /**
   * Strictly validates payment state machine transitions.
   * Disallows invalid jumps (e.g., FAILED -> SUCCESS, or re-verifying SUCCESS).
   */
  enforcePaymentStateMachine(currentStatus, targetStatus) {
    const cur = (currentStatus || "created").toLowerCase()
    const tgt = (targetStatus || "").toLowerCase()

    const ALLOWED_TRANSITIONS = {
      created: ["pending", "cancelled", "failed"],
      pending: ["processing", "verifying", "failed", "cancelled"],
      processing: ["verifying", "success", "successful", "failed", "verification_failed"],
      verifying: ["success", "successful", "failed", "verification_failed"],
      verification_failed: ["failed", "pending"], // May allow retry order creation, not direct success
      failed: ["cancelled"], // Terminal; cannot jump to success
      cancelled: [], // Terminal
      success: [], // Terminal
      successful: [], // Terminal
    }

    // Identical status is a no-op / valid idempotency check
    if (cur === tgt) {
      return { allowed: true, isNoop: true }
    }

    const allowedNext = ALLOWED_TRANSITIONS[cur] || []
    const isAllowed = allowedNext.includes(tgt)

    if (!isAllowed) {
      return {
        allowed: false,
        reason: `Illegal state transition from '${cur}' to '${tgt}'. Valid next states: [${allowedNext.join(", ")}]`,
      }
    }

    return { allowed: true, reason: null }
  }

  /**
   * Detects duplicate payment replay attempts using order ID or payment ID.
   */
  async detectReplayAttempt(orderId, paymentId, currentTransactionId = null) {
    if (!orderId && !paymentId) {
      return { isReplay: false }
    }

    // 1. Check if payment ID has already succeeded in another transaction
    if (paymentId) {
      const query = {
        paymentId,
        status: { $in: ["success", "successful"] },
      }
      if (currentTransactionId) {
        query._id = { $ne: currentTransactionId }
      }

      const replayTx = await PaymentTransaction.findOne(query).lean().catch(() => null)
      if (replayTx) {
        return {
          isReplay: true,
          type: "PAYMENT_ID_REUSE",
          matchedTransactionId: replayTx._id,
          matchedOrderId: replayTx.orderId,
          reason: `Payment ID '${paymentId}' has already been processed and activated.`,
        }
      }
    }

    // 2. Check if this exact orderId is already in success state
    if (orderId) {
      const orderTx = await PaymentTransaction.findOne({
        orderId,
        status: { $in: ["success", "successful"] },
      }).lean().catch(() => null)

      if (orderTx && (!currentTransactionId || String(orderTx._id) !== String(currentTransactionId))) {
        return {
          isReplay: true,
          type: "ORDER_ALREADY_COMPLETED",
          matchedTransactionId: orderTx._id,
          matchedOrderId: orderTx.orderId,
          reason: `Order '${orderId}' has already been completed.`,
        }
      }
    }

    return { isReplay: false }
  }

  /**
   * Enforces cross-user isolation and ownership verification.
   */
  validatePaymentOwnership(transaction, authenticatedUserId) {
    if (!transaction) {
      throw ApiError.notFound("TRANSACTION_NOT_FOUND", "Payment transaction not found")
    }

    if (!authenticatedUserId) {
      throw ApiError.unauthorized("UNAUTHORIZED", "Authentication required")
    }

    const txUserId = String(transaction.userId || transaction.user_id || "")
    const authUserId = String(authenticatedUserId)

    if (txUserId !== authUserId) {
      logger.warn(
        `Cross-user access violation attempt: User ${authUserId} attempted to access transaction owned by ${txUserId}`
      )
      throw ApiError.forbidden(
        "UNAUTHORIZED_TRANSACTION",
        "You are not authorized to access or modify this payment transaction."
      )
    }

    return true
  }
}

const paymentSecurityService = new PaymentSecurityService()
export default paymentSecurityService
