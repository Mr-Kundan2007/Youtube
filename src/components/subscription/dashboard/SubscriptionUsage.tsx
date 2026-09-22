import React from "react"
import Link from "next/link"
import {
  Clock,
  Download,
  Tv,
  Layers,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
} from "lucide-react"
import { PlanLimits, SubscriptionUsageData } from "@/services/subscriptionService"

interface SubscriptionUsageProps {
  usage: SubscriptionUsageData | null
  limits: PlanLimits | null
  currentPlanSlug?: string
}

export const SubscriptionUsage: React.FC<SubscriptionUsageProps> = ({
  usage,
  limits,
  currentPlanSlug = "free",
}) => {
  const planSlug = currentPlanSlug.toLowerCase()
  const isGold = planSlug === "gold"

  // 1. Watch Time Calculations
  const watchSeconds = usage?.watchTimeSeconds || 0
  const watchMinutes = Math.round(watchSeconds / 60)
  const watchHours = Math.floor(watchMinutes / 60)
  const watchMinsRemainder = watchMinutes % 60
  const watchTimeFormatted =
    watchHours > 0 ? `${watchHours}h ${watchMinsRemainder}m` : `${watchMinsRemainder}m`

  const isWatchTimeUnlimited = limits?.dailyWatchTime === null || limits?.dailyWatchTime === undefined
  const watchTimeLimitMinutes = limits?.dailyWatchTime || 120
  const remainingWatchMinutes = isWatchTimeUnlimited
    ? null
    : Math.max(0, watchTimeLimitMinutes - watchMinutes)

  const watchPercent = isWatchTimeUnlimited
    ? 0
    : Math.min(100, Math.round((watchMinutes / watchTimeLimitMinutes) * 100))

  // 2. Download Calculations
  const downloadsUsed = usage?.downloadCount || 0
  const dailyDownloadLimit = limits?.dailyDownloadLimit ?? 1
  const remainingDownloads = Math.max(0, dailyDownloadLimit - downloadsUsed)
  const downloadPercent = Math.min(100, Math.round((downloadsUsed / dailyDownloadLimit) * 100))

  // 3. Streaming Quality
  const streamingQuality = limits?.streamingQuality || "720p"

  // 4. Concurrent Streams
  const maxStreams = limits?.maxConcurrentStreams || 1
  const activeStreams = usage?.streamCount || 1

  return (
    <div className="p-6 sm:p-8 rounded-3xl bg-neutral-900/60 border border-neutral-800 backdrop-blur-md shadow-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-red-500" />
            <span>Today's Usage & Allowances</span>
          </h3>
          <p className="text-xs text-neutral-400 mt-0.5">
            Real-time daily consumption metrics. Quotas reset automatically at 00:00 UTC.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Watch Time Card */}
        <div className="p-5 rounded-2xl bg-neutral-950/60 border border-neutral-800/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-red-500/10 text-red-400">
                  <Clock className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                  Daily Watch Time
                </span>
              </div>
              <span className="text-xs font-bold text-white">
                {isWatchTimeUnlimited ? "Unlimited" : `${watchTimeFormatted} / ${Math.round(watchTimeLimitMinutes / 60)}h`}
              </span>
            </div>

            {isWatchTimeUnlimited ? (
              <p className="text-xs text-emerald-400 font-semibold my-3 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>Unlimited streaming on your membership</span>
              </p>
            ) : (
              <div className="my-3 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-neutral-400">
                  <span>Used: {watchTimeFormatted}</span>
                  <span>
                    Remaining: {Math.floor((remainingWatchMinutes || 0) / 60)}h {(remainingWatchMinutes || 0) % 60}m
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-neutral-900 border border-neutral-800 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      watchPercent > 90 ? "bg-red-500" : "bg-gradient-to-r from-red-600 to-rose-600"
                    }`}
                    style={{ width: `${watchPercent}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-neutral-800/80 text-[11px] text-neutral-400 flex items-center justify-between">
            <span>Quota Type: Daily reset</span>
            {!isWatchTimeUnlimited && (
              <Link href="/subscriptions" className="text-red-400 hover:text-red-300 font-semibold">
                Upgrade for Unlimited
              </Link>
            )}
          </div>
        </div>

        {/* Downloads Usage Card */}
        <div className="p-5 rounded-2xl bg-neutral-950/60 border border-neutral-800/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                  <Download className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                  Daily Offline Downloads
                </span>
              </div>
              <span className="text-xs font-bold text-white">
                {downloadsUsed} / {dailyDownloadLimit} Used
              </span>
            </div>

            <div className="my-3 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-neutral-400">
                <span>{remainingDownloads} downloads remaining today</span>
                <span>Max Quality: {limits?.maxDownloadQuality || "1080p"}</span>
              </div>
              <div className="w-full h-2 rounded-full bg-neutral-900 border border-neutral-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${downloadPercent}%` }}
                />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-neutral-800/80 text-[11px] text-neutral-400 flex items-center justify-between">
            <span>Max Quality: {limits?.maxDownloadQuality || "720p"}</span>
            <Link href="/subscriptions" className="text-red-400 hover:text-red-300 font-semibold">
              Need more downloads?
            </Link>
          </div>
        </div>

        {/* Streaming Resolution Card */}
        <div className="p-5 rounded-2xl bg-neutral-950/60 border border-neutral-800/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
                <Tv className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                Streaming Resolution Cap
              </span>
            </div>

            <div className="flex items-baseline gap-2 my-2">
              <span className="text-2xl font-black text-white">{streamingQuality}</span>
              <span className="text-xs text-neutral-400">
                {streamingQuality === "4k"
                  ? "Ultra HD HDR (Highest Available)"
                  : streamingQuality === "1440p"
                  ? "2K Quad HD"
                  : streamingQuality === "1080p"
                  ? "Full HD High Bitrate"
                  : "Standard HD"}
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-neutral-800/80 text-[11px] flex items-center justify-between">
            {!isGold ? (
              <>
                <span className="text-neutral-400">4K Ultra HD available on Gold</span>
                <Link
                  href="/subscriptions?plan=gold"
                  className="text-red-400 hover:text-red-300 font-bold flex items-center gap-1"
                >
                  <span>Unlock 4K</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </>
            ) : (
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Max Resolution Active
              </span>
            )}
          </div>
        </div>

        {/* Concurrent Streams Card */}
        <div className="p-5 rounded-2xl bg-neutral-950/60 border border-neutral-800/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                <Layers className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                Concurrent Active Screens
              </span>
            </div>

            <div className="flex items-baseline gap-2 my-2">
              <span className="text-2xl font-black text-white">
                {activeStreams} / {maxStreams}
              </span>
              <span className="text-xs text-neutral-400">
                simultaneous active device stream(s)
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-neutral-800/80 text-[11px] text-neutral-400 flex items-center justify-between">
            <span>Devices: up to {limits?.maxDevices ?? 1} registered</span>
            {maxStreams < 5 && (
              <Link href="/subscriptions" className="text-red-400 hover:text-red-300 font-semibold">
                Increase screen limit
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default SubscriptionUsage
