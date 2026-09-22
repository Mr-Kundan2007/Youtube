import React from "react"
import { AlertTriangle, ShieldAlert, ArrowRight, Lock } from "lucide-react"
import { SecurityAlert } from "@/services/securityAlertService"
import { Button } from "@/components/ui/button"

interface CriticalAlertBannerProps {
  alerts: SecurityAlert[]
  onSecureAccount: () => void
  onReviewAlert: (alert: SecurityAlert) => void
}

export const CriticalAlertBanner: React.FC<CriticalAlertBannerProps> = ({
  alerts,
  onSecureAccount,
  onReviewAlert,
}) => {
  const urgentAlerts = alerts.filter(
    (a) =>
      (a.severity === "CRITICAL" || a.actionRequired) &&
      a.status !== "RESOLVED" &&
      a.status !== "DISMISSED"
  )

  if (urgentAlerts.length === 0) return null

  const topAlert = urgentAlerts[0]
  const isCritical = topAlert.severity === "CRITICAL"

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`mb-6 p-4 rounded-2xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all shadow-sm ${
        isCritical
          ? "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300"
          : "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300"
      }`}
    >
      <div className="flex items-start gap-3.5">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            isCritical ? "bg-red-500 text-white" : "bg-amber-500 text-white"
          }`}
        >
          {isCritical ? <ShieldAlert className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                isCritical
                  ? "bg-red-500 text-white"
                  : "bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40"
              }`}
            >
              {isCritical ? "Critical Alert" : "Action Required"}
            </span>
            <span className="text-xs text-[var(--muted-foreground)]">
              {urgentAlerts.length} urgent notification{urgentAlerts.length > 1 ? "s" : ""}
            </span>
          </div>
          <h3 className="text-base font-bold text-[var(--foreground)] mt-1">{topAlert.title}</h3>
          <p className="text-xs text-[var(--muted-foreground)] line-clamp-2 mt-0.5">
            {topAlert.message}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5 w-full md:w-auto shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onReviewAlert(topAlert)}
          className="text-xs font-semibold rounded-xl flex-1 md:flex-initial"
        >
          Review Activity
        </Button>
        <Button
          size="sm"
          onClick={onSecureAccount}
          className={`text-xs font-semibold rounded-xl text-white flex-1 md:flex-initial flex items-center gap-1.5 ${
            isCritical
              ? "bg-red-600 hover:bg-red-700"
              : "bg-amber-600 hover:bg-amber-700"
          }`}
        >
          <Lock className="w-3.5 h-3.5" />
          <span>Secure My Account</span>
        </Button>
      </div>
    </div>
  )
}
