import React from "react"
import { useVideoPlayer } from "./VideoPlayerContext"
import { getNextVideoTitle } from "./nextVideoUtils"

export interface NextVideoButtonProps {
  className?: string
  iconSize?: number
  onClick?: () => void
}

export const NextVideoButton: React.FC<NextVideoButtonProps> = ({
  className = "p-2 hover:bg-white/15 rounded-full text-white transition-transform active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 cursor-pointer flex items-center justify-center",
  onClick,
}) => {
  const { state, actions } = useVideoPlayer()

  const hasNext = Boolean(state.resolvedNextVideo)
  const title = state.resolvedNextVideo ? getNextVideoTitle(state.resolvedNextVideo) : ""
  const label = hasNext ? `Next video: ${title} (Shift+N)` : "Next video (Shift+N)"

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onClick) {
      onClick()
    } else {
      actions.playNextVideo()
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!hasNext}
      className={`${className} ${
        hasNext
          ? "opacity-100 hover:text-white"
          : "opacity-40 cursor-not-allowed text-white/50"
      }`}
      aria-label={label}
      title={label}
    >
      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
        <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
      </svg>
    </button>
  )
}

export default NextVideoButton
