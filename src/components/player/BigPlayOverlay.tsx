import React from "react"
import { Play, RotateCcw } from "lucide-react"
import { useVideoPlayer } from "./VideoPlayerContext"

export interface BigPlayOverlayProps {
  className?: string
}

export const BigPlayOverlay: React.FC<BigPlayOverlayProps> = ({ className = "" }) => {
  const { state, actions } = useVideoPlayer()

  // If there's an error, loading, or buffering, indicators handle it without conflict
  if (state.error || state.isLoading || state.isBuffering) return null

  // If video has ended, show center Replay button
  if (state.isEnded) {
    return (
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            actions.play()
          }}
          className={`pointer-events-auto w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-black/60 hover:bg-red-600/90 text-white backdrop-blur-md flex items-center justify-center shadow-2xl transition-all duration-200 transform hover:scale-110 active:scale-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-red-500/50 ${className}`}
          aria-label="Replay video"
        >
          <RotateCcw size={32} className="stroke-white" />
        </button>
      </div>
    )
  }

  // If paused, show center Big Play button
  if (state.isPaused) {
    return (
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            actions.play()
          }}
          className={`pointer-events-auto w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-black/60 hover:bg-red-600/90 text-white backdrop-blur-md flex items-center justify-center shadow-2xl transition-all duration-200 transform hover:scale-110 active:scale-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-red-500/50 ${className}`}
          aria-label="Play video"
        >
          <Play size={32} className="fill-white stroke-white translate-x-0.5" />
        </button>
      </div>
    )
  }

  return null
}

export default BigPlayOverlay
