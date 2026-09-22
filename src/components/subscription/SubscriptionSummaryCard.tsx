import React from "react"
import Link from "next/link"
import {
  Crown,
  Calendar,
  Clock,
  Download,
  Tv,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Shield,
  Zap,
  Sparkles,
} from "lucide-react"

interface SubscriptionSummaryCardProps {
  currentPlan?: {
    name: string
    slug: string
  }
  status?: string
  expiryDate?: string | null
  remainingDays?: number | null
  streamingQuality?: string
  dailyDownloadsRemaining?: number | null
  compact?: boolean
  className?: string
}

export const SubscriptionSummaryCard: React.FC<SubscriptionSummaryCardProps> = ({
  currentPlan = { name: "Free", slug: "free" },
  status = "active",
  expiryDate,
  remainingDays,
  streamingQuality = "720p",
  dailyDownloadsRemaining = 1,
  compact = false,
  className = "",
}) => {
  const planSlug = currentPlan.slug.toLowerCase()
  const isFree = planSlug === "free"
  const isActive = status === "active"

  const formattedExpiry = expiryDate
    ? new Date(expiryDate).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Permanent Free Access"

  if (compact) {
    return (
      <div
        className={`inline-flex items-center gap-3 px-4 py-2 rounded-2xl bg-neutral-900/90 border border-neutral-800 text-xs text-neutral-300 shadow-md ${className}`}
      >
        <div className="flex items-center gap-2">
          {planSlug === "gold" ? (
            <Crown className="w-4 h-4 text-amber-400" />
          ) : planSlug === "silver" ? (
            <Sparkles className="w-4 h-4 text-red-400" />
          ) : planSlug === "bronze" ? (
            <Zap className="w-4 h-4 text-amber-600" />
          ) : (
            <Shield className="w-4 h-4 text-neutral-400" />
          )}
          <span className="font-bold text-white uppercase">{currentPlan.name}</span>
        </div>
        <span className="w-1 h-1 rounded-full bg-neutral-600" />
        <span className="text-neutral-400">
          {isFree ? "Standard Tier" : remainingDays !== null && remainingDays !== undefined ? `${remainingDays} days left` : "Active"}
        </span>
        <Link
          href="/subscription"
          className="text-red-400 hover:text-red-300 font-semibold underline underline-offset-2 ml-1"
        >
          Manage
        </Link>
      </div>
    )
  }

  return (
    <div
      className={`rounded-3xl p-6 bg-gradient-to-br from-neutral-900 via-neutral-900/90 to-neutral-950 border border-neutral-800 shadow-xl ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-neutral-800">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-red-600 to-rose-600 text-white flex items-center justify-center shadow-lg">
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
              <h3 className="text-xl font-black text-white">{currentPlan.name} Membership</h3>
              <span
                className={`text-[10px] uppercase font-extrabold px-2.5 py-0.5 rounded-full ${
                  isActive
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                }`}
              >
                {status}
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              {isFree ? "Default Free Tier" : `Active until ${formattedExpiry}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/subscription"
            className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold transition"
          >
            Manage Subscription
          </Link>
          {isFree && (
            <Link
              href="/subscriptions"
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-bold transition flex items-center gap-1 shadow-md shadow-red-600/30"
            >
              <span>Upgrade</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5 text-xs">
        <div className="p-3 rounded-2xl bg-neutral-950/60 border border-neutral-800/80">
          <div className="flex items-center gap-1.5 text-neutral-400 mb-1">
            <Clock className="w-3.5 h-3.5" />
            <span>Remaining Days</span>
          </div>
          <p className="text-base font-bold text-white">
            {isFree ? "No Expiry" : remainingDays !== null && remainingDays !== undefined ? `${remainingDays} Days` : "Active"}
          </p>
        </div>

        <div className="p-3 rounded-2xl bg-neutral-950/60 border border-neutral-800/80">
          <div className="flex items-center gap-1.5 text-neutral-400 mb-1">
            <Calendar className="w-3.5 h-3.5" />
            <span>Valid Until</span>
          </div>
          <p className="text-sm font-bold text-white truncate">{formattedExpiry}</p>
        </div>

        <div className="p-3 rounded-2xl bg-neutral-950/60 border border-neutral-800/80">
          <div className="flex items-center gap-1.5 text-neutral-400 mb-1">
            <Download className="w-3.5 h-3.5" />
            <span>Downloads Left</span>
          </div>
          <p className="text-base font-bold text-white">
            {dailyDownloadsRemaining ?? 0} Today
          </p>
        </div>

        <div className="p-3 rounded-2xl bg-neutral-950/60 border border-neutral-800/80">
          <div className="flex items-center gap-1.5 text-neutral-400 mb-1">
            <Tv className="w-3.5 h-3.5" />
            <span>Max Streaming</span>
          </div>
          <p className="text-base font-bold text-white">{streamingQuality}</p>
        </div>
      </div>
    </div>
  )
}

export default SubscriptionSummaryCard
