import React from "react"
import Link from "next/link"
import { CreditCard, Calendar, CheckCircle2, FileText, ArrowRight, ShieldCheck } from "lucide-react"
import { CurrentSubscriptionDetails, formatPrice } from "@/services/subscriptionService"

interface BillingSummaryProps {
  subscription: CurrentSubscriptionDetails | null
}

export const BillingSummary: React.FC<BillingSummaryProps> = ({ subscription }) => {
  const planSlug = (subscription?.currentPlan?.slug || "free").toLowerCase()
  const isFree = planSlug === "free"
  const price = subscription?.currentPlan?.price || 0
  const currency = subscription?.currentPlan?.currency || "INR"
  const validityType = subscription?.currentPlan?.validityType || "monthly"

  const expiryFormatted = subscription?.expiryDate
    ? new Date(subscription.expiryDate).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : isFree
    ? "Lifetime Free"
    : "Active"

  return (
    <div className="p-6 sm:p-8 rounded-3xl bg-neutral-900/60 border border-neutral-800 backdrop-blur-md shadow-lg">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-red-500" />
            <span>Billing & Invoicing Summary</span>
          </h3>
          <p className="text-xs text-neutral-400 mt-0.5">
            Overview of current pricing period and billing schedule.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs mb-5">
        <div className="p-4 rounded-2xl bg-neutral-950/60 border border-neutral-800/80">
          <span className="text-neutral-400 text-[11px]">Active Plan</span>
          <p className="text-sm font-bold text-white mt-1">
            {subscription?.currentPlan?.name || "Free"}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-neutral-950/60 border border-neutral-800/80">
          <span className="text-neutral-400 text-[11px]">Billing Frequency</span>
          <p className="text-sm font-bold text-white capitalize mt-1">
            {isFree ? "None (Free)" : validityType}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-neutral-950/60 border border-neutral-800/80">
          <span className="text-neutral-400 text-[11px]">Subscription Rate</span>
          <p className="text-sm font-bold text-white mt-1">
            {formatPrice(price, currency)}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-neutral-950/60 border border-neutral-800/80">
          <span className="text-neutral-400 text-[11px]">Next Billing Cycle</span>
          <p className="text-sm font-bold text-white mt-1">{expiryFormatted}</p>
        </div>
      </div>

      {isFree ? (
        <div className="p-4 rounded-2xl bg-neutral-950/40 border border-neutral-800/60 text-xs text-neutral-400 flex items-center justify-between">
          <span>No premium billing history or invoices for standard Free tier accounts.</span>
          <Link
            href="/subscriptions"
            className="text-red-400 hover:text-red-300 font-bold flex items-center gap-1"
          >
            <span>Upgrade to Premium</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-neutral-950/40 border border-neutral-800/60 text-xs text-neutral-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              All transactions are cryptographically verified. Official GST tax invoices and receipts are ready.
            </span>
          </div>
          <Link
            href="/billing"
            className="px-3.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs flex items-center gap-1.5 transition shrink-0 self-start sm:self-auto"
          >
            <span>View Billing & Invoices</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}
    </div>
  )
}

export default BillingSummary
