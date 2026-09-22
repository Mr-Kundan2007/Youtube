import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/lib/AuthContext"
import {
  getCurrentSubscription,
  getAvailableFeatures,
  CurrentSubscriptionDetails,
  FeaturePermissionsResponse,
} from "@/services/subscriptionService"

export const PLAN_RANKS: Record<string, number> = {
  free: 1,
  bronze: 2,
  silver: 3,
  gold: 4,
}

export function useSubscriptionPermissions() {
  const { user } = (useAuth() as any) || {}
  const [subscription, setSubscription] = useState<CurrentSubscriptionDetails | null>(null)
  const [featureMatrix, setFeatureMatrix] = useState<FeaturePermissionsResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const refreshPermissions = useCallback(async () => {
    if (!user) {
      setSubscription(null)
      setFeatureMatrix(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const [subData, featuresData] = await Promise.all([
        getCurrentSubscription().catch(() => null),
        getAvailableFeatures().catch(() => null),
      ])
      setSubscription(subData)
      setFeatureMatrix(featuresData)
      setError(null)
    } catch (err: any) {
      setError(err.message || "Failed to load permissions")
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    refreshPermissions()
  }, [refreshPermissions])

  const userPlanSlug = subscription?.currentPlan?.slug || "free"
  const isExpired = Boolean(subscription?.isExpired)
  const isActive = Boolean(subscription?.isActive) && !isExpired

  const hasFeature = useCallback(
    (featureKey: string): boolean => {
      if (!isActive) return false
      return Boolean(subscription?.enabledFeatures?.[featureKey as keyof typeof subscription.enabledFeatures])
    },
    [isActive, subscription]
  )

  const canAccessPlanContent = useCallback(
    (requiredPlan: string = "free"): boolean => {
      const userRank = PLAN_RANKS[userPlanSlug] || 1
      const requiredRank = PLAN_RANKS[requiredPlan.toLowerCase()] || 1
      return isActive && userRank >= requiredRank
    },
    [isActive, userPlanSlug]
  )

  const canAccessVideo = useCallback(
    (video: any): boolean => {
      if (!video) return false
      const requiredPlan = (video.requiredPlan || video.accessLevel || "free").toLowerCase()
      const isPremium = Boolean(video.isPremium || video.is_premium)
      if (requiredPlan === "free" && !isPremium) return true
      const effectiveRequired = requiredPlan === "free" && isPremium ? "bronze" : requiredPlan
      return canAccessPlanContent(effectiveRequired)
    },
    [canAccessPlanContent]
  )

  const isAdFree = useCallback((): boolean => {
    return hasFeature("adFree")
  }, [hasFeature])

  const getMaxQuality = useCallback((): string => {
    return subscription?.usageLimits?.streamingQuality || "480p"
  }, [subscription])

  const getRemainingDownloads = useCallback((): number => {
    return subscription?.usageLimits?.dailyDownloadLimit ?? 1
  }, [subscription])

  return {
    subscription,
    featureMatrix,
    loading,
    error,
    refreshPermissions,
    userPlanSlug,
    isActive,
    isExpired,
    isPremium: isActive && userPlanSlug !== "free",
    hasFeature,
    canAccessPlanContent,
    canAccessVideo,
    isAdFree,
    getMaxQuality,
    getRemainingDownloads,
  }
}

export default useSubscriptionPermissions
