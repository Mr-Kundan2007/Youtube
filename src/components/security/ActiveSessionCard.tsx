import React from "react"
import { UserSession } from "@/services/sessionService"
import {
  Laptop,
  Smartphone,
  Tablet,
  Monitor,
  Globe,
  MapPin,
  Clock,
  LogOut,
  Sparkles,
} from "lucide-react"

interface ActiveSessionCardProps {
  session: UserSession
  onTerminate: (session: UserSession) => void
}

export const ActiveSessionCard: React.FC<ActiveSessionCardProps> = ({
  session,
  onTerminate,
}) => {
  const getDeviceIcon = (type: string) => {
    const t = (type || "").toLowerCase()
    if (t.includes("mobile") || t.includes("phone")) return <Smartphone className="w-5 h-5" />
    if (t.includes("tablet") || t.includes("ipad")) return <Tablet className="w-5 h-5" />
    if (t.includes("laptop") || t.includes("macbook")) return <Laptop className="w-5 h-5" />
    return <Monitor className="w-5 h-5" />
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "N/A"
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch {
      return dateStr
    }
  }

  const locationString = [
    session.location?.city,
    session.location?.state,
    session.location?.country,
  ]
    .filter(Boolean)
    .join(", ") || "Approximate location unavailable"

  return (
    <div
      className={`p-5 rounded-2xl border transition-all ${
        session.isCurrentSession
          ? "border-blue-500/40 bg-blue-500/5 shadow-sm"
          : "border-[var(--border)] bg-[var(--card)] hover:border-gray-400/40"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Left: Device Icon & Identity */}
        <div className="flex items-start gap-3.5">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
              session.isCurrentSession
                ? "bg-blue-600 text-white"
                : "bg-[var(--muted)] text-[var(--foreground)]"
            }`}
          >
            {getDeviceIcon(session.device?.type || "")}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-[var(--foreground)]">
                {session.device?.model && session.device.model !== "Unknown Device"
                  ? session.device.model
                  : `${session.browser?.name || "Browser"} on ${session.operatingSystem?.name || "Device"}`}
              </h3>

              {session.isCurrentSession ? (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Current Session
                </span>
              ) : (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Active
                </span>
              )}
            </div>

            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
              {session.browser?.name || "Browser"} {session.browser?.version || ""} &bull;{" "}
              {session.operatingSystem?.name || "OS"}
            </p>
          </div>
        </div>

        {/* Right: Logout Action */}
        <button
          onClick={() => onTerminate(session)}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
            session.isCurrentSession
              ? "bg-red-500/10 text-red-600 hover:bg-red-500/20 border border-red-500/20"
              : "border border-[var(--border)] text-[var(--foreground)] hover:bg-red-500/10 hover:text-red-600 hover:border-red-500/20"
          }`}
          title="Terminate this session"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>{session.isCurrentSession ? "Logout" : "Logout Device"}</span>
        </button>
      </div>

      {/* Metadata Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-4 pt-3.5 border-t border-[var(--border)] text-xs text-[var(--muted-foreground)]">
        <div className="flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-[var(--muted-foreground)] shrink-0" />
          <span className="truncate">{locationString}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <Globe className="w-3.5 h-3.5 text-[var(--muted-foreground)] shrink-0" />
          <span className="truncate">IP: {session.maskedIP || "Masked"}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-[var(--muted-foreground)] shrink-0" />
          <span className="truncate">Active: {formatDate(session.lastActivityAt)}</span>
        </div>
      </div>
    </div>
  )
}

export default ActiveSessionCard
