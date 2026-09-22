import React, { useState } from "react"
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  HelpCircle,
  ShieldCheck,
  Sparkles,
  X,
  Loader2,
  ArrowRight,
} from "lucide-react"
import { cancelSubscription, CurrentSubscriptionDetails } from "@/services/subscriptionService"

interface CancellationModalProps {
  isOpen: boolean
  onClose: () => void
  subscription: CurrentSubscriptionDetails | null
  onSuccess?: () => void
}

const CANCELLATION_REASONS = [
  { id: "too_expensive", label: "Too expensive / looking to save money" },
  { id: "not_using_enough", label: "Not using the platform frequently enough" },
  { id: "technical_issues", label: "Encountered streaming or playback issues" },
  { id: "content_selection", label: "Finished the courses/videos I wanted to watch" },
  { id: "temporary_break", label: "Taking a temporary break, will return later" },
  { id: "other", label: "Other reason" },
]

export const CancellationModal: React.FC<CancellationModalProps> = ({
  isOpen,
  onClose,
  subscription,
  onSuccess,
}) => {
  const [step, setStep] = useState<"reason" | "confirm" | "success">("reason")
  const [selectedReason, setSelectedReason] = useState<string>("too_expensive")
  const [customFeedback, setCustomFeedback] = useState<string>("")
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [cancelResult, setCancelResult] = useState<{ cancelEffectiveAt?: string; plan?: string } | null>(null)

  if (!isOpen || !subscription) return null

  const expiryFormatted = subscription.expiryDate
    ? new Date(subscription.expiryDate).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "the end of your current period"

  const handleCancelSubmit = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const selectedObj = CANCELLATION_REASONS.find((r) => r.id === selectedReason)
      const reasonLabel = selectedObj?.label || selectedReason
      const fullReason = customFeedback.trim()
        ? `${reasonLabel} - Note: ${customFeedback.trim()}`
        : reasonLabel

      const result = await cancelSubscription(fullReason)
      setCancelResult(result)
      setStep("success")

      // Notify global state
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("subscription_updated"))
      }

      if (onSuccess) {
        onSuccess()
      }
    } catch (err: any) {
      setError(err.message || "Failed to schedule cancellation. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setStep("reason")
    setError(null)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden">
        {/* Background ambient glow */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header with close button */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800/80 mb-6">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/20">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white">
                {step === "success" ? "Cancellation Scheduled" : "Cancel Subscription Auto-Renewal"}
              </h3>
              <p className="text-[11px] text-neutral-400">
                {subscription.currentPlan?.name} Membership
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* STEP 1: REASON SELECTION */}
        {step === "reason" && (
          <div className="space-y-6">
            {/* Reassurance Banner */}
            <div className="p-4 rounded-2xl bg-amber-950/25 border border-amber-500/30 text-amber-200 text-xs leading-relaxed flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-white block mb-0.5">You will NOT lose access today!</span>
                Your premium features, courses, and daily downloads will remain 100% active until{" "}
                <strong className="text-white underline">{expiryFormatted}</strong>.
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-white uppercase tracking-wider mb-3">
                Why are you canceling? (Optional)
              </label>
              <div className="space-y-2">
                {CANCELLATION_REASONS.map((r) => (
                  <label
                    key={r.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border text-xs cursor-pointer transition ${
                      selectedReason === r.id
                        ? "bg-red-950/20 border-red-500/40 text-white"
                        : "bg-neutral-950/50 border-neutral-800 text-neutral-300 hover:bg-neutral-800/40"
                    }`}
                  >
                    <input
                      type="radio"
                      name="cancel_reason"
                      value={r.id}
                      checked={selectedReason === r.id}
                      onChange={() => setSelectedReason(r.id)}
                      className="accent-red-600"
                    />
                    <span>{r.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {selectedReason === "other" && (
              <div>
                <label className="block text-[11px] font-medium text-neutral-400 mb-1.5">
                  Please let us know how we can improve:
                </label>
                <textarea
                  value={customFeedback}
                  onChange={(e) => setCustomFeedback(e.target.value)}
                  placeholder="Your feedback helps us make the platform better..."
                  rows={2}
                  className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-red-500 transition"
                />
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 py-2.5 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold transition cursor-pointer"
              >
                Keep My Plan
              </button>
              <button
                type="button"
                onClick={() => setStep("confirm")}
                className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition shadow-lg shadow-red-600/30 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: CONFIRMATION PROMPT */}
        {step === "confirm" && (
          <div className="space-y-6">
            <div className="text-center py-2">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center mx-auto mb-3">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-white">Are you sure?</h4>
              <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto leading-relaxed">
                Confirming will disable auto-renewal for your <strong>{subscription.currentPlan?.name}</strong> plan.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-neutral-950/60 border border-neutral-800 space-y-2.5 text-xs text-neutral-300">
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Current Plan:</span>
                <span className="font-bold text-white">{subscription.currentPlan?.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Paid Access Ends:</span>
                <span className="font-bold text-amber-400">{expiryFormatted}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">After Expiry:</span>
                <span className="font-bold text-neutral-200">Automatically moves to Free Plan</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Watch History & Data:</span>
                <span className="font-bold text-emerald-400">100% Safe & Preserved</span>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-950/50 border border-red-500/40 text-xs text-red-200">
                {error}
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep("reason")}
                disabled={isLoading}
                className="flex-1 py-2.5 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold transition disabled:opacity-50 cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleCancelSubmit}
                disabled={isLoading}
                className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Scheduling...</span>
                  </>
                ) : (
                  <span>Confirm Cancellation</span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: SUCCESS CONFIRMATION */}
        {step === "success" && (
          <div className="space-y-6 text-center py-2">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h4 className="text-lg font-bold text-white">Cancellation Scheduled</h4>
              <p className="text-xs text-neutral-300 mt-1 leading-relaxed max-w-sm mx-auto">
                Auto-renewal has been successfully turned off. You will retain full access to all your premium features until:
              </p>
              <div className="mt-3 py-2.5 px-4 rounded-xl bg-neutral-950 border border-neutral-800 inline-block font-mono text-xs font-bold text-amber-400">
                {expiryFormatted}
              </div>
            </div>

            <p className="text-[11px] text-neutral-400 leading-relaxed">
              Change your mind? You can restore your subscription auto-renewal at any point before this date from your dashboard.
            </p>

            <button
              type="button"
              onClick={handleClose}
              className="w-full py-2.5 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold transition cursor-pointer"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default CancellationModal
