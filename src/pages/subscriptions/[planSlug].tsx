import React, { useState, useEffect } from "react"
import Head from "next/head"
import Link from "next/link"
import { useRouter } from "next/router"
import {
  Crown,
  Sparkles,
  Zap,
  Shield,
  ArrowLeft,
  ArrowRight,
  Check,
  Tv,
  DownloadCloud,
  Layers,
  Clock,
  Laptop,
  AlertCircle,
  RefreshCw,
} from "lucide-react"
import { useAuth } from "@/lib/AuthContext"
import {
  SubscriptionPlan,
  BillingCycleKey,
  getPlanDetails,
  getCurrentSubscription,
  formatPrice,
  getPlanCyclePricing,
} from "@/services/subscriptionService"
import PurchaseConfirmationModal from "@/components/subscription/PurchaseConfirmationModal"

export default function DynamicPlanDetailPage() {
  const router = useRouter()
  const { planSlug } = router.query
  const { user } = (useAuth() as any) || {}

  const [plan, setPlan] = useState<SubscriptionPlan | null>(null)
  const [currentPlanSlug, setCurrentPlanSlug] = useState<string>("free")
  const [selectedCycle, setSelectedCycle] = useState<BillingCycleKey>("monthly")
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [confirmModalOpen, setConfirmModalOpen] = useState<boolean>(false)

  useEffect(() => {
    if (planSlug) {
      loadPlan(planSlug as string)
    }
  }, [planSlug, user])

  useEffect(() => {
    const handleSubUpdated = () => {
      if (planSlug) {
        loadPlan(planSlug as string)
      }
    }
    if (typeof window !== "undefined") {
      window.addEventListener("subscription_updated", handleSubUpdated)
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("subscription_updated", handleSubUpdated)
      }
    }
  }, [planSlug, user])

  const loadPlan = async (slug: string) => {
    try {
      setLoading(true)
      setError(null)
      const data = await getPlanDetails(slug)
      setPlan(data)

      if (user) {
        try {
          const sub = await getCurrentSubscription()
          setCurrentPlanSlug(sub.currentPlan?.slug?.toLowerCase() || "free")
        } catch (subErr) {
          console.warn("Could not load user subscription details:", subErr)
        }
      }
    } catch (err: any) {
      console.error("Failed to load plan details:", err)
      setError(err.message || "Failed to load plan specifications.")
    } finally {
      setLoading(false)
    }
  }

  const isCurrent = user && plan && currentPlanSlug === plan.slug.toLowerCase()
  const pricing = plan ? getPlanCyclePricing(plan, selectedCycle) : null

  const handleSelectPlan = () => {
    if (!user) {
      router.push(`/auth/login?redirect=/subscriptions/${planSlug}`)
      return
    }
    if (isCurrent) {
      router.push("/subscription")
      return
    }
    setConfirmModalOpen(true)
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col selection:bg-red-600 selection:text-white">
      <Head>
        <title>{plan ? `${plan.name} Membership Plan` : "Subscription Plan"} | Stream & Learn</title>
        <meta
          name="description"
          content={plan?.description || "Explore plan benefits, pricing, and streaming quality limits."}
        />
      </Head>

      <main className="flex-1 p-4 sm:p-8 max-w-4xl mx-auto w-full">
          {/* Breadcrumb */}
          <div className="mb-6">
            <Link
              href="/subscriptions"
              className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-400 hover:text-white transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to All Plans</span>
            </Link>
          </div>

          {error && (
            <div className="my-6 p-4 rounded-2xl bg-red-950/40 border border-red-500/50 flex items-center justify-between gap-4 text-xs sm:text-sm text-red-200">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                <span>{error}</span>
              </div>
              <button
                type="button"
                onClick={() => planSlug && loadPlan(planSlug as string)}
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold text-xs flex items-center gap-1 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            </div>
          )}

          {loading ? (
            <div className="space-y-6 animate-pulse my-8">
              <div className="h-14 w-64 bg-neutral-900 rounded-2xl" />
              <div className="h-64 bg-neutral-900/60 rounded-3xl border border-neutral-800" />
            </div>
          ) : plan ? (
            <div className="space-y-8">
              {/* Plan Banner Card */}
              <div className="p-6 sm:p-10 rounded-3xl bg-gradient-to-br from-red-950/30 via-neutral-900 to-neutral-950 border border-neutral-800 shadow-2xl relative overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-neutral-800">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-red-600 to-rose-600 text-white flex items-center justify-center shadow-lg shrink-0">
                      {plan.slug === "gold" ? (
                        <Crown className="w-7 h-7" />
                      ) : plan.slug === "silver" ? (
                        <Sparkles className="w-7 h-7" />
                      ) : plan.slug === "bronze" ? (
                        <Zap className="w-7 h-7" />
                      ) : (
                        <Shield className="w-7 h-7" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h1 className="text-2xl sm:text-3xl font-black text-white">
                          {plan.name} Membership
                        </h1>
                        {plan.isPopular && (
                          <span className="text-[10px] uppercase font-extrabold px-2.5 py-0.5 rounded-full bg-red-600 text-white">
                            Most Popular
                          </span>
                        )}
                        {isCurrent && (
                          <span className="text-[10px] uppercase font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            Current Plan
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-400 mt-1 capitalize">{plan.slug} Tier</p>
                    </div>
                  </div>

                  {pricing && (
                    <div className="text-right">
                      <div className="text-3xl sm:text-4xl font-black text-white">
                        {formatPrice(pricing.price, plan.currency)}
                      </div>
                      <div className="text-xs text-neutral-400 capitalize">
                        {pricing.cycle === "yearly" ? "Billed annually" : pricing.cycle === "quarterly" ? "Billed every 3 months" : "Billed monthly"}
                      </div>
                      {pricing.discountPercent > 0 && (
                        <div className="text-xs font-bold text-emerald-400 mt-1">
                          {pricing.savingsText}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <p className="text-sm text-neutral-300 my-6 leading-relaxed">
                  {plan.description}
                </p>

                {/* Billing Cycle Picker */}
                {plan.price > 0 && (
                  <div className="mb-6">
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">
                      Select Billing Cycle
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {(["monthly", "quarterly", "yearly"] as BillingCycleKey[]).map((cycle) => {
                        const isSel = selectedCycle === cycle
                        const cp = getPlanCyclePricing(plan, cycle)
                        return (
                          <button
                            key={cycle}
                            type="button"
                            onClick={() => setSelectedCycle(cycle)}
                            className={`p-3 rounded-2xl border text-center transition cursor-pointer ${
                              isSel
                                ? "bg-red-600 text-white border-red-500 font-bold shadow-md shadow-red-600/30"
                                : "bg-neutral-950/60 text-neutral-300 border-neutral-800 hover:bg-neutral-800/60"
                            }`}
                          >
                            <div className="text-xs uppercase tracking-wider">{cycle}</div>
                            <div className="text-sm font-extrabold mt-0.5">
                              {formatPrice(cp.price, plan.currency)}
                            </div>
                            {cp.discountPercent > 0 && (
                              <div className="text-[10px] text-amber-300 font-bold mt-0.5">
                                {cp.savingsText}
                              </div>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* CTA Action */}
                <div>
                  <button
                    type="button"
                    disabled={isCurrent}
                    onClick={handleSelectPlan}
                    className={`w-full py-3.5 px-6 rounded-2xl font-bold text-sm transition flex items-center justify-center gap-2 cursor-pointer shadow-xl ${
                      isCurrent
                        ? "bg-neutral-800 text-neutral-400 border border-neutral-700 cursor-default"
                        : "bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-red-600/30"
                    }`}
                  >
                    <span>
                      {isCurrent
                        ? "Current Plan Active"
                        : plan.slug === "free"
                        ? "Downgrade to Free Membership"
                        : `Select ${plan.name} Membership`}
                    </span>
                    {!isCurrent && <ArrowRight className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Usage Limits Grid */}
              <div className="p-6 sm:p-8 rounded-3xl bg-neutral-900/60 border border-neutral-800">
                <h3 className="text-base font-bold text-white mb-4">Plan Limits & Quotas</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-4 rounded-2xl bg-neutral-950/60 border border-neutral-800 flex items-center gap-3">
                    <Tv className="w-5 h-5 text-red-400 shrink-0" />
                    <div>
                      <p className="text-xs text-neutral-400">Maximum Video Quality</p>
                      <p className="text-sm font-bold text-white mt-0.5">{plan.limits?.streamingQuality || "720p"}</p>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-neutral-950/60 border border-neutral-800 flex items-center gap-3">
                    <DownloadCloud className="w-5 h-5 text-red-400 shrink-0" />
                    <div>
                      <p className="text-xs text-neutral-400">Daily Offline Downloads</p>
                      <p className="text-sm font-bold text-white mt-0.5">{plan.limits?.dailyDownloadLimit ?? 1} videos / day</p>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-neutral-950/60 border border-neutral-800 flex items-center gap-3">
                    <Layers className="w-5 h-5 text-red-400 shrink-0" />
                    <div>
                      <p className="text-xs text-neutral-400">Concurrent Screens</p>
                      <p className="text-sm font-bold text-white mt-0.5">{plan.limits?.maxConcurrentStreams ?? 1} stream(s)</p>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-neutral-950/60 border border-neutral-800 flex items-center gap-3">
                    <Laptop className="w-5 h-5 text-red-400 shrink-0" />
                    <div>
                      <p className="text-xs text-neutral-400">Authorized Devices</p>
                      <p className="text-sm font-bold text-white mt-0.5">{plan.limits?.maxDevices ?? 1} registered device(s)</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </main>

      <PurchaseConfirmationModal
        plan={plan}
        isOpen={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
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
