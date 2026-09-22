import React from "react"
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  ShieldAlert,
  CreditCard,
  RefreshCw,
} from "lucide-react"

interface SubscriptionStatusIndicatorProps {
  status: string
  isExpired?: boolean
  isCancelled?: boolean
  isFree?: boolean
  expiryDate?: string | null
}

export const SubscriptionStatusIndicator: React.FC<SubscriptionStatusIndicatorProps> = ({
  status,
  isExpired = false,
  isCancelled = false,
  isFree = false,
  expiryDate,
}) => {
  const normStatus = status.toLowerCase()

  let icon = CheckCircle2
  let title = "ACTIVE"
  let description = "Your subscription is currently active and all premium features are unlocked."
  let cardClass = "bg-emerald-950/20 border-emerald-500/30 text-emerald-300"
  let iconClass = "text-emerald-400"

  if (isExpired || normStatus === "expired") {
    icon = XCircle
    title = "EXPIRED"
    description = "Your premium subscription period has ended. Your account has gracefully defaulted to the Free tier. Your watch history, courses, and playlists remain 100% safe."
    cardClass = "bg-rose-950/20 border-rose-500/30 text-rose-300"
  } else if (normStatus === "grace_period") {
    icon = AlertTriangle
    title = "GRACE PERIOD"
    description = "Your subscription has concluded, but you have temporary grace period access. Please renew now to maintain uninterrupted access."
    cardClass = "bg-amber-950/20 border-amber-500/30 text-amber-300"
    iconClass = "text-amber-400"
  } else if (isCancelled || normStatus === "cancelled" || normStatus === "cancel_scheduled") {
    icon = AlertTriangle
    title = "SCHEDULED CANCELLATION"
    description = `Auto-renewal is cancelled. You retain all paid benefits until ${
      expiryDate ? new Date(expiryDate).toLocaleDateString("en-IN") : "the end of your current cycle"
    }.`
    cardClass = "bg-amber-950/20 border-amber-500/30 text-amber-300"
    iconClass = "text-amber-400"
  } else if (normStatus === "payment_pending" || normStatus === "pending") {
    icon = Clock
    title = "PAYMENT PENDING"
    description = "Your transaction verification is being processed. Your subscription will activate automatically upon confirmation."
    cardClass = "bg-blue-950/20 border-blue-500/30 text-blue-300"
    iconClass = "text-blue-400"
  } else if (normStatus === "payment_failed") {
    icon = CreditCard
    title = "PAYMENT FAILED"
    description = "Your last renewal payment could not be processed. Please update your payment method to restore premium access."
    cardClass = "bg-red-950/20 border-red-500/30 text-red-300"
    iconClass = "text-red-400"
  } else if (normStatus === "suspended") {
    icon = ShieldAlert
    title = "SUSPENDED"
    description = "This subscription has been temporarily suspended by system operations. Please contact support."
    cardClass = "bg-neutral-900 border-neutral-700 text-neutral-300"
    iconClass = "text-neutral-400"
  } else if (isFree) {
    icon = CheckCircle2
    title = "ACTIVE (FREE TIER)"
    description = "You are currently enjoying our standard Free access. Upgrade anytime to unlock Full HD streaming, premium courses, and offline downloads."
    cardClass = "bg-neutral-900/60 border-neutral-800 text-neutral-300"
    iconClass = "text-neutral-400"
  }

  const StatusIcon = icon

  return (
    <div className={`p-4 sm:p-5 rounded-2xl border flex items-start gap-4 ${cardClass} shadow-sm`}>
      <div className="p-2 rounded-xl bg-black/30 border border-white/5 shrink-0 mt-0.5">
        <StatusIcon className={`w-5 h-5 ${iconClass}`} />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <h4 className="text-xs font-black uppercase tracking-wider text-white">
            Status: {title}
          </h4>
        </div>
        <p className="text-xs sm:text-sm mt-1 leading-relaxed opacity-90">{description}</p>
      </div>
    </div>
  )
}

export default SubscriptionStatusIndicator
