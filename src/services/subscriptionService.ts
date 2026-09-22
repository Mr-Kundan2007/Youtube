/**
 * Frontend Subscription Service Client
 * Provides typed methods to interact with /api/subscriptions endpoints.
 */

export interface PlanFeatures {
  premiumVideoAccess: boolean
  premiumCourses: boolean
  priorityContent: boolean
  adFree: boolean
  offlineDownloads: boolean
  fastStreaming: boolean
  exclusiveContent: boolean
}

export interface PlanLimits {
  streamingQuality: "720p" | "1080p" | "1440p" | "4k"
  dailyWatchTime: number | null
  dailyUsageLimit: number | null
  dailyDownloadLimit: number
  maxDownloadQuality: "720p" | "1080p" | "1440p" | "4k"
  maxDevices: number
  maxConcurrentStreams: number
}

export type BillingCycleKey = "monthly" | "quarterly" | "yearly"

export interface BillingCyclePricing {
  cycle: BillingCycleKey
  price: number
  baseTotal: number
  monthlyEquivalent: number
  discountPercent: number
  savings: number
  durationMonths: number
  durationDays: number | null
  savingsText: string | null
}

export interface BillingCycleConfig {
  key: BillingCycleKey
  label: string
  durationMonths: number
  durationDays: number
  discountPercent: number
  badge: string | null
  savingsText: string | null
}

export interface SubscriptionPlan {
  _id: string
  id?: string
  name: string
  slug: "free" | "bronze" | "silver" | "gold"
  description: string
  price: number
  currency: string
  isActive: boolean
  isPopular: boolean
  displayOrder: number
  validityType: "monthly" | "quarterly" | "yearly" | "lifetime"
  validityDays: number | null
  rank?: number
  features: PlanFeatures
  limits: PlanLimits
  summaryBenefits?: string[]
  billingCycles?: {
    monthly: BillingCyclePricing
    quarterly: BillingCyclePricing
    yearly: BillingCyclePricing
  }
  createdAt?: string
  updatedAt?: string
}

export interface GetPlansResponse {
  plans: SubscriptionPlan[]
  billingCycles?: Record<BillingCycleKey, BillingCycleConfig>
}

/**
 * Formats a currency amount nicely (e.g. ₹499 or Free).
 */
export const formatPrice = (amount: number, currency = "INR"): string => {
  if (amount === 0) return "Free"
  if (currency === "INR") return `₹${amount.toLocaleString("en-IN")}`
  return `${currency} ${amount}`
}

/**
 * Returns the cycle pricing for a plan, falling back gracefully if not yet computed.
 */
export const getPlanCyclePricing = (
  plan: SubscriptionPlan,
  cycle: BillingCycleKey = "monthly"
): BillingCyclePricing => {
  if (plan.billingCycles && plan.billingCycles[cycle]) {
    return plan.billingCycles[cycle]
  }
  const numericPrice = Number(plan.price) || 0
  const months = cycle === "yearly" ? 12 : cycle === "quarterly" ? 3 : 1
  const discount = cycle === "yearly" ? 0.2 : cycle === "quarterly" ? 0.1 : 0
  const rawTotal = numericPrice * months
  const price = Math.round(rawTotal * (1 - discount))
  return {
    cycle,
    price,
    baseTotal: rawTotal,
    monthlyEquivalent: Math.round(price / months),
    discountPercent: discount * 100,
    savings: rawTotal - price,
    durationMonths: months,
    durationDays: cycle === "yearly" ? 365 : cycle === "quarterly" ? 90 : 30,
    savingsText: discount > 0 ? `Save ${discount * 100}%` : null,
  }
}


export interface CurrentSubscriptionDetails {
  subscriptionId: string
  userId: string
  currentPlan: {
    id: string
    name: string
    slug: string
    description: string
    price: number
    currency: string
    validityType: string
  }
  status: "active" | "pending" | "expired" | "cancelled" | "cancel_scheduled" | "grace_period" | "expiring_soon" | "suspended" | "payment_pending" | "payment_failed"
  isActive: boolean
  isExpired: boolean
  startDate: string
  expiryDate: string | null
  remainingDays: number | null
  nextRenewalDate: string | null
  autoRenew: boolean
  cancelAtPeriodEnd: boolean
  cancelScheduled?: boolean
  cancelEffectiveAt?: string | null
  cancellationReason?: string | null
  cancelledAt: string | null
  cancelReason: string | null
  gracePeriodActive?: boolean
  gracePeriodEnd?: string | null
  enabledFeatures: PlanFeatures
  usageLimits: PlanLimits
}

export interface SubscriptionHistoryItem {
  _id: string
  userId: string
  subscriptionId: string
  previousPlanId: { _id: string; name: string; slug: string; price: number } | null
  newPlanId: { _id: string; name: string; slug: string; price: number }
  action: string
  reason: string
  performedAt: string
  metadata?: Record<string, any>
}

export interface FeaturePermissionsResponse {
  userId: string
  plan: string
  planName: string
  status: string
  isActive: boolean
  features: PlanFeatures
  limits: PlanLimits
}

export interface ApiResponse<T> {
  success: boolean
  message?: string
  data: T
  error?: {
    code: string
    message: string
    details?: any
  }
}

const getAuthHeaders = (): HeadersInit => {
  if (typeof window === "undefined") return { "Content-Type": "application/json" }
  const token = localStorage.getItem("token") || ""
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

/**
 * Fetches all active subscription plans along with supported billing cycles.
 */
export const getSubscriptionPlansAndCycles = async (): Promise<GetPlansResponse> => {
  const res = await fetch("/api/subscriptions/plans")
  const json: ApiResponse<GetPlansResponse> = await res.json()
  if (!json.success || !json.data?.plans) {
    throw new Error(json.error?.message || json.message || "Failed to fetch subscription plans")
  }
  return json.data
}

/**
 * Fetches all active subscription plans.
 */
export const getSubscriptionPlans = async (): Promise<SubscriptionPlan[]> => {
  const data = await getSubscriptionPlansAndCycles()
  return data.plans
}


/**
 * Fetches specific subscription plan details by ID or slug.
 */
export const getPlanDetails = async (planId: string): Promise<SubscriptionPlan> => {
  const res = await fetch(`/api/subscriptions/plans/${encodeURIComponent(planId)}`)
  const json: ApiResponse<{ plan: SubscriptionPlan }> = await res.json()
  if (!json.success || !json.data?.plan) {
    throw new Error(json.error?.message || json.message || "Failed to fetch plan details")
  }
  return json.data.plan
}

/**
 * Fetches the authenticated user's current subscription details, status, features, and limits.
 */
export const getCurrentSubscription = async (): Promise<CurrentSubscriptionDetails> => {
  const res = await fetch("/api/subscriptions/current", {
    headers: getAuthHeaders(),
  })
  const json: ApiResponse<CurrentSubscriptionDetails> = await res.json()
  if (!json.success || !json.data) {
    throw new Error(json.error?.message || json.message || "Failed to fetch current subscription")
  }
  return json.data
}

/**
 * Fetches the authenticated user's chronological subscription lifecycle history.
 */
export const getSubscriptionHistory = async (): Promise<SubscriptionHistoryItem[]> => {
  const res = await fetch("/api/subscriptions/history", {
    headers: getAuthHeaders(),
  })
  const json: ApiResponse<{ history: SubscriptionHistoryItem[] }> = await res.json()
  if (!json.success || !json.data?.history) {
    throw new Error(json.error?.message || json.message || "Failed to fetch subscription history")
  }
  return json.data.history
}

/**
 * Fetches resolved feature permissions and capability flags for the current user.
 */
export const getAvailableFeatures = async (): Promise<FeaturePermissionsResponse> => {
  const res = await fetch("/api/subscriptions/features", {
    headers: getAuthHeaders(),
  })
  const json: ApiResponse<FeaturePermissionsResponse> = await res.json()
  if (!json.success || !json.data) {
    throw new Error(json.error?.message || json.message || "Failed to fetch feature permissions")
  }
  return json.data
}

export interface SubscriptionUsageData {
  date: string
  watchTimeSeconds: number
  watchTimeMinutes: number
  dailyWatchTimeLimitMinutes: number | null
  remainingWatchTimeMinutes: number | null
  downloadCount: number
  streamCount: number
}

/**
 * Fetches the authenticated user's current daily usage metrics and allowances.
 */
export const getSubscriptionUsage = async (): Promise<SubscriptionUsageData> => {
  const res = await fetch("/api/subscriptions/usage", {
    headers: getAuthHeaders(),
  })
  const json: ApiResponse<SubscriptionUsageData> = await res.json()
  if (!json.success || !json.data) {
    throw new Error(json.error?.message || json.message || "Failed to fetch subscription usage")
  }
  return json.data
}

export interface AppNotification {
  _id: string
  type: string
  title: string
  message: string
  actionUrl?: string | null
  status?: string
  read: boolean
  createdAt: string
  metadata?: Record<string, any>
}

/**
 * Schedules cancellation of the user's active paid subscription.
 */
export const cancelSubscription = async (reason?: string): Promise<{ success: boolean; message: string; cancelEffectiveAt: string }> => {
  const res = await fetch("/api/subscriptions/cancel", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ reason }),
  })
  const json = await res.json()
  if (!json.success) {
    throw new Error(json.error?.message || json.message || "Failed to cancel subscription")
  }
  return json.data
}

/**
 * Reverses a scheduled subscription cancellation before it reaches expiry.
 */
export const restoreCancellation = async (): Promise<{ success: boolean; message: string }> => {
  const res = await fetch("/api/subscriptions/restore-cancellation", {
    method: "POST",
    headers: getAuthHeaders(),
  })
  const json = await res.json()
  if (!json.success) {
    throw new Error(json.error?.message || json.message || "Failed to restore subscription")
  }
  return json.data
}

/**
 * Fetches user notifications.
 */
export const getUserNotifications = async (): Promise<AppNotification[]> => {
  const res = await fetch("/api/notifications", {
    headers: getAuthHeaders(),
  })
  const json = await res.json()
  if (!json.success || !json.data) {
    return []
  }
  return Array.isArray(json.data) ? json.data : json.data.notifications || []
}

/**
 * Marks a single notification as read.
 */
export const markNotificationRead = async (id: string): Promise<boolean> => {
  const res = await fetch(`/api/notifications/${encodeURIComponent(id)}/read`, {
    method: "PATCH",
    headers: getAuthHeaders(),
  })
  const json = await res.json()
  return Boolean(json.success)
}

/**
 * Marks all notifications as read.
 */
export const markAllNotificationsRead = async (): Promise<boolean> => {
  const res = await fetch("/api/notifications/read-all", {
    method: "PATCH",
    headers: getAuthHeaders(),
  })
  const json = await res.json()
  return Boolean(json.success)
}

export interface PlanChangeResponse {
  action: string
  currentPlan: string
  targetPlan: string
  requiresPayment: boolean
  effectiveDate?: string
  message: string
}

/**
 * Requests a plan change (such as scheduling a downgrade to Free or another plan).
 */
export const changeSubscriptionPlan = async (targetPlanKey: string): Promise<PlanChangeResponse> => {
  const res = await fetch("/api/subscriptions/change-plan", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ targetPlanKey, plan: targetPlanKey }),
  })
  const json = await res.json()
  if (!json.success) {
    throw new Error(json.error?.message || json.message || "Failed to change subscription plan")
  }
  return json.data
}

export default {
  getSubscriptionPlans,
  getSubscriptionPlansAndCycles,
  getPlanDetails,
  getCurrentSubscription,
  getSubscriptionHistory,
  getAvailableFeatures,
  getSubscriptionUsage,
  cancelSubscription,
  restoreCancellation,
  changeSubscriptionPlan,
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  formatPrice,
  getPlanCyclePricing,
}


