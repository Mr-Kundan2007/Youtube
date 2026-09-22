import React from "react"
import { RotateCw } from "lucide-react"
import { useVideoPlayer } from "./VideoPlayerContext"

export interface SkipForwardButtonProps {
  className?: string
  iconSize?: number
  onClick?: () => void
}

export const SkipForwardButton: React.FC<SkipForwardButtonProps> = ({
  className = "relative p-2 hover:bg-white/15 rounded-full text-white transition-transform active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 cursor-pointer flex items-center justify-center",
  iconSize = 20,
  onClick,
}) => {
  const { state, actions } = useVideoPlayer()

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onClick) {
      onClick()
    } else {
      actions.skipForward()
    }
  }

  const interval = state.seekInterval || 10
  const label = `Seek forward ${interval} seconds`
  const title = `Seek forward ${interval}s`

  return (
    <button
      type="button"
      onClick={handleClick}
      className={className}
      aria-label={label}
      title={title}
    >
      <RotateCw size={iconSize} className="stroke-white" />
      <span className="absolute text-[8px] font-bold tracking-tighter leading-none select-none text-white/95 translate-y-0.5">
        {interval}
      </span>
    </button>
  )
}

export default SkipForwardButton
