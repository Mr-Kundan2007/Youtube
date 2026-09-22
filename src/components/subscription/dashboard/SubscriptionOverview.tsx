import React from "react"
import Link from "next/link"
import {
  Crown,
  Sparkles,
  Zap,
  Shield,
  Calendar,
  Clock,
  ArrowRight,
  Sliders,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react"
import { CurrentSubscriptionDetails } from "@/services/subscriptionService"

interface SubscriptionOverviewProps {
  subscription: CurrentSubscriptionDetails | null
  onOpenCancelModal?: () => void
  onOpenRenewModal?: () => void
}

const TIER_THEMES: Record<
  string,
  {
    icon: React.ComponentType<{ className?: string }>
    bgGradient: string
    borderColor: string
    badgeBg: string
  }
> = {
  free: {
    icon: Shield,
    bgGradient: "from-neutral-900 via-neutral-900/90 to-neutral-950",
    borderColor: "border-neutral-800",
    badgeBg: "bg-neutral-800 text-neutral-300 border-neutral-700",
  },
  bronze: {
    icon: Zap,
    bgGradient: "from-amber-950/40 via-neutral-900 to-neutral-950",
    borderColor: "border-amber-700/50",
    badgeBg: "bg-amber-900/30 text-amber-400 border-amber-600/40",
  },
  silver: {
    icon: Sparkles,
    bgGradient: "from-red-950/40 via-neutral-900 to-neutral-950",
    borderColor: "border-red-500/50",
    badgeBg: "bg-red-500/20 text-red-300 border-red-500/40",
  },
  gold: {
    icon: Crown,
    bgGradient: "from-amber-950/50 via-yellow-950/20 to-neutral-950",
    borderColor: "border-amber-400/50",
    badgeBg: "bg-amber-400/20 text-amber-300 border-amber-400/40",
  },
}

export const SubscriptionOverview: React.FC<SubscriptionOverviewProps> = ({
  subscription,
}) => {
  const planSlug = (subscription?.currentPlan?.slug || "free").toLowerCase()
  const planName = subscription?.currentPlan?.name || (planSlug === "free" ? "Free" : "Premium")
  const status = subscription?.status || "active"
  const isFree = planSlug === "free"
  const isExpired = Boolean(subscription?.isExpired)

  const theme = TIER_THEMES[planSlug] || TIER_THEMES.free
  const TierIcon = theme.icon

  const startedFormatted = subscription?.startDate
    ? new Date(subscription.startDate).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "Lifetime Access"

  const expiryFormatted = subscription?.expiryDate
    ? new Date(subscription.expiryDate).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : isFree
    ? "Permanent Free Tier"
    : "No Expiration Date"

  return (
    <div
      className={`rounded-3xl p-6 sm:p-8 bg-gradient-to-br ${theme.bgGradient} border-2 ${theme.borderColor} shadow-2xl backdrop-blur-md relative overflow-hidden`}
    >
      {/* Background glow */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-neutral-800">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-red-600 to-rose-600 text-white flex items-center justify-center shadow-xl shrink-0">
            <TierIcon className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {planName} Membership
              </h2>
              <span
                className={`text-[10px] uppercase font-extrabold px-3 py-1 rounded-full border ${theme.badgeBg}`}
              >
                {isExpired ? "EXPIRED" : status.toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-1 capitalize">
              {isFree ? "Standard free video & learning access" : `${planSlug} tier active subscription`}
            </p>
          </div>
        </div>

        {/* Quick action buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/subscriptions"
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-red-600/30 transition flex items-center gap-1.5"
          >
            <span>{isFree ? "Upgrade Plan" : "Change Plan"}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/subscriptions/compare"
            className="px-4 py-2.5 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 text-neutral-300 border border-neutral-700 font-semibold text-xs sm:text-sm transition flex items-center gap-1.5"
          >
            <Sliders className="w-4 h-4 text-neutral-400" />
            <span>Compare Features</span>
          </Link>
        </div>
      </div>

      {/* Date & Validity Metric Grid */}
      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6">
        <div className="p-4 rounded-2xl bg-neutral-950/60 border border-neutral-800/80">
          <div className="flex items-center gap-2 text-neutral-400 text-xs mb-1">
            <Calendar className="w-4 h-4 text-neutral-400" />
            <span>Started Date</span>
          </div>
          <p className="text-sm sm:text-base font-bold text-white mt-0.5">{startedFormatted}</p>
        </div>

        <div className="p-4 rounded-2xl bg-neutral-950/60 border border-neutral-800/80">
          <div className="flex items-center gap-2 text-neutral-400 text-xs mb-1">
            <Clock className="w-4 h-4 text-neutral-400" />
            <span>Expiry Date</span>
          </div>
          <p className="text-sm sm:text-base font-bold text-white mt-0.5">{expiryFormatted}</p>
        </div>

        <div className="p-4 rounded-2xl bg-neutral-950/60 border border-neutral-800/80">
          <div className="flex items-center gap-2 text-neutral-400 text-xs mb-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Remaining Validity</span>
          </div>
          <p className="text-sm sm:text-base font-black text-white mt-0.5">
            {isFree
              ? "Unlimited"
              : isExpired
              ? "Expired"
              : subscription?.remainingDays !== null && subscription?.remainingDays !== undefined
              ? `${subscription.remainingDays} Days Left`
              : "Active"}
          </p>
        </div>
      </div>
    </div>
  )
}

export default SubscriptionOverview
