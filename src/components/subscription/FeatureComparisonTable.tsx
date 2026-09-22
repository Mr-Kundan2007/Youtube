import React from "react"
import { Check, X, Lock, Sparkles, HelpCircle } from "lucide-react"
import { SubscriptionPlan } from "@/services/subscriptionService"

interface FeatureComparisonTableProps {
  plans: SubscriptionPlan[]
  currentPlanSlug?: string
  onSelectPlan?: (plan: SubscriptionPlan) => void
}

interface FeatureRow {
  name: string
  description?: string
  free: string | boolean
  bronze: string | boolean
  silver: string | boolean
  gold: string | boolean
}

interface FeatureCategory {
  categoryName: string
  features: FeatureRow[]
}

const COMPARISON_CATEGORIES: FeatureCategory[] = [
  {
    categoryName: "Video Access & Catalog",
    features: [
      {
        name: "Standard Public Videos",
        description: "Access to community and public uploaded videos",
        free: true,
        bronze: true,
        silver: true,
        gold: true,
      },
      {
        name: "Premium Video Access",
        description: "Full access to our curated premium video catalog",
        free: "Limited",
        bronze: "Full",
        silver: "Full",
        gold: "Unlimited",
      },
      {
        name: "Exclusive & Early Access Videos",
        description: "VIP early window releases and creator exclusives",
        free: false,
        bronze: false,
        silver: "Selected",
        gold: "Full Access",
      },
      {
        name: "Priority Server Bandwidth",
        description: "Zero-buffering priority CDN routing for smoother playback",
        free: false,
        bronze: false,
        silver: true,
        gold: true,
      },
    ],
  },
  {
    categoryName: "Streaming & Playback Quality",
    features: [
      {
        name: "Maximum Streaming Resolution",
        description: "Highest available video resolution cap",
        free: "720p HD",
        bronze: "1080p Full HD",
        silver: "1440p 2K QHD",
        gold: "4K Ultra HD HDR",
      },
      {
        name: "Concurrent Active Streams",
        description: "Number of screens streaming simultaneously on one account",
        free: "1 screen",
        bronze: "2 screens",
        silver: "3 screens",
        gold: "5 screens",
      },
      {
        name: "Daily Watch-Time Limit",
        description: "Daily video consumption allowance",
        free: "120 mins / day",
        bronze: "360 mins / day",
        silver: "Unlimited",
        gold: "Unlimited",
      },
      {
        name: "Ad-Free Playback",
        description: "Watch videos without preroll or midroll video advertisements",
        free: false,
        bronze: false,
        silver: true,
        gold: true,
      },
    ],
  },
  {
    categoryName: "Offline Downloads & Quota",
    features: [
      {
        name: "Daily Offline Video Downloads",
        description: "Number of videos you can download offline per calendar day",
        free: "1 / day",
        bronze: "5 / day",
        silver: "15 / day",
        gold: "50 / day",
      },
      {
        name: "Max Download Quality",
        description: "Resolution for offline downloaded video files",
        free: "720p HD",
        bronze: "1080p Full HD",
        silver: "1080p Full HD",
        gold: "4K Ultra HD",
      },
      {
        name: "Registered Download Devices",
        description: "Total devices allowed to store offline videos",
        free: "1 device",
        bronze: "2 devices",
        silver: "5 devices",
        gold: "10 devices",
      },
    ],
  },
  {
    categoryName: "Learning & Premium Courses",
    features: [
      {
        name: "Premium Structured Courses",
        description: "Access to complete multi-chapter courses and learning modules",
        free: "Free previews",
        bronze: "Free previews",
        silver: true,
        gold: true,
      },
      {
        name: "Exclusive VIP Masterclasses",
        description: "Top-tier instructor masterclasses and certification content",
        free: false,
        bronze: false,
        silver: "Selected",
        gold: "All Tracks",
      },
      {
        name: "Downloadable Course Assets",
        description: "Exercise files, project code, and study guides",
        free: false,
        bronze: false,
        silver: true,
        gold: true,
      },
    ],
  },
  {
    categoryName: "Support & Account Privileges",
    features: [
      {
        name: "Interactive Video Meetings",
        description: "Join or host interactive video conference sessions",
        free: "Join only",
        bronze: "Host (Basic)",
        silver: "Host + Record",
        gold: "Host + E2EE + Rec",
      },
      {
        name: "Customer Support Tier",
        description: "Speed and channel of customer service assistance",
        free: "Community",
        bronze: "Standard Email",
        silver: "Priority 24/7",
        gold: "Dedicated VIP",
      },
    ],
  },
]

export const FeatureComparisonTable: React.FC<FeatureComparisonTableProps> = ({
  plans,
  currentPlanSlug = "free",
  onSelectPlan,
}) => {
  const currentSlug = currentPlanSlug.toLowerCase()

  const renderValue = (val: string | boolean, planKey: string) => {
    if (val === true) {
      return (
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400">
          <Check className="w-4 h-4" />
          <span className="sr-only">Included</span>
        </span>
      )
    }
    if (val === false) {
      return (
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-neutral-800 text-neutral-500">
          <X className="w-3.5 h-3.5" />
          <span className="sr-only">Not Included</span>
        </span>
      )
    }
    return (
      <span className="text-xs font-semibold text-neutral-200">
        {val}
      </span>
    )
  }

  return (
    <div className="w-full my-12">
      <div className="text-center mb-8">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Compare All Features & Limits
        </h2>
        <p className="text-sm text-neutral-400 mt-2 max-w-2xl mx-auto">
          Deep-dive into the exact capabilities, limits, and allowances of each subscription plan.
        </p>
      </div>

      <div className="relative overflow-x-auto rounded-3xl border border-neutral-800 bg-neutral-900/60 backdrop-blur-md shadow-2xl">
        <table className="w-full text-left border-collapse min-w-[720px]">
          <caption className="sr-only">Subscription Plan Feature Comparison Table</caption>
          <thead>
            <tr className="border-b border-neutral-800 bg-neutral-950/80 sticky top-0 z-20">
              <th scope="col" className="p-4 sm:p-5 text-sm font-bold text-neutral-400 w-1/3">
                Features & Limits
              </th>
              {["free", "bronze", "silver", "gold"].map((tier) => {
                const planObj = plans.find((p) => p.slug.toLowerCase() === tier)
                const isCurrent = currentSlug === tier
                const isPopular = tier === "silver"

                return (
                  <th
                    key={tier}
                    scope="col"
                    className={`p-4 sm:p-5 text-center w-1/6 transition-colors ${
                      isCurrent ? "bg-red-950/20 border-x border-red-500/30" : ""
                    }`}
                  >
                    <div className="flex flex-col items-center">
                      <span className="text-sm font-extrabold uppercase tracking-wider text-white">
                        {planObj?.name || tier}
                      </span>
                      {isPopular && (
                        <span className="text-[9px] uppercase font-extrabold px-2 py-0.5 mt-1 rounded-full bg-red-600 text-white shadow-sm">
                          Popular
                        </span>
                      )}
                      {isCurrent && (
                        <span className="text-[9px] uppercase font-bold px-2 py-0.5 mt-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          Current
                        </span>
                      )}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>

          <tbody>
            {COMPARISON_CATEGORIES.map((cat, catIdx) => (
              <React.Fragment key={catIdx}>
                {/* Category Header */}
                <tr className="bg-neutral-950/90 border-t border-b border-neutral-800/80">
                  <th
                    colSpan={5}
                    scope="colgroup"
                    className="py-3 px-5 text-xs font-extrabold uppercase tracking-wider text-red-400"
                  >
                    {cat.categoryName}
                  </th>
                </tr>

                {/* Category Feature Rows */}
                {cat.features.map((feat, featIdx) => (
                  <tr
                    key={featIdx}
                    className="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors"
                  >
                    <th scope="row" className="py-3.5 px-5 text-xs text-neutral-300 font-medium">
                      <div className="font-semibold text-white">{feat.name}</div>
                      {feat.description && (
                        <div className="text-[11px] text-neutral-400 mt-0.5">{feat.description}</div>
                      )}
                    </th>

                    <td className={`py-3.5 px-4 text-center ${currentSlug === "free" ? "bg-red-950/10 border-x border-red-500/20" : ""}`}>
                      {renderValue(feat.free, "free")}
                    </td>
                    <td className={`py-3.5 px-4 text-center ${currentSlug === "bronze" ? "bg-red-950/10 border-x border-red-500/20" : ""}`}>
                      {renderValue(feat.bronze, "bronze")}
                    </td>
                    <td className={`py-3.5 px-4 text-center ${currentSlug === "silver" ? "bg-red-950/10 border-x border-red-500/20" : ""}`}>
                      {renderValue(feat.silver, "silver")}
                    </td>
                    <td className={`py-3.5 px-4 text-center ${currentSlug === "gold" ? "bg-red-950/10 border-x border-red-500/20" : ""}`}>
                      {renderValue(feat.gold, "gold")}
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default FeatureComparisonTable
