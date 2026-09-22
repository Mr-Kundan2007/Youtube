import React from "react"
import { PictureInPicture2 } from "lucide-react"
import { useVideoPlayer } from "./VideoPlayerContext"

export interface PictureInPictureButtonProps {
  className?: string
}

/**
 * PictureInPictureButton
 * Toggles HTML5 Picture-in-Picture floating video playback.
 */
export const PictureInPictureButton: React.FC<PictureInPictureButtonProps> = ({
  className = "",
}) => {
  const { state, actions } = useVideoPlayer()
  const isPiP = state.isPictureInPicture

  // If browser completely lacks PiP support, hide gracefully to keep UI uncluttered
  if (!state.pictureInPictureSupported) {
    return null
  }

  return (
    <button
      type="button"
      onClick={actions.togglePictureInPicture}
      className={`relative p-2 rounded-full text-white/90 hover:text-white hover:bg-white/15 transition-all duration-200 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 cursor-pointer inline-flex items-center justify-center ${
        isPiP ? "text-red-500 hover:text-red-400" : ""
      } ${className}`}
      aria-label={isPiP ? "Exit Picture-in-Picture (p)" : "Enter Picture-in-Picture (p)"}
      aria-pressed={isPiP}
      title={isPiP ? "Exit Picture-in-Picture (p)" : "Picture-in-Picture (p)"}
    >
      <PictureInPicture2
        size={19}
        className={isPiP ? "stroke-red-500 fill-red-500/20" : "stroke-white"}
      />
      {isPiP && (
        <span
          className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-3 h-0.5 bg-red-500 rounded-full"
          aria-hidden="true"
        />
      )}
    </button>
  )
}

export default PictureInPictureButton
