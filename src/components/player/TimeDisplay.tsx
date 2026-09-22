import React from "react"
import {
  useVideoPlayer,
  formatVideoTime,
  calculateRemainingTime,
  formatRemainingTime,
} from "./VideoPlayerContext"

export interface TimeDisplayProps {
  className?: string
  separator?: string
  isInteractive?: boolean
}

export const TimeDisplay: React.FC<TimeDisplayProps> = ({
  className = "text-xs font-medium text-white/90 select-none tracking-wide flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 cursor-pointer",
  separator = "/",
  isInteractive = true,
}) => {
  const { state, actions } = useVideoPlayer()
  const displaySeconds = state.isSeeking ? state.seekPreviewTime : state.currentTime
  const mode = state.timeDisplayMode || "current-total"

  const remainingSeconds = calculateRemainingTime(displaySeconds, state.duration)

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isInteractive) {
      actions.toggleTimeDisplayMode()
    }
  }

  const renderContent = () => {
    if (mode === "current-only") {
      return (
        <span className="tabular-nums text-white" aria-label="Current time">
          {formatVideoTime(displaySeconds)}
        </span>
      )
    }

    if (mode === "current-remaining") {
      return (
        <>
          <span className="tabular-nums text-white" aria-label="Current time">
            {formatVideoTime(displaySeconds)}
          </span>
          <span className="text-white/40">{separator}</span>
          <span className="tabular-nums text-white/70" aria-label="Remaining time">
            {formatRemainingTime(remainingSeconds)}
          </span>
        </>
      )
    }

    // Default: current-total
    return (
      <>
        <span className="tabular-nums text-white" aria-label="Current time">
          {formatVideoTime(displaySeconds)}
        </span>
        <span className="text-white/40">{separator}</span>
        <span className="tabular-nums text-white/70" aria-label="Total duration">
          {formatVideoTime(state.duration)}
        </span>
      </>
    )
  }

  const getAriaLabel = () => {
    if (mode === "current-remaining") {
      return `Current time ${formatVideoTime(displaySeconds)}, remaining time ${formatRemainingTime(remainingSeconds)}. Click to change time display.`
    }
    if (mode === "current-only") {
      return `Current time ${formatVideoTime(displaySeconds)}. Click to change time display.`
    }
    return `Current time ${formatVideoTime(displaySeconds)} of ${formatVideoTime(state.duration)}. Click to change time display.`
  }

  if (!isInteractive) {
    return (
      <div className={className} aria-live="off">
        {renderContent()}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={className}
      aria-label={getAriaLabel()}
      title="Toggle time display mode"
    >
      {renderContent()}
    </button>
  )
}

export default TimeDisplay
