import React from "react"
import {
  Check,
  Crown,
  Sparkles,
  Zap,
  Shield,
  ArrowRight,
  Info,
  CheckCircle2,
  Tv,
  DownloadCloud,
} from "lucide-react"
import {
  SubscriptionPlan,
  BillingCycleKey,
  formatPrice,
  getPlanCyclePricing,
} from "@/services/subscriptionService"

interface PlanCardProps {
  plan: SubscriptionPlan
  selectedCycle: BillingCycleKey
  currentPlanSlug?: string
  isAuthenticated: boolean
  onSelectPlan: (plan: SubscriptionPlan) => void
  onViewDetails: (plan: SubscriptionPlan) => void
}

const TIER_CONFIG: Record<
  string,
  {
    icon: React.ComponentType<{ className?: string }>
    accentBorder: string
    accentBg: string
    badgeBg: string
    buttonClass: string
  }
> = {
  free: {
    icon: Shield,
    accentBorder: "border-neutral-800 hover:border-neutral-700",
    accentBg: "from-neutral-900/50 to-neutral-900/30",
    badgeBg: "bg-neutral-800 text-neutral-300",
    buttonClass: "bg-neutral-800 hover:bg-neutral-700 text-neutral-200",
  },
  bronze: {
    icon: Zap,
    accentBorder: "border-amber-900/40 hover:border-amber-700/60",
    accentBg: "from-amber-950/20 to-neutral-900/40",
    badgeBg: "bg-amber-900/30 text-amber-400 border border-amber-800/40",
    buttonClass: "bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white",
  },
  silver: {
    icon: Sparkles,
    accentBorder: "border-red-500/50 hover:border-red-500 shadow-xl shadow-red-950/30",
    accentBg: "from-red-950/30 via-neutral-900/50 to-neutral-900/30",
    badgeBg: "bg-red-500/20 text-red-300 border border-red-500/40",
    buttonClass: "bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-lg shadow-red-600/30",
  },
  gold: {
    icon: Crown,
    accentBorder: "border-amber-500/40 hover:border-amber-400/70 shadow-xl shadow-amber-950/30",
    accentBg: "from-amber-950/30 via-yellow-950/20 to-neutral-900/30",
    badgeBg: "bg-amber-400/20 text-amber-300 border border-amber-400/40",
    buttonClass: "bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-black font-bold shadow-lg shadow-amber-500/20",
  },
}

export const PlanCard: React.FC<PlanCardProps> = ({
  plan,
  selectedCycle,
  currentPlanSlug = "free",
  isAuthenticated,
  onSelectPlan,
  onViewDetails,
}) => {
  const planSlug = plan.slug.toLowerCase()
  const currentSlug = currentPlanSlug.toLowerCase()
  const isCurrentPlan = isAuthenticated && currentSlug === planSlug
  const config = TIER_CONFIG[planSlug] || TIER_CONFIG.free
  const TierIcon = config.icon

  const pricing = getPlanCyclePricing(plan, selectedCycle)
  const isFree = planSlug === "free" || plan.price === 0

  // Determine button state and label based on plan hierarchy rank
  const planRank = plan.rank || (planSlug === "gold" ? 4 : planSlug === "silver" ? 3 : planSlug === "bronze" ? 2 : 1)
  const currentRank = currentSlug === "gold" ? 4 : currentSlug === "silver" ? 3 : currentSlug === "bronze" ? 2 : 1

  let buttonText = "Choose Plan"
  let buttonStyle = config.buttonClass
  let isButtonDisabled = false

  if (!isAuthenticated) {
    buttonText = isFree ? "Get Started" : `Subscribe to ${plan.name}`
  } else if (isCurrentPlan) {
    buttonText = "Current Plan"
    buttonStyle = "bg-neutral-800 text-neutral-400 cursor-default border border-neutral-700"
    isButtonDisabled = true
  } else if (planRank > currentRank) {
    buttonText = `Upgrade to ${plan.name}`
  } else {
    buttonText = `Downgrade to ${plan.name}`
    buttonStyle = "bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 border border-neutral-700/60"
  }

  // Key highlight specifications
  const maxQuality = plan.limits?.streamingQuality || "720p"
  const dailyDownloads = plan.limits?.dailyDownloadLimit ?? 1
  const maxStreams = plan.limits?.maxConcurrentStreams ?? 1

  return (
    <div
      className={`relative flex flex-col justify-between rounded-3xl p-6 sm:p-7 bg-gradient-to-b ${config.accentBg} bg-neutral-900/90 border-2 ${
        plan.isPopular ? "border-red-500 ring-2 ring-red-500/20" : config.accentBorder
      } backdrop-blur-md transition-all duration-300 hover:scale-[1.015] w-full max-w-sm sm:max-w-none mx-auto`}
    >
      {/* Popular Badge */}
      {plan.isPopular && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-red-600 to-rose-600 text-white text-[11px] font-extrabold uppercase tracking-wider shadow-md shadow-red-600/40">
          Most Popular
        </div>
      )}

      {/* Current Plan Badge */}
      {isCurrentPlan && (
        <div className="absolute -top-3.5 right-6 px-3 py-1 rounded-full bg-emerald-600 text-white text-[10px] font-extrabold uppercase tracking-wider shadow-md flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" /> Current Plan
        </div>
      )}

      {/* Plan Header */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-neutral-800/80 border border-neutral-700/60 flex items-center justify-center">
              <TierIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white tracking-tight">{plan.name}</h3>
              <p className="text-xs text-neutral-400 capitalize">{planSlug} Tier</p>
            </div>
          </div>
          {isFree && (
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-neutral-800 text-neutral-300">
              Always Free
            </span>
          )}
        </div>

        <p className="text-xs text-neutral-300 min-h-[36px] line-clamp-2 mb-5 leading-relaxed">
          {plan.description}
        </p>

        {/* Pricing Block */}
        <div className="pt-2 pb-4 border-y border-neutral-800/80 mb-5">
          {isFree ? (
            <div className="flex items-baseline gap-1.5">
              <span className="text-4xl font-extrabold text-white">₹0</span>
              <span className="text-xs text-neutral-400 font-medium">/ forever</span>
            </div>
          ) : (
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-extrabold text-white">
                  {formatPrice(pricing.price, plan.currency)}
                </span>
                <span className="text-xs text-neutral-400 font-medium">
                  / {pricing.cycle === "yearly" ? "year" : pricing.cycle === "quarterly" ? "3 months" : "month"}
                </span>
              </div>

              {/* Savings note & monthly equivalent if on quarterly/yearly */}
              {pricing.discountPercent > 0 && (
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-xs text-neutral-500 line-through">
                    {formatPrice(pricing.baseTotal, plan.currency)}
                  </span>
                  <span className="text-xs font-bold text-emerald-400">
                    {pricing.savingsText} ({formatPrice(pricing.savings, plan.currency)} saved)
                  </span>
                </div>
              )}

              {pricing.cycle !== "monthly" && (
                <p className="text-[11px] text-neutral-400 mt-1">
                  Just {formatPrice(pricing.monthlyEquivalent, plan.currency)} / month
                </p>
              )}
            </div>
          )}
        </div>

        {/* Spec Highlights Grid */}
        <div className="grid grid-cols-2 gap-2 mb-5 text-xs">
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-neutral-950/50 border border-neutral-800/80">
            <Tv className="w-4 h-4 text-neutral-400 shrink-0" />
            <div>
              <p className="text-[10px] text-neutral-400 leading-none">Max Quality</p>
              <p className="font-semibold text-neutral-200 mt-0.5">{maxQuality}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-neutral-950/50 border border-neutral-800/80">
            <DownloadCloud className="w-4 h-4 text-neutral-400 shrink-0" />
            <div>
              <p className="text-[10px] text-neutral-400 leading-none">Daily Downloads</p>
              <p className="font-semibold text-neutral-200 mt-0.5">{dailyDownloads} / day</p>
            </div>
          </div>
        </div>

        {/* Key Features List */}
        <div className="space-y-2.5 mb-6">
          <p className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">
            What's included:
          </p>

          {plan.summaryBenefits && plan.summaryBenefits.length > 0 ? (
            plan.summaryBenefits.map((benefit, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-neutral-200">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{benefit}</span>
              </div>
            ))
          ) : (
            <>
              <div className="flex items-start gap-2 text-xs text-neutral-200">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  {plan.features?.premiumVideoAccess ? "Full Premium Video Access" : "Standard Free Videos"}
                </span>
              </div>
              <div className="flex items-start gap-2 text-xs text-neutral-200">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{plan.features?.adFree ? "100% Ad-Free Viewing" : "Standard Ad Experience"}</span>
              </div>
              <div className="flex items-start gap-2 text-xs text-neutral-200">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  {plan.features?.premiumCourses ? "Interactive Premium Courses" : "Basic Course Preview"}
                </span>
              </div>
              <div className="flex items-start gap-2 text-xs text-neutral-200">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Up to {maxStreams} concurrent active screen{maxStreams > 1 ? "s" : ""}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="pt-4 border-t border-neutral-800/80 space-y-2.5">
        <button
          type="button"
          disabled={isButtonDisabled}
          onClick={() => onSelectPlan(plan)}
          className={`w-full py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer touch-target-44 ${buttonStyle}`}
        >
          <span>{buttonText}</span>
          {!isButtonDisabled && <ArrowRight className="w-4 h-4" />}
        </button>

        <button
          type="button"
          onClick={() => onViewDetails(plan)}
          className="w-full py-2 text-xs font-medium text-neutral-400 hover:text-white transition flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Info className="w-3.5 h-3.5" />
          <span>View All Details & Limits</span>
        </button>
      </div>
    </div>
  )
}

export default PlanCard
