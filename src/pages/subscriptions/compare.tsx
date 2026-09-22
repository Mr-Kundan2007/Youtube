import React, { useState, useEffect } from "react"
import Head from "next/head"
import Link from "next/link"
import { useRouter } from "next/router"
import { ArrowLeft, Sparkles, RefreshCw, AlertCircle } from "lucide-react"
import { useAuth } from "@/lib/AuthContext"
import {
  SubscriptionPlan,
  BillingCycleKey,
  getSubscriptionPlansAndCycles,
  getCurrentSubscription,
} from "@/services/subscriptionService"
import FeatureComparisonTable from "@/components/subscription/FeatureComparisonTable"
import PurchaseConfirmationModal from "@/components/subscription/PurchaseConfirmationModal"

export default function SubscriptionComparePage() {
  const router = useRouter()
  const { user } = (useAuth() as any) || {}

  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [currentPlanSlug, setCurrentPlanSlug] = useState<string>("free")
  const [selectedCycle, setSelectedCycle] = useState<BillingCycleKey>("monthly")
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [confirmModalPlan, setConfirmModalPlan] = useState<SubscriptionPlan | null>(null)

  useEffect(() => {
    loadData()
  }, [user])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getSubscriptionPlansAndCycles()
      setPlans(data.plans || [])

      if (user) {
        try {
          const sub = await getCurrentSubscription()
          setCurrentPlanSlug(sub.currentPlan?.slug?.toLowerCase() || "free")
        } catch (subErr) {
          console.warn("Could not load user subscription:", subErr)
        }
      }
    } catch (err: any) {
      console.error("Failed to load comparison data:", err)
      setError(err.message || "Failed to load plans comparison. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  // Refresh subscription when updated anywhere in the app
  useEffect(() => {
    const handleSubUpdated = () => {
      loadData()
    }
    window.addEventListener("subscription_updated", handleSubUpdated)
    return () => window.removeEventListener("subscription_updated", handleSubUpdated)
  }, [])

  const handleSelectPlan = (plan: SubscriptionPlan) => {
    if (!user) {
      router.push(`/auth/login?redirect=/subscriptions`)
      return
    }
    if (plan.slug.toLowerCase() === currentPlanSlug) {
      if (plan.slug.toLowerCase() !== "free") {
        router.push("/subscription")
        return
      }
    }
    setConfirmModalPlan(plan)
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col selection:bg-red-600 selection:text-white">
      <Head>
        <title>Compare Subscription Plans | Stream & Learn</title>
        <meta
          name="description"
          content="Detailed feature by feature matrix comparing Free, Bronze, Silver, and Gold membership plans."
        />
      </Head>

      <main className="flex-1 p-4 sm:p-8 max-w-7xl mx-auto w-full">
          {/* Breadcrumb / Back Link */}
          <div className="mb-6">
            <Link
              href="/subscriptions"
              className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-400 hover:text-white transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Plans Overview</span>
            </Link>
          </div>

          <div className="text-center max-w-2xl mx-auto mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 text-red-400 text-xs font-bold uppercase tracking-wider mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Comprehensive Breakdown</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Subscription Plan Comparison Matrix
            </h1>
            <p className="text-xs sm:text-sm text-neutral-400 mt-2">
              Evaluate differences across resolution caps, offline download quotas, concurrent screens, and course offerings.
            </p>
          </div>

          {error && (
            <div className="my-6 p-4 rounded-2xl bg-red-950/40 border border-red-500/50 flex items-center justify-between gap-4 text-xs sm:text-sm text-red-200">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                <span>{error}</span>
              </div>
              <button
                type="button"
                onClick={loadData}
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold text-xs flex items-center gap-1 transition cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            </div>
          )}

          {loading ? (
            <div className="space-y-4 animate-pulse my-8">
              <div className="h-12 bg-neutral-900 rounded-2xl" />
              <div className="h-96 bg-neutral-900/60 rounded-3xl border border-neutral-800" />
            </div>
          ) : (
            <FeatureComparisonTable
              plans={plans}
              currentPlanSlug={currentPlanSlug}
              onSelectPlan={handleSelectPlan}
            />
          )}
        </main>

      <PurchaseConfirmationModal
        plan={confirmModalPlan}
        isOpen={!!confirmModalPlan}
        onClose={() => setConfirmModalPlan(null)}
        selectedCycle={selectedCycle}
        onCycleChange={setSelectedCycle}
        currentPlanSlug={currentPlanSlug}
        userEmail={user?.email || ""}
        userName={user?.channelname || user?.name || ""}
        onProceedToPayment={(data) => {
          console.log("Proceed to payment prepared:", data)
        }}
      />
    </div>
  )
}
