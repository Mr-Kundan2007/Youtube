import React, { useState, useEffect } from "react"
import Head from "next/head"
import Link from "next/link"
import { useRouter } from "next/router"
import {
  Sparkles,
  Crown,
  Shield,
  Zap,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Tv,
  Download,
  BookOpen,
  Sliders,
  ChevronDown,
} from "lucide-react"
import { useAuth } from "@/lib/AuthContext"
import {
  SubscriptionPlan,
  BillingCycleKey,
  CurrentSubscriptionDetails,
  getSubscriptionPlansAndCycles,
  getCurrentSubscription,
} from "@/services/subscriptionService"
import BillingPeriodSelector from "@/components/subscription/BillingPeriodSelector"
import PlanCard from "@/components/subscription/PlanCard"
import FeatureComparisonTable from "@/components/subscription/FeatureComparisonTable"
import PlanDetailsModal from "@/components/subscription/PlanDetailsModal"
import PurchaseConfirmationModal from "@/components/subscription/PurchaseConfirmationModal"
import UpgradeRecommendations from "@/components/subscription/UpgradeRecommendations"
import SubscriptionSummaryCard from "@/components/subscription/SubscriptionSummaryCard"
import SubscriptionFAQ from "@/components/subscription/SubscriptionFAQ"

export default function SubscriptionsPricingPage() {
  const router = useRouter()
  const { user } = (useAuth() as any) || {}

  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [currentSub, setCurrentSub] = useState<CurrentSubscriptionDetails | null>(null)
  const [selectedCycle, setSelectedCycle] = useState<BillingCycleKey>("monthly")
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Modals state
  const [detailModalPlan, setDetailModalPlan] = useState<SubscriptionPlan | null>(null)
  const [confirmModalPlan, setConfirmModalPlan] = useState<SubscriptionPlan | null>(null)

  const currentPlanSlug = currentSub?.currentPlan?.slug?.toLowerCase() || "free"

  // Fetch plans & user's current subscription
  useEffect(() => {
    loadData()
  }, [user])

  // Refresh subscription when updated anywhere in the app
  useEffect(() => {
    const handleSubUpdated = () => {
      loadData()
    }
    window.addEventListener("subscription_updated", handleSubUpdated)
    return () => window.removeEventListener("subscription_updated", handleSubUpdated)
  }, [])

  // Handle URL query parameters (e.g. ?plan=silver&validity=quarterly)
  useEffect(() => {
    if (router.query.validity && ["monthly", "quarterly", "yearly"].includes(router.query.validity as string)) {
      setSelectedCycle(router.query.validity as BillingCycleKey)
    }
  }, [router.query.validity])

  // Handle URL plan selection (e.g. ?plan=free or ?plan=silver)
  useEffect(() => {
    if (router.query.plan && plans.length > 0) {
      const targetSlug = (router.query.plan as string).toLowerCase()
      const targetPlan = plans.find((p) => p.slug.toLowerCase() === targetSlug)
      if (targetPlan) {
        if (targetPlan.slug.toLowerCase() === currentPlanSlug) {
          // Already on this plan
          if (targetPlan.slug.toLowerCase() !== "free") {
            router.push("/subscription")
          }
        } else {
          setConfirmModalPlan(targetPlan)
        }
      }
    }
  }, [router.query.plan, plans, currentPlanSlug])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      // 1. Fetch plans
      const plansData = await getSubscriptionPlansAndCycles()
      setPlans(plansData.plans || [])

      // 2. Fetch current user subscription if logged in
      if (user) {
        try {
          const subData = await getCurrentSubscription()
          setCurrentSub(subData)
        } catch (subErr) {
          console.warn("Could not load user subscription details:", subErr)
        }
      }
    } catch (err: any) {
      console.error("Failed to load subscription plans:", err)
      setError(err.message || "Failed to load subscription plans. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  // User selects a plan
  const handleSelectPlan = (plan: SubscriptionPlan) => {
    if (!user) {
      // Unauthenticated: preserve intent and redirect to login
      const returnUrl = `/subscriptions?plan=${plan.slug}&validity=${selectedCycle}`
      router.push(`/auth/login?redirect=${encodeURIComponent(returnUrl)}`)
      return
    }

    if (plan.slug.toLowerCase() === currentPlanSlug) {
      // Navigate to manage subscription
      router.push("/subscription")
      return
    }

    // Open confirmation modal
    setConfirmModalPlan(plan)
  }

  const handleProceedToPayment = (checkoutData: any) => {
    console.log("Subscription checkout intent initialized:", checkoutData)
    // In Phase 5/6, Razorpay modal will trigger here.
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col selection:bg-red-600 selection:text-white">
      <Head>
        <title>Subscription Plans & Pricing | Stream & Learn</title>
        <meta
          name="description"
          content="Choose the perfect subscription plan. Unlock Full HD & 4K video streaming, offline downloads, exclusive courses, and ad-free playback."
        />
      </Head>

      <main className="flex-1 p-4 sm:p-8 max-w-7xl mx-auto w-full overflow-hidden">
          {/* HERO SECTION */}
          <section className="relative text-center py-10 sm:py-14 px-4 rounded-3xl bg-gradient-to-b from-red-950/30 via-neutral-900/40 to-neutral-950 border border-neutral-800/80 backdrop-blur-md shadow-2xl mb-10 overflow-hidden">
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-bold uppercase tracking-wider mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Flexible Membership Plans</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight max-w-3xl mx-auto leading-tight sm:leading-tight">
              Choose the Perfect Plan for You
            </h1>

            <p className="text-sm sm:text-base text-neutral-300 mt-4 max-w-2xl mx-auto leading-relaxed">
              Unlock premium video libraries, crisp Full HD and 4K streaming, offline downloads, exclusive courses, and an uninterrupted ad-free experience.
            </p>

            {/* Current Subscription Pill for Authenticated Users */}
            {user && currentSub && (
              <div className="mt-6 flex justify-center">
                <SubscriptionSummaryCard
                  currentPlan={currentSub.currentPlan}
                  status={currentSub.status}
                  expiryDate={currentSub.expiryDate}
                  remainingDays={currentSub.remainingDays}
                  streamingQuality={currentSub.usageLimits?.streamingQuality}
                  dailyDownloadsRemaining={currentSub.usageLimits?.dailyDownloadLimit}
                  compact={true}
                />
              </div>
            )}

            {/* Hero Quick Jump Links */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <a
                href="#plan-cards"
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-red-600/30 transition flex items-center gap-1.5"
              >
                <span>View Plans</span>
                <ArrowRight className="w-4 h-4" />
              </a>
              <Link
                href="/subscriptions/compare"
                className="px-5 py-2.5 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 text-neutral-200 border border-neutral-700 text-xs sm:text-sm font-semibold transition flex items-center gap-1.5"
              >
                <Sliders className="w-4 h-4 text-neutral-400" />
                <span>Compare All Features</span>
              </Link>
            </div>
          </section>

          {/* ERROR STATE */}
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

          {/* LOADING STATE */}
          {loading ? (
            <div className="space-y-6 my-10 animate-pulse">
              <div className="h-12 w-72 bg-neutral-900 rounded-2xl mx-auto" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-96 rounded-3xl bg-neutral-900/60 border border-neutral-800 p-6" />
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* BILLING PERIOD SELECTOR */}
              <div id="plan-cards">
                <BillingPeriodSelector
                  selectedCycle={selectedCycle}
                  onChange={setSelectedCycle}
                />
              </div>

              {/* PLAN CARDS GRID */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 my-8 items-stretch place-items-center sm:place-items-stretch justify-center max-w-7xl mx-auto">
                {plans.map((plan) => (
                  <PlanCard
                    key={plan._id || (plan as any).id || plan.slug}
                    plan={plan}
                    selectedCycle={selectedCycle}
                    currentPlanSlug={currentPlanSlug}
                    isAuthenticated={!!user}
                    onSelectPlan={handleSelectPlan}
                    onViewDetails={setDetailModalPlan}
                  />
                ))}
              </div>

              {/* UPGRADE RECOMMENDATIONS BANNER */}
              <UpgradeRecommendations
                currentPlanSlug={currentPlanSlug}
                plans={plans}
                onSelectPlan={handleSelectPlan}
              />

              {/* PLAN BENEFITS SHOWCASE SECTION */}
              <section className="my-16 py-10 px-6 rounded-3xl bg-neutral-900/40 border border-neutral-800/80">
                <div className="text-center max-w-2xl mx-auto mb-10">
                  <span className="text-[11px] uppercase font-bold text-red-400 tracking-wider">
                    Why Go Premium?
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
                    Premium Benefits Engineered For You
                  </h2>
                  <p className="text-xs sm:text-sm text-neutral-400 mt-2">
                    Transform your viewing and educational experience with high-fidelity streaming and offline capabilities.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  <div className="p-5 rounded-2xl bg-neutral-950/60 border border-neutral-800 flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 shrink-0">
                      <Tv className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">Full HD & 4K Ultra HD</h4>
                      <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                        Enjoy high-bitrate streaming with vivid detail, enhanced audio codecs, and minimal compression.
                      </p>
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-neutral-950/60 border border-neutral-800 flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                      <Download className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">Encrypted Offline Downloads</h4>
                      <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                        Download up to 50 videos a day directly to your registered devices and watch anytime on the go.
                      </p>
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-neutral-950/60 border border-neutral-800 flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">100% Ad-Free Viewing</h4>
                      <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                        Zero preroll and midroll video advertisements on Silver and Gold memberships for uninterrupted focus.
                      </p>
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-neutral-950/60 border border-neutral-800 flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">Complete Course Masterclasses</h4>
                      <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                        Structured lessons, project files, exercises, and study materials taught by industry experts.
                      </p>
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-neutral-950/60 border border-neutral-800 flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 shrink-0">
                      <Crown className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">5 Simultaneous Screens</h4>
                      <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                        Share your entertainment across your TV, tablet, phone, and laptop without session conflicts.
                      </p>
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-neutral-950/60 border border-neutral-800 flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 shrink-0">
                      <Shield className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">Graceful Auto-Downgrade</h4>
                      <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                        Never worry about data loss. If a subscription concludes, your account seamlessly transitions to Free.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* FEATURE COMPARISON TABLE */}
              <div id="compare-table">
                <FeatureComparisonTable
                  plans={plans}
                  currentPlanSlug={currentPlanSlug}
                  onSelectPlan={handleSelectPlan}
                />
              </div>

              {/* FAQ SECTION */}
              <SubscriptionFAQ />

              {/* BOTTOM CALL TO ACTION BANNER */}
              <section className="my-16 p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-red-950/60 via-neutral-900 to-neutral-900 border border-red-500/30 text-center relative overflow-hidden shadow-2xl">
                <div className="max-w-2xl mx-auto space-y-4">
                  <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    Ready to elevate your streaming journey?
                  </h3>
                  <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
                    Join thousands of happy learners and viewers. Select your plan today and cancel anytime with no penalties.
                  </p>
                  <div className="pt-2 flex justify-center">
                    <button
                      type="button"
                      onClick={() => {
                        const silver = plans.find((p) => p.slug === "silver") || plans[0]
                        if (silver) handleSelectPlan(silver)
                      }}
                      className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-sm shadow-xl shadow-red-600/40 transition flex items-center gap-2 cursor-pointer"
                    >
                      <span>Get Started Now</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </section>
            </>
          )}
        </main>

      {/* PLAN DETAILS MODAL */}
      <PlanDetailsModal
        plan={detailModalPlan}
        isOpen={!!detailModalPlan}
        onClose={() => setDetailModalPlan(null)}
        selectedCycle={selectedCycle}
        currentPlanSlug={currentPlanSlug}
        isAuthenticated={!!user}
        onSelectPlan={handleSelectPlan}
      />

      {/* PURCHASE CONFIRMATION MODAL */}
      <PurchaseConfirmationModal
        plan={confirmModalPlan}
        isOpen={!!confirmModalPlan}
        onClose={() => setConfirmModalPlan(null)}
        selectedCycle={selectedCycle}
        onCycleChange={setSelectedCycle}
        currentPlanSlug={currentPlanSlug}
        userEmail={user?.email || ""}
        userName={user?.channelname || user?.name || ""}
        onProceedToPayment={handleProceedToPayment}
      />
    </div>
  )
}
