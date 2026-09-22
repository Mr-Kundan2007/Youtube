import React from "react"
import { Calendar, Clock, RefreshCw, CheckCircle2 } from "lucide-react"

interface SubscriptionValidityProps {
  startDate?: string | null
  expiryDate?: string | null
  remainingDays?: number | null
  nextRenewalDate?: string | null
  isFree?: boolean
  isExpired?: boolean
  autoRenew?: boolean
}

export const SubscriptionValidity: React.FC<SubscriptionValidityProps> = ({
  startDate,
  expiryDate,
  remainingDays,
  nextRenewalDate,
  isFree = false,
  isExpired = false,
  autoRenew = false,
}) => {
  // Calculate progress percentage
  let percentUsed = 0
  let totalDays = 30
  let usedDays = 0

  if (!isFree && startDate && expiryDate) {
    const startMs = new Date(startDate).getTime()
    const expiryMs = new Date(expiryDate).getTime()
    const nowMs = Date.now()

    if (expiryMs > startMs) {
      totalDays = Math.max(1, Math.round((expiryMs - startMs) / (1000 * 60 * 60 * 24)))
      usedDays = Math.max(0, Math.round((nowMs - startMs) / (1000 * 60 * 60 * 24)))
      percentUsed = Math.min(100, Math.max(0, Math.round((usedDays / totalDays) * 100)))
    }
  }

  const startFormatted = startDate
    ? new Date(startDate).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Day of Sign-up"

  const expiryFormatted = expiryDate
    ? new Date(expiryDate).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : isFree
    ? "Lifetime"
    : "Active"

  const renewalFormatted = nextRenewalDate
    ? new Date(nextRenewalDate).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : expiryFormatted

  return (
    <div className="p-6 rounded-3xl bg-neutral-900/60 border border-neutral-800 backdrop-blur-md shadow-lg">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-red-500" />
          <h3 className="text-base font-bold text-white">Subscription Validity Timeline</h3>
        </div>
        <span className="text-xs text-neutral-400 font-medium">
          {isFree ? "No Expiration" : autoRenew ? "Auto-Renews" : "Manual Renewal"}
        </span>
      </div>

      {/* Progress Bar Section */}
      {!isFree && (
        <div className="my-5">
          <div className="flex items-center justify-between text-xs text-neutral-400 mb-2">
            <span>Started: {startFormatted}</span>
            <span className="font-semibold text-white">
              {isExpired ? "Period Concluded" : `${percentUsed}% used (${remainingDays || 0} days left)`}
            </span>
            <span>Expires: {expiryFormatted}</span>
          </div>

          <div
            className="relative w-full h-3 rounded-full bg-neutral-950 border border-neutral-800 overflow-hidden"
            role="progressbar"
            aria-valuenow={percentUsed}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Subscription validity progress"
          >
            <div
              className={`h-full transition-all duration-500 ${
                isExpired
                  ? "bg-neutral-600"
                  : percentUsed > 85
                  ? "bg-amber-500"
                  : "bg-gradient-to-r from-red-600 to-rose-600"
              }`}
              style={{ width: `${percentUsed}%` }}
            />
          </div>
        </div>
      )}

      {/* Summary Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
        <div className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800/80">
          <div className="text-neutral-400 text-[11px] mb-0.5">Start Date</div>
          <div className="font-bold text-white">{startFormatted}</div>
        </div>

        <div className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800/80">
          <div className="text-neutral-400 text-[11px] mb-0.5">Expiry Date</div>
          <div className="font-bold text-white">{expiryFormatted}</div>
        </div>

        <div className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800/80">
          <div className="text-neutral-400 text-[11px] mb-0.5">Days Remaining</div>
          <div className="font-bold text-emerald-400">
            {isFree ? "Permanent" : isExpired ? "0 Days" : `${remainingDays ?? 0} Days`}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800/80">
          <div className="text-neutral-400 text-[11px] mb-0.5">Next Renewal</div>
          <div className="font-bold text-white">{isFree ? "N/A" : renewalFormatted}</div>
        </div>
      </div>
    </div>
  )
}

export default SubscriptionValidity
