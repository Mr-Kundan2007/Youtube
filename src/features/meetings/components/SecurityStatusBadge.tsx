"use client"

import React from "react"
import { Lock, ShieldCheck, AlertTriangle } from "lucide-react"

interface SecurityStatusBadgeProps {
  isE2EEActive: boolean
  isSupported?: boolean
  securityMode?: "STANDARD" | "E2EE"
  keyVersion?: number
  onClick?: () => void
  className?: string
}

export const SecurityStatusBadge: React.FC<SecurityStatusBadgeProps> = ({
  isE2EEActive,
  isSupported = true,
  securityMode = "STANDARD",
  keyVersion = 1,
  onClick,
  className = "",
}) => {
  const isE2EEMode = securityMode === "E2EE"

  if (isE2EEMode && isE2EEActive) {
    return (
      <div
        onClick={onClick}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 text-xs font-semibold select-none cursor-pointer hover:bg-emerald-900/80 transition-all shadow-sm ${className}`}
        title={`End-to-End Encrypted (AES-GCM 256-bit, Key v${keyVersion})`}
      >
        <Lock className="w-3.5 h-3.5 text-emerald-400" />
        <span className="hidden md:inline">E2EE Active</span>
      </div>
    )
  }

  if (isE2EEMode && !isSupported) {
    return (
      <div
        onClick={onClick}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-950/80 border border-amber-500/40 text-amber-400 text-xs font-semibold select-none cursor-pointer hover:bg-amber-900/80 transition-all shadow-sm ${className}`}
        title="E2EE is not supported by your current browser. Falling back to encrypted WebRTC transport."
      >
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
        <span className="hidden md:inline">E2EE Unavailable</span>
      </div>
    )
  }

  // Standard Mode: Transport Encrypted via WebRTC (DTLS-SRTP)
  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-zinc-300 text-xs font-semibold select-none cursor-pointer hover:bg-white/10 transition-all ${className}`}
      title="WebRTC Transport Encrypted (DTLS 1.2 / SRTP)"
    >
      <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
      <span className="hidden md:inline">Encrypted</span>
    </div>
  )
}
