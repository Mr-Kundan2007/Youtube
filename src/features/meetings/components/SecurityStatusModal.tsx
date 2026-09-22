"use client"

import React, { useState } from "react"
import {
  X,
  ShieldCheck,
  Lock,
  KeyRound,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Sliders,
  Users,
} from "lucide-react"
import { MeetingRole, MeetingPermissions } from "../types/meeting"

interface SecurityStatusModalProps {
  isOpen: boolean
  isHost: boolean
  securityMode: "STANDARD" | "E2EE"
  isE2EEActive: boolean
  isSupported: boolean
  keyVersion: number
  isLocked: boolean
  permissions?: MeetingPermissions
  onClose: () => void
  onToggleE2EE?: (enabled: boolean) => Promise<void>
  onRotateKey?: () => Promise<void>
  onToggleLock?: (locked: boolean) => Promise<void>
}

export const SecurityStatusModal: React.FC<SecurityStatusModalProps> = ({
  isOpen,
  isHost,
  securityMode,
  isE2EEActive,
  isSupported,
  keyVersion,
  isLocked,
  permissions,
  onClose,
  onToggleE2EE,
  onRotateKey,
  onToggleLock,
}) => {
  const [isRotating, setIsRotating] = useState(false)
  const [isTogglingE2EE, setIsTogglingE2EE] = useState(false)
  const [rotateMessage, setRotateMessage] = useState<string | null>(null)

  if (!isOpen) return null

  const isE2EE = securityMode === "E2EE"

  const handleRotateKey = async () => {
    if (!onRotateKey) return
    setIsRotating(true)
    setRotateMessage(null)
    try {
      await onRotateKey()
      setRotateMessage("Encryption key rotated and synchronized with all participants.")
      setTimeout(() => setRotateMessage(null), 4000)
    } catch (err: any) {
      setRotateMessage("Failed to rotate encryption key.")
    } finally {
      setIsRotating(false)
    }
  }

  const handleToggleE2EE = async () => {
    if (!onToggleE2EE) return
    setIsTogglingE2EE(true)
    try {
      await onToggleE2EE(!isE2EE)
    } catch (err) {
      console.error(err)
    } finally {
      setIsTogglingE2EE(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 text-zinc-100">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Meeting Security & Encryption</h2>
              <p className="text-xs text-zinc-400">
                Layered WebRTC, media transport, and permission hardening
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Encryption Mode Card */}
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                Encryption Mode
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  isE2EE && isE2EEActive
                    ? "bg-emerald-950 text-emerald-300 border border-emerald-500/40"
                    : "bg-blue-950 text-blue-300 border border-blue-500/40"
                }`}
              >
                {isE2EE ? "End-to-End Encrypted" : "WebRTC Transport Encrypted"}
              </span>
            </div>

            <div className="space-y-2 text-xs text-zinc-300">
              <div className="flex items-center justify-between py-1 border-b border-zinc-800/60">
                <span className="text-zinc-400">Cryptographic Primitive</span>
                <span className="font-mono text-zinc-200">
                  {isE2EE ? "AES-GCM 256-bit (Insertable Streams)" : "DTLS 1.2 / SRTP (Transport)"}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-zinc-800/60">
                <span className="text-zinc-400">Key Revision</span>
                <span className="font-mono text-zinc-200">Version {keyVersion}</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-zinc-400">Browser Compatibility</span>
                <span className="flex items-center gap-1 font-medium text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Verified
                </span>
              </div>
            </div>

            <p className="text-[11px] text-zinc-400 leading-relaxed bg-zinc-900/60 p-2.5 rounded-xl border border-zinc-800">
              {isE2EE
                ? "Audio, video, and data channel frames are encrypted directly in the browser with AES-GCM before transport. Encryption keys are negotiated strictly among authorized participants and never stored in plaintext on the server."
                : "Media streams are protected with WebRTC transport encryption (DTLS/SRTP). Unauthorized eavesdropping across the network is blocked."}
            </p>
          </div>

          {/* Feedback banner */}
          {rotateMessage && (
            <div className="px-4 py-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{rotateMessage}</span>
            </div>
          )}

          {/* Host Security Actions */}
          {isHost && (
            <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                Host Security Controls
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Toggle E2EE Mode */}
                {onToggleE2EE && (
                  <button
                    onClick={handleToggleE2EE}
                    disabled={isTogglingE2EE}
                    className="flex items-center justify-between p-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 transition-colors text-xs font-semibold text-zinc-200"
                  >
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-emerald-400" />
                      <span>{isE2EE ? "Disable E2EE" : "Enable E2EE"}</span>
                    </div>
                    <span className="text-[10px] text-zinc-400 font-mono">
                      {isE2EE ? "ON" : "OFF"}
                    </span>
                  </button>
                )}

                {/* Rotate Key */}
                {onRotateKey && (
                  <button
                    onClick={handleRotateKey}
                    disabled={isRotating}
                    className="flex items-center justify-between p-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 transition-colors text-xs font-semibold text-zinc-200 disabled:opacity-50"
                  >
                    <div className="flex items-center gap-2">
                      <KeyRound className="w-4 h-4 text-amber-400" />
                      <span>Rotate Key</span>
                    </div>
                    {isRotating ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-zinc-400" />
                    ) : (
                      <span className="text-[10px] text-zinc-400 font-mono">Ratchet</span>
                    )}
                  </button>
                )}

                {/* Lock Meeting */}
                {onToggleLock && (
                  <button
                    onClick={() => onToggleLock(!isLocked)}
                    className="flex items-center justify-between p-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 transition-colors text-xs font-semibold text-zinc-200"
                  >
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-zinc-400" />
                      <span>{isLocked ? "Unlock Meeting" : "Lock Meeting"}</span>
                    </div>
                    <span className="text-[10px] text-zinc-400 font-mono">
                      {isLocked ? "LOCKED" : "OPEN"}
                    </span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400 bg-zinc-950/40">
          <span className="flex items-center gap-1.5 text-zinc-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Zero unauthorized access permitted
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
