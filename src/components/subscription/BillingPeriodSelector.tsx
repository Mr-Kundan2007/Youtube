import React from "react"
import { Sparkles } from "lucide-react"
import { BillingCycleKey } from "@/services/subscriptionService"

interface BillingPeriodSelectorProps {
  selectedCycle: BillingCycleKey
  onChange: (cycle: BillingCycleKey) => void
  disabled?: boolean
}

export const BillingPeriodSelector: React.FC<BillingPeriodSelectorProps> = ({
  selectedCycle,
  onChange,
  disabled = false,
}) => {
  const options: {
    key: BillingCycleKey
    label: string
    badge: string | null
    subtext: string
  }[] = [
    {
      key: "monthly",
      label: "Monthly",
      badge: null,
      subtext: "Standard",
    },
    {
      key: "quarterly",
      label: "Quarterly",
      badge: "Save 10%",
      subtext: "3 Months",
    },
    {
      key: "yearly",
      label: "Yearly",
      badge: "Save 20%",
      subtext: "Best Value",
    },
  ]

  return (
    <div className="flex flex-col items-center justify-center my-6">
      <div
        role="tablist"
        aria-label="Subscription Billing Period"
        className="inline-flex p-1.5 bg-neutral-900/90 border border-neutral-800 rounded-2xl shadow-inner backdrop-blur-md"
      >
        {options.map((opt) => {
          const isSelected = selectedCycle === opt.key
          return (
            <button
              key={opt.key}
              role="tab"
              type="button"
              id={`billing-tab-${opt.key}`}
              aria-selected={isSelected}
              aria-controls={`billing-panel-${opt.key}`}
              tabIndex={0}
              disabled={disabled}
              onClick={() => onChange(opt.key)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight") {
                  const nextIndex = (options.findIndex((o) => o.key === opt.key) + 1) % options.length
                  onChange(options[nextIndex].key)
                } else if (e.key === "ArrowLeft") {
                  const prevIndex = (options.findIndex((o) => o.key === opt.key) - 1 + options.length) % options.length
                  onChange(options[prevIndex].key)
                }
              }}
              className={`relative flex items-center gap-2 px-4 sm:px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer touch-target-44 ${
                isSelected
                  ? "bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-600/30 scale-[1.02]"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60"
              }`}
            >
              <span>{opt.label}</span>
              {opt.badge && (
                <span
                  className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1 ${
                    isSelected
                      ? "bg-black/30 text-amber-300 border border-amber-400/40 shadow-sm"
                      : "bg-red-500/20 text-red-400 border border-red-500/30"
                  }`}
                >
                  {opt.key === "yearly" && <Sparkles className="w-2.5 h-2.5" />}
                  {opt.badge}
                </span>
              )}
            </button>
          )
        })}
      </div>
      <p className="text-xs text-neutral-400 mt-2.5 text-center">
        {selectedCycle === "monthly" && "Billed monthly. Cancel anytime."}
        {selectedCycle === "quarterly" && "Billed every 3 months. Save 10% compared to monthly."}
        {selectedCycle === "yearly" && "Billed annually. Save 20% compared to monthly."}
      </p>
    </div>
  )
}

export default BillingPeriodSelector
