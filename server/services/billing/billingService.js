import Subscription from "../../Modals/Subscription.js"
import SubscriptionPlan from "../../Modals/SubscriptionPlan.js"
import PaymentTransaction from "../../Modals/PaymentTransaction.js"
import Invoice from "../../Modals/Invoice.js"
import { getSubscriptionPlan } from "../../config/subscriptionPlans.js"
import { formatCurrency } from "./billingUtils.js"

export class BillingService {
  /**
   * Aggregates billing summary information for the authenticated user.
   */
  async getBillingSummary(userId) {
    // 1. Get current subscription
    const subscription = await Subscription.findOne({
      $or: [{ userId }, { user_id: userId }],
    })
      .populate("planId")
      .lean()

    let planName = "Free"
    let planSlug = "free"
    let validityType = "lifetime"
    let price = 0
    let currency = "INR"

    if (subscription) {
      if (subscription.planId) {
        planName = subscription.planId.name || "Free"
        planSlug = subscription.planId.slug || "free"
        validityType = subscription.planId.validityType || "monthly"
        price = subscription.planId.price || 0
        currency = subscription.planId.currency || "INR"
      } else if (subscription.planKey) {
        const p = getSubscriptionPlan(subscription.planKey)
        if (p) {
          planName = p.name
          planSlug = p.slug
          price = p.price
        }
      }
    }

    // 2. Query transactions & invoices
    const [lastSuccessfulTransaction, totalTransactions, successfulTransactions, invoiceCount] =
      await Promise.all([
        PaymentTransaction.findOne({
          userId,
          status: { $in: ["success", "successful"] },
        })
          .sort({ createdAt: -1 })
          .lean(),
        PaymentTransaction.countDocuments({ userId }),
        PaymentTransaction.find({
          userId,
          status: { $in: ["success", "successful"] },
        })
          .select("amount")
          .lean(),
        Invoice.countDocuments({ userId }),
      ])

    // Calculate total spend (convert paise if needed)
    let totalSpent = 0
    successfulTransactions.forEach((t) => {
      const amt = t.amount > 1000 && !t.amountInRupees ? t.amount / 100 : t.amount
      totalSpent += Number(amt) || 0
    })

    let lastPayment = null
    if (lastSuccessfulTransaction) {
      const amt =
        lastSuccessfulTransaction.amount > 1000 && !lastSuccessfulTransaction.amountInRupees
          ? lastSuccessfulTransaction.amount / 100
          : lastSuccessfulTransaction.amount

      lastPayment = {
        transactionId: lastSuccessfulTransaction._id,
        amount: amt,
        currency: lastSuccessfulTransaction.currency || "INR",
        formattedAmount: formatCurrency(amt, lastSuccessfulTransaction.currency),
        paidAt:
          lastSuccessfulTransaction.paymentVerifiedAt ||
          lastSuccessfulTransaction.createdAt,
        invoiceNumber: lastSuccessfulTransaction.invoiceNumber || null,
        receiptNumber: lastSuccessfulTransaction.receiptNumber || null,
        orderId: lastSuccessfulTransaction.orderId,
      }
    }

    return {
      currentPlan: {
        name: planName,
        slug: planSlug,
        price,
        currency,
        validityType,
      },
      status: subscription?.status || "free",
      isActive: Boolean(subscription?.isActive),
      autoRenew: Boolean(subscription?.autoRenew),
      cancelScheduled: Boolean(subscription?.cancelScheduled),
      cancelEffectiveAt: subscription?.cancelEffectiveAt || null,
      expiryDate: subscription?.expiresAt || null,
      nextBillingDate: subscription?.expiresAt || null,
      lastPayment,
      metrics: {
        totalSpent: Math.round(totalSpent * 100) / 100,
        formattedTotalSpent: formatCurrency(totalSpent, currency),
        totalTransactions,
        successfulPayments: successfulTransactions.length,
        invoiceCount,
      },
    }
  }
}

export const billingService = new BillingService()
export default billingService
