import React from "react"
import { useVideoPlayer } from "./VideoPlayerContext"
import { PlayPauseButton } from "./PlayPauseButton"
import { NextVideoButton } from "./NextVideoButton"
import { SkipBackwardButton } from "./SkipBackwardButton"
import { SkipForwardButton } from "./SkipForwardButton"
import { VolumeControl } from "./VolumeControl"
import { TimeDisplay } from "./TimeDisplay"
import { ProgressBar } from "./ProgressBar"
import { PlaybackSpeed } from "./PlaybackSpeed"
import { SubtitleButton } from "./SubtitleButton"
import { VideoQualityInfo } from "./VideoQualityInfo"
import { TheaterModeButton } from "./TheaterModeButton"
import { PictureInPictureButton } from "./PictureInPictureButton"
import { FullscreenButton } from "./FullscreenButton"

import {
  type PreviewThumbnailItem,
  type PreviewSpriteConfig,
} from "./timelinePreviewUtils"

export interface PlayerControlsProps {
  className?: string
  isPlaying?: boolean
  onTogglePlay?: () => void
  previewThumbnails?: PreviewThumbnailItem[]
  previewSprites?: PreviewSpriteConfig
  fallbackPoster?: string
}

export const PlayerControls: React.FC<PlayerControlsProps> = ({
  className = "",
  onTogglePlay,
  previewThumbnails,
  previewSprites,
  fallbackPoster,
}) => {
  const { state, actions } = useVideoPlayer()

  const isVisible =
    state.isControlsVisible ||
    state.isPaused ||
    state.isSeeking ||
    state.isBuffering ||
    state.isLoading ||
    state.isEnded ||
    state.isMenuOpen ||
    state.isDragging ||
    state.isFocusWithinControls ||
    Boolean(state.error)

  return (
    <div
      className={`player-controls absolute inset-x-0 bottom-0 pt-16 pb-2.5 px-3 sm:px-4 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col justify-end transition-all duration-300 ease-in-out motion-reduce:transition-none z-20 ${
        isVisible
          ? "player-controls--visible opacity-100 translate-y-0 pointer-events-auto"
          : "player-controls--hidden opacity-0 translate-y-2 pointer-events-none"
      } ${className}`}
      onClick={(e) => e.stopPropagation()}
      onFocus={() => actions.setIsFocusWithinControls(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          actions.setIsFocusWithinControls(false)
        }
      }}
      onMouseEnter={() => actions.setIsUserInteracting(true)}
      onMouseLeave={() => actions.setIsUserInteracting(false)}
    >
      {/* 
        Phase 5 Main Control Bar Layout:
        LEFT: [ Play ] [ SkipBack ] [ SkipForward ] [ VolumeControl ] [ TimeDisplay ]
        CENTER: [ Progress Bar (flex-1) ]
        RIGHT: [ Playback Speed ] [ Theater Mode ] [ Picture-in-Picture ] [ Fullscreen ]
      */}
      {/* Mobile Row 1: Full width progress bar on small screens */}
      <div className="w-full px-0.5 pb-1 sm:hidden">
        <ProgressBar
          previewThumbnails={previewThumbnails}
          previewSprites={previewSprites}
          fallbackPoster={fallbackPoster}
        />
      </div>

      <div className="flex items-center justify-between gap-1 sm:gap-2 w-full">
        {/* Left cluster: Play/Pause, Next Video, Skips (desktop), Volume, Time */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <PlayPauseButton onTogglePlay={onTogglePlay} />
          <NextVideoButton />
          <div className="hidden sm:flex items-center">
            <SkipBackwardButton />
          </div>
          <div className="hidden sm:flex items-center">
            <SkipForwardButton />
          </div>
          <VolumeControl />
          <TimeDisplay />
        </div>

        {/* Center: Desktop Progress Bar */}
        <div className="hidden sm:flex flex-1 items-center min-w-[80px] px-1 sm:px-2">
          <ProgressBar
            previewThumbnails={previewThumbnails}
            previewSprites={previewSprites}
            fallbackPoster={fallbackPoster}
          />
        </div>

        {/* Right cluster: Speed, Subtitles, Quality, Theater, PiP, Fullscreen */}
        <div className="flex items-center gap-0.5 sm:gap-1 text-white shrink-0">
          <PlaybackSpeed />
          <SubtitleButton />
          <div className="hidden md:flex items-center">
            <VideoQualityInfo />
          </div>
          <div className="hidden md:flex items-center">
            <TheaterModeButton />
          </div>
          <div className="hidden sm:flex items-center">
            <PictureInPictureButton />
          </div>
          <FullscreenButton />
        </div>
      </div>
    </div>
  )
}

export default PlayerControls
