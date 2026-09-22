import React from "react"
import { RectangleHorizontal } from "lucide-react"
import { useVideoPlayer } from "./VideoPlayerContext"

export interface TheaterModeButtonProps {
  className?: string
}

/**
 * TheaterModeButton
 * Toggles expanded theater viewing mode on supported desktop/tablet layouts.
 */
export const TheaterModeButton: React.FC<TheaterModeButtonProps> = ({
  className = "",
}) => {
  const { state, actions } = useVideoPlayer()
  const isTheater = state.isTheaterMode

  return (
    <button
      type="button"
      onClick={actions.toggleTheaterMode}
      className={`relative p-2 rounded-full text-white/90 hover:text-white hover:bg-white/15 transition-all duration-200 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 cursor-pointer hidden sm:inline-flex items-center justify-center ${
        isTheater ? "text-red-500 hover:text-red-400" : ""
      } ${className}`}
      aria-label={isTheater ? "Exit theater mode (t)" : "Enter theater mode (t)"}
      aria-pressed={isTheater}
      title={isTheater ? "Default view (t)" : "Theater mode (t)"}
    >
      <RectangleHorizontal
        size={20}
        className={isTheater ? "stroke-red-500 fill-red-500/20" : "stroke-white"}
      />
      {isTheater && (
        <span
          className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-3 h-0.5 bg-red-500 rounded-full"
          aria-hidden="true"
        />
      )}
    </button>
  )
}

export default TheaterModeButton
