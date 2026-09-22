import React from "react"
import { Play, Pause, RotateCcw } from "lucide-react"
import { useVideoPlayer } from "./VideoPlayerContext"

export interface PlayPauseButtonProps {
  className?: string
  iconSize?: number
  onTogglePlay?: () => void
}

export const PlayPauseButton: React.FC<PlayPauseButtonProps> = ({
  className = "p-2 hover:bg-white/15 rounded-full text-white transition-transform active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 cursor-pointer",
  iconSize = 22,
  onTogglePlay,
}) => {
  const { state, actions } = useVideoPlayer()

  const handleClick = () => {
    if (onTogglePlay) {
      onTogglePlay()
    } else {
      actions.togglePlay()
    }
  }

  const ariaLabel = state.isEnded
    ? "Replay video"
    : state.isPlaying
    ? "Pause video (k)"
    : "Play video (k)"

  const title = state.isEnded
    ? "Replay"
    : state.isPlaying
    ? "Pause (k)"
    : "Play (k)"

  return (
    <button
      type="button"
      onClick={handleClick}
      className={className}
      aria-label={ariaLabel}
      title={title}
    >
      {state.isEnded ? (
        <RotateCcw size={iconSize} className="stroke-white" />
      ) : state.isPlaying ? (
        <Pause size={iconSize} className="fill-white stroke-white" />
      ) : (
        <Play size={iconSize} className="fill-white stroke-white translate-x-0.5" />
      )}
    </button>
  )
}

export default PlayPauseButton
