import React from "react"
import { Sparkles, Crown, Zap, ArrowRight } from "lucide-react"
import { SubscriptionPlan } from "@/services/subscriptionService"

interface UpgradeRecommendationsProps {
  currentPlanSlug?: string
  plans: SubscriptionPlan[]
  onSelectPlan: (plan: SubscriptionPlan) => void
}

export const UpgradeRecommendations: React.FC<UpgradeRecommendationsProps> = ({
  currentPlanSlug = "free",
  plans,
  onSelectPlan,
}) => {
  const current = (currentPlanSlug || "free").toLowerCase()

  // If already on highest tier
  if (current === "gold") {
    return (
      <div className="my-8 p-6 rounded-3xl bg-gradient-to-r from-amber-950/40 via-yellow-950/20 to-neutral-900 border border-amber-500/40 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0">
            <Crown className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-white font-bold text-base sm:text-lg flex items-center gap-2">
              VIP Gold Member
              <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40">
                Highest Tier
              </span>
            </h4>
            <p className="text-xs text-neutral-400 mt-1">
              You are enjoying the ultimate experience: 4K Ultra HD HDR streaming, 50 daily downloads, ad-free viewing, and 5 simultaneous screens.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Determine target recommended plan
  let targetSlug = "silver"
  let headline = "Recommended for you: Silver Membership"
  let perks = "Get 100% Ad-Free viewing, 2K Quad HD streaming, full course library, and 15 daily offline downloads."
  let TargetIcon = Sparkles

  if (current === "silver") {
    targetSlug = "gold"
    headline = "Elevate to VIP: Gold Membership"
    perks = "Unlock 4K Ultra HD HDR streaming, 50 daily downloads, and stream across 5 screens simultaneously."
    TargetIcon = Crown
  } else if (current === "free") {
    targetSlug = "silver"
    headline = "Most Popular: Upgrade to Silver"
    perks = "Experience zero ads, complete premium courses, Full HD streaming, and 15 daily downloads."
    TargetIcon = Sparkles
  } else if (current === "bronze") {
    targetSlug = "silver"
    headline = "Step Up to Silver Membership"
    perks = "Remove all ads, unlock full courses, and upgrade to 2K streaming with 15 daily downloads."
    TargetIcon = Sparkles
  }

  const targetPlan = plans.find((p) => p.slug.toLowerCase() === targetSlug)

  return (
    <div className="my-8 p-6 rounded-3xl bg-gradient-to-r from-red-950/50 via-neutral-900 to-neutral-900 border border-red-500/40 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-5">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0">
          <TargetIcon className="w-6 h-6" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold text-red-400 tracking-wider">
              Smart Recommendation
            </span>
          </div>
          <h4 className="text-white font-bold text-base sm:text-lg">{headline}</h4>
          <p className="text-xs text-neutral-300 mt-1 max-w-xl">{perks}</p>
        </div>
      </div>

      {targetPlan && (
        <button
          type="button"
          onClick={() => onSelectPlan(targetPlan)}
          className="shrink-0 w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-red-600/30 flex items-center justify-center gap-1.5 transition cursor-pointer"
        >
          <span>Upgrade to {targetPlan.name}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

export default UpgradeRecommendations
