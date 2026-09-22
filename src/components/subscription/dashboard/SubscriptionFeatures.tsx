import React from "react"
import Link from "next/link"
import { Check, Lock, ArrowRight, ShieldCheck, Sparkles } from "lucide-react"
import { PlanFeatures, PlanLimits } from "@/services/subscriptionService"

interface SubscriptionFeaturesProps {
  features: PlanFeatures | null
  limits: PlanLimits | null
  currentPlanSlug?: string
}

export const SubscriptionFeatures: React.FC<SubscriptionFeaturesProps> = ({
  features,
  limits,
  currentPlanSlug = "free",
}) => {
  const plan = currentPlanSlug.toLowerCase()
  const isGold = plan === "gold"
  const isSilverOrGold = plan === "silver" || isGold
  const isBronzeOrHigher = plan === "bronze" || isSilverOrGold

  const featureGroups = [
    {
      category: "Video Access",
      items: [
        {
          name: "Standard Public Videos",
          unlocked: true,
          badge: null,
        },
        {
          name: "Premium Video Library",
          unlocked: Boolean(features?.premiumVideoAccess || isBronzeOrHigher),
          requiredTier: "Bronze",
        },
        {
          name: "VIP Exclusives & Early Access",
          unlocked: Boolean(features?.exclusiveContent || isGold),
          requiredTier: "Gold",
        },
        {
          name: "Priority CDN Streaming Bandwidth",
          unlocked: Boolean(features?.priorityContent || isSilverOrGold),
          requiredTier: "Silver",
        },
      ],
    },
    {
      category: "Streaming & Playback",
      items: [
        {
          name: `Streaming Resolution (${limits?.streamingQuality || "720p"})`,
          unlocked: true,
          badge: limits?.streamingQuality || "720p",
        },
        {
          name: "100% Ad-Free Video Playback",
          unlocked: Boolean(features?.adFree || isSilverOrGold),
          requiredTier: "Silver",
        },
        {
          name: `Simultaneous Active Screens (${limits?.maxConcurrentStreams || 1})`,
          unlocked: true,
          badge: `${limits?.maxConcurrentStreams || 1} Screen(s)`,
        },
        {
          name: "Fast Streaming Routing",
          unlocked: Boolean(features?.fastStreaming || isSilverOrGold),
          requiredTier: "Silver",
        },
      ],
    },
    {
      category: "Offline Downloads",
      items: [
        {
          name: `Daily Download Allowance (${limits?.dailyDownloadLimit ?? 1}/day)`,
          unlocked: true,
          badge: `${limits?.dailyDownloadLimit ?? 1} / day`,
        },
        {
          name: "Encrypted Offline Playback",
          unlocked: Boolean(features?.offlineDownloads || isBronzeOrHigher),
          requiredTier: "Bronze",
        },
        {
          name: `Download Devices (${limits?.maxDevices ?? 1} Authorized)`,
          unlocked: true,
          badge: `${limits?.maxDevices ?? 1} Device(s)`,
        },
      ],
    },
    {
      category: "Learning & Courses",
      items: [
        {
          name: "Full Premium Course Catalog",
          unlocked: Boolean(features?.premiumCourses || isSilverOrGold),
          requiredTier: "Silver",
        },
        {
          name: "Exclusive Masterclasses & Study Materials",
          unlocked: isGold,
          requiredTier: "Gold",
        },
      ],
    },
  ]

  return (
    <div className="p-6 sm:p-8 rounded-3xl bg-neutral-900/60 border border-neutral-800 backdrop-blur-md shadow-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-red-500" />
            <h3 className="text-lg font-bold text-white">Your Plan Feature Privileges</h3>
          </div>
          <p className="text-xs text-neutral-400 mt-0.5">
            Features currently enabled or locked for your active account level.
          </p>
        </div>

        <Link
          href="/subscriptions"
          className="text-xs font-bold text-red-400 hover:text-red-300 flex items-center gap-1 self-start sm:self-auto"
        >
          <span>Upgrade to Unlock More</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {featureGroups.map((group, idx) => (
          <div
            key={idx}
            className="p-4 sm:p-5 rounded-2xl bg-neutral-950/60 border border-neutral-800/80 space-y-3"
          >
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-red-400">
              {group.category}
            </h4>

            <div className="space-y-2">
              {group.items.map((item, itemIdx) => (
                <div
                  key={itemIdx}
                  className="flex items-center justify-between gap-3 py-1.5 text-xs text-neutral-200"
                >
                  <div className="flex items-center gap-2.5">
                    {item.unlocked ? (
                      <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-neutral-800 text-neutral-500 flex items-center justify-center shrink-0">
                        <Lock className="w-3 h-3" />
                      </div>
                    )}
                    <span className={item.unlocked ? "text-neutral-200" : "text-neutral-500 line-through"}>
                      {item.name}
                    </span>
                  </div>

                  <div>
                    {item.badge && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-neutral-800 text-neutral-300">
                        {item.badge}
                      </span>
                    )}
                    {!item.unlocked && item.requiredTier && (
                      <Link
                        href={`/subscriptions?plan=${item.requiredTier.toLowerCase()}`}
                        className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition flex items-center gap-1"
                      >
                        <Lock className="w-2.5 h-2.5" />
                        <span>Unlock ({item.requiredTier})</span>
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default SubscriptionFeatures
