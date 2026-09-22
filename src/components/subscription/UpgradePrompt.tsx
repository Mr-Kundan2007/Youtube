import React from "react"
import Link from "next/link"
import { Sparkles, Crown, ArrowRight, X, ShieldAlert } from "lucide-react"

interface UpgradePromptProps {
  currentPlan?: string
  requiredPlan?: string
  featureRequired?: string
  reason?: string
  isOpen?: boolean
  onClose?: () => void
  isBanner?: boolean
}

export const UpgradePrompt: React.FC<UpgradePromptProps> = ({
  currentPlan = "free",
  requiredPlan = "bronze",
  featureRequired = "Premium Video Access",
  reason,
  isOpen = true,
  onClose,
  isBanner = false,
}) => {
  if (!isOpen) return null

  const title = `Upgrade to ${requiredPlan.toUpperCase()}`
  const description =
    reason ||
    `This content is reserved for ${requiredPlan.toUpperCase()} members and above. Upgrade your plan to unlock instant full access.`

  if (isBanner) {
    return (
      <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-gradient-to-r from-red-950/70 via-zinc-900/90 to-zinc-900 border border-red-500/30 rounded-xl shadow-lg my-3 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-600/20 border border-red-500/30 flex items-center justify-center shrink-0">
            <Crown className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h4 className="text-white font-semibold text-sm sm:text-base flex items-center gap-2">
              {title}
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 font-normal">
                {featureRequired}
              </span>
            </h4>
            <p className="text-xs text-zinc-400 mt-0.5">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
          <Link
            href="/pricing"
            className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs sm:text-sm font-semibold transition-all shadow-md"
          >
            Upgrade Now <ArrowRight className="w-4 h-4" />
          </Link>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-zinc-900 border border-red-500/40 rounded-2xl p-6 shadow-2xl">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-zinc-400 hover:text-white transition p-1"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-red-600 to-amber-500 flex items-center justify-center shadow-lg">
            <Crown className="w-6 h-6 text-white" />
          </div>
          <div>
            <span className="text-xs uppercase tracking-wider font-semibold text-red-400">
              Subscription Required
            </span>
            <h3 className="text-xl font-bold text-white">{title}</h3>
          </div>
        </div>

        <div className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-4 mb-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Current Plan:</span>
            <span className="font-semibold text-zinc-200 uppercase">{currentPlan}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Required Tier:</span>
            <span className="font-semibold text-amber-400 uppercase">{requiredPlan}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Feature Required:</span>
            <span className="font-semibold text-zinc-200">{featureRequired}</span>
          </div>
        </div>

        <p className="text-sm text-zinc-300 mb-6 leading-relaxed">{description}</p>

        <div className="flex items-center gap-3">
          {onClose && (
            <button
              onClick={onClose}
              className="flex-1 py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-sm font-medium transition"
            >
              Cancel
            </button>
          )}
          <Link
            href="/pricing"
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-red-600/30 transition-all"
          >
            <Sparkles className="w-4 h-4" /> View Plans
          </Link>
        </div>
      </div>
    </div>
  )
}

export default UpgradePrompt
