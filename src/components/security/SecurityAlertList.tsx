import React, { useState } from "react"
import { Bell, CheckCheck, RefreshCw, ShieldAlert, Filter } from "lucide-react"
import { SecurityAlert } from "@/services/securityAlertService"
import { SecurityAlertCard } from "./SecurityAlertCard"
import { Button } from "@/components/ui/button"

interface SecurityAlertListProps {
  alerts: SecurityAlert[]
  total: number
  page: number
  totalPages: number
  loading: boolean
  onPageChange: (page: number) => void
  onRefresh: () => void
  onMarkRead: (alertId: string) => Promise<void>
  onMarkAllRead: () => Promise<void>
  onConfirm: (alertId: string) => Promise<void>
  onReportSuspicious: (alertId: string) => Promise<void>
  filterStatus: string
  onFilterChange: (status: string) => void
}

export const SecurityAlertList: React.FC<SecurityAlertListProps> = ({
  alerts,
  total,
  page,
  totalPages,
  loading,
  onPageChange,
  onRefresh,
  onMarkRead,
  onMarkAllRead,
  onConfirm,
  onReportSuspicious,
  filterStatus,
  onFilterChange,
}) => {
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [bulkProcessing, setBulkProcessing] = useState(false)

  const handleConfirm = async (id: string) => {
    try {
      setProcessingId(id)
      await onConfirm(id)
    } finally {
      setProcessingId(null)
    }
  }

  const handleReport = async (id: string) => {
    try {
      setProcessingId(id)
      await onReportSuspicious(id)
    } finally {
      setProcessingId(null)
    }
  }

  const handleMarkRead = async (id: string) => {
    try {
      setProcessingId(id)
      await onMarkRead(id)
    } finally {
      setProcessingId(null)
    }
  }

  const handleMarkAllRead = async () => {
    try {
      setBulkProcessing(true)
      await onMarkAllRead()
    } finally {
      setBulkProcessing(false)
    }
  }

  const unreadCount = alerts.filter((a) => a.status === "UNREAD").length

  return (
    <div className="space-y-4">
      {/* List Header & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onFilterChange("")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              filterStatus === ""
                ? "bg-blue-600 text-white"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]"
            }`}
          >
            All Alerts
          </button>
          <button
            onClick={() => onFilterChange("ACTION_REQUIRED")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              filterStatus === "ACTION_REQUIRED"
                ? "bg-amber-600 text-white"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]"
            }`}
          >
            Action Required
          </button>
          <button
            onClick={() => onFilterChange("UNREAD")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              filterStatus === "UNREAD"
                ? "bg-blue-600 text-white"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]"
            }`}
          >
            Unread
          </button>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              disabled={bulkProcessing}
              onClick={handleMarkAllRead}
              className="text-xs font-semibold rounded-xl flex items-center gap-1.5"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark All Read</span>
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            aria-label="Refresh alerts"
            className="text-xs rounded-xl p-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Content Stream */}
      {loading && alerts.length === 0 ? (
        <div className="space-y-3 py-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-5 rounded-2xl border border-[var(--border)] bg-[var(--card)] animate-pulse space-y-2"
            >
              <div className="h-4 bg-[var(--muted)] rounded w-1/4" />
              <div className="h-3 bg-[var(--muted)] rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-2xl border border-dashed border-[var(--border)]">
          <div className="w-12 h-12 rounded-2xl bg-[var(--muted)] flex items-center justify-center mx-auto mb-3 text-[var(--muted-foreground)]">
            <Bell className="w-6 h-6" />
          </div>
          <h4 className="text-base font-bold text-[var(--foreground)]">No Security Alerts</h4>
          <p className="text-xs text-[var(--muted-foreground)] mt-1 max-w-sm mx-auto">
            {filterStatus
              ? "No alerts match the selected filter."
              : "No unusual account activity detected. Your login baseline and active devices are clean."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <SecurityAlertCard
              key={alert.id || alert._id}
              alert={alert}
              onConfirm={handleConfirm}
              onReportSuspicious={handleReport}
              onMarkRead={handleMarkRead}
              isProcessing={processingId === (alert.id || alert._id)}
            />
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-[var(--border)] text-xs">
          <span className="text-[var(--muted-foreground)]">
            Page {page} of {totalPages} ({total} total alerts)
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => onPageChange(page - 1)}
              className="text-xs rounded-xl"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || loading}
              onClick={() => onPageChange(page + 1)}
              className="text-xs rounded-xl"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
