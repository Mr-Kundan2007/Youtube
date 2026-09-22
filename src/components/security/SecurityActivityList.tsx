import React from "react"
import { SecurityActivityItem } from "@/services/securityService"
import {
  ShieldAlert,
  ShieldCheck,
  AlertCircle,
  Clock,
  Globe,
  ChevronLeft,
  ChevronRight,
  Info,
} from "lucide-react"

interface SecurityActivityListProps {
  activities: SecurityActivityItem[]
  loading: boolean
  page: number
  totalPages: number
  totalCount: number
  severityFilter: string
  onSeverityChange: (sev: string) => void
  onPageChange: (newPage: number) => void
}

export const SecurityActivityList: React.FC<SecurityActivityListProps> = ({
  activities,
  loading,
  page,
  totalPages,
  totalCount,
  severityFilter,
  onSeverityChange,
  onPageChange,
}) => {
  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-600/15 text-red-600 dark:text-red-400 border border-red-600/30">
            CRITICAL
          </span>
        )
      case "HIGH":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30">
            HIGH
          </span>
        )
      case "MEDIUM":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
            MEDIUM
          </span>
        )
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
            LOW
          </span>
        )
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
      case "HIGH":
        return <AlertCircle className="w-4 h-4 text-red-500" />
      case "MEDIUM":
        return <ShieldAlert className="w-4 h-4 text-amber-500" />
      default:
        return <ShieldCheck className="w-4 h-4 text-blue-500" />
    }
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString(undefined, {
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

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-[var(--border)] bg-[var(--card)]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-[var(--muted-foreground)] mr-1">Severity:</span>
          {["ALL", "LOW", "MEDIUM", "HIGH", "CRITICAL"].map((sev) => (
            <button
              key={sev}
              onClick={() => onSeverityChange(sev === "ALL" ? "" : sev)}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                (sev === "ALL" && !severityFilter) || severityFilter === sev
                  ? "bg-blue-600 text-white"
                  : "bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              {sev === "ALL" ? "All Levels" : sev}
            </button>
          ))}
        </div>

        <div className="text-xs text-[var(--muted-foreground)]">
          Total Events: <span className="font-semibold text-[var(--foreground)]">{totalCount}</span>
        </div>
      </div>

      {/* Activity Timeline List */}
      {loading ? (
        <div className="p-8 text-center text-xs text-[var(--muted-foreground)] rounded-xl border border-[var(--border)]">
          Loading security activity...
        </div>
      ) : activities.length === 0 ? (
        <div className="p-8 text-center rounded-xl border border-[var(--border)] bg-[var(--card)]">
          <Info className="w-8 h-8 text-[var(--muted-foreground)] mx-auto mb-2 opacity-50" />
          <p className="text-sm font-semibold text-[var(--foreground)]">No Security Activity Recorded</p>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
            Your account does not have any security activity matching the selected filters.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] divide-y divide-[var(--border)] overflow-hidden">
          {activities.map((act) => (
            <div
              key={act.id || act._id}
              className="p-4 flex items-start gap-3.5 hover:bg-[var(--muted)]/40 transition-colors"
            >
              <div className="mt-0.5 shrink-0">{getSeverityIcon(act.severity)}</div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap justify-between">
                  <span className="text-sm font-semibold text-[var(--foreground)] truncate">
                    {act.title}
                  </span>
                  {getSeverityBadge(act.severity)}
                </div>

                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                  {act.description}
                </p>

                <div className="flex items-center gap-3 text-[11px] text-[var(--muted-foreground)] mt-2 flex-wrap">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {formatDate(act.timestamp)}
                  </span>
                  {act.ip && (
                    <span className="flex items-center gap-1">
                      <Globe className="w-3 h-3" /> {act.ip}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2 pt-2">
          <p className="text-xs text-[var(--muted-foreground)]">
            Showing page {page} of {totalPages}
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

export default SecurityActivityList
