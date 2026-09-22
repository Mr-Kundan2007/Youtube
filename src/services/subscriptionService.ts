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

const API_BASE_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5001"

const resolveUrl = (path: string): string => {
  if (path.startsWith("http://") || path.startsWith("https://")) return path
  if (typeof window !== "undefined" && API_BASE_URL && API_BASE_URL.startsWith("http")) {
    return `${API_BASE_URL.replace(/\/$/, "")}/${path.replace(/^\//, "")}`
  }
  return path
}

const getAuthHeaders = (): HeadersInit => {
  if (typeof window === "undefined") return { "Content-Type": "application/json" }
  let token = localStorage.getItem("token") || ""
  if (!token) {
    const localProfile = localStorage.getItem("Profile") || localStorage.getItem("profile")
    if (localProfile) {
      try {
        const parsed = JSON.parse(localProfile)
        if (parsed?.token) token = parsed.token
      } catch {}
    }
  }
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

const safeFetchJson = async <T>(path: string, options?: RequestInit): Promise<ApiResponse<T>> => {
  const url = resolveUrl(path)
  let res: Response
  try {
    res = await fetch(url, options)
  } catch (netErr: any) {
    if (url !== path) {
      try {
        res = await fetch(path, options)
      } catch {
        throw new Error(netErr.message || "Network request failed")
      }
    } else {
      throw new Error(netErr.message || "Network request failed")
    }
  }

  const contentType = res.headers.get("content-type") || ""
  if (!contentType.includes("application/json")) {
    const text = await res.text().catch(() => "")
    const cleanText = text.replace(/<[^>]*>?/gm, " ").replace(/\s+/g, " ").trim().slice(0, 100)
    throw new Error(cleanText || `Server returned non-JSON response (${res.status})`)
  }

  return res.json()
}

export const DEFAULT_STATIC_PLANS: SubscriptionPlan[] = [
  {
    _id: "static-plan-free",
    id: "static-plan-free",
    name: "Free",
    slug: "free",
    description: "Basic streaming and learning access with 1 daily download",
    price: 0,
    currency: "INR",
    isActive: true,
    isPopular: false,
    displayOrder: 1,
    validityType: "lifetime",
    validityDays: null,
    rank: 1,
    features: {
      premiumVideoAccess: false,
      premiumCourses: false,
      priorityContent: false,
      adFree: false,
      offlineDownloads: false,
      fastStreaming: false,
      exclusiveContent: false,
    },
    limits: {
      streamingQuality: "720p",
      dailyWatchTime: 120,
      dailyUsageLimit: 1000,
      dailyDownloadLimit: 1,
      maxDownloadQuality: "720p",
      maxDevices: 1,
      maxConcurrentStreams: 1,
    },
    billingCycles: {
      monthly: {
        cycle: "monthly",
        price: 0,
        baseTotal: 0,
        monthlyEquivalent: 0,
        discountPercent: 0,
        savings: 0,
        durationMonths: 1,
        durationDays: null,
        savingsText: null,
      },
      quarterly: {
        cycle: "quarterly",
        price: 0,
        baseTotal: 0,
        monthlyEquivalent: 0,
        discountPercent: 0,
        savings: 0,
        durationMonths: 3,
        durationDays: null,
        savingsText: null,
      },
      yearly: {
        cycle: "yearly",
        price: 0,
        baseTotal: 0,
        monthlyEquivalent: 0,
        discountPercent: 0,
        savings: 0,
        durationMonths: 12,
        durationDays: null,
        savingsText: null,
      },
    },
    summaryBenefits: [
      "Standard public video access",
      "Standard 720p HD streaming",
      "1 daily offline video download",
      "Single active device stream",
    ],
  },
  {
    _id: "static-plan-bronze",
    id: "static-plan-bronze",
    name: "Bronze",
    slug: "bronze",
    description: "Enhanced HD streaming with 5 downloads/day and standard ad experience",
    price: 199,
    currency: "INR",
    isActive: true,
    isPopular: false,
    displayOrder: 2,
    validityType: "monthly",
    validityDays: 30,
    rank: 2,
    features: {
      premiumVideoAccess: true,
      premiumCourses: false,
      priorityContent: false,
      adFree: false,
      offlineDownloads: true,
      fastStreaming: false,
      exclusiveContent: false,
    },
    limits: {
      streamingQuality: "1080p",
      dailyWatchTime: null,
      dailyUsageLimit: null,
      dailyDownloadLimit: 5,
      maxDownloadQuality: "1080p",
      maxDevices: 2,
      maxConcurrentStreams: 2,
    },
    billingCycles: {
      monthly: {
        cycle: "monthly",
        price: 199,
        baseTotal: 199,
        monthlyEquivalent: 199,
        discountPercent: 0,
        savings: 0,
        durationMonths: 1,
        durationDays: 30,
        savingsText: null,
      },
      quarterly: {
        cycle: "quarterly",
        price: 537,
        baseTotal: 597,
        monthlyEquivalent: 179,
        discountPercent: 10,
        savings: 60,
        durationMonths: 3,
        durationDays: 90,
        savingsText: "Save 10%",
      },
      yearly: {
        cycle: "yearly",
        price: 1910,
        baseTotal: 2388,
        monthlyEquivalent: 159,
        discountPercent: 20,
        savings: 478,
        durationMonths: 12,
        durationDays: 365,
        savingsText: "Save 20%",
      },
    },
    summaryBenefits: [
      "Premium video library access",
      "Crisp 1080p Full HD streaming",
      "5 daily offline video downloads",
      "2 registered devices",
    ],
  },
  {
    _id: "static-plan-silver",
    id: "static-plan-silver",
    name: "Silver",
    slug: "silver",
    description: "Full HD 2K streaming, Ad-free playback, premium courses and 15 downloads/day",
    price: 499,
    currency: "INR",
    isActive: true,
    isPopular: true,
    displayOrder: 3,
    validityType: "monthly",
    validityDays: 30,
    rank: 3,
    features: {
      premiumVideoAccess: true,
      premiumCourses: true,
      priorityContent: true,
      adFree: true,
      offlineDownloads: true,
      fastStreaming: true,
      exclusiveContent: false,
    },
    limits: {
      streamingQuality: "1440p",
      dailyWatchTime: null,
      dailyUsageLimit: null,
      dailyDownloadLimit: 15,
      maxDownloadQuality: "1080p",
      maxDevices: 5,
      maxConcurrentStreams: 3,
    },
    billingCycles: {
      monthly: {
        cycle: "monthly",
        price: 499,
        baseTotal: 499,
        monthlyEquivalent: 499,
        discountPercent: 0,
        savings: 0,
        durationMonths: 1,
        durationDays: 30,
        savingsText: null,
      },
      quarterly: {
        cycle: "quarterly",
        price: 1347,
        baseTotal: 1497,
        monthlyEquivalent: 449,
        discountPercent: 10,
        savings: 150,
        durationMonths: 3,
        durationDays: 90,
        savingsText: "Save 10%",
      },
      yearly: {
        cycle: "yearly",
        price: 4790,
        baseTotal: 5988,
        monthlyEquivalent: 399,
        discountPercent: 20,
        savings: 1198,
        durationMonths: 12,
        durationDays: 365,
        savingsText: "Save 20%",
      },
    },
    summaryBenefits: [
      "Full premium video & course catalog",
      "Ad-Free uninterrupted viewing",
      "2K 1440p Quad HD streaming",
      "15 daily offline video downloads",
      "Priority fast streaming servers",
    ],
  },
  {
    _id: "static-plan-gold",
    id: "static-plan-gold",
    name: "Gold",
    slug: "gold",
    description: "Ultra HD 4K HDR, VIP ad-free streaming, exclusive content, 50 downloads/day",
    price: 999,
    currency: "INR",
    isActive: true,
    isPopular: false,
    displayOrder: 4,
    validityType: "monthly",
    validityDays: 30,
    rank: 4,
    features: {
      premiumVideoAccess: true,
      premiumCourses: true,
      priorityContent: true,
      adFree: true,
      offlineDownloads: true,
      fastStreaming: true,
      exclusiveContent: true,
    },
    limits: {
      streamingQuality: "4k",
      dailyWatchTime: null,
      dailyUsageLimit: null,
      dailyDownloadLimit: 50,
      maxDownloadQuality: "4k",
      maxDevices: 10,
      maxConcurrentStreams: 5,
    },
    billingCycles: {
      monthly: {
        cycle: "monthly",
        price: 999,
        baseTotal: 999,
        monthlyEquivalent: 999,
        discountPercent: 0,
        savings: 0,
        durationMonths: 1,
        durationDays: 30,
        savingsText: null,
      },
      quarterly: {
        cycle: "quarterly",
        price: 2697,
        baseTotal: 2997,
        monthlyEquivalent: 899,
        discountPercent: 10,
        savings: 300,
        durationMonths: 3,
        durationDays: 90,
        savingsText: "Save 10%",
      },
      yearly: {
        cycle: "yearly",
        price: 9590,
        baseTotal: 11988,
        monthlyEquivalent: 799,
        discountPercent: 20,
        savings: 2398,
        durationMonths: 12,
        durationDays: 365,
        savingsText: "Save 20%",
      },
    },
    summaryBenefits: [
      "All-Access VIP pass & exclusive masterclasses",
      "Cinematic 4K Ultra HD HDR streaming",
      "50 daily offline video downloads",
      "Ad-Free across 5 concurrent screens",
      "Dedicated VIP priority customer support",
    ],
  },
]

const DEFAULT_BILLING_CYCLES: Record<BillingCycleKey, BillingCycleConfig> = {
  monthly: {
    key: "monthly",
    label: "Monthly",
    durationMonths: 1,
    durationDays: 30,
    discountPercent: 0,
    badge: null,
    savingsText: null,
  },
  quarterly: {
    key: "quarterly",
    label: "Quarterly",
    durationMonths: 3,
    durationDays: 90,
    discountPercent: 10,
    badge: "Save 10%",
    savingsText: "Save 10%",
  },
  yearly: {
    key: "yearly",
    label: "Yearly",
    durationMonths: 12,
    durationDays: 365,
    discountPercent: 20,
    badge: "Save 20%",
    savingsText: "Save 20%",
  },
}

/**
 * Fetches all active subscription plans along with supported billing cycles.
 */
export const getSubscriptionPlansAndCycles = async (): Promise<GetPlansResponse> => {
  try {
    const json = await safeFetchJson<GetPlansResponse>("/api/subscriptions/plans")
    if (json.success && json.data?.plans?.length) {
      return json.data
    }
  } catch (err) {
    console.warn("[SubscriptionService] Live plans fetch failed, using fallback plans:", err)
  }

  // Graceful fallback to static plans configuration
  return {
    plans: DEFAULT_STATIC_PLANS,
    billingCycles: DEFAULT_BILLING_CYCLES,
  }
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
  try {
    const json = await safeFetchJson<{ plan: SubscriptionPlan }>(
      `/api/subscriptions/plans/${encodeURIComponent(planId)}`
    )
    if (json.success && json.data?.plan) {
      return json.data.plan
    }
  } catch (err) {
    console.warn(`[SubscriptionService] Live plan detail fetch failed for ${planId}:`, err)
  }

  const fallback = DEFAULT_STATIC_PLANS.find(
    (p) => p.slug.toLowerCase() === planId.toLowerCase() || p._id === planId || p.id === planId
  )
  if (fallback) return fallback

  throw new Error("Subscription plan not found")
}

/**
 * Fetches the authenticated user's current subscription details, status, features, and limits.
 */
export const getCurrentSubscription = async (): Promise<CurrentSubscriptionDetails> => {
  try {
    const json = await safeFetchJson<CurrentSubscriptionDetails>("/api/subscriptions/current", {
      headers: getAuthHeaders(),
    })
    if (json.success && json.data) {
      return json.data
    }
  } catch (err) {
    console.warn("[SubscriptionService] Failed to fetch current subscription, using fallback:", err)
  }

  // Graceful fallback Free subscription details so UI never displays database error banners
  return {
    subscriptionId: "sub_free_default",
    userId: "current_user",
    currentPlan: {
      id: "static-plan-free",
      name: "Free",
      slug: "free",
      description: "Standard video streaming with basic community features",
      price: 0,
      currency: "INR",
      validityType: "lifetime",
    },
    status: "active",
    isActive: true,
    isExpired: false,
    startDate: new Date().toISOString(),
    expiryDate: null,
    remainingDays: null,
    nextRenewalDate: null,
    autoRenew: false,
    cancelAtPeriodEnd: false,
    cancelledAt: null,
    cancelReason: null,
    enabledFeatures: {
      premiumVideoAccess: false,
      premiumCourses: false,
      priorityContent: false,
      adFree: false,
      offlineDownloads: true,
      fastStreaming: false,
      exclusiveContent: false,
    },
    usageLimits: {
      streamingQuality: "720p",
      dailyWatchTime: null,
      dailyUsageLimit: null,
      dailyDownloadLimit: 1,
      maxDownloadQuality: "720p",
      maxDevices: 1,
      maxConcurrentStreams: 1,
    },
  }
}

/**
 * Fetches the authenticated user's chronological subscription lifecycle history.
 */
export const getSubscriptionHistory = async (): Promise<SubscriptionHistoryItem[]> => {
  const json = await safeFetchJson<{ history: SubscriptionHistoryItem[] }>("/api/subscriptions/history", {
    headers: getAuthHeaders(),
  })
  if (!json.success || !json.data?.history) {
    throw new Error(json.error?.message || json.message || "Failed to fetch subscription history")
  }
  return json.data.history
}

/**
 * Fetches resolved feature permissions and capability flags for the current user.
 */
export const getAvailableFeatures = async (): Promise<FeaturePermissionsResponse> => {
  const json = await safeFetchJson<FeaturePermissionsResponse>("/api/subscriptions/features", {
    headers: getAuthHeaders(),
  })
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
  const json = await safeFetchJson<SubscriptionUsageData>("/api/subscriptions/usage", {
    headers: getAuthHeaders(),
  })
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
  const json = await safeFetchJson<{ success: boolean; message: string; cancelEffectiveAt: string }>("/api/subscriptions/cancel", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ reason }),
  })
  if (!json.success) {
    throw new Error(json.error?.message || json.message || "Failed to cancel subscription")
  }
  return json.data
}

/**
 * Reverses a scheduled subscription cancellation before it reaches expiry.
 */
export const restoreCancellation = async (): Promise<{ success: boolean; message: string }> => {
  const json = await safeFetchJson<{ success: boolean; message: string }>("/api/subscriptions/restore-cancellation", {
    method: "POST",
    headers: getAuthHeaders(),
  })
  if (!json.success) {
    throw new Error(json.error?.message || json.message || "Failed to restore subscription")
  }
  return json.data
}

/**
 * Fetches user notifications.
 */
export const getUserNotifications = async (): Promise<AppNotification[]> => {
  try {
    const json = await safeFetchJson<any>("/api/notifications", {
      headers: getAuthHeaders(),
    })
    if (!json.success || !json.data) {
      return []
    }
    return Array.isArray(json.data) ? json.data : json.data.notifications || []
  } catch {
    return []
  }
}

/**
 * Marks a single notification as read.
 */
export const markNotificationRead = async (id: string): Promise<boolean> => {
  try {
    const json = await safeFetchJson<any>(`/api/notifications/${encodeURIComponent(id)}/read`, {
      method: "PATCH",
      headers: getAuthHeaders(),
    })
    return Boolean(json.success)
  } catch {
    return false
  }
}

/**
 * Marks all notifications as read.
 */
export const markAllNotificationsRead = async (): Promise<boolean> => {
  try {
    const json = await safeFetchJson<any>("/api/notifications/read-all", {
      method: "PATCH",
      headers: getAuthHeaders(),
    })
    return Boolean(json.success)
  } catch {
    return false
  }
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
  const json = await safeFetchJson<PlanChangeResponse>("/api/subscriptions/change-plan", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ targetPlanKey, plan: targetPlanKey }),
  })
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


