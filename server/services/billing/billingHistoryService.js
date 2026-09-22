import PaymentTransaction from "../../Modals/PaymentTransaction.js"
import Invoice from "../../Modals/Invoice.js"
import { getSubscriptionPlan } from "../../config/subscriptionPlans.js"
import { ApiError } from "../../utils/apiError.js"
import { sanitizeTransactionForClient } from "./billingUtils.js"

export class BillingHistoryService {
  /**
   * Retrieves paginated, searchable, filterable transaction history for an authenticated user.
   */
  async getBillingHistory(
    userId,
    {
      page = 1,
      limit = 10,
      status = "all",
      plan = "all",
      dateRange = "all",
      startDate = null,
      endDate = null,
      search = "",
      sortBy = "date",
      sortOrder = "desc",
    } = {}
  ) {
    const p = Math.max(1, Number(page) || 1)
    const lim = Math.max(1, Math.min(50, Number(limit) || 10))
    const skip = (p - 1) * lim

    const query = { userId }

    // Status filter
    if (status && status !== "all") {
      if (status === "success") {
        query.status = { $in: ["success", "successful"] }
      } else if (status === "failed") {
        query.status = { $in: ["failed", "verification_failed"] }
      } else {
        query.status = status.toLowerCase()
      }
    }

    // Plan filter
    if (plan && plan !== "all") {
      query.planKey = plan.toLowerCase()
    }

    // Date range filter
    const now = new Date()
    if (dateRange && dateRange !== "all") {
      let days = 0
      if (dateRange === "30d" || dateRange === "last_30_days") days = 30
      else if (dateRange === "90d" || dateRange === "last_3_months") days = 90
      else if (dateRange === "1y" || dateRange === "last_year") days = 365

      if (days > 0) {
        const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
        query.createdAt = { $gte: cutoff }
      }
    } else if (startDate || endDate) {
      query.createdAt = {}
      if (startDate) query.createdAt.$gte = new Date(startDate)
      if (endDate) query.createdAt.$lte = new Date(endDate)
    }

    // Search filter
    if (search && String(search).trim().length > 0) {
      const term = String(search).trim()
      query.$or = [
        { orderId: { $regex: term, $options: "i" } },
        { paymentId: { $regex: term, $options: "i" } },
        { invoiceNumber: { $regex: term, $options: "i" } },
        { planKey: { $regex: term, $options: "i" } },
        { internalTransactionId: { $regex: term, $options: "i" } },
      ]
    }

    // Sorting
    const sort = {}
    const dir = sortOrder === "asc" ? 1 : -1
    if (sortBy === "amount") {
      sort.amount = dir
    } else if (sortBy === "plan") {
      sort.planKey = dir
    } else {
      sort.createdAt = dir
    }

    const [transactions, total] = await Promise.all([
      PaymentTransaction.find(query).sort(sort).skip(skip).limit(lim).lean(),
      PaymentTransaction.countDocuments(query),
    ])

    const sanitized = transactions.map(sanitizeTransactionForClient)

    return {
      transactions: sanitized,
      pagination: {
        page: p,
        limit: lim,
        total,
        totalPages: Math.ceil(total / lim) || 1,
        hasNext: p * lim < total,
        hasPrev: p > 1,
      },
      filters: {
        status,
        plan,
        dateRange,
        search,
        sortBy,
        sortOrder,
      },
    }
  }

  /**
   * Retrieves single transaction details with associated invoice reference.
   * Gated strictly by user ownership.
   */
  async getTransactionDetails(transactionId, userId, isAdmin = false) {
    const transaction = await PaymentTransaction.findById(transactionId).lean()
    if (!transaction) {
      throw ApiError.notFound("TRANSACTION_NOT_FOUND", "Transaction record not found")
    }

    if (!isAdmin && String(transaction.userId) !== String(userId)) {
      throw ApiError.forbidden(
        "FORBIDDEN",
        "You do not have permission to view this transaction"
      )
    }

    const sanitized = sanitizeTransactionForClient(transaction)

    // Lookup associated invoice if any
    let invoiceInfo = null
    const invoice = await Invoice.findOne({ transactionId: transaction._id }).lean()
    if (invoice) {
      invoiceInfo = {
        invoiceId: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        amount: invoice.amount,
        currency: invoice.currency,
        issuedAt: invoice.createdAt || invoice.issuedAt,
        downloadUrl: `/api/invoices/${invoice._id}/download`,
      }
    }

    const plan = getSubscriptionPlan(transaction.planKey)

    return {
      ...sanitized,
      invoice: invoiceInfo,
      planDetails: plan
        ? {
            name: plan.name,
            description: plan.description,
            rank: plan.rank,
            features: plan.features,
          }
        : null,
      orderCreatedAt: transaction.orderCreatedAt || transaction.createdAt,
      receiptUrl:
        sanitized.hasReceipt ? `/api/receipts/${transaction._id}/download` : null,
    }
  }
}

export const billingHistoryService = new BillingHistoryService()
export default billingHistoryService
