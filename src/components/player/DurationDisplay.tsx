import React from "react"
import { useVideoPlayer, formatVideoTime } from "./VideoPlayerContext"

export interface DurationDisplayProps {
  className?: string
}

export const DurationDisplay: React.FC<DurationDisplayProps> = ({
  className = "text-xs font-medium text-white/70 tabular-nums select-none tracking-wide",
}) => {
  const { state } = useVideoPlayer()

  return (
    <span className={className} aria-label={`Total duration: ${formatVideoTime(state.duration)}`}>
      {formatVideoTime(state.duration)}
    </span>
  )
}

export default DurationDisplay
