import React, { useState, useEffect } from "react"
import {
  VideoPlayerProvider,
  useVideoPlayer,
} from "./VideoPlayerContext"
import { VideoElement, type VideoSource } from "./VideoElement"
import type { SubtitleTrackSource } from "./subtitleUtils"
import { BigPlayOverlay } from "./BigPlayOverlay"
import { LoadingIndicator } from "./LoadingIndicator"
import { BufferingIndicator } from "./BufferingIndicator"
import { PlayerControls } from "./PlayerControls"
import { PlayerErrorOverlay } from "./PlayerErrorOverlay"
import { SeekFeedbackOverlay } from "./SeekFeedbackOverlay"
import { ResumePlaybackDialog } from "./ResumePlaybackDialog"
import { NextVideoOverlay } from "./NextVideoOverlay"
import { ShortcutHelpOverlay } from "./ShortcutHelpOverlay"
import { useKeyboardShortcuts } from "./useKeyboardShortcuts"
import type { KeyboardShortcutConfig } from "./keyboardShortcuts"
import type { PreviewThumbnailItem, PreviewSpriteConfig } from "./timelinePreviewUtils"
import type { VideoAnalyticsConfig, VideoAnalyticsEvent } from "./analyticsTypes"
import { useVideoAnalytics } from "./useVideoAnalytics"
import { resolveVideoId } from "./watchProgressUtils"
import type { NextVideoItem, NextVideoResumeBehavior } from "./nextVideoUtils"
import { AccessDeniedOverlay } from "./AccessDeniedOverlay"
import { PlayerErrorBoundary } from "./PlayerErrorBoundary"

export interface CustomVideoPlayerProps {
  videoId?: string
  video?: {
    _id?: string
    id?: string
    videotitle?: string
    filepath?: string
    videoUrl?: string
    videofilepath?: string
    thumbnailUrl?: string
  }
  sources?: VideoSource[]
  tracks?: SubtitleTrackSource[]
  poster?: string
  autoPlay?: boolean
  autoResume?: boolean
  resumePromptEnabled?: boolean
  progressSaveInterval?: number
  completionThreshold?: number
  resumeMinimumSeconds?: number
  resumeEndThresholdSeconds?: number
  playerId?: string
  nextVideo?: NextVideoItem | null
  playlist?: NextVideoItem[]
  queue?: NextVideoItem[]
  autoplayNext?: boolean
  autoplayCountdown?: number
  nextVideoResumeBehavior?: NextVideoResumeBehavior
  onVideoChange?: (video: NextVideoItem) => void
  onNextVideo?: (video: NextVideoItem) => void
  onAutoplayCountdownStart?: (remainingSeconds: number, nextVideo: NextVideoItem) => void
  onAutoplayCancelled?: (nextVideo: NextVideoItem) => void
  seekInterval?: number
  largeSeekSeconds?: number
  controlsHideDelay?: number
  enableDoubleClickSeek?: boolean
  keyboardShortcuts?: boolean
  keyboardShortcutConfig?: KeyboardShortcutConfig
  previewThumbnails?: PreviewThumbnailItem[]
  previewSprites?: PreviewSpriteConfig
  analyticsEnabled?: boolean
  analyticsConfig?: VideoAnalyticsConfig
  debug?: boolean
  onAnalyticsEvent?: (event: VideoAnalyticsEvent) => void
  maxRetries?: number
  retryBaseDelay?: number
  enableSourceFallback?: boolean
  className?: string
  onTheaterModeChange?: (isTheater: boolean) => void
  onEnded?: () => void
  onPlay?: () => void
  onPause?: () => void
  accessStatus?: {
    allowed: boolean
    requiredPlan?: string
    currentPlan?: string
    message?: string
  }
  onUpgradeClick?: () => void
  onErrorBoundary?: (error: Error, info: React.ErrorInfo) => void
}

function PlayerInner({
  sources,
  tracks,
  poster,
  autoPlay = false,
  enableDoubleClickSeek = true,
  keyboardShortcuts = true,
  keyboardShortcutConfig,
  previewThumbnails,
  previewSprites,
  analyticsEnabled = true,
  analyticsConfig,
  debug,
  onAnalyticsEvent,
  className = "",
  onTheaterModeChange,
  onEnded,
  onPlay,
  onPause,
  accessStatus,
  onUpgradeClick,
}: {
  sources: VideoSource[]
  tracks?: SubtitleTrackSource[]
  poster?: string
  autoPlay?: boolean
  enableDoubleClickSeek?: boolean
  keyboardShortcuts?: boolean
  keyboardShortcutConfig?: KeyboardShortcutConfig
  previewThumbnails?: PreviewThumbnailItem[]
  previewSprites?: PreviewSpriteConfig
  analyticsEnabled?: boolean
  analyticsConfig?: VideoAnalyticsConfig
  debug?: boolean
  onAnalyticsEvent?: (event: VideoAnalyticsEvent) => void
  className?: string
  onTheaterModeChange?: (isTheater: boolean) => void
  onEnded?: () => void
  onPlay?: () => void
  onPause?: () => void
  accessStatus?: {
    allowed: boolean
    requiredPlan?: string
    currentPlan?: string
    message?: string
  }
  onUpgradeClick?: () => void
}) {
  const { containerRef, state, actions } = useVideoPlayer()
  const [isHovered, setIsHovered] = useState(false)
  const clickTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clear pending click debounce timer on unmount
  useEffect(() => {
    return () => {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current)
        clickTimeoutRef.current = null
      }
    }
  }, [])

  // Phase 10: Scoped Keyboard Shortcuts
  useKeyboardShortcuts({
    config: {
      ...keyboardShortcutConfig,
      enabled: keyboardShortcuts !== false && keyboardShortcutConfig?.enabled !== false,
    },
    playerId: state.playerId,
    state,
    actions,
    containerRef: containerRef as React.RefObject<HTMLDivElement | null>,
  })

  // Phase 11: Master Analytics and Engagement Tracking
  useVideoAnalytics({
    videoId: state.videoId,
    playerId: state.playerId,
    currentTime: state.currentTime,
    duration: state.duration,
    isPlaying: state.isPlaying,
    isPaused: state.isPaused,
    isBuffering: state.isBuffering,
    isSeeking: state.isSeeking,
    isCompleted: state.isCompleted,
    isEnded: state.isEnded,
    playbackRate: state.playbackRate,
    volume: state.volume,
    isMuted: state.isMuted,
    isFullscreen: state.isFullscreen,
    isPiP: state.isPiP,
    areSubtitlesEnabled: state.areSubtitlesEnabled,
    activeSubtitleTrackLang: state.activeSubtitleTrack?.language,
    analyticsEnabled,
    analyticsConfig: onAnalyticsEvent
      ? { ...analyticsConfig, onTrackEvent: onAnalyticsEvent, debug }
      : { ...analyticsConfig, debug },
    debug,
    mediaElement: (containerRef.current?.querySelector("video") as HTMLVideoElement | null) || null,
  })

  // Notify parent callback when theater mode changes
  useEffect(() => {
    if (onTheaterModeChange) {
      onTheaterModeChange(state.isTheaterMode)
    }
  }, [state.isTheaterMode, onTheaterModeChange])

  // Notify parent callbacks when playback state changes
  useEffect(() => {
    if (state.isPlaying && onPlay) onPlay()
    if (state.isPaused && onPause) onPause()
  }, [state.isPlaying, state.isPaused, onPlay, onPause])

  const handlePointerInteraction = () => {
    actions.resetControlsTimer()
  }

  const handleMouseEnter = () => {
    setIsHovered(true)
    actions.setIsUserInteracting(true)
    actions.resetControlsTimer()
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
    actions.setIsUserInteracting(false)
  }

  // Phase 10: Disambiguate single vs double click (250ms debounce)
  const handleVideoClick = (e: React.MouseEvent<HTMLDivElement>) => {
    actions.resetControlsTimer()

    // If another click arrived within 250ms debounce window, cancel single-click play/pause
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current)
      clickTimeoutRef.current = null
      return
    }

    clickTimeoutRef.current = setTimeout(() => {
      clickTimeoutRef.current = null
      actions.togglePlay()
    }, 250)
  }

  // Phase 10: 3-Zone Double Click Seeking and Fullscreen
  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current)
      clickTimeoutRef.current = null
    }

    if (!enableDoubleClickSeek) return
    e.preventDefault()
    e.stopPropagation()

    const rect = e.currentTarget.getBoundingClientRect()
    if (rect.width <= 0) return
    const clickX = e.clientX - rect.left
    const ratio = clickX / rect.width

    // Left Zone (< 35%): seek backward 10s
    // Center Zone (35% - 65%): toggle fullscreen
    // Right Zone (> 65%): seek forward 10s
    if (ratio < 0.35) {
      actions.skipBackward(10)
    } else if (ratio > 0.65) {
      actions.skipForward(10)
    } else {
      actions.toggleFullscreen().catch(() => {})
    }
  }

  // Cursor auto-hide condition: only hide when playing, controls hidden, user inactive, and no modal/dragging/countdown state
  const shouldHideCursor =
    state.isPlaying &&
    !state.isControlsVisible &&
    !isHovered &&
    !state.isSeeking &&
    !state.isBuffering &&
    !state.isLoading &&
    !state.isMenuOpen &&
    !state.isDragging &&
    !state.isFocusWithinControls &&
    !state.isNextVideoCountdownActive &&
    !state.isEnded &&
    !state.error

  return (
    <div
      ref={containerRef as React.RefObject<HTMLDivElement>}
      className={`video-player relative w-full bg-neutral-950 overflow-hidden select-none group shadow-xl transition-all duration-300 ease-in-out motion-reduce:transition-none ${
        state.isFullscreen
          ? "video-player--fullscreen rounded-none w-full h-full max-h-screen"
          : state.isTheaterMode
          ? "video-player--theater rounded-none w-full aspect-video max-h-[82vh]"
          : "aspect-video rounded-xl"
      } ${!state.isControlsVisible ? "video-player--controls-hidden" : ""} ${className}`}
      onMouseMove={handlePointerInteraction}
      onPointerMove={handlePointerInteraction}
      onPointerDown={handlePointerInteraction}
      onTouchStart={handlePointerInteraction}
      onTouchMove={handlePointerInteraction}
      onClick={handleVideoClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handlePointerInteraction}
      role="region"
      aria-label="Video Player"
      tabIndex={0}
      style={{
        cursor: shouldHideCursor ? "none" : "default",
      }}
    >
      {/* 1. Core Video Element */}
      <VideoElement
        sources={sources}
        tracks={tracks}
        poster={poster}
        autoPlay={autoPlay}
        onEnded={onEnded}
      />

      {/* 2. Initial Video Loading Indicator */}
      <LoadingIndicator />

      {/* 3. Re-Buffering Indicator */}
      <BufferingIndicator />

      {/* 4. Big Play / Replay Center Overlay */}
      <BigPlayOverlay />

      {/* 5. Directional Seek Feedback Overlay */}
      <SeekFeedbackOverlay />

      {/* 6. Playback Error Overlay */}
      <PlayerErrorOverlay />

      {/* 6.5. Subscription Access Denied Overlay */}
      {accessStatus && !accessStatus.allowed && (
        <AccessDeniedOverlay
          requiredPlan={accessStatus.requiredPlan}
          currentPlan={accessStatus.currentPlan}
          message={accessStatus.message}
          onUpgradeClick={onUpgradeClick}
        />
      )}

      {/* 7. Resume Playback Dialog */}
      <ResumePlaybackDialog />

      {/* 8. Next Video Autoplay Countdown Overlay */}
      <NextVideoOverlay />

      {/* 9. Professional Custom Control Bar with Thumbnail Hover Preview */}
      <PlayerControls
        previewThumbnails={previewThumbnails}
        previewSprites={previewSprites}
        fallbackPoster={poster}
      />

      {/* 10. Playback Speed Stepping Visual Indicator */}
      {state.playbackRateFeedback && (
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none transition-all duration-200"
          aria-live="polite"
          aria-label={`Playback speed: ${state.playbackRateFeedback}`}
        >
          <div className="flex items-center justify-center px-4 py-2 rounded-full bg-black/85 backdrop-blur-md border border-white/20 text-white shadow-2xl animate-in fade-in zoom-in-90 duration-150">
            <span className="text-sm font-semibold tracking-wide">{state.playbackRateFeedback}</span>
          </div>
        </div>
      )}

      {/* 11. Accessible Keyboard Shortcuts Help Modal */}
      <ShortcutHelpOverlay />
    </div>
  )
}

export function CustomVideoPlayer({
  videoId,
  video,
  sources,
  tracks,
  poster,
  autoPlay = false,
  autoResume,
  resumePromptEnabled,
  progressSaveInterval,
  completionThreshold,
  resumeMinimumSeconds,
  resumeEndThresholdSeconds,
  playerId,
  nextVideo,
  playlist,
  queue,
  autoplayNext = true,
  autoplayCountdown = 10,
  nextVideoResumeBehavior = "prompt",
  onVideoChange,
  onNextVideo,
  onAutoplayCountdownStart,
  onAutoplayCancelled,
  seekInterval = 10,
  largeSeekSeconds,
  controlsHideDelay = 3000,
  enableDoubleClickSeek = true,
  keyboardShortcuts = true,
  keyboardShortcutConfig,
  previewThumbnails,
  previewSprites,
  analyticsEnabled = true,
  analyticsConfig,
  debug,
  onAnalyticsEvent,
  maxRetries = 3,
  retryBaseDelay = 1000,
  enableSourceFallback = true,
  className = "",
  onTheaterModeChange,
  onEnded,
  onPlay,
  onPause,
  accessStatus,
  onUpgradeClick,
  onErrorBoundary,
}: CustomVideoPlayerProps) {
  const [activeVideo, setActiveVideo] = useState(video)

  useEffect(() => {
    setActiveVideo(video)
  }, [video])

  const handleVideoChange = (newVideo: NextVideoItem) => {
    setActiveVideo(newVideo as typeof video)
    if (onVideoChange) {
      onVideoChange(newVideo)
    }
  }

  const backendUrl =
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_SERVER_URL ||
    "http://localhost:5001"

  const rawPath =
    activeVideo?.filepath ||
    (activeVideo as Record<string, unknown>)?.videofilepath ||
    (activeVideo as Record<string, unknown>)?.videoUrl ||
    ""

  const cleanPath =
    typeof rawPath === "string" && rawPath
      ? rawPath.startsWith("/")
        ? rawPath.slice(1)
        : rawPath
      : "video/vdo.mp4"

  const sameOriginSrc =
    typeof rawPath === "string" && rawPath.startsWith("http")
      ? rawPath
      : `/${cleanPath}`

  const backendSrc =
    typeof rawPath === "string" && rawPath.startsWith("http")
      ? rawPath
      : `${backendUrl}/${cleanPath}`

  const resolvedSources: VideoSource[] =
    sources && sources.length > 0
      ? sources
      : [
          { src: sameOriginSrc, type: "video/mp4" },
          { src: backendSrc, type: "video/mp4" },
          { src: "/video/vdo.mp4", type: "video/mp4" },
        ]

  const resolvedTracks: SubtitleTrackSource[] =
    tracks && tracks.length > 0
      ? tracks
      : [
          {
            src: "/subtitles/en.vtt",
            kind: "subtitles",
            srcLang: "en",
            label: "English",
            default: true,
          },
          {
            src: "/subtitles/hi.vtt",
            kind: "subtitles",
            srcLang: "hi",
            label: "Hindi",
          },
        ]

  const resolvedPoster =
    poster || activeVideo?.thumbnailUrl || "/placeholder.svg?height=480&width=854"

  const effectiveVideoId = resolveVideoId(activeVideo, videoId)

  return (
    <PlayerErrorBoundary onError={onErrorBoundary}>
      <VideoPlayerProvider
        videoId={effectiveVideoId}
        autoResume={autoResume}
        resumePromptEnabled={resumePromptEnabled}
        progressSaveInterval={progressSaveInterval}
        completionThreshold={completionThreshold}
        resumeMinimumSeconds={resumeMinimumSeconds}
        resumeEndThresholdSeconds={resumeEndThresholdSeconds}
        playerId={playerId}
        currentVideo={activeVideo}
        nextVideo={nextVideo}
        playlist={playlist}
        queue={queue}
        autoplayNext={autoplayNext}
        autoplayCountdown={autoplayCountdown}
        nextVideoResumeBehavior={nextVideoResumeBehavior}
        onVideoChange={handleVideoChange}
        onNextVideo={onNextVideo}
        onAutoplayCountdownStart={onAutoplayCountdownStart}
        onAutoplayCancelled={onAutoplayCancelled}
        onEnded={onEnded}
        seekInterval={seekInterval}
        largeSeekSeconds={largeSeekSeconds}
        controlsHideDelay={controlsHideDelay}
        analyticsEnabled={analyticsEnabled}
        analyticsConfig={analyticsConfig}
        maxRetries={maxRetries}
        retryBaseDelay={retryBaseDelay}
        enableSourceFallback={enableSourceFallback}
        sources={resolvedSources}
      >
        <PlayerInner
          sources={resolvedSources}
          tracks={resolvedTracks}
          poster={resolvedPoster}
          autoPlay={autoPlay}
          enableDoubleClickSeek={enableDoubleClickSeek}
          keyboardShortcuts={keyboardShortcuts}
          keyboardShortcutConfig={keyboardShortcutConfig}
          previewThumbnails={previewThumbnails}
          previewSprites={previewSprites}
          analyticsEnabled={analyticsEnabled}
          analyticsConfig={analyticsConfig}
          debug={debug}
          onAnalyticsEvent={onAnalyticsEvent}
          className={className}
          onTheaterModeChange={onTheaterModeChange}
          onEnded={onEnded}
          onPlay={onPlay}
          onPause={onPause}
          accessStatus={accessStatus}
          onUpgradeClick={onUpgradeClick}
        />
      </VideoPlayerProvider>
    </PlayerErrorBoundary>
  )
}

export default CustomVideoPlayer

