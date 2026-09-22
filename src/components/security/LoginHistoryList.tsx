import React from "react"
import { LoginHistoryItem } from "@/services/securityService"
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Lock,
  ChevronLeft,
  ChevronRight,
  Globe,
  MapPin,
  Laptop,
  Smartphone,
  Tablet,
  CheckCircle2,
} from "lucide-react"

interface LoginHistoryListProps {
  history: LoginHistoryItem[]
  loading: boolean
  page: number
  totalPages: number
  totalCount: number
  statusFilter: string
  deviceFilter: string
  onStatusChange: (status: string) => void
  onDeviceChange: (device: string) => void
  onPageChange: (newPage: number) => void
}

export const LoginHistoryList: React.FC<LoginHistoryListProps> = ({
  history,
  loading,
  page,
  totalPages,
  totalCount,
  statusFilter,
  deviceFilter,
  onStatusChange,
  onDeviceChange,
  onPageChange,
}) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "SUCCESS":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" /> Successful
          </span>
        )
      case "OTP_REQUIRED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <ShieldAlert className="w-3 h-3" /> OTP Required
          </span>
        )
      case "FAILED":
      case "OTP_FAILED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
            <AlertTriangle className="w-3 h-3" /> Failed
          </span>
        )
      case "BLOCKED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-600/15 text-rose-700 dark:text-rose-400 border border-rose-600/30">
            <Lock className="w-3 h-3" /> Blocked
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--muted)] text-[var(--muted-foreground)]">
            {status}
          </span>
        )
    }
  }

  const getDeviceIcon = (type: string) => {
    const t = (type || "").toLowerCase()
    if (t.includes("mobile") || t.includes("phone")) return <Smartphone className="w-4 h-4" />
    if (t.includes("tablet") || t.includes("ipad")) return <Tablet className="w-4 h-4" />
    return <Laptop className="w-4 h-4" />
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    } catch {
      return dateStr
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-[var(--border)] bg-[var(--card)]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-[var(--muted-foreground)] mr-1">Status:</span>
          {["ALL", "SUCCESS", "OTP_REQUIRED", "FAILED", "BLOCKED"].map((s) => (
            <button
              key={s}
              onClick={() => onStatusChange(s === "ALL" ? "" : s)}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                (s === "ALL" && !statusFilter) || statusFilter === s
                  ? "bg-blue-600 text-white"
                  : "bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              {s === "ALL" ? "All" : s.replace("_", " ")}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[var(--muted-foreground)]">Device:</span>
          <select
            value={deviceFilter}
            onChange={(e) => onDeviceChange(e.target.value)}
            className="px-2.5 py-1 text-xs rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none"
          >
            <option value="">All Devices</option>
            <option value="desktop">Desktop</option>
            <option value="mobile">Mobile</option>
            <option value="tablet">Tablet</option>
          </select>
        </div>
      </div>

      {/* History Items */}
      {loading ? (
        <div className="p-8 text-center text-xs text-[var(--muted-foreground)] rounded-xl border border-[var(--border)]">
          Loading login history...
        </div>
      ) : history.length === 0 ? (
        <div className="p-8 text-center rounded-xl border border-[var(--border)] bg-[var(--card)]">
          <ShieldCheck className="w-8 h-8 text-[var(--muted-foreground)] mx-auto mb-2 opacity-50" />
          <p className="text-sm font-semibold text-[var(--foreground)]">No Login Events Found</p>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
            There are no recorded login attempts matching your filter criteria.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] divide-y divide-[var(--border)] overflow-hidden">
          {history.map((item) => {
            const locationStr = [
              item.location?.city,
              item.location?.state,
              item.location?.country,
            ]
              .filter(Boolean)
              .join(", ") || "Location unavailable"

            return (
              <div
                key={item.id || item._id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[var(--muted)]/50 transition-colors"
              >
                {/* Left: Device & Method */}
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[var(--muted)] text-[var(--foreground)] flex items-center justify-center shrink-0 mt-0.5">
                    {getDeviceIcon(item.device?.type || "")}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-[var(--foreground)]">
                        {item.browser?.name || "Browser"} on {item.operatingSystem?.name || "OS"}
                      </span>
                      {getStatusBadge(item.status)}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-[var(--muted-foreground)] mt-1 flex-wrap">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {locationStr}
                      </span>
                      <span className="flex items-center gap-1">
                        <Globe className="w-3 h-3" /> {item.maskedIP}
                      </span>
                      {item.verificationMethod && (
                        <span className="font-medium text-blue-500">
                          Verified via {item.verificationMethod}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Timestamp */}
                <div className="text-xs text-[var(--muted-foreground)] sm:text-right shrink-0">
                  <p>{formatDate(item.loginAt)}</p>
                  <p className="text-[10px] opacity-75">{item.authenticationMethod || "PASSWORD"}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2 pt-2">
          <p className="text-xs text-[var(--muted-foreground)]">
            Showing page {page} of {totalPages} ({totalCount} total events)
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1 || loading}
              className="p-2 rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-semibold px-2">{page}</span>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages || loading}
              className="p-2 rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default LoginHistoryList
