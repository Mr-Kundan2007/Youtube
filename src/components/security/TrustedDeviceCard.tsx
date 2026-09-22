import React, { useState } from "react"
import { TrustedDevice } from "@/services/securityService"
import {
  Laptop,
  Smartphone,
  Tablet,
  Monitor,
  Globe,
  MapPin,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Edit2,
  Trash2,
} from "lucide-react"

interface TrustedDeviceCardProps {
  device: TrustedDevice
  onRename: (device: TrustedDevice) => void
  onRevoke: (deviceId: string) => Promise<void>
}

export const TrustedDeviceCard: React.FC<TrustedDeviceCardProps> = ({
  device,
  onRename,
  onRevoke,
}) => {
  const [confirmRevoke, setConfirmRevoke] = useState(false)
  const [revoking, setRevoking] = useState(false)

  const getDeviceIcon = (type: string) => {
    const t = (type || "").toLowerCase()
    if (t.includes("mobile") || t.includes("phone")) return <Smartphone className="w-5 h-5" />
    if (t.includes("tablet") || t.includes("ipad")) return <Tablet className="w-5 h-5" />
    if (t.includes("laptop") || t.includes("macbook")) return <Laptop className="w-5 h-5" />
    return <Monitor className="w-5 h-5" />
  }

  const handleRevoke = async () => {
    try {
      setRevoking(true)
      await onRevoke(device.id || (device as any)._id)
    } finally {
      setRevoking(false)
      setConfirmRevoke(false)
    }
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
    device.location?.city,
    device.location?.state,
    device.location?.country,
  ]
    .filter(Boolean)
    .join(", ") || "Approximate location unavailable"

  const isExpired = device.status === "EXPIRED"

  return (
    <div
      className={`p-5 rounded-2xl border transition-all ${
        device.isCurrentDevice
          ? "border-blue-500/40 bg-blue-500/5 shadow-sm"
          : "border-[var(--border)] bg-[var(--card)] hover:border-gray-400/40"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Left: Device Icon & Core Identity */}
        <div className="flex items-start gap-3.5">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center ${
              device.isCurrentDevice
                ? "bg-blue-600 text-white"
                : isExpired
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                : "bg-[var(--muted)] text-[var(--foreground)]"
            }`}
          >
            {getDeviceIcon(device.device?.type || "")}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-[var(--foreground)]">
                {device.customName || device.deviceName || "Web Browser"}
              </h3>

              {device.isCurrentDevice && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                  This Device
                </span>
              )}

              {isExpired ? (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25 flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3" /> Expired Trust
                </span>
              ) : (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Trusted
                </span>
              )}
            </div>

            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
              {device.browser?.name || "Browser"} {device.browser?.version || ""} on{" "}
              {device.operatingSystem?.name || "OS"}
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onRename(device)}
            className="p-2 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
            title="Rename Device"
            aria-label="Rename Device"
          >
            <Edit2 className="w-4 h-4" />
          </button>

          {confirmRevoke ? (
            <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
              <button
                onClick={handleRevoke}
                disabled={revoking}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors"
              >
                {revoking ? "Revoking..." : "Confirm"}
              </button>
              <button
                onClick={() => setConfirmRevoke(false)}
                disabled={revoking}
                className="px-2 py-1 text-xs rounded-lg border border-[var(--border)] hover:bg-[var(--muted)]"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmRevoke(true)}
              className="p-2 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-500/10 transition-colors"
              title="Revoke Trust"
              aria-label="Revoke Trust"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Metadata Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-4 pt-3.5 border-t border-[var(--border)] text-xs text-[var(--muted-foreground)]">
        <div className="flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-[var(--muted-foreground)] shrink-0" />
          <span className="truncate">{locationString}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <Globe className="w-3.5 h-3.5 text-[var(--muted-foreground)] shrink-0" />
          <span className="truncate">IP: {device.lastKnownIP || "Masked"}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-[var(--muted-foreground)] shrink-0" />
          <span className="truncate">
            {isExpired ? "Expired: " : "Expires: "}
            {formatDate(device.trustExpiresAt)}
          </span>
        </div>
      </div>
    </div>
  )
}

export default TrustedDeviceCard
