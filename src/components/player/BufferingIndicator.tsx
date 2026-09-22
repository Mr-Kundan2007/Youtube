import React from "react"
import { Loader2 } from "lucide-react"
import { useVideoPlayer } from "./VideoPlayerContext"

export interface BufferingIndicatorProps {
  className?: string
}

export const BufferingIndicator: React.FC<BufferingIndicatorProps> = ({ className = "" }) => {
  const { state } = useVideoPlayer()

  // Only show when actively buffering during playback (not during manual pause, end, initial load, or error)
  if (
    !state.isBuffering ||
    state.isLoading ||
    state.isPaused ||
    state.isEnded ||
    state.error
  ) {
    return null
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-15 ${className}`}
    >
      <div className="flex flex-col items-center p-3 sm:p-4 rounded-2xl bg-black/60 backdrop-blur-md border border-white/10 shadow-2xl text-white">
        <Loader2
          size={40}
          className="stroke-[2.5] text-white/90 animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
        <span className="mt-2 text-xs sm:text-sm font-medium text-neutral-200 tracking-wide">
          Buffering...
        </span>
        <span className="sr-only">Buffering video</span>
      </div>
    </div>
  )
}

export default BufferingIndicator
