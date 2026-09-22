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

export type SecuritySeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
export type SecurityEventStatus = "OPEN" | "REVIEWED" | "RESOLVED" | "IGNORED"

export interface SecurityEventItem {
  _id: string
  eventType: string
  severity: SecuritySeverity
  status: SecurityEventStatus
  riskScore: number
  userId?: string | null
  relatedTransactionId?: string | null
  orderId?: string | null
  ipHash?: string | null
  userAgent?: string | null
  requestId?: string | null
  adminNotes?: string | null
  reviewedBy?: {
    _id: string
    name: string
    email: string
    role: string
  } | null
  reviewedAt?: string | null
  safeMetadata?: Record<string, any>
  createdAt: string
  updatedAt: string
}

export interface SecuritySummary {
  totalEventsToday: number
  openCriticalReviews: number
  rateLimitTriggersToday: number
  paymentAnomaliesToday: number
  severityDistribution: {
    LOW: number
    MEDIUM: number
    HIGH: number
    CRITICAL: number
  }
  jobs: {
    overallStatus: "HEALTHY" | "WARNING" | "DEGRADED"
    totalJobs: number
    healthyCount: number
    degradedCount: number
    failedCount: number
    checkedAt: string
    jobs: Array<{
      jobName: string
      isLocked: boolean
      lockedAt?: string | null
      lockedBy?: string | null
      lockExpiresAt?: string | null
      lastRunAt?: string | null
      lastCompletedAt?: string | null
      lastStatus: string
      lastError?: string | null
      consecutiveFailures: number
      health: string
      stats?: Record<string, any>
    }>
  }
  recentAlerts: Array<{
    alertId: string
    alertType: string
    title: string
    message: string
    severity: SecuritySeverity
    metadata: Record<string, any>
    dispatchedAt: string
  }>
  generatedAt: string
}

export interface SecurityEventQueryParams {
  page?: number
  limit?: number
  severity?: SecuritySeverity | ""
  eventType?: string
  status?: SecurityEventStatus | ""
  userId?: string
  orderId?: string
  startDate?: string
  endDate?: string
}

export interface SecurityEventsResponse {
  events: SecurityEventItem[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export interface SecurityEventDetailResponse {
  event: SecurityEventItem
  userContext?: {
    _id: string
    name: string
    email: string
    role: string
    createdAt: string
  } | null
  transactionContext?: {
    _id: string
    internalTransactionId: string
    orderId: string
    paymentId?: string
    amount: number
    currency: string
    status: string
    planKey: string
    billingCycle: string
    createdAt: string
  } | null
  subscriptionContext?: {
    _id: string
    plan: string
    status: string
    startDate: string
    expiresAt?: string
  } | null
}

// -------------------------------------------------------------
// API Client Service
// -------------------------------------------------------------

export const adminSecurityService = {
  /**
   * Fetches high-level security overview and risk distributions.
   */
  async getSummary(): Promise<SecuritySummary> {
    const res = await axiosInstance.get(`${API_BASE_URL}/api/security/summary`, {
      headers: getHeaders(),
    })
    return (
      res.data?.data ||
      res.data || {
        totalEvents: 0,
        criticalCount: 0,
        highCount: 0,
        openEvents: 0,
        avgRiskScore: 0,
        jobs: { running: 0, failed: 0, locked: 0 },
      }
    )
  },

  /**
   * Fetches filterable and paginated security event stream.
   */
  async getEvents(params: SecurityEventQueryParams = {}): Promise<SecurityEventsResponse> {
    const res = await axiosInstance.get(`${API_BASE_URL}/api/security/events`, {
      headers: getHeaders(),
      params,
    })
    return (
      res.data?.data ||
      res.data || {
        events: [],
        pagination: { total: 0, page: 1, limit: 10, totalPages: 1 },
      }
    )
  },

  /**
   * Fetches full audit details for a specific security event.
   */
  async getEventById(eventId: string): Promise<SecurityEventDetailResponse> {
    const res = await axiosInstance.get(`${API_BASE_URL}/api/security/events/${eventId}`, {
      headers: getHeaders(),
    })
    return res.data?.data || res.data
  },

  /**
   * Reviews and marks an event with mandatory admin resolution notes.
   */
  async reviewEvent(
    eventId: string,
    payload: { status: "REVIEWED" | "RESOLVED" | "IGNORED"; adminNotes: string }
  ): Promise<SecurityEventItem> {
    const res = await axiosInstance.patch(
      `${API_BASE_URL}/api/security/events/${eventId}/review`,
      payload,
      { headers: getHeaders() }
    )
    return res.data?.data || res.data
  },

  /**
   * Fetches background job telemetry and health status.
   */
  async getJobHealth(): Promise<SecuritySummary["jobs"]> {
    const res = await axiosInstance.get(`${API_BASE_URL}/api/security/jobs`, {
      headers: getHeaders(),
    })
    return res.data?.data || res.data
  },

  /**
   * Triggers manual cleanup of orphaned or stale job locks.
   */
  async cleanStaleLocks(maxAgeMinutes: number = 30): Promise<{ clearedCount: number }> {
    const res = await axiosInstance.post(
      `${API_BASE_URL}/api/security/jobs/clean-locks`,
      { maxAgeMinutes },
      { headers: getHeaders() }
    )
    return res.data?.data || res.data
  },

  /**
   * Runs an on-demand telemetry anomaly scan.
   */
  async runAnomalyScan(): Promise<any> {
    const res = await axiosInstance.get(`${API_BASE_URL}/api/security/anomalies/scan`, {
      headers: getHeaders(),
    })
    return res.data?.data || res.data
  },
}

export default adminSecurityService
