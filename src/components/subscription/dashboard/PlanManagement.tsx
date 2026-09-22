import React, { useState } from "react"
import Link from "next/link"
import {
  Sparkles,
  Crown,
  ArrowRight,
  RefreshCw,
  XCircle,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Layers,
  Zap,
} from "lucide-react"
import {
  SubscriptionPlan,
  CurrentSubscriptionDetails,
  restoreCancellation,
  BillingCycleKey,
} from "@/services/subscriptionService"
import CancellationModal from "@/components/subscription/CancellationModal"
import PurchaseConfirmationModal from "@/components/subscription/PurchaseConfirmationModal"

interface PlanManagementProps {
  subscription: CurrentSubscriptionDetails | null
  availablePlans: SubscriptionPlan[]
  onRenewSuccess?: () => void
}

export const PlanManagement: React.FC<PlanManagementProps> = ({
  subscription,
  availablePlans,
  onRenewSuccess,
}) => {
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false)
  const [selectedCycle, setSelectedCycle] = useState<BillingCycleKey>(
    (subscription?.currentPlan?.validityType as BillingCycleKey) || "monthly"
  )
  const [isRestoring, setIsRestoring] = useState(false)
  const [actionNotice, setActionNotice] = useState<{ type: "success" | "info" | "error"; text: string } | null>(
    null
  )

  const currentSlug = (subscription?.currentPlan?.slug || "free").toLowerCase()
  const isFree = currentSlug === "free"
  const isGold = currentSlug === "gold"
  const isCancelled = Boolean(subscription?.cancelAtPeriodEnd)

  // Plan ranks
  const currentRank = isGold ? 4 : currentSlug === "silver" ? 3 : currentSlug === "bronze" ? 2 : 1

  const upgradePlans = availablePlans.filter((p) => {
    const rank = p.rank || (p.slug === "gold" ? 4 : p.slug === "silver" ? 3 : p.slug === "bronze" ? 2 : 1)
    return rank > currentRank
  })

  const downgradePlans = availablePlans.filter((p) => {
    const rank = p.rank || (p.slug === "gold" ? 4 : p.slug === "silver" ? 3 : p.slug === "bronze" ? 2 : 1)
    return rank < currentRank
  })

  const expiryFormatted = subscription?.expiryDate
    ? new Date(subscription.expiryDate).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "Period conclusion"

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-red-500" />
            <span>Manage Your Subscription</span>
          </h3>
          <p className="text-xs text-neutral-400 mt-0.5">
            Upgrade, downgrade, renew, or schedule cancellation for your membership.
          </p>
        </div>
      </div>

      {actionNotice && (
        <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-700 text-xs text-neutral-200 flex items-center justify-between">
          <span>{actionNotice.text}</span>
          <button
            onClick={() => setActionNotice(null)}
            className="text-[11px] font-bold text-red-400 underline ml-3"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* UPGRADE CARD */}
        <div className="p-6 rounded-3xl bg-neutral-900/60 border border-neutral-800 backdrop-blur-md flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-xl bg-red-500/10 text-red-400">
                <Crown className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-bold text-white">Upgrade Your Membership</h4>
            </div>

            {upgradePlans.length > 0 ? (
              <>
                <p className="text-xs text-neutral-300 leading-relaxed mb-4">
                  Step up to a higher tier to unlock higher resolution streaming, increased offline download quotas, and premium courses.
                </p>
                <div className="space-y-2 mb-4">
                  {upgradePlans.map((plan) => (
                    <div
                      key={plan.slug}
                      className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800/80 flex items-center justify-between"
                    >
                      <div>
                        <span className="text-xs font-bold text-white">{plan.name} Tier</span>
                        <span className="text-[11px] text-neutral-400 ml-2">
                          from ₹{plan.price}/mo
                        </span>
                      </div>
                      <Link
                        href={`/subscriptions?plan=${plan.slug}`}
                        className="text-xs font-bold text-red-400 hover:text-red-300 flex items-center gap-1"
                      >
                        <span>Upgrade</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-xs text-neutral-400 my-4 leading-relaxed">
                You are currently on our highest membership tier (Gold VIP). You have unlocked all available streaming and learning benefits!
              </p>
            )}
          </div>

          <div className="pt-4 border-t border-neutral-800/80">
            <Link
              href="/subscriptions"
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs shadow-md shadow-red-600/30 flex items-center justify-center gap-1.5 transition"
            >
              <span>Explore All Subscription Plans</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* RENEWAL & STATUS CARD */}
        {!isFree ? (
          <div className="p-6 rounded-3xl bg-neutral-900/60 border border-neutral-800 backdrop-blur-md flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                  <RefreshCw className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-white">Renewal & Extension</h4>
              </div>

              <p className="text-xs text-neutral-300 leading-relaxed mb-4">
                Your current {subscription?.currentPlan?.name} membership is valid until{" "}
                <strong>{expiryFormatted}</strong>. Extend your subscription anytime.
              </p>

              <div className="p-3.5 rounded-2xl bg-neutral-950/60 border border-neutral-800/80 space-y-2 mb-4 text-xs">
                <div className="flex items-center justify-between text-neutral-400">
                  <span>Renewal Policy:</span>
                  <span className="font-semibold text-white">Manual / On-Demand</span>
                </div>
                <div className="flex items-center justify-between text-neutral-400">
                  <span>Current Billing:</span>
                  <span className="font-semibold text-white capitalize">
                    {subscription?.currentPlan?.validityType || "Monthly"}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-neutral-800/80 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setCheckoutModalOpen(true)}
                className="flex-1 py-2.5 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Renew Membership</span>
              </button>

              {!isCancelled ? (
                <button
                  type="button"
                  onClick={() => setCancelModalOpen(true)}
                  className="py-2.5 px-4 rounded-xl bg-neutral-900 hover:bg-red-950/40 text-neutral-400 hover:text-red-400 border border-neutral-800 text-xs font-semibold transition cursor-pointer"
                >
                  Cancel Plan
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isRestoring}
                  onClick={async () => {
                    try {
                      setIsRestoring(true)
                      await restoreCancellation()
                      setActionNotice({
                        type: "success",
                        text: "Subscription cancellation reversed! Auto-renewal and all benefits remain active.",
                      })
                      if (typeof window !== "undefined") {
                        window.dispatchEvent(new CustomEvent("subscription_updated"))
                      }
                      if (onRenewSuccess) onRenewSuccess()
                    } catch (err: any) {
                      setActionNotice({
                        type: "error",
                        text: err.message || "Failed to restore cancellation.",
                      })
                    } finally {
                      setIsRestoring(false)
                    }
                  }}
                  className="py-2.5 px-4 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-400 border border-emerald-500/40 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{isRestoring ? "Restoring..." : "Keep My Subscription"}</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          /* DOWNGRADE / FREE STATUS CARD */
          <div className="p-6 rounded-3xl bg-neutral-900/60 border border-neutral-800 backdrop-blur-md flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-xl bg-neutral-800 text-neutral-400">
                  <Layers className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-white">Standard Free Membership</h4>
              </div>
              <p className="text-xs text-neutral-300 leading-relaxed mb-4">
                You are currently on the Free tier. There are no recurring fees or cancellation requirements.
              </p>
            </div>
            <div className="pt-4 border-t border-neutral-800/80">
              <Link
                href="/subscriptions"
                className="w-full py-2.5 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold text-xs flex items-center justify-center gap-1.5 transition"
              >
                <span>View Upgrade Comparison</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* DOWNGRADE OPTIONS SECTION */}
      {downgradePlans.length > 0 && (
        <div className="p-6 rounded-3xl bg-neutral-900/40 border border-neutral-800">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              Downgrade Options
            </span>
          </div>
          <p className="text-xs text-neutral-400 mb-4">
            If you wish to switch to a lower tier, the change will take effect at the conclusion of your current paid billing period ({expiryFormatted}). You will not lose any active benefits today.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {downgradePlans.map((p) => (
              <div
                key={p.slug}
                className="p-3.5 rounded-2xl bg-neutral-950/60 border border-neutral-800/80 flex items-center justify-between"
              >
                <div>
                  <div className="text-xs font-bold text-white">{p.name} Plan</div>
                  <div className="text-[11px] text-neutral-400 mt-0.5">₹{p.price}/mo</div>
                </div>
                <Link
                  href={`/subscriptions?plan=${p.slug}`}
                  className="text-xs font-semibold text-neutral-400 hover:text-white"
                >
                  Select
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CANCELLATION MODAL */}
      <CancellationModal
        isOpen={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        subscription={subscription}
        onSuccess={() => {
          setCancelModalOpen(false)
          setActionNotice({
            type: "info",
            text: "Cancellation scheduled successfully. You retain all benefits until period end.",
          })
          if (onRenewSuccess) onRenewSuccess()
        }}
      />

      {/* RENEWAL CHECKOUT MODAL */}
      {checkoutModalOpen && (
        <PurchaseConfirmationModal
          isOpen={checkoutModalOpen}
          onClose={() => {
            setCheckoutModalOpen(false)
            if (onRenewSuccess) onRenewSuccess()
          }}
          plan={
            availablePlans.find((p) => p.slug === currentSlug) ||
            availablePlans.find((p) => p.slug !== "free") ||
            availablePlans[0]
          }
          selectedCycle={selectedCycle}
          onCycleChange={setSelectedCycle}
          currentPlanSlug={currentSlug}
        />
      )}
    </div>
  )
}

export default PlanManagement
