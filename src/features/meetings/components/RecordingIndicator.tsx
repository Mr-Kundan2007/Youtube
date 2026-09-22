"use client"

import React from "react"

interface RecordingIndicatorProps {
  isRecording: boolean
  durationSeconds?: number
  className?: string
  onClick?: () => void
}

export const RecordingIndicator: React.FC<RecordingIndicatorProps> = ({
  isRecording,
  durationSeconds = 0,
  className = "",
  onClick,
}) => {
  if (!isRecording) return null

  const formatDuration = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    if (hours > 0) {
      return `${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
    }
    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`
  }

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-950/80 border border-red-500/40 text-red-400 backdrop-blur-md shadow-lg shadow-red-900/20 text-xs font-semibold select-none ${
        onClick ? "cursor-pointer hover:bg-red-900/80 transition-colors" : ""
      } ${className}`}
      title="This meeting is being recorded"
    >
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
      </span>
      <span className="font-bold tracking-wide text-red-300">REC</span>
      <span className="font-mono text-zinc-300 tabular-nums">
        {formatDuration(durationSeconds)}
      </span>
    </div>
  )
}
