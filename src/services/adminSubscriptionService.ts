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

// -------------------------------------------------------------
// Type Definitions
// -------------------------------------------------------------

export interface SubscriptionKPIs {
  subscribers: {
    totalUsers: number
    freeSubscribers: number
    paidSubscribers: number
    activeSubscriptions: number
    expiredSubscriptions: number
    cancelScheduled: number
    suspendedSubscriptions: number
    plans: {
      free: number
      bronze: number
      silver: number
      gold: number
    }
  }
  distribution: Array<{
    plan: string
    count: number
    percentage: number
  }>
  revenue: {
    today: number
    monthly: number
    quarterly: number
    yearly: number
    lifetime: number
    transactionCount: number
    currency: string
    byPlan: Array<{
      plan: string
      revenue: number
      percentage: number
      transactions: number
    }>
  }
  growth: {
    periodDays: number
    newSubscriptions: number
    renewals: number
    cancellations: number
    expired: number
    netSubscriberChange: number
  }
  popularity: {
    mostPopularPlan: { plan: string; subscribers: number }
    highestRevenuePlan: { plan: string; revenue: number }
    fastestGrowingPlan: { plan: string; trend: string }
  }
  rates: {
    conversionRate: number
    renewalRate: number
    cancellationRate: number
    arpu: number
    arppu: number
    currency: string
  }
  paymentHealth: {
    successRate: number
    failureRate: number
    totalAttempts: number
    successfulPayments: number
    failedPayments: number
  }
  alerts: Array<{
    type: "warning" | "error" | "info" | "success"
    code: string
    title: string
    message: string
    count?: number
  }>
}

export interface RevenueTrendsData {
  period: "daily" | "monthly" | "yearly"
  currency: string
  data: Array<{
    date: string
    label: string
    revenue: number
    transactions: number
  }>
  summary: {
    totalRevenue: number
    totalTransactions: number
    averageTransactionValue: number
  }
}

export interface SubscriberListItem {
  _id: string
  userId: string
  name: string
  email: string
  image?: string
  plan: string
  status: string
  billingCycle: string
  startDate: string
  endDate: string | null
  expiresAt: string | null
  daysRemaining: number | null
  autoRenew: boolean
  isExpiringSoon: boolean
}

export interface SubscriberListResponse {
  subscribers: SubscriberListItem[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
  filters: {
    plan: string
    status: string
    search: string
    expiringWithinDays: string
  }
}

export interface SubscriberProfileDetail {
  user: {
    id: string
    name: string
    email: string
    image?: string
    joinedOn: string
  }
  subscription: {
    _id?: string
    plan: string
    status: string
    billingCycle?: string
    startDate?: string
    endDate?: string | null
    expiresAt?: string | null
    autoRenew?: boolean
    cancellationReason?: string
    cancelledAt?: string
    daysRemaining?: number | null
  }
  history: Array<{
    _id: string
    action: string
    reason?: string
    performedAt: string
    metadata?: Record<string, any>
  }>
  transactions: Array<{
    _id: string
    transactionId: string
    orderId: string
    planKey: string
    amount: number
    currency: string
    status: string
    paymentMethod: string
    createdAt: string
  }>
  invoices: Array<{
    _id: string
    invoiceNumber: string
    amount: number
    currency: string
    status: string
    createdAt: string
    pdfUrl?: string
  }>
  auditLogs: Array<{
    _id: string
    adminId?: { name: string; email: string }
    action: string
    reason: string
    previousValue?: any
    newValue?: any
    timestamp: string
  }>
}

export interface SubscriptionPlanItem {
  _id: string
  name: string
  slug: string
  description: string
  price: number
  currency: string
  isActive: boolean
  isPopular: boolean
  displayOrder: number
  validityType: string
  validityDays: number
  features: {
    premiumVideoAccess: boolean
    premiumCourses: boolean
    priorityContent: boolean
    adFree: boolean
    offlineDownloads: boolean
    fastStreaming: boolean
    exclusiveContent: boolean
  }
  limits: {
    streamingQuality: string
    dailyWatchTime: number | null
    dailyUsageLimit: number | null
    dailyDownloadLimit: number
    maxDownloadQuality: string
    maxDevices: number
    maxConcurrentStreams: number
  }
  stats?: {
    activeSubscribers: number
    totalSubscribers: number
    cancelledSubscribers: number
    totalRevenue: number
    transactionsCount: number
  }
}

export interface AdminPaymentItem {
  _id: string
  transactionId: string
  orderId: string
  user: {
    id: string
    name: string
    email: string
  }
  plan: string
  amount: number
  currency: string
  status: string
  paymentMethod: string
  createdAt: string
}

export interface ReportResponseData {
  reportType: "revenue" | "subscribers" | "plans"
  generatedAt: string
  summary: Record<string, any>
  rows: any[]
  csv?: string
}

// -------------------------------------------------------------
// Service Methods
// -------------------------------------------------------------

export const adminSubscriptionService = {
  /**
   * Get KPI analytics overview and revenue stats
   */
  async getAnalyticsOverview(): Promise<SubscriptionKPIs> {
    const res = await axiosInstance.get(`${API_BASE_URL}/api/admin/subscriptions/analytics/overview`, {
      headers: getHeaders(),
    })
    const kpis = res.data?.data?.kpis || {}
    const rev = res.data?.data?.revenue || {}
    return {
      ...kpis,
      revenue: rev,
    }
  },

  /**
   * Get revenue time-series trends (daily, monthly, yearly)
   */
  async getRevenueTrends(period: "daily" | "monthly" | "yearly" = "monthly"): Promise<RevenueTrendsData> {
    const res = await axiosInstance.get(`${API_BASE_URL}/api/admin/subscriptions/analytics/revenue-trends?period=${period}`, {
      headers: getHeaders(),
    })
    return res.data?.data
  },

  /**
   * List subscribers with pagination and search/filters
   */
  async getSubscribers(params: {
    page?: number
    limit?: number
    search?: string
    plan?: string
    status?: string
    expiringWithinDays?: string
    sortBy?: string
    sortOrder?: string
  } = {}): Promise<SubscriberListResponse> {
    const query = new URLSearchParams()
    if (params.page) query.append("page", String(params.page))
    if (params.limit) query.append("limit", String(params.limit))
    if (params.search) query.append("search", params.search)
    if (params.plan) query.append("plan", params.plan)
    if (params.status) query.append("status", params.status)
    if (params.expiringWithinDays) query.append("expiringWithinDays", params.expiringWithinDays)
    if (params.sortBy) query.append("sortBy", params.sortBy)
    if (params.sortOrder) query.append("sortOrder", params.sortOrder)

    const res = await axiosInstance.get(`${API_BASE_URL}/api/admin/subscriptions/subscribers?${query.toString()}`, {
      headers: getHeaders(),
    })
    return (
      res.data?.data ||
      res.data || {
        subscribers: [],
        pagination: { total: 0, page: 1, limit: 10, totalPages: 1 },
      }
    )
  },

  /**
   * Fetch 360-degree subscriber profile
   */
  async getSubscriberProfile(userId: string): Promise<SubscriberProfileDetail> {
    const res = await axiosInstance.get(`${API_BASE_URL}/api/admin/subscriptions/subscribers/${userId}`, {
      headers: getHeaders(),
    })
    return res.data?.data
  },

  /**
   * Admin action: Extend validity of subscriber
   */
  async extendSubscriptionValidity(userId: string, additionalDays: number, reason: string): Promise<any> {
    const res = await axiosInstance.post(
      `${API_BASE_URL}/api/admin/subscriptions/subscribers/${userId}/extend`,
      { additionalDays, reason },
      { headers: getHeaders() }
    )
    return res.data
  },

  /**
   * Admin action: Suspend active subscription
   */
  async suspendSubscription(userId: string, reason: string): Promise<any> {
    const res = await axiosInstance.post(
      `${API_BASE_URL}/api/admin/subscriptions/subscribers/${userId}/suspend`,
      { reason },
      { headers: getHeaders() }
    )
    return res.data
  },

  /**
   * Admin action: Restore suspended subscription
   */
  async restoreSubscription(userId: string, reason: string): Promise<any> {
    const res = await axiosInstance.post(
      `${API_BASE_URL}/api/admin/subscriptions/subscribers/${userId}/restore`,
      { reason },
      { headers: getHeaders() }
    )
    return res.data
  },

  /**
   * Admin action: Move subscription to Free tier
   */
  async moveToFreeTier(userId: string, reason: string): Promise<any> {
    const res = await axiosInstance.post(
      `${API_BASE_URL}/api/admin/subscriptions/subscribers/${userId}/move-to-free`,
      { reason },
      { headers: getHeaders() }
    )
    return res.data
  },

  /**
   * Get all subscription plans with usage metrics
   */
  async getPlans(): Promise<SubscriptionPlanItem[]> {
    const res = await axiosInstance.get(`${API_BASE_URL}/api/admin/subscriptions/plans`, {
      headers: getHeaders(),
    })
    return res.data?.data || []
  },

  /**
   * Update plan details, pricing, features, or limits
   */
  async updatePlan(planId: string, updates: Partial<SubscriptionPlanItem>, reason: string): Promise<SubscriptionPlanItem> {
    const res = await axiosInstance.put(
      `${API_BASE_URL}/api/admin/subscriptions/plans/${planId}`,
      { updates, reason },
      { headers: getHeaders() }
    )
    return res.data?.data
  },

  /**
   * Toggle plan active/inactive status
   */
  async togglePlanStatus(planId: string, isActive: boolean, reason: string): Promise<SubscriptionPlanItem> {
    const res = await axiosInstance.patch(
      `${API_BASE_URL}/api/admin/subscriptions/plans/${planId}/toggle-status`,
      { isActive, reason },
      { headers: getHeaders() }
    )
    return res.data?.data
  },

  /**
   * Get live payments list for transaction oversight
   */
  async getPaymentsList(params: {
    page?: number
    limit?: number
    search?: string
    status?: string
    plan?: string
    from?: string
    to?: string
  } = {}): Promise<{ payments: AdminPaymentItem[]; pagination: { total: number; page: number; limit: number; totalPages: number } }> {
    const query = new URLSearchParams()
    if (params.page) query.append("page", String(params.page))
    if (params.limit) query.append("limit", String(params.limit))
    if (params.search) query.append("search", params.search)
    if (params.status) query.append("status", params.status)
    if (params.plan) query.append("plan", params.plan)
    if (params.from) query.append("from", params.from)
    if (params.to) query.append("to", params.to)

    const res = await axiosInstance.get(`${API_BASE_URL}/api/admin/subscriptions/payments?${query.toString()}`, {
      headers: getHeaders(),
    })
    return (
      res.data?.data ||
      res.data || {
        payments: [],
        pagination: { total: 0, page: 1, limit: 10, totalPages: 1 },
      }
    )
  },

  /**
   * Get report JSON data
   */
  async getReport(params: {
    type: "revenue" | "subscribers" | "plans"
    from?: string
    to?: string
    plan?: string
    status?: string
  }): Promise<ReportResponseData> {
    const query = new URLSearchParams()
    query.append("type", params.type)
    if (params.from) query.append("from", params.from)
    if (params.to) query.append("to", params.to)
    if (params.plan) query.append("plan", params.plan)
    if (params.status) query.append("status", params.status)

    const res = await axiosInstance.get(`${API_BASE_URL}/api/admin/subscriptions/reports?${query.toString()}`, {
      headers: getHeaders(),
    })
    return res.data?.data || null
  },

  /**
   * Download report as RFC 4180 CSV file directly in browser
   */
  async downloadReportCsv(
    type: "revenue" | "subscribers" | "plans",
    filters: { from?: string; to?: string; plan?: string; status?: string } = {}
  ): Promise<void> {
    const query = new URLSearchParams()
    query.append("type", type)
    if (filters.from) query.append("from", filters.from)
    if (filters.to) query.append("to", filters.to)
    if (filters.plan) query.append("plan", filters.plan)
    if (filters.status) query.append("status", filters.status)

    const res = await axiosInstance.get(`${API_BASE_URL}/api/admin/subscriptions/reports/export-csv?${query.toString()}`, {
      headers: getHeaders(),
      responseType: "blob",
    })

    const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", `subscription-${type}-report-${Date.now()}.csv`)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  },

  /**
   * Get administrative audit logs
   */
  async getAuditLogs(params: {
    page?: number
    limit?: number
    userId?: string
    action?: string
  } = {}): Promise<{ logs: any[]; pagination: any }> {
    const query = new URLSearchParams()
    if (params.page) query.append("page", String(params.page))
    if (params.limit) query.append("limit", String(params.limit))
    if (params.userId) query.append("userId", params.userId)
    if (params.action) query.append("action", params.action)

    const res = await axiosInstance.get(`${API_BASE_URL}/api/admin/subscriptions/audit-logs?${query.toString()}`, {
      headers: getHeaders(),
    })
    return (
      res.data?.data ||
      res.data || {
        logs: [],
        pagination: { total: 0, page: 1, limit: 10, totalPages: 1 },
      }
    )
  },
}

export default adminSubscriptionService
