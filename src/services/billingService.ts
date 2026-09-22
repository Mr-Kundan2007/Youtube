import axiosInstance from "@/lib/axiosinstance"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_SERVER_URL || ""

const getAuthToken = (): string | null => {
  if (typeof window === "undefined") return null
  const localProfile = localStorage.getItem("profile")
  if (localProfile) {
    try {
      const parsed = JSON.parse(localProfile)
      if (parsed?.token) return parsed.token
    } catch {}
  }
  return localStorage.getItem("token")
}

const getHeaders = () => {
  const token = getAuthToken()
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export interface BillingSummaryData {
  currentPlan: {
    name: string
    slug: string
    price: number
    currency: string
    validityType: string
  }
  status: string
  isActive: boolean
  autoRenew: boolean
  cancelScheduled: boolean
  cancelEffectiveAt: string | null
  expiryDate: string | null
  nextBillingDate: string | null
  lastPayment: {
    transactionId: string
    amount: number
    currency: string
    formattedAmount: string
    paidAt: string
    invoiceNumber: string | null
    receiptNumber: string | null
    orderId: string
  } | null
  metrics: {
    totalSpent: number
    formattedTotalSpent: string
    totalTransactions: number
    successfulPayments: number
    invoiceCount: number
  }
}

export interface BillingTransactionItem {
  _id: string
  id: string
  transactionId: string
  orderId: string | null
  paymentId: string | null
  invoiceNumber: string | null
  receiptNumber: string | null
  amount: number
  currency: string
  planKey: string
  planName: string
  actionType: "new_subscription" | "upgrade" | "renew" | "downgrade"
  status: "success" | "successful" | "pending" | "failed" | "cancelled" | "verification_failed"
  paymentMethod: string
  paymentGateway: string
  billingCycle: string
  createdAt: string
  updatedAt: string
  paymentVerifiedAt: string | null
  hasInvoice: boolean
  hasReceipt: boolean
  invoice?: {
    invoiceId: string
    invoiceNumber: string
    status: string
    amount: number
    currency: string
    issuedAt: string
    downloadUrl: string
  } | null
  planDetails?: {
    name: string
    description: string
    rank: number
    features: Record<string, any>
  } | null
  receiptUrl?: string | null
}

export interface BillingHistoryQuery {
  page?: number
  limit?: number
  status?: string
  plan?: string
  dateRange?: string
  startDate?: string
  endDate?: string
  search?: string
  sortBy?: "date" | "amount" | "plan"
  sortOrder?: "asc" | "desc"
}

export interface BillingHistoryResponse {
  transactions: BillingTransactionItem[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
  filters: Record<string, any>
}

export interface InvoiceDetails {
  _id: string
  invoiceNumber: string
  userId: string
  transactionId: string
  planKey: string
  planName: string
  billingCycle: string
  amount: number
  amountPaid: number
  subtotal: number
  taxRatePercent: number
  taxAmount: number
  currency: string
  paymentGateway: string
  paymentId: string
  billingPeriodStart: string
  billingPeriodEnd: string
  customerName: string
  customerEmail: string
  status: string
  issuedAt: string
  createdAt: string
}

export interface PaymentReceiptDetails {
  receiptNumber: string
  transactionId: string
  orderId: string
  paymentId: string
  planKey: string
  planName: string
  amount: number
  currency: string
  paymentDate: string
  paymentStatus: string
  provider: string
  paymentMethod: string
  customerName: string
  customerEmail: string
}

export async function getBillingSummary(): Promise<BillingSummaryData> {
  const response = await axiosInstance.get(`${API_BASE_URL}/api/billing/summary`, {
    headers: getHeaders(),
  })
  return response.data?.data || response.data
}

export async function getBillingHistory(
  query: BillingHistoryQuery = {}
): Promise<BillingHistoryResponse> {
  const response = await axiosInstance.get(`${API_BASE_URL}/api/billing/history`, {
    headers: getHeaders(),
    params: query,
  })
  return (
    response.data?.data ||
    response.data || {
      transactions: [],
      pagination: { total: 0, page: 1, limit: 10, totalPages: 1 },
    }
  )
}

export async function getTransactionDetails(
  transactionId: string
): Promise<BillingTransactionItem> {
  const response = await axiosInstance.get(`${API_BASE_URL}/api/billing/transaction/${transactionId}`, {
    headers: getHeaders(),
  })
  return response.data?.data || response.data || null
}

export async function getUserInvoices(
  page = 1,
  limit = 10,
  search = "",
  status = ""
): Promise<{ invoices: InvoiceDetails[]; pagination: any }> {
  const response = await axiosInstance.get(`${API_BASE_URL}/api/invoices`, {
    headers: getHeaders(),
    params: { page, limit, search, status },
  })
  return (
    response.data?.data ||
    response.data || {
      invoices: [],
      pagination: { total: 0, page: 1, limit: 10, totalPages: 1 },
    }
  )
}

export async function getInvoiceDetails(invoiceId: string): Promise<InvoiceDetails> {
  const response = await axiosInstance.get(`${API_BASE_URL}/api/invoices/${invoiceId}`, {
    headers: getHeaders(),
  })
  return response.data?.data || response.data
}

export async function getReceiptDetails(
  transactionId: string
): Promise<PaymentReceiptDetails> {
  const response = await axiosInstance.get(`${API_BASE_URL}/api/receipts/${transactionId}`, {
    headers: getHeaders(),
  })
  return response.data?.data || response.data
}

/**
 * Downloads invoice PDF as an authenticated binary blob and triggers browser save.
 */
export async function downloadInvoicePdf(
  invoiceId: string,
  invoiceNumber: string
): Promise<void> {
  const token = getAuthToken()
  const response = await axiosInstance.get(
    `${API_BASE_URL}/api/invoices/${invoiceId}/download`,
    {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      responseType: "blob",
    }
  )

  const blob = new Blob([response.data], { type: "application/pdf" })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `Invoice-${invoiceNumber}.pdf`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

/**
 * Downloads payment receipt PDF as an authenticated binary blob and triggers browser save.
 */
export async function downloadReceiptPdf(
  transactionId: string,
  receiptNumber: string
): Promise<void> {
  const token = getAuthToken()
  const response = await axiosInstance.get(
    `${API_BASE_URL}/api/receipts/${transactionId}/download`,
    {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      responseType: "blob",
    }
  )

  const blob = new Blob([response.data], { type: "application/pdf" })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `Receipt-${receiptNumber}.pdf`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}
