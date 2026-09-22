import React, { useState } from "react"
import Link from "next/link"
import { AlertCircle, Clock, XCircle, AlertTriangle, ArrowRight, X, CheckCircle2 } from "lucide-react"
import { restoreCancellation } from "@/services/subscriptionService"

interface SubscriptionNotificationProps {
  status: string
  isExpired?: boolean
  isCancelled?: boolean
  remainingDays?: number | null
  expiryDate?: string | null
  isFree?: boolean
  onRenewClick?: () => void
  onRestoreSuccess?: () => void
}

export const SubscriptionNotification: React.FC<SubscriptionNotificationProps> = ({
  status,
  isExpired = false,
  isCancelled = false,
  remainingDays = null,
  expiryDate = null,
  isFree = false,
  onRenewClick,
  onRestoreSuccess,
}) => {
  const [dismissed, setDismissed] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)

  if (dismissed || isFree) return null

  const normStatus = status.toLowerCase()
  const isExpiringSoon =
    !isExpired && remainingDays !== null && remainingDays !== undefined && remainingDays <= 3 && remainingDays > 0

  const expiryFormatted = expiryDate
    ? new Date(expiryDate).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "soon"

  // 1. Expired state
  if (isExpired || normStatus === "expired") {
    return (
      <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-rose-950/40 border border-rose-500/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg text-xs sm:text-sm text-rose-200">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 shrink-0">
            <XCircle className="w-5 h-5" />
          </div>
          <div>
            <span className="font-extrabold text-white block sm:inline mr-2">Subscription Expired</span>
            <span>
              Your premium subscription has ended. You are currently on the Free tier with all your personal data safely preserved.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <Link
            href="/subscriptions"
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition flex items-center gap-1 shadow-md shadow-rose-600/30"
          >
            <span>Renew Plan</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <button
            onClick={() => setDismissed(true)}
            aria-label="Dismiss banner"
            className="p-1.5 text-rose-400 hover:text-white rounded-lg hover:bg-rose-900/40 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  // 2. Expiring soon state
  if (isExpiringSoon) {
    return (
      <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-amber-950/40 border border-amber-500/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg text-xs sm:text-sm text-amber-200">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="font-extrabold text-white block sm:inline mr-2">
              Subscription Expiring Soon ({remainingDays} day{remainingDays > 1 ? "s" : ""} left)
            </span>
            <span>
              Your plan will conclude on {expiryFormatted}. Renew today to maintain uninterrupted 4K streaming and downloads.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          {onRenewClick ? (
            <button
              onClick={onRenewClick}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition flex items-center gap-1 shadow-md shadow-amber-600/30 cursor-pointer"
            >
              <span>Renew Now</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <Link
              href="/subscriptions"
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition flex items-center gap-1 shadow-md shadow-amber-600/30"
            >
              <span>Renew Now</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
          <button
            onClick={() => setDismissed(true)}
            aria-label="Dismiss banner"
            className="p-1.5 text-amber-400 hover:text-white rounded-lg hover:bg-amber-900/40 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  // 3. Cancelled but still active state
  if (isCancelled) {
    return (
      <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-neutral-900 border border-amber-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg text-xs sm:text-sm text-neutral-300">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <span className="font-extrabold text-white block sm:inline mr-2">Cancellation Scheduled</span>
            <span>
              Your recurring renewal is turned off. You retain all active premium privileges until {expiryFormatted}.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <button
            type="button"
            disabled={isRestoring}
            onClick={async () => {
              try {
                setIsRestoring(true)
                await restoreCancellation()
                if (typeof window !== "undefined") {
                  window.dispatchEvent(new CustomEvent("subscription_updated"))
                }
                if (onRestoreSuccess) onRestoreSuccess()
              } catch (err) {
                // ignore
              } finally {
                setIsRestoring(false)
              }
            }}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition flex items-center gap-1 shadow-md shadow-emerald-600/30 cursor-pointer disabled:opacity-50"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{isRestoring ? "Restoring..." : "Keep Subscription"}</span>
          </button>
          <button
            onClick={() => setDismissed(true)}
            aria-label="Dismiss banner"
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  // 4. Payment pending
  if (normStatus === "payment_pending" || normStatus === "pending") {
    return (
      <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-blue-950/40 border border-blue-500/50 flex items-center justify-between gap-4 text-xs sm:text-sm text-blue-200">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="font-extrabold text-white mr-2">Payment Verification in Progress</span>
            <span>Your membership benefits will be active momentarily upon transaction confirmation.</span>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss banner"
          className="p-1.5 text-blue-400 hover:text-white rounded-lg hover:bg-blue-900/40 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return null
}

export default SubscriptionNotification
