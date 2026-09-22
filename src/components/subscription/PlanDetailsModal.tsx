import React, { useEffect } from "react"
import {
  X,
  Check,
  Crown,
  Sparkles,
  Zap,
  Shield,
  ArrowRight,
  Tv,
  DownloadCloud,
  Layers,
  Clock,
  Laptop,
} from "lucide-react"
import {
  SubscriptionPlan,
  BillingCycleKey,
  formatPrice,
  getPlanCyclePricing,
} from "@/services/subscriptionService"

interface PlanDetailsModalProps {
  plan: SubscriptionPlan | null
  isOpen: boolean
  onClose: () => void
  selectedCycle: BillingCycleKey
  currentPlanSlug?: string
  isAuthenticated: boolean
  onSelectPlan: (plan: SubscriptionPlan) => void
}

export const PlanDetailsModal: React.FC<PlanDetailsModalProps> = ({
  plan,
  isOpen,
  onClose,
  selectedCycle,
  currentPlanSlug = "free",
  isAuthenticated,
  onSelectPlan,
}) => {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !plan) return null

  const planSlug = plan.slug.toLowerCase()
  const isCurrent = isAuthenticated && currentPlanSlug.toLowerCase() === planSlug
  const pricing = getPlanCyclePricing(plan, selectedCycle)
  const isFree = planSlug === "free" || plan.price === 0

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-details-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-neutral-900 border border-neutral-700 rounded-3xl p-6 sm:p-8 shadow-2xl">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-5 right-5 p-2 text-neutral-400 hover:text-white rounded-full hover:bg-neutral-800 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3.5 mb-5">
          <div className="p-3 rounded-2xl bg-gradient-to-tr from-red-600 to-rose-600 text-white shadow-lg">
            {planSlug === "gold" ? (
              <Crown className="w-6 h-6" />
            ) : planSlug === "silver" ? (
              <Sparkles className="w-6 h-6" />
            ) : planSlug === "bronze" ? (
              <Zap className="w-6 h-6" />
            ) : (
              <Shield className="w-6 h-6" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 id="plan-details-title" className="text-2xl font-black text-white">
                {plan.name} Membership
              </h3>
              {plan.isPopular && (
                <span className="text-[10px] uppercase font-extrabold px-2.5 py-0.5 rounded-full bg-red-600 text-white">
                  Most Popular
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-400 capitalize">{planSlug} tier specifications</p>
          </div>
        </div>

        <p className="text-sm text-neutral-300 mb-6 leading-relaxed bg-neutral-950/60 p-4 rounded-2xl border border-neutral-800">
          {plan.description}
        </p>

        {/* Pricing Breakdown */}
        <div className="mb-6 p-4 rounded-2xl bg-neutral-950/80 border border-neutral-800">
          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3">
            Pricing Options
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(["monthly", "quarterly", "yearly"] as BillingCycleKey[]).map((cycleKey) => {
              const cyclePricing = getPlanCyclePricing(plan, cycleKey)
              const isSelected = selectedCycle === cycleKey

              return (
                <div
                  key={cycleKey}
                  className={`p-3 rounded-xl border text-center transition-all ${
                    isSelected
                      ? "bg-red-950/30 border-red-500/60 shadow-md"
                      : "bg-neutral-900/40 border-neutral-800"
                  }`}
                >
                  <p className="text-xs font-bold uppercase text-neutral-400">{cycleKey}</p>
                  <p className="text-base font-extrabold text-white mt-1">
                    {formatPrice(cyclePricing.price, plan.currency)}
                  </p>
                  {cyclePricing.discountPercent > 0 && (
                    <span className="text-[10px] font-bold text-emerald-400">
                      {cyclePricing.savingsText}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Usage Limits */}
        <div className="mb-6">
          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3">
            Usage Limits & Quotas
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-neutral-950/50 border border-neutral-800">
              <Tv className="w-5 h-5 text-red-400 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-white">Streaming Resolution</p>
                <p className="text-[11px] text-neutral-400">
                  Up to {plan.limits?.streamingQuality || "720p"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-neutral-950/50 border border-neutral-800">
              <DownloadCloud className="w-5 h-5 text-red-400 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-white">Daily Offline Downloads</p>
                <p className="text-[11px] text-neutral-400">
                  {plan.limits?.dailyDownloadLimit ?? 1} videos per day
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-neutral-950/50 border border-neutral-800">
              <Layers className="w-5 h-5 text-red-400 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-white">Concurrent Screens</p>
                <p className="text-[11px] text-neutral-400">
                  {plan.limits?.maxConcurrentStreams ?? 1} active simultaneous device(s)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-neutral-950/50 border border-neutral-800">
              <Clock className="w-5 h-5 text-red-400 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-white">Daily Watch-Time</p>
                <p className="text-[11px] text-neutral-400">
                  {plan.limits?.dailyWatchTime
                    ? `${plan.limits.dailyWatchTime} minutes / day`
                    : "Unlimited video consumption"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-neutral-950/50 border border-neutral-800">
              <Laptop className="w-5 h-5 text-red-400 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-white">Registered Devices</p>
                <p className="text-[11px] text-neutral-400">
                  Up to {plan.limits?.maxDevices ?? 1} authorized device(s)
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Checkmarks */}
        <div className="mb-6">
          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3">
            Features & Privileges
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2 text-neutral-200">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                {plan.features?.premiumVideoAccess
                  ? "Full Access to Premium Videos"
                  : "Access to Standard Videos"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-neutral-200">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                {plan.features?.adFree
                  ? "100% Ad-Free Video Playback"
                  : "Standard Advertisements Included"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-neutral-200">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                {plan.features?.premiumCourses
                  ? "Complete Premium Course Catalog"
                  : "Course Previews Only"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-neutral-200">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                {plan.features?.exclusiveContent
                  ? "Exclusive VIP Creator Content"
                  : "Standard Catalog"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-neutral-200">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                {plan.features?.fastStreaming
                  ? "High-Speed Priority CDN Servers"
                  : "Standard Streaming Speed"}
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-800">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-sm font-semibold transition cursor-pointer"
          >
            Close
          </button>
          {!isCurrent && (
            <button
              type="button"
              onClick={() => {
                onClose()
                onSelectPlan(plan)
              }}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-sm font-bold shadow-lg shadow-red-600/30 flex items-center gap-2 transition cursor-pointer"
            >
              <span>Select {plan.name}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default PlanDetailsModal
