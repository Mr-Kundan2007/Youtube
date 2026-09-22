import React from "react"
import { useRouter } from "next/router"

export interface AccessDeniedOverlayProps {
  requiredPlan?: string
  currentPlan?: string
  message?: string
  onUpgradeClick?: () => void
  onDismiss?: () => void
}

/**
 * AccessDeniedOverlay
 * Premium glassmorphic overlay displayed when a video is gated behind a subscription tier.
 * Completely blocks underlying video playback without frontend bypass.
 */
export const AccessDeniedOverlay: React.FC<AccessDeniedOverlayProps> = ({
  requiredPlan = "Silver",
  currentPlan = "Free",
  message = "This video is exclusive to subscribers. Upgrade your subscription plan to watch immediately in full HD.",
  onUpgradeClick,
  onDismiss,
}) => {
  const router = useRouter()

  const handleUpgrade = () => {
    if (onUpgradeClick) {
      onUpgradeClick()
    } else {
      router.push("/pricing")
    }
  }

  const handleDismiss = () => {
    if (onDismiss) {
      onDismiss()
    } else if (typeof window !== "undefined" && window.history.length > 1) {
      router.back()
    } else {
      router.push("/")
    }
  }

  const formattedRequired =
    requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1).toLowerCase()

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="access-denied-title"
      aria-describedby="access-denied-desc"
      className="absolute inset-0 z-40 flex flex-col items-center justify-center p-6 bg-[#0a0a0f]/90 backdrop-blur-md text-white select-none animate-fadeIn"
      style={{ minHeight: "280px" }}
    >
      <div className="max-w-md w-full flex flex-col items-center text-center p-6 rounded-2xl bg-white/[0.04] border border-white/10 shadow-2xl">
        {/* Lock / Tier Badge */}
        <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-amber-500/20 to-yellow-400/30 border border-amber-400/40 flex items-center justify-center mb-4 text-amber-400 shadow-lg shadow-amber-500/10">
          <svg
            className="w-7 h-7"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>

        {/* Plan Pill */}
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-amber-500/15 border border-amber-500/30 text-amber-300 mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          {formattedRequired} Tier Required
        </span>

        <h2
          id="access-denied-title"
          className="text-xl sm:text-2xl font-bold tracking-tight text-white mb-2"
        >
          Premium Content
        </h2>

        <p
          id="access-denied-desc"
          className="text-sm text-gray-300 leading-relaxed mb-6 max-w-sm"
        >
          {message}
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
          <button
            type="button"
            onClick={handleUpgrade}
            className="w-full sm:flex-1 py-2.5 px-5 rounded-xl font-medium text-sm text-black bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 transition-all shadow-md shadow-amber-500/20 active:scale-95 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
          >
            Upgrade to {formattedRequired}
          </button>

          <button
            type="button"
            onClick={handleDismiss}
            className="w-full sm:w-auto py-2.5 px-5 rounded-xl font-medium text-sm text-gray-300 bg-white/[0.08] hover:bg-white/[0.14] border border-white/10 transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-white/30"
          >
            Go Back
          </button>
        </div>

        {currentPlan && currentPlan !== "Free" && (
          <p className="text-xs text-gray-400 mt-4">
            Current Plan: <span className="text-gray-200 font-medium">{currentPlan}</span>
          </p>
        )}
      </div>
    </div>
  )
}

export default AccessDeniedOverlay
