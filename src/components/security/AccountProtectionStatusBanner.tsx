import React from "react"
import { ShieldCheck, ShieldAlert, Shield, Lock, Radio } from "lucide-react"
import { Button } from "@/components/ui/button"

interface AccountProtectionStatusBannerProps {
  status: "NORMAL" | "MONITORING" | "PROTECTED" | "TEMPORARILY_RESTRICTED" | "SECURITY_REVIEW"
  message?: string
  onSecureAccount: () => void
}

export const AccountProtectionStatusBanner: React.FC<AccountProtectionStatusBannerProps> = ({
  status,
  message,
  onSecureAccount,
}) => {
  const isSecure = status === "NORMAL"
  const isProtected = status === "PROTECTED"
  const isElevated = ["MONITORING", "TEMPORARILY_RESTRICTED", "SECURITY_REVIEW"].includes(status)

  const icon = isSecure ? (
    <ShieldCheck className="w-5 h-5 text-emerald-500" />
  ) : isProtected ? (
    <Lock className="w-5 h-5 text-blue-500" />
  ) : (
    <ShieldAlert className="w-5 h-5 text-amber-500" />
  )

  const statusLabel =
    status === "NORMAL"
      ? "Account Secure"
      : status === "PROTECTED"
      ? "Account Protected"
      : status === "MONITORING"
      ? "Enhanced Monitoring Active"
      : status === "TEMPORARILY_RESTRICTED"
      ? "Temporarily Restricted"
      : "Security Review"

  const statusBadgeColor = isSecure
    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
    : isProtected
    ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
    : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"

  return (
    <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-xl bg-[var(--muted)] flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--muted-foreground)]">Account Security Status</span>
            <span
              className={`px-2 py-0.2 rounded-full text-[10px] font-bold border uppercase tracking-wider ${statusBadgeColor}`}
            >
              {statusLabel}
            </span>
          </div>
          <p className="text-sm font-semibold text-[var(--foreground)] mt-0.5">
            {message || (isSecure ? "Your account credentials and active sessions are verified." : "Protection policies are actively shielding your account.")}
          </p>
        </div>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={onSecureAccount}
        className="text-xs font-semibold rounded-xl shrink-0 flex items-center gap-1.5 hover:bg-red-500/10 hover:text-red-600 hover:border-red-500/30"
      >
        <Lock className="w-3.5 h-3.5" />
        <span>Lockdown Account</span>
      </Button>
    </div>
  )
}
