"use client"

import React, { useEffect, useRef } from "react"
import {
  X,
  ScreenShare,
  Monitor,
  Disc,
  MessageSquare,
  Users,
  Hand,
  Smile,
  Settings,
  Lock,
  Unlock,
  Shield,
} from "lucide-react"
import { MeetingRole } from "../types/meeting"

interface MobileMoreMenuProps {
  isOpen: boolean
  onClose: () => void
  isScreenSharing: boolean
  allowScreenShare: boolean
  onToggleScreenShare: () => void
  isRecording: boolean
  canRecord: boolean
  isRecordingLoading: boolean
  onToggleRecord?: () => void
  unreadChatCount: number
  onToggleChat: () => void
  participantCount: number
  onToggleParticipants: () => void
  isHandRaised: boolean
  onToggleHandRaise: () => void
  onOpenSettings: () => void
  userRole: MeetingRole
  isLocked: boolean
  onToggleLock?: (lock: boolean) => void
  onOpenSecurity: () => void
  securityMode?: "STANDARD" | "E2EE"
  onSendReaction?: (emoji: string) => void
}

export const MobileMoreMenu: React.FC<MobileMoreMenuProps> = ({
  isOpen,
  onClose,
  isScreenSharing,
  allowScreenShare,
  onToggleScreenShare,
  isRecording,
  canRecord,
  isRecordingLoading,
  onToggleRecord,
  unreadChatCount,
  onToggleChat,
  participantCount,
  onToggleParticipants,
  isHandRaised,
  onToggleHandRaise,
  onOpenSettings,
  userRole,
  isLocked,
  onToggleLock,
  onOpenSecurity,
  securityMode = "STANDARD",
  onSendReaction,
}) => {
  const sheetRef = useRef<HTMLDivElement | null>(null)
  const isHostOrCoHost = userRole === "HOST" || userRole === "CO_HOST"
  const effectiveCanRecord = canRecord || isHostOrCoHost

  // Focus management & Escape listener
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    sheetRef.current?.focus()

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:hidden bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={sheetRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="more-menu-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full bg-zinc-900 border-t border-white/10 rounded-t-3xl p-5 pb-safe shadow-2xl flex flex-col max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-250 focus:outline-none"
      >
        {/* Top Drag Pill */}
        <div className="flex justify-center mb-3">
          <div className="w-12 h-1.5 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <h2 id="more-menu-title" className="text-base font-semibold text-white">
            Meeting Controls
          </h2>
          <button
            onClick={onClose}
            aria-label="Close controls menu"
            className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 touch-target-44 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Reactions Bar */}
        {onSendReaction && (
          <div className="flex items-center justify-around py-2 px-2 bg-white/5 rounded-2xl mt-3">
            {["❤️", "👍", "👏", "🎉", "😂", "😮"].map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  onSendReaction(emoji)
                  onClose()
                }}
                aria-label={`Send reaction ${emoji}`}
                className="w-10 h-10 flex items-center justify-center text-xl hover:scale-125 active:scale-95 transition-transform touch-target-44"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* Actions Grid */}
        <div className="grid grid-cols-4 gap-3 pt-3">
          {/* 1. Chat */}
          <button
            onClick={() => {
              onToggleChat()
              onClose()
            }}
            className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-white/5 hover:bg-white/10 active:bg-white/15 touch-target-44 transition-all relative"
            aria-label={`Chat (${unreadChatCount} unread)`}
          >
            <div className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center text-white relative">
              <MessageSquare className="w-5 h-5" />
              {unreadChatCount > 0 && (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-bold">
                  {unreadChatCount}
                </span>
              )}
            </div>
            <span className="text-[11px] font-medium text-zinc-300">Chat</span>
          </button>

          {/* 2. Participants */}
          <button
            onClick={() => {
              onToggleParticipants()
              onClose()
            }}
            className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-white/5 hover:bg-white/10 active:bg-white/15 touch-target-44 transition-all"
            aria-label={`Participants (${participantCount})`}
          >
            <div className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center text-white relative">
              <Users className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-zinc-800 border border-white/10 text-zinc-300 text-[10px] font-semibold">
                {participantCount}
              </span>
            </div>
            <span className="text-[11px] font-medium text-zinc-300">People</span>
          </button>

          {/* 3. Raise Hand */}
          <button
            onClick={() => {
              onToggleHandRaise()
              onClose()
            }}
            className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl touch-target-44 transition-all ${
              isHandRaised
                ? "bg-amber-500/20 border border-amber-500/40 text-amber-300"
                : "bg-white/5 hover:bg-white/10 text-zinc-300"
            }`}
            aria-label={isHandRaised ? "Lower hand" : "Raise hand"}
          >
            <div
              className={`w-11 h-11 rounded-full flex items-center justify-center ${
                isHandRaised ? "bg-amber-500 text-amber-950" : "bg-white/10 text-white"
              }`}
            >
              <Hand className={`w-5 h-5 ${isHandRaised ? "fill-current animate-bounce" : ""}`} />
            </div>
            <span className="text-[11px] font-medium">{isHandRaised ? "Lowered" : "Raise"}</span>
          </button>

          {/* 4. Record Meeting */}
          {onToggleRecord && (
            <button
              onClick={() => {
                if (effectiveCanRecord || isRecording) {
                  onToggleRecord()
                  onClose()
                } else {
                  alert("Only meeting hosts and co-hosts can start recordings.")
                }
              }}
              disabled={isRecordingLoading}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl touch-target-44 transition-all ${
                isRecording
                  ? "bg-red-600/20 border border-red-500/40 text-red-400"
                  : "bg-white/5 hover:bg-white/10 text-zinc-300"
              } disabled:opacity-50`}
              aria-label={isRecording ? "Stop recording" : "Start recording"}
            >
              <div
                className={`w-11 h-11 rounded-full flex items-center justify-center ${
                  isRecording ? "bg-red-600 text-white animate-pulse" : "bg-white/10 text-red-500"
                }`}
              >
                <Disc className={`w-5 h-5 ${isRecording ? "animate-spin text-white" : ""}`} />
              </div>
              <span className="text-[11px] font-medium">{isRecording ? "Stop REC" : "Record"}</span>
            </button>
          )}

          {/* 5. Screen Share */}
          {allowScreenShare && (
            <button
              onClick={() => {
                onToggleScreenShare()
                onClose()
              }}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl touch-target-44 transition-all ${
                isScreenSharing
                  ? "bg-blue-600/20 border border-blue-500/40 text-blue-400"
                  : "bg-white/5 hover:bg-white/10 text-zinc-300"
              }`}
              aria-label={isScreenSharing ? "Stop sharing screen" : "Share screen"}
            >
              <div
                className={`w-11 h-11 rounded-full flex items-center justify-center ${
                  isScreenSharing ? "bg-blue-600 text-white" : "bg-white/10 text-white"
                }`}
              >
                {isScreenSharing ? <Monitor className="w-5 h-5" /> : <ScreenShare className="w-5 h-5" />}
              </div>
              <span className="text-[11px] font-medium">{isScreenSharing ? "Stop Share" : "Share"}</span>
            </button>
          )}

          {/* 6. Settings */}
          <button
            onClick={() => {
              onOpenSettings()
              onClose()
            }}
            className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-white/5 hover:bg-white/10 active:bg-white/15 touch-target-44 transition-all text-zinc-300"
            aria-label="Device settings"
          >
            <div className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center text-white">
              <Settings className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-medium">Settings</span>
          </button>

          {/* 7. Security & E2EE Info */}
          <button
            onClick={() => {
              onOpenSecurity()
              onClose()
            }}
            className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl touch-target-44 transition-all ${
              securityMode === "E2EE"
                ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                : "bg-white/5 hover:bg-white/10 text-zinc-300"
            }`}
            aria-label="Security and Encryption Status"
          >
            <div
              className={`w-11 h-11 rounded-full flex items-center justify-center ${
                securityMode === "E2EE"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                  : "bg-white/10 text-white"
              }`}
            >
              <Shield className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-medium">
              {securityMode === "E2EE" ? "E2EE" : "Security"}
            </span>
          </button>

          {/* 8. Lock / Unlock Meeting (Host / Co-Host) */}
          {isHostOrCoHost && onToggleLock && (
            <button
              onClick={() => {
                onToggleLock(!isLocked)
                onClose()
              }}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl touch-target-44 transition-all ${
                isLocked
                  ? "bg-amber-500/20 border border-amber-500/40 text-amber-400"
                  : "bg-white/5 hover:bg-white/10 text-zinc-300"
              }`}
              aria-label={isLocked ? "Unlock meeting" : "Lock meeting"}
            >
              <div
                className={`w-11 h-11 rounded-full flex items-center justify-center ${
                  isLocked ? "bg-amber-500 text-amber-950" : "bg-white/10 text-white"
                }`}
              >
                {isLocked ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
              </div>
              <span className="text-[11px] font-medium">{isLocked ? "Locked" : "Lock"}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
