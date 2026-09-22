import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/lib/AuthContext"
import {
  CurrentSubscriptionDetails,
  SubscriptionPlan,
  SubscriptionHistoryItem,
  PlanFeatures,
  PlanLimits,
  SubscriptionUsageData,
  getCurrentSubscription,
  getSubscriptionPlans,
  getSubscriptionHistory,
  getSubscriptionUsage,
} from "@/services/subscriptionService"

export interface UseSubscriptionReturn {
  subscription: CurrentSubscriptionDetails | null
  plan: CurrentSubscriptionDetails["currentPlan"] | null
  status: string
  isActive: boolean
  isExpired: boolean
  isCancelled: boolean
  isFree: boolean
  features: PlanFeatures | null
  limits: PlanLimits | null
  usage: SubscriptionUsageData | null
  history: SubscriptionHistoryItem[]
  availablePlans: SubscriptionPlan[]
  isLoading: boolean
  error: string | null
  refreshSubscription: () => Promise<void>
}

export const useSubscription = (): UseSubscriptionReturn => {
  const { user } = (useAuth() as any) || {}

  const [subscription, setSubscription] = useState<CurrentSubscriptionDetails | null>(null)
  const [usage, setUsage] = useState<SubscriptionUsageData | null>(null)
  const [history, setHistory] = useState<SubscriptionHistoryItem[]>([])
  const [availablePlans, setAvailablePlans] = useState<SubscriptionPlan[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!user) {
      setIsLoading(false)
      setSubscription(null)
      setUsage(null)
      setHistory([])
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      // Fetch all required data concurrently
      const [currentRes, plansRes, historyRes, usageRes] = await Promise.allSettled([
        getCurrentSubscription(),
        getSubscriptionPlans(),
        getSubscriptionHistory(),
        getSubscriptionUsage(),
      ])

      if (currentRes.status === "fulfilled") {
        setSubscription(currentRes.value)
      } else {
        console.warn("Failed to fetch current subscription:", currentRes.reason)
      }

      if (plansRes.status === "fulfilled") {
        setAvailablePlans(plansRes.value)
      } else {
        console.warn("Failed to fetch available plans:", plansRes.reason)
      }

      if (historyRes.status === "fulfilled") {
        setHistory(historyRes.value)
      } else {
        console.warn("Failed to fetch subscription history:", historyRes.reason)
      }

      if (usageRes.status === "fulfilled") {
        setUsage(usageRes.value)
      } else {
        console.warn("Failed to fetch subscription usage:", usageRes.reason)
      }

      // If current subscription failed, surface error
      if (currentRes.status === "rejected") {
        setError(currentRes.reason?.message || "Failed to load subscription details")
      }
    } catch (err: any) {
      console.error("useSubscription hook error:", err)
      setError(err.message || "An unexpected error occurred while loading subscription data")
    } finally {
      setIsLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchData()

    const handleUpdate = () => {
      fetchData()
    }
    window.addEventListener("subscription_updated", handleUpdate)
    return () => window.removeEventListener("subscription_updated", handleUpdate)
  }, [fetchData])

  const planSlug = subscription?.currentPlan?.slug?.toLowerCase() || "free"
  const isFree = planSlug === "free"
  const isExpired = Boolean(subscription?.isExpired)
  const isCancelled = Boolean(subscription?.cancelAtPeriodEnd)
  const isActive = Boolean(subscription?.isActive) && !isExpired

  return {
    subscription,
    plan: subscription?.currentPlan || null,
    status: subscription?.status || (isFree ? "active" : "unknown"),
    isActive,
    isExpired,
    isCancelled,
    isFree,
    features: subscription?.enabledFeatures || null,
    limits: subscription?.usageLimits || null,
    usage,
    history,
    availablePlans,
    isLoading,
    error,
    refreshSubscription: fetchData,
  }
}

export default useSubscription
