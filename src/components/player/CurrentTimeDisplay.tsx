import React from "react"
import { useVideoPlayer, formatVideoTime } from "./VideoPlayerContext"

export interface CurrentTimeDisplayProps {
  className?: string
}

export const CurrentTimeDisplay: React.FC<CurrentTimeDisplayProps> = ({
  className = "text-xs font-medium text-white/95 tabular-nums select-none tracking-wide",
}) => {
  const { state } = useVideoPlayer()
  const displaySeconds = state.isSeeking ? state.seekPreviewTime : state.currentTime

  return (
    <span className={className} aria-label={`Current time: ${formatVideoTime(displaySeconds)}`}>
      {formatVideoTime(displaySeconds)}
    </span>
  )
}

export default CurrentTimeDisplay
