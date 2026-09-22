import React from "react"
import {
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  Info,
  MapPin,
  Laptop,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
} from "lucide-react"
import { SecurityAlert } from "@/services/securityAlertService"
import { Button } from "@/components/ui/button"

interface SecurityAlertCardProps {
  alert: SecurityAlert
  onConfirm: (alertId: string) => void
  onReportSuspicious: (alertId: string) => void
  onMarkRead: (alertId: string) => void
  isProcessing?: boolean
}

export const SecurityAlertCard: React.FC<SecurityAlertCardProps> = ({
  alert,
  onConfirm,
  onReportSuspicious,
  onMarkRead,
  isProcessing = false,
}) => {
  const isUnread = alert.status === "UNREAD"
  const isResolved = alert.status === "RESOLVED"
  const isActionRequired = alert.status === "ACTION_REQUIRED" || alert.actionRequired

  const severity = alert.severity || "MEDIUM"

  const severityColor =
    severity === "CRITICAL"
      ? "text-red-500 bg-red-500/10 border-red-500/20"
      : severity === "HIGH"
      ? "text-orange-500 bg-orange-500/10 border-orange-500/20"
      : severity === "MEDIUM"
      ? "text-amber-500 bg-amber-500/10 border-amber-500/20"
      : "text-blue-500 bg-blue-500/10 border-blue-500/20"

  const severityIcon =
    severity === "CRITICAL" ? (
      <ShieldAlert className="w-4 h-4" />
    ) : severity === "HIGH" ? (
      <AlertTriangle className="w-4 h-4" />
    ) : (
      <Info className="w-4 h-4" />
    )

  const formattedTime = alert.createdAt
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        hour12: true,
      }).format(new Date(alert.createdAt))
    : "Recently"

  return (
    <div
      className={`p-5 rounded-2xl border transition-all ${
        isUnread
          ? "bg-[var(--card)] border-[var(--border)] shadow-sm"
          : "bg-[var(--card)]/60 border-[var(--border)] opacity-90"
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex items-start gap-3.5">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${severityColor}`}
          >
            {severityIcon}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${severityColor}`}
              >
                {severity}
              </span>

              {isUnread && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500 text-white">
                  NEW
                </span>
              )}

              {isResolved && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  <span>
                    {alert.actionStatus === "CONFIRMED"
                      ? "Confirmed"
                      : alert.actionStatus === "REPORTED"
                      ? "Secured"
                      : "Resolved"}
                  </span>
                </span>
              )}
            </div>

            <h4 className="text-base font-bold text-[var(--foreground)] mt-1.5">{alert.title}</h4>
            <p className="text-xs text-[var(--muted-foreground)] mt-1 leading-relaxed max-w-xl">
              {alert.message}
            </p>

            {/* Context metadata pills */}
            <div className="flex items-center gap-3 text-[11px] text-[var(--muted-foreground)] mt-3 flex-wrap">
              {alert.metadata?.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-red-500" />
                  <span>{alert.metadata.location}</span>
                </span>
              )}
              {alert.metadata?.device && (
                <span className="flex items-center gap-1">
                  <Laptop className="w-3 h-3 text-blue-500" />
                  <span>
                    {alert.metadata.device}
                    {alert.metadata.browser ? ` • ${alert.metadata.browser}` : ""}
                  </span>
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-500" />
                <span>{formattedTime}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-end sm:self-center shrink-0 mt-2 sm:mt-0">
          {isActionRequired && !isResolved && (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={isProcessing}
                onClick={() => onConfirm(alert.id || alert._id!)}
                className="text-xs font-semibold rounded-xl hover:bg-emerald-500/10 hover:text-emerald-600 hover:border-emerald-500/30"
              >
                This Was Me
              </Button>
              <Button
                size="sm"
                disabled={isProcessing}
                onClick={() => onReportSuspicious(alert.id || alert._id!)}
                className="text-xs font-semibold rounded-xl bg-red-600 hover:bg-red-700 text-white"
              >
                Not Me
              </Button>
            </>
          )}

          {isUnread && !isActionRequired && (
            <Button
              variant="ghost"
              size="sm"
              disabled={isProcessing}
              onClick={() => onMarkRead(alert.id || alert._id!)}
              className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] rounded-xl flex items-center gap-1"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Mark Read</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
