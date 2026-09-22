"use client"

import React, { useState, useEffect } from "react"
import { Copy, Check, Lock, Users, Shield, Film } from "lucide-react"
import { RecordingIndicator } from "./RecordingIndicator"
import { SecurityStatusBadge } from "./SecurityStatusBadge"

interface MeetingHeaderProps {
  title: string
  roomId: string
  isLocked: boolean
  participantCount: number
  startedAt?: string
  isRecording?: boolean
  recordingDurationSeconds?: number
  isE2EEActive?: boolean
  securityMode?: "STANDARD" | "E2EE"
  keyVersion?: number
  onOpenRecordings?: () => void
  onOpenSecurity?: () => void
}

export const MeetingHeader: React.FC<MeetingHeaderProps> = ({
  title,
  roomId,
  isLocked,
  participantCount,
  startedAt,
  isRecording = false,
  recordingDurationSeconds = 0,
  isE2EEActive = false,
  securityMode = "STANDARD",
  keyVersion = 1,
  onOpenRecordings,
  onOpenSecurity,
}) => {
  const [copied, setCopied] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0)

  // Timer
  useEffect(() => {
    const startTime = startedAt ? new Date(startedAt).getTime() : Date.now()
    const interval = setInterval(() => {
      const now = Date.now()
      setElapsedSeconds(Math.max(0, Math.floor((now - startTime) / 1000)))
    }, 1000)

    return () => clearInterval(interval)
  }, [startedAt])

  const formatDuration = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600)
    const mins = Math.floor((totalSeconds % 3600) / 60)
    const secs = totalSeconds % 60

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
    }
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const handleCopy = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <header className="min-h-[4rem] pt-safe px-3 sm:px-6 bg-zinc-950/80 backdrop-blur-xl border-b border-white/10 flex items-center justify-between z-30 select-none shrink-0 gap-2">
      {/* Title & Room ID */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <h1 className="text-sm sm:text-base font-bold text-white truncate max-w-[120px] xs:max-w-[160px] sm:max-w-xs">
          {title || "Meeting"}
        </h1>

        <button
          onClick={handleCopy}
          aria-label={copied ? "Meeting link copied" : "Copy meeting link"}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-zinc-300 transition-colors touch-target-44"
          title="Click to copy meeting link"
        >
          <span className="hidden sm:inline">{roomId}</span>
          {copied ? (
            <Check className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Copy className="w-3.5 h-3.5 text-zinc-400" />
          )}
        </button>
      </div>

      {/* Badges & Timer */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Security & E2EE Status Badge */}
        <SecurityStatusBadge
          isE2EEActive={isE2EEActive}
          securityMode={securityMode}
          keyVersion={keyVersion}
          onClick={onOpenSecurity}
        />

        {/* Recording Indicator */}
        <RecordingIndicator
          isRecording={isRecording}
          durationSeconds={recordingDurationSeconds}
          onClick={onOpenRecordings}
        />

        {/* View Recordings Button */}
        {onOpenRecordings && (
          <button
            onClick={onOpenRecordings}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-zinc-300 transition-colors"
            title="View Meeting Recordings"
          >
            <Film className="w-3.5 h-3.5 text-zinc-400" />
            <span className="hidden md:inline">Recordings</span>
          </button>
        )}

        {/* Locked Badge */}
        {isLocked && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold">
            <Lock className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Locked</span>
          </div>
        )}

        {/* Participant Count */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-zinc-300">
          <Users className="w-3.5 h-3.5 text-zinc-400" />
          <span>{participantCount}</span>
        </div>

        {/* Duration Timer */}
        <div className="px-3 py-1 rounded-full bg-red-600/10 border border-red-500/20 text-xs font-mono font-semibold text-red-400">
          {formatDuration(elapsedSeconds)}
        </div>
      </div>
    </header>
  )
}
