import React from "react"
import { Volume, Volume1, Volume2, VolumeX } from "lucide-react"
import { useVideoPlayer } from "./VideoPlayerContext"

export interface MuteButtonProps {
  className?: string
  iconSize?: number
  onClick?: () => void
}

export const MuteButton: React.FC<MuteButtonProps> = ({
  className = "p-2 hover:bg-white/15 rounded-full text-white transition-transform active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 cursor-pointer",
  iconSize = 20,
  onClick,
}) => {
  const { state, actions } = useVideoPlayer()

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onClick) {
      onClick()
    } else {
      actions.toggleMute()
    }
  }

  const isEffectiveMuted = state.isMuted || state.volume === 0

  const getVolumeIcon = () => {
    if (isEffectiveMuted) {
      return <VolumeX size={iconSize} className="stroke-white" />
    }
    if (state.volume < 0.4) {
      return <Volume size={iconSize} className="stroke-white" />
    }
    if (state.volume < 0.7) {
      return <Volume1 size={iconSize} className="stroke-white" />
    }
    return <Volume2 size={iconSize} className="stroke-white" />
  }

  const label = isEffectiveMuted ? "Unmute video (m)" : "Mute video (m)"
  const title = isEffectiveMuted ? "Unmute (m)" : "Mute (m)"

  return (
    <button
      type="button"
      onClick={handleClick}
      className={className}
      aria-label={label}
      title={title}
    >
      {getVolumeIcon()}
    </button>
  )
}

export default MuteButton
