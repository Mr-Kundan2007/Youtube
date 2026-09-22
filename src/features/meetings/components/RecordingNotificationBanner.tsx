"use client"

import React from "react"
import { Disc, CheckCircle2, X } from "lucide-react"
import { RecordingNotification } from "../hooks/useRecording"

interface RecordingNotificationBannerProps {
  notification: RecordingNotification | null
  onDismiss: () => void
}

export const RecordingNotificationBanner: React.FC<RecordingNotificationBannerProps> = ({
  notification,
  onDismiss,
}) => {
  if (!notification) return null

  const isStarted = notification.type === "started"

  return (
    <aside
      role="status"
      aria-label="Recording Notification"
      className="fixed top-16 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-auto"
    >
      <div
        className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl shadow-2xl backdrop-blur-xl border select-none ${
          isStarted
            ? "bg-red-950/90 border-red-500/40 text-red-200 shadow-red-950/50"
            : "bg-emerald-950/90 border-emerald-500/40 text-emerald-200 shadow-emerald-950/50"
        }`}
      >
        <div
          className={`p-1.5 rounded-full ${
            isStarted ? "bg-red-500/20 text-red-400" : "bg-emerald-500/20 text-emerald-400"
          }`}
        >
          {isStarted ? (
            <Disc className="w-4 h-4 animate-spin" />
          ) : (
            <CheckCircle2 className="w-4 h-4" />
          )}
        </div>

        <div className="flex flex-col">
          <span className="text-xs font-semibold leading-tight text-white">
            {notification.message}
          </span>
          <span className="text-[11px] text-zinc-400">
            {isStarted
              ? "Audio, video, and screen shares in this call are being recorded."
              : "Recording has been securely processed and archived."}
          </span>
        </div>

        <button
          onClick={onDismiss}
          className="ml-2 p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
          title="Dismiss notification"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  )
}
