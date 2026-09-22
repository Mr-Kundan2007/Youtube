import React from "react"
import { RotateCcw, RotateCw } from "lucide-react"
import { useVideoPlayer } from "./VideoPlayerContext"

export interface SeekFeedbackOverlayProps {
  className?: string
}

export const SeekFeedbackOverlay: React.FC<SeekFeedbackOverlayProps> = ({
  className = "",
}) => {
  const { state } = useVideoPlayer()
  const feedback = state.seekFeedback

  if (!feedback) return null

  const isBackward = feedback.direction === "backward"

  return (
    <div
      className={`absolute top-1/2 -translate-y-1/2 z-30 pointer-events-none transition-all duration-200 ${
        isBackward ? "left-6 sm:left-12" : "right-6 sm:right-12"
      } ${className}`}
      aria-live="polite"
      aria-label={`Skipped ${feedback.direction} ${feedback.seconds} seconds`}
    >
      <div className="flex flex-col items-center justify-center p-3.5 sm:p-4 rounded-full bg-black/75 backdrop-blur-md border border-white/15 text-white shadow-2xl animate-in fade-in zoom-in-90 duration-150">
        {isBackward ? (
          <RotateCcw size={26} className="stroke-white stroke-[2.2]" />
        ) : (
          <RotateCw size={26} className="stroke-white stroke-[2.2]" />
        )}
        <span className="text-xs sm:text-sm font-bold tracking-tight mt-1 text-white">
          {isBackward ? `-${feedback.seconds}s` : `+${feedback.seconds}s`}
        </span>
      </div>
    </div>
  )
}

export default SeekFeedbackOverlay
