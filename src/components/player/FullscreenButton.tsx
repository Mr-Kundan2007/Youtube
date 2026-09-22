import React from "react"
import { Maximize, Minimize } from "lucide-react"
import { useVideoPlayer } from "./VideoPlayerContext"

export interface FullscreenButtonProps {
  className?: string
}

/**
 * FullscreenButton
 * Toggles browser fullscreen viewing mode with authoritative state synchronization.
 */
export const FullscreenButton: React.FC<FullscreenButtonProps> = ({
  className = "",
}) => {
  const { state, actions } = useVideoPlayer()
  const isFs = state.isFullscreen

  return (
    <button
      type="button"
      onClick={actions.toggleFullscreen}
      disabled={!state.fullscreenSupported}
      className={`p-2 rounded-full text-white/90 hover:text-white hover:bg-white/15 transition-all duration-200 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 cursor-pointer inline-flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
      aria-label={isFs ? "Exit fullscreen (f)" : "Enter fullscreen (f)"}
      aria-pressed={isFs}
      title={isFs ? "Exit fullscreen (f)" : "Fullscreen (f)"}
    >
      {isFs ? (
        <Minimize size={19} className="stroke-white" />
      ) : (
        <Maximize size={19} className="stroke-white" />
      )}
    </button>
  )
}

export default FullscreenButton
