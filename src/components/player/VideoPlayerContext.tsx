import React, {
  createContext,
  useContext,
  useRef,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react"
import {
  formatVideoTime,
  type TimeDisplayMode,
} from "./timelineUtils"
import {
  type SubtitleTrack,
  type SubtitleTrackSource,
  normalizeSubtitleTrack,
} from "./subtitleUtils"
import {
  type VideoQualityMetadata,
  getQualityLabel,
  calculateAspectRatio,
  formatResolution,
  getReadyStatusLabel,
} from "./videoQualityUtils"
import {
  type BufferedRange,
  getBufferedRanges,
  calculateBufferedPercentage,
  areBufferedRangesEqual,
  getNetworkStateLabel,
} from "./videoBufferUtils"
import {
  type WatchProgressData,
  resolveVideoId,
  calculateWatchPercentage,
  isVideoCompleted,
  isResumeEligible,
  clampResumePosition,
  DEFAULT_PROGRESS_SAVE_INTERVAL,
  DEFAULT_COMPLETION_THRESHOLD,
  DEFAULT_RESUME_MINIMUM_SECONDS,
  DEFAULT_RESUME_END_THRESHOLD_SECONDS,
} from "./watchProgressUtils"
import { WatchProgressService } from "./watchProgressService"
import {
  type NextVideoItem,
  type NextVideoResumeBehavior,
  resolveNextVideo,
  validateNextVideo,
  validateAutoplayCountdown,
  DEFAULT_AUTOPLAY_COUNTDOWN,
} from "./nextVideoUtils"
import { videoPlayerManager } from "./videoPlayerManager"
import type {
  ClassifiedVideoError,
  PlayerRecoveryState,
  VideoAnalyticsConfig,
} from "./analyticsTypes"
import { usePlayerRecovery } from "./usePlayerRecovery"
import type { VideoSource } from "./VideoElement"

export {
  formatVideoTime,
  calculateProgress,
  calculateTimeFromPercentage,
  calculateRemainingTime,
  formatRemainingTime,
  TIME_DISPLAY_MODES,
  type TimeDisplayMode,
} from "./timelineUtils"

export {
  type SubtitleTrack,
  type SubtitleTrackSource,
  type VideoQualityMetadata,
  getQualityLabel,
  calculateAspectRatio,
  formatResolution,
  getReadyStatusLabel,
  type BufferedRange,
  getBufferedRanges,
  calculateBufferedPercentage,
  areBufferedRangesEqual,
  getNetworkStateLabel,
  type WatchProgressData,
  resolveVideoId,
  calculateWatchPercentage,
  isVideoCompleted,
  isResumeEligible,
  clampResumePosition,
  DEFAULT_PROGRESS_SAVE_INTERVAL,
  DEFAULT_COMPLETION_THRESHOLD,
  DEFAULT_RESUME_MINIMUM_SECONDS,
  DEFAULT_RESUME_END_THRESHOLD_SECONDS,
  WatchProgressService,
  type NextVideoItem,
  type NextVideoResumeBehavior,
  resolveNextVideo,
  validateNextVideo,
  validateAutoplayCountdown,
  DEFAULT_AUTOPLAY_COUNTDOWN,
}
export { videoPlayerManager, type PlayerRegistration } from "./videoPlayerManager"

// Backward compatibility alias for Phase 1
export const formatTime = formatVideoTime

// Phase 3 Audio & Playback Speed Constants
export const SUPPORTED_PLAYBACK_RATES = [0.5, 1, 1.25, 1.5, 2] as const
export type SupportedPlaybackRate = (typeof SUPPORTED_PLAYBACK_RATES)[number]
export const DEFAULT_VOLUME_STEP = 0.05

export function formatPlaybackRate(rate: number): string {
  return rate === 1 ? "1×" : `${rate}×`
}

// Phase 4 Seeking & Time Management Constants
export const DEFAULT_SEEK_INTERVAL = 10

export interface SeekFeedback {
  direction: "forward" | "backward"
  seconds: number
  timestamp: number
}

export interface VideoPlayerState {
  isPlaying: boolean
  isPaused: boolean
  isBuffering: boolean
  isEnded: boolean
  isSeeking: boolean
  seekPreviewTime: number
  seekPreviewPercentage: number
  currentTime: number
  duration: number
  bufferedPercent: number
  volume: number
  isMuted: boolean
  playbackRate: number
  seekInterval: number
  timeDisplayMode: TimeDisplayMode
  seekFeedback: SeekFeedback | null
  isFullscreen: boolean
  isTheaterMode: boolean
  isTheater: boolean
  isPictureInPicture: boolean
  isPiP: boolean
  fullscreenSupported: boolean
  pictureInPictureSupported: boolean
  availableSubtitleTracks: SubtitleTrack[]
  activeSubtitleTrack: SubtitleTrack | null
  areSubtitlesEnabled: boolean
  videoQuality: VideoQualityMetadata
  isLoading: boolean
  bufferedRanges: BufferedRange[]
  networkState: number
  readyState: number
  isUserInteracting: boolean
  isMenuOpen: boolean
  isDragging: boolean
  isFocusWithinControls: boolean
  controlsHideDelay: number
  isControlsVisible: boolean
  videoId: string | null
  savedProgress: WatchProgressData | null
  shouldShowResumePrompt: boolean
  resumePosition: number
  isCompleted: boolean
  autoResume: boolean
  resumePromptEnabled: boolean
  progressSaveInterval: number
  completionThreshold: number
  resumeMinimumSeconds: number
  resumeEndThresholdSeconds: number
  playerId: string
  nextVideo: NextVideoItem | null
  playlist: NextVideoItem[]
  queue: NextVideoItem[]
  resolvedNextVideo: NextVideoItem | null
  autoplayNext: boolean
  autoplayCountdown: number
  countdownRemaining: number
  isNextVideoCountdownActive: boolean
  isAutoplayCancelled: boolean
  nextVideoResumeBehavior: NextVideoResumeBehavior
  isShortcutHelpOpen: boolean
  playbackRateFeedback: string | null
  largeSeekSeconds: number
  recoveryState?: PlayerRecoveryState
  classifiedError?: ClassifiedVideoError | null
  error: { code: number; message: string } | null
}

export interface VideoPlayerActions {
  play: () => Promise<void>
  pause: () => void
  togglePlay: () => void
  seek: (timeInSeconds: number) => void
  seekTo: (timeInSeconds: number) => void
  skipBackward: (seconds?: number) => void
  skipForward: (seconds?: number) => void
  startSeeking: (previewTime: number, previewPercentage: number) => void
  updateSeeking: (previewTime: number, previewPercentage: number) => void
  endSeeking: (finalTime?: number) => void
  setVolume: (volume: number) => void
  increaseVolume: (step?: number) => void
  decreaseVolume: (step?: number) => void
  toggleMute: () => void
  setPlaybackRate: (rate: number) => void
  stepPlaybackRate: (direction: "up" | "down") => void
  resetPlaybackRate: () => void
  clearPlaybackRateFeedback: () => void
  setTimeDisplayMode: (mode: TimeDisplayMode) => void
  toggleTimeDisplayMode: () => void
  clearSeekFeedback: () => void
  toggleFullscreen: () => Promise<void>
  enterFullscreen: () => Promise<void>
  exitFullscreen: () => Promise<void>
  toggleTheaterMode: () => void
  enterTheaterMode: () => void
  exitTheaterMode: () => void
  toggleTheater: () => void
  togglePictureInPicture: () => Promise<void>
  enterPictureInPicture: () => Promise<void>
  exitPictureInPicture: () => Promise<void>
  togglePiP: () => Promise<void>
  enableSubtitleTrack: (trackIdOrIndex: string | number) => void
  disableSubtitles: () => void
  toggleSubtitles: () => void
  syncSubtitleTracks: () => void
  syncQualityInfo: () => void
  retry: () => void
  manualRetry: () => void
  cancelRecovery: () => void
  setControlsVisible: (visible: boolean) => void
  showControls: () => void
  hideControls: () => void
  resetControlsTimer: () => void
  setIsUserInteracting: (interacting: boolean) => void
  setIsMenuOpen: (open: boolean) => void
  setIsDragging: (dragging: boolean) => void
  setIsFocusWithinControls: (focusWithin: boolean) => void
  setVideoId: (id: string | null) => void
  saveWatchProgress: (force?: boolean) => void
  restoreWatchPosition: (position?: number) => void
  startOver: () => void
  dismissResumePrompt: () => void
  markVideoCompleted: () => void
  playNextVideo: (targetNextVideo?: NextVideoItem) => void
  cancelAutoplayCountdown: () => void
  setPlaylist: (playlist: NextVideoItem[]) => void
  setQueue: (queue: NextVideoItem[]) => void
  setAutoplayNext: (enabled: boolean) => void
  openShortcutHelp: () => void
  closeShortcutHelp: () => void
  toggleShortcutHelp: () => void
}

export interface VideoPlayerContextValue {
  state: VideoPlayerState
  actions: VideoPlayerActions
  videoRef: React.RefObject<HTMLVideoElement | null>
  containerRef: React.RefObject<HTMLDivElement | null>
  registerVideo: (el: HTMLVideoElement | null) => void
}

const VideoPlayerContext = createContext<VideoPlayerContextValue | null>(null)

export interface VideoPlayerProviderProps {
  children: ReactNode
  initialVolume?: number
  initialMuted?: boolean
  initialPlaybackRate?: number
  seekInterval?: number
  seekSeconds?: number
  largeSeekSeconds?: number
  initialTimeDisplayMode?: TimeDisplayMode
  controlsHideDelay?: number
  videoId?: string | null
  autoResume?: boolean
  resumePromptEnabled?: boolean
  progressSaveInterval?: number
  completionThreshold?: number
  resumeMinimumSeconds?: number
  resumeEndThresholdSeconds?: number
  playerId?: string
  currentVideo?: unknown
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
  onEnded?: () => void
  analyticsEnabled?: boolean
  analyticsConfig?: VideoAnalyticsConfig
  maxRetries?: number
  retryBaseDelay?: number
  enableSourceFallback?: boolean
  sources?: VideoSource[]
}

export function VideoPlayerProvider({
  children,
  initialVolume = 1,
  initialMuted = false,
  initialPlaybackRate = 1,
  seekInterval,
  seekSeconds = DEFAULT_SEEK_INTERVAL,
  largeSeekSeconds = 30,
  initialTimeDisplayMode = "current-total",
  controlsHideDelay = 3000,
  videoId = null,
  autoResume = false,
  resumePromptEnabled = true,
  progressSaveInterval = DEFAULT_PROGRESS_SAVE_INTERVAL,
  completionThreshold = DEFAULT_COMPLETION_THRESHOLD,
  resumeMinimumSeconds = DEFAULT_RESUME_MINIMUM_SECONDS,
  resumeEndThresholdSeconds = DEFAULT_RESUME_END_THRESHOLD_SECONDS,
  playerId,
  currentVideo,
  nextVideo = null,
  playlist = [],
  queue = [],
  autoplayNext = true,
  autoplayCountdown = DEFAULT_AUTOPLAY_COUNTDOWN,
  nextVideoResumeBehavior = "prompt",
  onVideoChange,
  onNextVideo,
  onAutoplayCountdownStart,
  onAutoplayCancelled,
  onEnded,
  analyticsEnabled = true,
  analyticsConfig,
  maxRetries = 3,
  retryBaseDelay = 1000,
  enableSourceFallback = true,
  sources = [],
}: VideoPlayerProviderProps) {
  const effectiveSeekInterval = seekSeconds ?? seekInterval ?? DEFAULT_SEEK_INTERVAL

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const isSeekingRef = useRef<boolean>(false)
  const previousVolumeRef = useRef<number>(initialVolume > 0 ? initialVolume : 0.7)
  const seekFeedbackTimerRef = useRef<NodeJS.Timeout | null>(null)
  const wasTheaterBeforeFullscreenRef = useRef<boolean>(false)
  const hideControlsTimerRef = useRef<NodeJS.Timeout | null>(null)
  const bufferedRangesRef = useRef<BufferedRange[]>([])
  const currentVideoIdRef = useRef<string | null>(videoId || null)
  const lastSaveTimeRef = useRef<number>(0)
  const lastSavedSnapshotRef = useRef<{ time: number; completed: boolean } | null>(null)
  const playerIdRef = useRef<string>(playerId || `player_${Math.random().toString(36).substring(2, 9)}`)
  const currentVideoRef = useRef<unknown>(currentVideo)
  const nextVideoRef = useRef<NextVideoItem | null>(nextVideo || null)
  const playlistRef = useRef<NextVideoItem[]>(playlist || [])
  const queueRef = useRef<NextVideoItem[]>(queue || [])
  const isAutoplayCancelledRef = useRef<boolean>(false)
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null)
  const countdownTargetTimeRef = useRef<number>(0)
  const shouldAutoPlayNextRef = useRef<boolean>(false)
  const sourcesRef = useRef<VideoSource[]>(sources || [])
  sourcesRef.current = sources || []

  // Phase 11 Error Recovery Hook
  const {
    recoveryState,
    handleError: handleRecoveryError,
    manualRetry: executeManualRetry,
    cancelRecovery: executeCancelRecovery,
    restorePlayback: executeRestorePlayback,
  } = usePlayerRecovery({
    maxRetries,
    baseDelay: retryBaseDelay,
    enableSourceFallback,
  })

  const recoveryStateRef = useRef(recoveryState)
  recoveryStateRef.current = recoveryState

  const [state, setState] = useState<VideoPlayerState>({
    isPlaying: false,
    isPaused: true,
    isBuffering: false,
    isEnded: false,
    isSeeking: false,
    seekPreviewTime: 0,
    seekPreviewPercentage: 0,
    currentTime: 0,
    duration: 0,
    bufferedPercent: 0,
    volume: initialVolume,
    isMuted: initialMuted,
    playbackRate: initialPlaybackRate,
    seekInterval: effectiveSeekInterval,
    timeDisplayMode: initialTimeDisplayMode,
    seekFeedback: null,
    isFullscreen: false,
    isTheaterMode: false,
    isTheater: false,
    isPictureInPicture: false,
    isPiP: false,
    fullscreenSupported:
      typeof document !== "undefined" &&
      Boolean(
        document.fullscreenEnabled ||
          (document as unknown as Record<string, unknown>).webkitFullscreenEnabled ||
          (document as unknown as Record<string, unknown>).mozFullScreenEnabled ||
          (document as unknown as Record<string, unknown>).msFullscreenEnabled
      ),
    pictureInPictureSupported:
      typeof document !== "undefined" &&
      Boolean(document.pictureInPictureEnabled),
    availableSubtitleTracks: [],
    activeSubtitleTrack: null,
    areSubtitlesEnabled: false,
    videoQuality: {
      videoWidth: 0,
      videoHeight: 0,
      qualityLabel: "Auto",
      aspectRatio: "16:9",
      formattedResolution: "Auto",
      readyStatus: "Loading",
      bufferedPercent: 0,
      sourceType: "MP4",
    },
    isLoading: true,
    bufferedRanges: [],
    networkState: 0,
    readyState: 0,
    isUserInteracting: false,
    isMenuOpen: false,
    isDragging: false,
    isFocusWithinControls: false,
    controlsHideDelay,
    isControlsVisible: true,
    videoId: videoId || null,
    savedProgress: null,
    shouldShowResumePrompt: false,
    resumePosition: 0,
    isCompleted: false,
    autoResume,
    resumePromptEnabled,
    progressSaveInterval,
    completionThreshold,
    resumeMinimumSeconds,
    resumeEndThresholdSeconds,
    playerId: playerIdRef.current,
    nextVideo: nextVideo || null,
    playlist: playlist || [],
    queue: queue || [],
    resolvedNextVideo: resolveNextVideo(
      currentVideo || (videoId ? { id: videoId } : undefined),
      nextVideo,
      playlist,
      queue
    ),
    autoplayNext,
    autoplayCountdown,
    countdownRemaining: autoplayCountdown,
    isNextVideoCountdownActive: false,
    isAutoplayCancelled: false,
    nextVideoResumeBehavior,
    isShortcutHelpOpen: false,
    playbackRateFeedback: null,
    largeSeekSeconds,
    error: null,
  })


  // Auto-hide controls timer management
  const clearAutoHideTimer = useCallback(() => {
    if (hideControlsTimerRef.current) {
      clearTimeout(hideControlsTimerRef.current)
      hideControlsTimerRef.current = null
    }
  }, [])

  const startAutoHideTimer = useCallback(() => {
    clearAutoHideTimer()
    hideControlsTimerRef.current = setTimeout(() => {
      setState((prev) => {
        // Keep controls visible if video is not playing or in an interactive/loading state
        if (
          !prev.isPlaying ||
          prev.isPaused ||
          prev.isBuffering ||
          prev.isLoading ||
          prev.isSeeking ||
          prev.isEnded ||
          prev.isMenuOpen ||
          prev.isDragging ||
          prev.isFocusWithinControls ||
          prev.isNextVideoCountdownActive ||
          Boolean(prev.error)
        ) {
          return prev
        }
        return { ...prev, isControlsVisible: false }
      })
    }, controlsHideDelay)
  }, [clearAutoHideTimer, controlsHideDelay])

  const showControls = useCallback(() => {
    setState((prev) => (prev.isControlsVisible ? prev : { ...prev, isControlsVisible: true }))
    startAutoHideTimer()
  }, [startAutoHideTimer])

  const hideControls = useCallback(() => {
    clearAutoHideTimer()
    setState((prev) => {
      if (
        !prev.isPlaying ||
        prev.isPaused ||
        prev.isBuffering ||
        prev.isLoading ||
        prev.isSeeking ||
        prev.isEnded ||
        prev.isMenuOpen ||
        prev.isDragging ||
        prev.isFocusWithinControls ||
        prev.isNextVideoCountdownActive ||
        Boolean(prev.error)
      ) {
        return prev
      }
      return { ...prev, isControlsVisible: false }
    })
  }, [clearAutoHideTimer])

  const resetControlsTimer = useCallback(() => {
    showControls()
  }, [showControls])

  const setIsUserInteracting = useCallback((interacting: boolean) => {
    setState((prev) => ({ ...prev, isUserInteracting: interacting }))
    if (interacting) {
      showControls()
    }
  }, [showControls])

  const setIsMenuOpen = useCallback((open: boolean) => {
    setState((prev) => ({ ...prev, isMenuOpen: open }))
    if (open) {
      clearAutoHideTimer()
      setState((prev) => (prev.isControlsVisible ? prev : { ...prev, isControlsVisible: true }))
    } else {
      startAutoHideTimer()
    }
  }, [clearAutoHideTimer, startAutoHideTimer])

  const setIsDragging = useCallback((dragging: boolean) => {
    setState((prev) => ({ ...prev, isDragging: dragging }))
    if (dragging) {
      clearAutoHideTimer()
      setState((prev) => (prev.isControlsVisible ? prev : { ...prev, isControlsVisible: true }))
    } else {
      startAutoHideTimer()
    }
  }, [clearAutoHideTimer, startAutoHideTimer])

  const setIsFocusWithinControls = useCallback((focusWithin: boolean) => {
    setState((prev) => ({ ...prev, isFocusWithinControls: focusWithin }))
    if (focusWithin) {
      clearAutoHideTimer()
      setState((prev) => (prev.isControlsVisible ? prev : { ...prev, isControlsVisible: true }))
    } else {
      startAutoHideTimer()
    }
  }, [clearAutoHideTimer, startAutoHideTimer])

  // Phase 8: Watch Progress Methods
  const saveWatchProgress = useCallback((force = false) => {
    const el = videoRef.current
    const activeVideoId = currentVideoIdRef.current
    if (!el || !activeVideoId || !Number.isFinite(el.duration) || el.duration <= 0) return

    const currentTime = el.currentTime || 0
    const duration = el.duration
    const pct = calculateWatchPercentage(currentTime, duration)
    const completed = isVideoCompleted(pct, currentTime, duration, completionThreshold)

    // Duplicate save prevention: if position moved < 1s and completion status unchanged, skip
    if (!force && lastSavedSnapshotRef.current) {
      const timeDiff = Math.abs(currentTime - lastSavedSnapshotRef.current.time)
      const sameCompletion = completed === lastSavedSnapshotRef.current.completed
      if (timeDiff < 1 && sameCompletion) {
        return
      }
    }

    lastSaveTimeRef.current = Date.now()
    lastSavedSnapshotRef.current = { time: currentTime, completed }

    const payload: WatchProgressData = {
      videoId: activeVideoId,
      currentTime,
      duration,
      progressPercentage: pct,
      isCompleted: completed,
      lastWatchedAt: new Date().toISOString(),
      playbackRate: el.playbackRate || 1,
    }

    WatchProgressService.saveProgress(payload)
    setState((prev) => ({
      ...prev,
      savedProgress: payload,
      isCompleted: completed,
    }))
  }, [completionThreshold])

  const setVideoId = useCallback((id: string | null) => {
    // Flush save for previous video before changing
    if (currentVideoIdRef.current && currentVideoIdRef.current !== id) {
      saveWatchProgress(true)
    }

    currentVideoIdRef.current = id
    lastSaveTimeRef.current = 0
    lastSavedSnapshotRef.current = null

    setState((prev) => ({
      ...prev,
      videoId: id,
      savedProgress: null,
      shouldShowResumePrompt: false,
      resumePosition: 0,
      isCompleted: false,
      isEnded: false,
      currentTime: 0,
      error: null,
    }))

    if (id) {
      Promise.resolve(WatchProgressService.loadProgress(id)).then((saved) => {
        if (saved && currentVideoIdRef.current === id) {
          setState((prev) => ({
            ...prev,
            savedProgress: saved,
            isCompleted: saved.isCompleted,
          }))
        }
      })
    }
  }, [saveWatchProgress])

  const restoreWatchPosition = useCallback((targetPosition?: number) => {
    const el = videoRef.current
    if (!el) return

    const pos = typeof targetPosition === "number"
      ? targetPosition
      : (state.resumePosition || state.savedProgress?.currentTime || 0)

    const safePos = clampResumePosition(pos, el.duration, resumeEndThresholdSeconds)
    el.currentTime = safePos
    setState((prev) => ({
      ...prev,
      currentTime: safePos,
      shouldShowResumePrompt: false,
    }))
  }, [state.resumePosition, state.savedProgress, resumeEndThresholdSeconds])

  const startOver = useCallback(() => {
    const el = videoRef.current
    const activeVideoId = currentVideoIdRef.current
    if (el) {
      el.currentTime = 0
    }
    if (activeVideoId) {
      WatchProgressService.clearProgress(activeVideoId)
    }
    lastSavedSnapshotRef.current = { time: 0, completed: false }
    setState((prev) => ({
      ...prev,
      currentTime: 0,
      savedProgress: null,
      shouldShowResumePrompt: false,
      resumePosition: 0,
      isCompleted: false,
    }))
  }, [])

  const dismissResumePrompt = useCallback(() => {
    setState((prev) => ({ ...prev, shouldShowResumePrompt: false }))
  }, [])

  const markVideoCompleted = useCallback(() => {
    const el = videoRef.current
    const activeVideoId = currentVideoIdRef.current
    if (!activeVideoId) return

    const duration = el?.duration || state.duration || 0
    const payload: WatchProgressData = {
      videoId: activeVideoId,
      currentTime: duration,
      duration,
      progressPercentage: 100,
      isCompleted: true,
      lastWatchedAt: new Date().toISOString(),
      playbackRate: el?.playbackRate || state.playbackRate || 1,
    }

    WatchProgressService.saveProgress(payload)
    lastSavedSnapshotRef.current = { time: duration, completed: true }
    setState((prev) => ({
      ...prev,
      savedProgress: payload,
      isCompleted: true,
    }))
  }, [state.duration, state.playbackRate])

  // Sync external videoId prop if provided
  useEffect(() => {
    if (videoId !== undefined && videoId !== currentVideoIdRef.current) {
      setVideoId(videoId)
    }
  }, [videoId, setVideoId])

  // Phase 9: Sync props and next video resolution
  useEffect(() => {
    currentVideoRef.current = currentVideo
    nextVideoRef.current = nextVideo || null
    playlistRef.current = playlist || []
    queueRef.current = queue || []
    const next = resolveNextVideo(
      currentVideo || (currentVideoIdRef.current ? { id: currentVideoIdRef.current } : undefined),
      nextVideo,
      playlist,
      queue
    )
    setState((prev) => ({
      ...prev,
      nextVideo: nextVideo || null,
      playlist: playlist || [],
      queue: queue || [],
      resolvedNextVideo: next,
    }))
  }, [currentVideo, nextVideo, playlist, queue])

  // Phase 9: Multi-Player Registration & Cleanup
  useEffect(() => {
    const id = playerIdRef.current
    const unregister = videoPlayerManager.registerPlayer(id, {
      playerId: id,
      pause: () => {
        if (videoRef.current && !videoRef.current.paused) {
          videoRef.current.pause()
        }
      },
      isPlaying: () => {
        return Boolean(videoRef.current && !videoRef.current.paused && !videoRef.current.ended)
      },
    })
    return () => {
      unregister()
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current)
        countdownTimerRef.current = null
      }
      if (videoRef.current && !videoRef.current.paused) {
        try {
          videoRef.current.pause()
        } catch {
          // Safe execution
        }
      }
      saveWatchProgress(true)
    }
  }, [saveWatchProgress])

  // Phase 9: Countdown timer helper
  const clearCountdownTimer = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current)
      countdownTimerRef.current = null
    }
  }, [])

  const cancelAutoplayCountdown = useCallback(() => {
    clearCountdownTimer()
    isAutoplayCancelledRef.current = true
    setState((prev) => ({
      ...prev,
      isNextVideoCountdownActive: false,
      isAutoplayCancelled: true,
    }))
    if (onAutoplayCancelled && state.resolvedNextVideo) {
      onAutoplayCancelled(state.resolvedNextVideo)
    }
  }, [clearCountdownTimer, onAutoplayCancelled, state.resolvedNextVideo])

  const playNextVideo = useCallback(
    (targetNextVideo?: NextVideoItem) => {
      clearCountdownTimer()
      markVideoCompleted()
      saveWatchProgress(true)

      const next = targetNextVideo || state.resolvedNextVideo
      if (!next) return

      isAutoplayCancelledRef.current = false
      shouldAutoPlayNextRef.current = true

      // Advance queue if transitioning to a queue item
      if (queueRef.current.length > 0) {
        const nextId = resolveVideoId(next)
        const updatedQueue = queueRef.current.filter((item) => resolveVideoId(item) !== nextId)
        if (updatedQueue.length !== queueRef.current.length) {
          queueRef.current = updatedQueue
          setState((prev) => ({ ...prev, queue: updatedQueue }))
        }
      }

      setState((prev) => ({
        ...prev,
        isNextVideoCountdownActive: false,
        isAutoplayCancelled: false,
        countdownRemaining: prev.autoplayCountdown,
        isControlsVisible: true,
      }))

      if (onNextVideo) onNextVideo(next)
      if (onVideoChange) onVideoChange(next)

      const nextId = resolveVideoId(next)
      if (nextId) {
        setVideoId(nextId)
      }

      videoPlayerManager.setActivePlayer(playerIdRef.current)

      if (videoRef.current) {
        // Next video resume conflict behavior
        if (nextVideoResumeBehavior === "start-over") {
          videoRef.current.currentTime = 0
        }
        const playPromise = videoRef.current.play()
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            // Handled gracefully per browser autoplay policy
            setState((prev) => ({
              ...prev,
              isPlaying: false,
              isPaused: true,
              isControlsVisible: true,
            }))
          })
        }
      }
    },
    [
      clearCountdownTimer,
      markVideoCompleted,
      saveWatchProgress,
      state.resolvedNextVideo,
      onNextVideo,
      onVideoChange,
      setVideoId,
      nextVideoResumeBehavior,
    ]
  )

  const startNextVideoCountdown = useCallback(
    (targetNext: NextVideoItem) => {
      clearCountdownTimer()
      const cd = validateAutoplayCountdown(autoplayCountdown)
      const durationMs = cd * 1000

      countdownTargetTimeRef.current = Date.now() + durationMs

      setState((prev) => ({
        ...prev,
        isNextVideoCountdownActive: true,
        countdownRemaining: cd,
        isControlsVisible: true,
      }))

      if (onAutoplayCountdownStart) {
        onAutoplayCountdownStart(cd, targetNext)
      }

      countdownTimerRef.current = setInterval(() => {
        const remainingMs = countdownTargetTimeRef.current - Date.now()
        const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000))

        setState((prev) => {
          if (prev.countdownRemaining === remainingSec) return prev
          return { ...prev, countdownRemaining: remainingSec }
        })

        if (remainingMs <= 0) {
          clearCountdownTimer()
          playNextVideo(targetNext)
        }
      }, 100)
    },
    [autoplayCountdown, clearCountdownTimer, onAutoplayCountdownStart, playNextVideo]
  )

  const setPlaylist = useCallback((newPlaylist: NextVideoItem[]) => {
    playlistRef.current = newPlaylist
    const next = resolveNextVideo(
      currentVideoRef.current || (currentVideoIdRef.current ? { id: currentVideoIdRef.current } : undefined),
      nextVideoRef.current,
      newPlaylist,
      queueRef.current
    )
    setState((prev) => ({ ...prev, playlist: newPlaylist, resolvedNextVideo: next }))
  }, [])

  const setQueue = useCallback((newQueue: NextVideoItem[]) => {
    queueRef.current = newQueue
    const next = resolveNextVideo(
      currentVideoRef.current || (currentVideoIdRef.current ? { id: currentVideoIdRef.current } : undefined),
      nextVideoRef.current,
      playlistRef.current,
      newQueue
    )
    setState((prev) => ({ ...prev, queue: newQueue, resolvedNextVideo: next }))
  }, [])

  const setAutoplayNext = useCallback((enabled: boolean) => {
    setState((prev) => ({ ...prev, autoplayNext: enabled }))
  }, [])

  // Save progress on page visibility change and unload
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        saveWatchProgress(true)
      }
    }

    const handlePageExit = () => {
      saveWatchProgress(true)
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("pagehide", handlePageExit)
    window.addEventListener("beforeunload", handlePageExit)

    return () => {
      saveWatchProgress(true) // Save on unmount
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("pagehide", handlePageExit)
      window.removeEventListener("beforeunload", handlePageExit)
    }
  }, [saveWatchProgress])

  // Synchronize auto-hide timer when playback state transitions
  useEffect(() => {
    if (
      !state.isPlaying ||
      state.isPaused ||
      state.isBuffering ||
      state.isLoading ||
      state.isSeeking ||
      state.isEnded ||
      state.isMenuOpen ||
      state.isDragging ||
      state.isFocusWithinControls ||
      Boolean(state.error)
    ) {
      clearAutoHideTimer()
    } else {
      startAutoHideTimer()
    }
  }, [
    state.isPlaying,
    state.isPaused,
    state.isBuffering,
    state.isLoading,
    state.isSeeking,
    state.isEnded,
    state.isMenuOpen,
    state.isDragging,
    state.isFocusWithinControls,
    state.error,
    clearAutoHideTimer,
    startAutoHideTimer,
  ])

  // Cleanup auto-hide timer on unmount
  useEffect(() => {
    return () => {
      clearAutoHideTimer()
    }
  }, [clearAutoHideTimer])

  // Synchronize Fullscreen events from browser with vendor prefix support
  useEffect(() => {
    const handleFullscreenChange = () => {
      const doc = document as unknown as Record<string, unknown>
      const currentFsElement =
        document.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement

      const isCurrentFs = currentFsElement === containerRef.current

      setState((prev) => {
        // If exiting fullscreen, restore prior theater mode if it was active
        if (prev.isFullscreen && !isCurrentFs) {
          const restoreTheater = wasTheaterBeforeFullscreenRef.current
          return {
            ...prev,
            isFullscreen: false,
            isTheaterMode: restoreTheater,
            isTheater: restoreTheater,
          }
        }
        return {
          ...prev,
          isFullscreen: isCurrentFs,
        }
      })
    }

    const handleFullscreenError = () => {
      // Safe error handling - keep player functional without crashing
      setState((prev) => ({ ...prev, isFullscreen: false }))
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange)
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange)
    document.addEventListener("fullscreenerror", handleFullscreenError)
    document.addEventListener("webkitfullscreenerror", handleFullscreenError)

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange)
      document.removeEventListener("fullscreenerror", handleFullscreenError)
      document.removeEventListener("webkitfullscreenerror", handleFullscreenError)
    }
  }, [])

  // Callback ref to attach/detach video event listeners cleanly
  const registerVideo = useCallback(
    (el: HTMLVideoElement | null) => {
      videoRef.current = el
      if (!el) return

      try {
        el.volume = state.volume
        el.muted = state.isMuted
      } catch {}

      const syncQuality = () => {
        const width = el.videoWidth || 0
        const height = el.videoHeight || 0
        setState((prev) => ({
          ...prev,
          videoQuality: {
            videoWidth: width,
            videoHeight: height,
            qualityLabel: getQualityLabel(height),
            aspectRatio: calculateAspectRatio(width, height),
            formattedResolution: formatResolution(width, height),
            readyStatus: getReadyStatusLabel(el.readyState, prev.isBuffering, !!prev.error),
            bufferedPercent: prev.bufferedPercent,
            sourceType: el.currentSrc ? el.currentSrc.split(".").pop()?.toUpperCase() : "MP4",
          },
        }))
      }

      const syncTracks = () => {
        if (!el.textTracks) return
        const rawList = Array.from(el.textTracks)
        const tracks: SubtitleTrack[] = []
        let active: SubtitleTrack | null = null

        rawList.forEach((t, i) => {
          if (t.kind === "subtitles" || t.kind === "captions") {
            const normalized = normalizeSubtitleTrack(t, i)
            tracks.push(normalized)
            if (t.mode === "showing") {
              active = normalized
            }
          }
        })

        setState((prev) => ({
          ...prev,
          availableSubtitleTracks: tracks,
          activeSubtitleTrack: active,
          areSubtitlesEnabled: active !== null,
        }))
      }

      const onLoadStart = () => {
        bufferedRangesRef.current = []
        isAutoplayCancelledRef.current = false
        clearCountdownTimer()
        setState((prev) => ({
          ...prev,
          isLoading: true,
          bufferedRanges: [],
          error: null,
          isControlsVisible: true,
          isNextVideoCountdownActive: false,
          isAutoplayCancelled: false,
        }))
      }

      const onLoadedMetadata = () => {
        syncQuality()
        syncTracks()
        const dur = el.duration || 0

        try {
          el.volume = state.volume
          el.muted = state.isMuted
        } catch {}

        setState((prev) => ({
          ...prev,
          duration: dur,
          isPaused: el.paused,
          isLoading: false,
          error: null,
        }))

        // Phase 11: If restoring after error recovery reload, restore position and playback
        if (recoveryStateRef.current.isRecovering) {
          executeRestorePlayback(el)
        }

        // Load saved progress for the current video and check resume eligibility
        const activeVideoId = currentVideoIdRef.current

        const handlePendingAutoPlay = () => {
          if (shouldAutoPlayNextRef.current) {
            shouldAutoPlayNextRef.current = false
            videoPlayerManager.setActivePlayer(playerIdRef.current)
            const playPromise = el.play()
            if (playPromise !== undefined) {
              playPromise.catch(() => {
                setState((prev) => ({
                  ...prev,
                  isPlaying: false,
                  isPaused: true,
                  isControlsVisible: true,
                }))
              })
            }
          }
        }

        if (activeVideoId) {
          Promise.resolve(WatchProgressService.loadProgress(activeVideoId)).then((saved) => {
            if (saved && currentVideoIdRef.current === activeVideoId) {
              const eligible = isResumeEligible(saved, dur, {
                minimumSeconds: resumeMinimumSeconds,
                endThresholdSeconds: resumeEndThresholdSeconds,
              })

              if (eligible) {
                const safePos = clampResumePosition(saved.currentTime, dur, resumeEndThresholdSeconds)
                if (autoResume || nextVideoResumeBehavior === "resume") {
                  el.currentTime = safePos
                  setState((prev) => ({
                    ...prev,
                    currentTime: safePos,
                    savedProgress: saved,
                    isCompleted: saved.isCompleted,
                    shouldShowResumePrompt: false,
                  }))
                  handlePendingAutoPlay()
                } else if (nextVideoResumeBehavior === "start-over") {
                  el.currentTime = 0
                  setState((prev) => ({
                    ...prev,
                    currentTime: 0,
                    savedProgress: saved,
                    isCompleted: false,
                    shouldShowResumePrompt: false,
                  }))
                  handlePendingAutoPlay()
                } else if (resumePromptEnabled) {
                  // Prompt behavior takes priority: show prompt and do not start playback over it
                  shouldAutoPlayNextRef.current = false
                  setState((prev) => ({
                    ...prev,
                    savedProgress: saved,
                    isCompleted: saved.isCompleted,
                    shouldShowResumePrompt: true,
                    resumePosition: safePos,
                  }))
                } else {
                  handlePendingAutoPlay()
                }
              } else {
                setState((prev) => ({
                  ...prev,
                  savedProgress: saved,
                  isCompleted: saved.isCompleted,
                }))
                handlePendingAutoPlay()
              }
            } else {
              handlePendingAutoPlay()
            }
          })
        } else {
          handlePendingAutoPlay()
        }
      }


      const onCanPlay = () => {
        setState((prev) => ({
          ...prev,
          networkState: el.networkState ?? 0,
          readyState: el.readyState ?? 0,
          isLoading: false,
          isBuffering: false,
        }))
      }

      const onTimeUpdate = () => {
        // Prevent timeupdate from fighting with active seek dragging
        if (isSeekingRef.current) return
        const curTime = el.currentTime || 0
        const dur = el.duration || 0
        const isEndedState = el.ended || (dur > 0 && curTime >= dur)

        // Completion detection
        const pct = calculateWatchPercentage(curTime, dur)
        const completed = isVideoCompleted(pct, curTime, dur, completionThreshold)

        setState((prev) => ({
          ...prev,
          currentTime: curTime,
          isEnded: isEndedState,
          isCompleted: completed || prev.isCompleted,
        }))

        // Periodic progress save
        if (!el.paused && !isEndedState && curTime > 0 && dur > 0) {
          const now = Date.now()
          if (now - lastSaveTimeRef.current >= progressSaveInterval * 1000) {
            saveWatchProgress()
          }
        }
      }

      const onProgress = () => {
        const ranges = getBufferedRanges(el)
        if (!areBufferedRangesEqual(bufferedRangesRef.current, ranges)) {
          bufferedRangesRef.current = ranges
          const pct = calculateBufferedPercentage(ranges, el.duration || 0)
          setState((prev) => ({
            ...prev,
            bufferedRanges: ranges,
            bufferedPercent: pct,
            videoQuality: {
              ...prev.videoQuality,
              bufferedPercent: pct,
            },
          }))
        }
      }

      const onPlay = () => {
        videoPlayerManager.setActivePlayer(playerIdRef.current)
        setState((prev) => ({
          ...prev,
          isPlaying: true,
          isPaused: false,
          isBuffering: false,
          isLoading: false,
          isEnded: false,
          error: null,
        }))
      }

      const onPause = () => {
        setState((prev) => ({
          ...prev,
          isPlaying: false,
          isPaused: true,
          isControlsVisible: true,
        }))
        saveWatchProgress()
      }

      const onWaiting = () => {
        setState((prev) => ({
          ...prev,
          isBuffering: true,
          isLoading: !el.duration || el.readyState < 2,
          isControlsVisible: true,
        }))
      }

      const onPlaying = () => {
        setState((prev) => ({
          ...prev,
          isBuffering: false,
          isLoading: false,
          isPlaying: true,
          isPaused: false,
          isEnded: false,
        }))
      }

      const onRateChange = () => {
        setState((prev) => ({ ...prev, playbackRate: el.playbackRate }))
      }

      const onVolumeChange = () => {
        setState((prev) => ({
          ...prev,
          volume: el.volume,
          isMuted: el.muted,
        }))
      }

      const onEndedEvent = () => {
        setState((prev) => ({
          ...prev,
          isPlaying: false,
          isPaused: true,
          isEnded: true,
          isBuffering: false,
          isLoading: false,
          currentTime: prev.duration || el.currentTime,
          isControlsVisible: true,
          isCompleted: true,
        }))
        markVideoCompleted()
        if (onEnded) onEnded()

        const nextToPlay = resolveNextVideo(
          currentVideoRef.current || (currentVideoIdRef.current ? { id: currentVideoIdRef.current } : undefined),
          nextVideoRef.current,
          playlistRef.current,
          queueRef.current
        )

        if (autoplayNext && nextToPlay && !isAutoplayCancelledRef.current) {
          startNextVideoCountdown(nextToPlay)
        }
      }

      const onError = () => {
        const err = el.error
        const classified = handleRecoveryError(err, el, sourcesRef.current, (params) => {
          if (videoRef.current) {
            if (params.nextSource && params.nextSource.src) {
              videoRef.current.src = params.nextSource.src
            }
            try {
              videoRef.current.load()
            } catch {
              // Safe fallback
            }
          }
        })
        setState((prev) => ({
          ...prev,
          isLoading: false,
          isBuffering: false,
          isControlsVisible: true,
          error: {
            code: classified?.code || err?.code || 0,
            message: classified?.message || "An error occurred while loading the video.",
          },
          classifiedError: classified,
        }))
      }

      const onSeeking = () => {
        setState((prev) => ({
          ...prev,
          isSeeking: true,
          isControlsVisible: true,
        }))
      }

      const onSeeked = () => {
        if (!isSeekingRef.current) {
          setState((prev) => ({
            ...prev,
            isSeeking: false,
            currentTime: el.currentTime || 0,
            isEnded: el.ended || (el.duration > 0 && el.currentTime >= el.duration),
          }))
        }
      }

      const onEnterPiP = () => {
        setState((prev) => ({
          ...prev,
          isPictureInPicture: true,
          isPiP: true,
        }))
      }

      const onLeavePiP = () => {
        setState((prev) => ({
          ...prev,
          isPictureInPicture: false,
          isPiP: false,
        }))
      }

      el.addEventListener("loadstart", onLoadStart)
      el.addEventListener("loadedmetadata", onLoadedMetadata)
      el.addEventListener("loadeddata", syncQuality)
      el.addEventListener("canplay", onCanPlay)
      el.addEventListener("canplaythrough", onCanPlay)
      el.addEventListener("resize", syncQuality)
      el.addEventListener("timeupdate", onTimeUpdate)
      el.addEventListener("progress", onProgress)
      el.addEventListener("play", onPlay)
      el.addEventListener("pause", onPause)
      el.addEventListener("waiting", onWaiting)
      el.addEventListener("playing", onPlaying)
      el.addEventListener("ratechange", onRateChange)
      el.addEventListener("volumechange", onVolumeChange)
      el.addEventListener("seeking", onSeeking)
      el.addEventListener("seeked", onSeeked)
      el.addEventListener("enterpictureinpicture", onEnterPiP)
      el.addEventListener("leavepictureinpicture", onLeavePiP)
      el.addEventListener("ended", onEndedEvent)
      el.addEventListener("error", onError)

      if (el.textTracks) {
        el.textTracks.addEventListener("change", syncTracks)
        el.textTracks.addEventListener("addtrack", syncTracks)
        el.textTracks.addEventListener("removetrack", syncTracks)
      }
    },
    [
      onEnded,
      autoResume,
      completionThreshold,
      markVideoCompleted,
      progressSaveInterval,
      resumeEndThresholdSeconds,
      resumeMinimumSeconds,
      resumePromptEnabled,
      saveWatchProgress,
      autoplayNext,
      clearCountdownTimer,
      startNextVideoCountdown,
    ]
  )

  const play = useCallback(async () => {
    if (!videoRef.current) return
    try {
      // Replay functionality: if completed or at the end, restart from beginning
      if (
        videoRef.current.ended ||
        (videoRef.current.duration > 0 &&
          videoRef.current.currentTime >= videoRef.current.duration - 0.2)
      ) {
        videoRef.current.currentTime = 0
        setState((prev) => ({ ...prev, currentTime: 0, isEnded: false }))
      }
      // Ensure audio volume and mute are in sync
      try {
        videoRef.current.volume = state.volume
        videoRef.current.muted = state.isMuted
      } catch {}
      await videoRef.current.play()
      setState((prev) => ({
        ...prev,
        isPlaying: true,
        isPaused: false,
        isEnded: false,
        error: null,
      }))
    } catch (err: unknown) {
      if (
        err instanceof DOMException &&
        (err.name === "AbortError" || err.name === "NotAllowedError")
      ) {
        setState((prev) => ({ ...prev, isPlaying: false, isPaused: true }))
        return
      }
      const message = err instanceof Error ? err.message : "Playback request aborted"
      setState((prev) => ({
        ...prev,
        isPlaying: false,
        isPaused: true,
        error: { code: 0, message },
      }))
    }
  }, [])

  const pause = useCallback(() => {
    if (!videoRef.current) return
    videoRef.current.pause()
    setState((prev) => ({ ...prev, isPlaying: false, isPaused: true }))
  }, [])

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return
    if (videoRef.current.paused || videoRef.current.ended) {
      play()
    } else {
      pause()
    }
  }, [play, pause])

  const seekTo = useCallback((timeInSeconds: number) => {
    if (typeof timeInSeconds !== "number" || isNaN(timeInSeconds)) return
    if (!videoRef.current) return
    const maxDur = videoRef.current.duration || 0
    if (!Number.isFinite(maxDur)) return
    const clamped = Math.max(0, Math.min(timeInSeconds, maxDur))
    videoRef.current.currentTime = clamped
    setState((prev) => ({
      ...prev,
      currentTime: clamped,
      isEnded: maxDur > 0 && clamped >= maxDur,
    }))
  }, [])

  const seek = seekTo

  const clearSeekFeedback = useCallback(() => {
    if (seekFeedbackTimerRef.current) {
      clearTimeout(seekFeedbackTimerRef.current)
      seekFeedbackTimerRef.current = null
    }
    setState((prev) => (prev.seekFeedback ? { ...prev, seekFeedback: null } : prev))
  }, [])

  const triggerSeekFeedback = useCallback(
    (direction: "forward" | "backward", seconds: number) => {
      if (seekFeedbackTimerRef.current) {
        clearTimeout(seekFeedbackTimerRef.current)
      }
      setState((prev) => ({
        ...prev,
        seekFeedback: { direction, seconds, timestamp: Date.now() },
      }))
      seekFeedbackTimerRef.current = setTimeout(() => {
        setState((prev) => ({ ...prev, seekFeedback: null }))
        seekFeedbackTimerRef.current = null
      }, 650)
    },
    []
  )

  const skipBackward = useCallback(
    (seconds?: number) => {
      const interval =
        typeof seconds === "number" && seconds > 0 ? seconds : state.seekInterval
      triggerSeekFeedback("backward", interval)
      const current = videoRef.current ? videoRef.current.currentTime : state.currentTime
      seekTo(current - interval)
    },
    [state.seekInterval, state.currentTime, triggerSeekFeedback, seekTo]
  )

  const skipForward = useCallback(
    (seconds?: number) => {
      const interval =
        typeof seconds === "number" && seconds > 0 ? seconds : state.seekInterval
      triggerSeekFeedback("forward", interval)
      const current = videoRef.current ? videoRef.current.currentTime : state.currentTime
      seekTo(current + interval)
    },
    [state.seekInterval, state.currentTime, triggerSeekFeedback, seekTo]
  )

  const setTimeDisplayMode = useCallback((mode: TimeDisplayMode) => {
    setState((prev) => ({ ...prev, timeDisplayMode: mode }))
  }, [])

  const toggleTimeDisplayMode = useCallback(() => {
    setState((prev) => {
      let nextMode: TimeDisplayMode = "current-total"
      if (prev.timeDisplayMode === "current-total") {
        nextMode = "current-remaining"
      } else if (prev.timeDisplayMode === "current-remaining") {
        nextMode = "current-only"
      } else {
        nextMode = "current-total"
      }
      return { ...prev, timeDisplayMode: nextMode }
    })
  }, [])

  useEffect(() => {
    return () => {
      if (seekFeedbackTimerRef.current) {
        clearTimeout(seekFeedbackTimerRef.current)
      }
    }
  }, [])

  const startSeeking = useCallback((previewTime: number, previewPercentage: number) => {
    isSeekingRef.current = true
    setState((prev) => ({
      ...prev,
      isSeeking: true,
      seekPreviewTime: previewTime,
      seekPreviewPercentage: previewPercentage,
    }))
  }, [])

  const updateSeeking = useCallback((previewTime: number, previewPercentage: number) => {
    setState((prev) => ({
      ...prev,
      seekPreviewTime: previewTime,
      seekPreviewPercentage: previewPercentage,
    }))
  }, [])

  const endSeeking = useCallback((finalTime?: number) => {
    isSeekingRef.current = false
    if (!videoRef.current) {
      setState((prev) => ({ ...prev, isSeeking: false }))
      return
    }

    const duration = videoRef.current.duration || 0
    const targetTime =
      typeof finalTime === "number"
        ? Math.max(0, Math.min(finalTime, duration))
        : videoRef.current.currentTime

    videoRef.current.currentTime = targetTime
    setState((prev) => ({
      ...prev,
      isSeeking: false,
      currentTime: targetTime,
      isEnded: duration > 0 && targetTime >= duration,
    }))
  }, [])

  const setVolume = useCallback((volume: number) => {
    if (typeof volume !== "number" || isNaN(volume)) return
    const clamped = Math.max(0, Math.min(1, Number(volume.toFixed(4))))
    if (videoRef.current) {
      videoRef.current.volume = clamped
      if (clamped > 0) {
        videoRef.current.muted = false
        previousVolumeRef.current = clamped
      } else {
        videoRef.current.muted = true
      }
    } else {
      if (clamped > 0) {
        previousVolumeRef.current = clamped
      }
    }
    setState((prev) => ({
      ...prev,
      volume: clamped,
      isMuted: clamped === 0 ? true : false,
    }))
  }, [])

  const toggleMute = useCallback(() => {
    if (!videoRef.current) {
      setState((prev) => ({ ...prev, isMuted: !prev.isMuted }))
      return
    }

    const isCurrentlyMuted = videoRef.current.muted || videoRef.current.volume === 0

    if (isCurrentlyMuted) {
      // Unmute: restore previous volume or safe default 0.7
      const restoredVol =
        previousVolumeRef.current > 0 ? previousVolumeRef.current : 0.7
      videoRef.current.muted = false
      if (videoRef.current.volume === 0) {
        videoRef.current.volume = restoredVol
      }
      setState((prev) => ({
        ...prev,
        isMuted: false,
        volume: videoRef.current ? videoRef.current.volume : restoredVol,
      }))
    } else {
      // Mute: save current volume
      if (videoRef.current.volume > 0) {
        previousVolumeRef.current = videoRef.current.volume
      }
      videoRef.current.muted = true
      setState((prev) => ({
        ...prev,
        isMuted: true,
      }))
    }
  }, [])

  const increaseVolume = useCallback(
    (step = DEFAULT_VOLUME_STEP) => {
      setState((prev) => {
        const currentEffective = prev.isMuted ? 0 : prev.volume
        const newVolume = Math.min(1, currentEffective + step)
        if (videoRef.current) {
          videoRef.current.volume = newVolume
          videoRef.current.muted = false
          if (newVolume > 0) {
            previousVolumeRef.current = newVolume
          }
        }
        return {
          ...prev,
          volume: newVolume,
          isMuted: false,
        }
      })
    },
    []
  )

  const decreaseVolume = useCallback(
    (step = DEFAULT_VOLUME_STEP) => {
      setState((prev) => {
        const currentEffective = prev.isMuted ? 0 : prev.volume
        const newVolume = Math.max(0, currentEffective - step)
        const willBeMuted = newVolume === 0
        if (videoRef.current) {
          videoRef.current.volume = newVolume
          videoRef.current.muted = willBeMuted
          if (newVolume > 0) {
            previousVolumeRef.current = newVolume
          }
        }
        return {
          ...prev,
          volume: newVolume,
          isMuted: willBeMuted,
        }
      })
    },
    []
  )

  const setPlaybackRate = useCallback((rate: number) => {
    if (
      typeof rate !== "number" ||
      isNaN(rate) ||
      !isFinite(rate) ||
      rate <= 0 ||
      !(SUPPORTED_PLAYBACK_RATES as readonly number[]).includes(rate)
    ) {
      return
    }
    if (videoRef.current) {
      videoRef.current.playbackRate = rate
    }
    setState((prev) => ({ ...prev, playbackRate: rate }))
  }, [])

  const playbackRateFeedbackTimerRef = useRef<NodeJS.Timeout | null>(null)

  const clearPlaybackRateFeedback = useCallback(() => {
    if (playbackRateFeedbackTimerRef.current) {
      clearTimeout(playbackRateFeedbackTimerRef.current)
      playbackRateFeedbackTimerRef.current = null
    }
    setState((prev) => (prev.playbackRateFeedback ? { ...prev, playbackRateFeedback: null } : prev))
  }, [])

  const triggerPlaybackRateFeedback = useCallback(
    (rate: number) => {
      clearPlaybackRateFeedback()
      const label = formatPlaybackRate(rate)
      setState((prev) => ({ ...prev, playbackRateFeedback: label }))
      playbackRateFeedbackTimerRef.current = setTimeout(() => {
        clearPlaybackRateFeedback()
      }, 1000)
    },
    [clearPlaybackRateFeedback]
  )

  const stepPlaybackRate = useCallback(
    (direction: "up" | "down") => {
      const rates = SUPPORTED_PLAYBACK_RATES as readonly number[]
      const current = state.playbackRate || 1
      let newRate = current
      if (direction === "up") {
        const higher = rates.filter((r) => r > current)
        newRate = higher.length > 0 ? higher[0] : rates[rates.length - 1]
      } else {
        const lower = rates.filter((r) => r < current)
        newRate = lower.length > 0 ? lower[lower.length - 1] : rates[0]
      }
      setPlaybackRate(newRate)
      triggerPlaybackRateFeedback(newRate)
    },
    [state.playbackRate, setPlaybackRate, triggerPlaybackRateFeedback]
  )

  const resetPlaybackRate = useCallback(() => {
    setPlaybackRate(1)
    triggerPlaybackRateFeedback(1)
  }, [setPlaybackRate, triggerPlaybackRateFeedback])

  const openShortcutHelp = useCallback(() => {
    setState((prev) => ({ ...prev, isShortcutHelpOpen: true }))
  }, [])

  const closeShortcutHelp = useCallback(() => {
    setState((prev) => ({ ...prev, isShortcutHelpOpen: false }))
  }, [])

  const toggleShortcutHelp = useCallback(() => {
    setState((prev) => ({ ...prev, isShortcutHelpOpen: !prev.isShortcutHelpOpen }))
  }, [])


  const enterFullscreen = useCallback(async () => {
    if (!containerRef.current) return
    try {
      wasTheaterBeforeFullscreenRef.current = state.isTheaterMode
      const container = containerRef.current as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void>
        mozRequestFullScreen?: () => Promise<void>
        msRequestFullscreen?: () => Promise<void>
      }
      if (container.requestFullscreen) {
        await container.requestFullscreen()
      } else if (container.webkitRequestFullscreen) {
        await container.webkitRequestFullscreen()
      } else if (container.mozRequestFullScreen) {
        await container.mozRequestFullScreen()
      } else if (container.msRequestFullscreen) {
        await container.msRequestFullscreen()
      }
    } catch {
      // Safe fallback - browser rejected or permissions denied
    }
  }, [state.isTheaterMode])

  const exitFullscreen = useCallback(async () => {
    try {
      const doc = document as Document & {
        webkitExitFullscreen?: () => Promise<void>
        mozCancelFullScreen?: () => Promise<void>
        msExitFullscreen?: () => Promise<void>
      }
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else if ((doc as unknown as Record<string, unknown>).webkitFullscreenElement && doc.webkitExitFullscreen) {
        await doc.webkitExitFullscreen()
      } else if ((doc as unknown as Record<string, unknown>).mozFullScreenElement && doc.mozCancelFullScreen) {
        await doc.mozCancelFullScreen()
      } else if ((doc as unknown as Record<string, unknown>).msFullscreenElement && doc.msExitFullscreen) {
        await doc.msExitFullscreen()
      }
    } catch {
      // Safe fallback
    }
  }, [])

  const toggleFullscreen = useCallback(async () => {
    const doc = document as unknown as Record<string, unknown>
    const isFs = Boolean(
      document.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
    )
    if (isFs) {
      await exitFullscreen()
    } else {
      await enterFullscreen()
    }
  }, [enterFullscreen, exitFullscreen])

  const enterTheaterMode = useCallback(() => {
    setState((prev) => ({ ...prev, isTheaterMode: true, isTheater: true }))
  }, [])

  const exitTheaterMode = useCallback(() => {
    setState((prev) => ({ ...prev, isTheaterMode: false, isTheater: false }))
  }, [])

  const toggleTheaterMode = useCallback(() => {
    setState((prev) => {
      const next = !prev.isTheaterMode
      return { ...prev, isTheaterMode: next, isTheater: next }
    })
  }, [])

  const toggleTheater = toggleTheaterMode

  const enterPictureInPicture = useCallback(async () => {
    if (!videoRef.current) return
    try {
      if (
        document.pictureInPictureEnabled &&
        "requestPictureInPicture" in videoRef.current &&
        document.pictureInPictureElement !== videoRef.current
      ) {
        await videoRef.current.requestPictureInPicture()
      }
    } catch {
      // Safe fallback: PiP blocked by user or permissions policy
    }
  }, [])

  const exitPictureInPicture = useCallback(async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture()
      }
    } catch {
      // Safe fallback
    }
  }, [])

  const togglePictureInPicture = useCallback(async () => {
    if (!videoRef.current) return
    try {
      if (document.pictureInPictureElement === videoRef.current) {
        await exitPictureInPicture()
      } else {
        await enterPictureInPicture()
      }
    } catch {
      // Safe fallback
    }
  }, [enterPictureInPicture, exitPictureInPicture])

  const togglePiP = togglePictureInPicture

  const manualRetry = useCallback(() => {
    setState((prev) => ({ ...prev, error: null, isBuffering: true, isEnded: false }))
    executeManualRetry(sourcesRef.current, (params) => {
      if (videoRef.current) {
        if (params.nextSource && params.nextSource.src) {
          videoRef.current.src = params.nextSource.src
        }
        try {
          videoRef.current.load()
        } catch {
          // Safe fallback
        }
      }
    })
  }, [executeManualRetry])

  const cancelRecovery = useCallback(() => {
    executeCancelRecovery()
    setState((prev) => ({ ...prev, isBuffering: false }))
  }, [executeCancelRecovery])

  const retry = manualRetry

  const enableSubtitleTrack = useCallback((trackIdOrIndex: string | number) => {
    if (!videoRef.current || !videoRef.current.textTracks) return
    const list = Array.from(videoRef.current.textTracks)
    let found: SubtitleTrack | null = null

    const hasExactMatch = list.some(
      (t, i) =>
        t.id === trackIdOrIndex ||
        i === trackIdOrIndex ||
        String(i) === String(trackIdOrIndex)
    )

    list.forEach((t, i) => {
      const matches = hasExactMatch
        ? t.id === trackIdOrIndex ||
          i === trackIdOrIndex ||
          String(i) === String(trackIdOrIndex)
        : t.language === trackIdOrIndex || t.label === trackIdOrIndex

      if (matches && !found) {
        t.mode = "showing"
        found = normalizeSubtitleTrack(t, i)
      } else if (t.kind === "subtitles" || t.kind === "captions") {
        t.mode = "disabled"
      }
    })

    if (found) {
      setState((prev) => ({
        ...prev,
        activeSubtitleTrack: found,
        areSubtitlesEnabled: true,
      }))
    }
  }, [])

  const disableSubtitles = useCallback(() => {
    if (!videoRef.current || !videoRef.current.textTracks) return
    const list = Array.from(videoRef.current.textTracks)
    list.forEach((t) => {
      if (t.kind === "subtitles" || t.kind === "captions") {
        t.mode = "disabled"
      }
    })
    setState((prev) => ({
      ...prev,
      activeSubtitleTrack: null,
      areSubtitlesEnabled: false,
    }))
  }, [])

  const toggleSubtitles = useCallback(() => {
    setState((prev) => {
      if (prev.areSubtitlesEnabled) {
        if (videoRef.current && videoRef.current.textTracks) {
          Array.from(videoRef.current.textTracks).forEach((t) => {
            if (t.kind === "subtitles" || t.kind === "captions") {
              t.mode = "disabled"
            }
          })
        }
        return {
          ...prev,
          activeSubtitleTrack: null,
          areSubtitlesEnabled: false,
        }
      } else if (prev.availableSubtitleTracks.length > 0) {
        const target =
          prev.availableSubtitleTracks.find((t) => t.isDefault) ||
          prev.availableSubtitleTracks[0]

        if (videoRef.current && videoRef.current.textTracks) {
          Array.from(videoRef.current.textTracks).forEach((t, i) => {
            if (t.id === target.id || i === target.index) {
              t.mode = "showing"
            } else if (t.kind === "subtitles" || t.kind === "captions") {
              t.mode = "disabled"
            }
          })
        }

        return {
          ...prev,
          activeSubtitleTrack: target,
          areSubtitlesEnabled: true,
        }
      }
      return prev
    })
  }, [])

  const syncSubtitleTracks = useCallback(() => {
    if (!videoRef.current || !videoRef.current.textTracks) return
    const rawList = Array.from(videoRef.current.textTracks)
    const tracks: SubtitleTrack[] = []
    let active: SubtitleTrack | null = null

    rawList.forEach((t, i) => {
      if (t.kind === "subtitles" || t.kind === "captions") {
        const normalized = normalizeSubtitleTrack(t, i)
        tracks.push(normalized)
        if (t.mode === "showing") {
          active = normalized
        }
      }
    })

    setState((prev) => ({
      ...prev,
      availableSubtitleTracks: tracks,
      activeSubtitleTrack: active,
      areSubtitlesEnabled: active !== null,
    }))
  }, [])

  const syncQualityInfo = useCallback(() => {
    if (!videoRef.current) return
    const el = videoRef.current
    const width = el.videoWidth || 0
    const height = el.videoHeight || 0
    setState((prev) => ({
      ...prev,
      videoQuality: {
        videoWidth: width,
        videoHeight: height,
        qualityLabel: getQualityLabel(height),
        aspectRatio: calculateAspectRatio(width, height),
        formattedResolution: formatResolution(width, height),
        readyStatus: getReadyStatusLabel(el.readyState, prev.isBuffering, !!prev.error),
        bufferedPercent: prev.bufferedPercent,
        sourceType: el.currentSrc ? el.currentSrc.split(".").pop()?.toUpperCase() : "MP4",
      },
    }))
  }, [])

  const setControlsVisible = useCallback((visible: boolean) => {
    setState((prev) => ({ ...prev, isControlsVisible: visible }))
  }, [])

  const actions: VideoPlayerActions = {
    play,
    pause,
    togglePlay,
    seek,
    seekTo,
    skipBackward,
    skipForward,
    startSeeking,
    updateSeeking,
    endSeeking,
    setVolume,
    increaseVolume,
    decreaseVolume,
    toggleMute,
    setPlaybackRate,
    stepPlaybackRate,
    resetPlaybackRate,
    clearPlaybackRateFeedback,
    setTimeDisplayMode,
    toggleTimeDisplayMode,
    clearSeekFeedback,
    toggleFullscreen,
    enterFullscreen,
    exitFullscreen,
    toggleTheaterMode,
    enterTheaterMode,
    exitTheaterMode,
    toggleTheater,
    togglePictureInPicture,
    enterPictureInPicture,
    exitPictureInPicture,
    togglePiP,
    enableSubtitleTrack,
    disableSubtitles,
    toggleSubtitles,
    syncSubtitleTracks,
    syncQualityInfo,
    retry,
    manualRetry,
    cancelRecovery,
    setControlsVisible,
    showControls,
    hideControls,
    resetControlsTimer,
    setIsUserInteracting,
    setIsMenuOpen,
    setIsDragging,
    setIsFocusWithinControls,
    setVideoId,
    saveWatchProgress,
    restoreWatchPosition,
    startOver,
    dismissResumePrompt,
    markVideoCompleted,
    playNextVideo,
    cancelAutoplayCountdown,
    setPlaylist,
    setQueue,
    setAutoplayNext,
    openShortcutHelp,
    closeShortcutHelp,
    toggleShortcutHelp,
  }

  return (
    <VideoPlayerContext.Provider
      value={{
        state: {
          ...state,
          recoveryState,
          classifiedError: recoveryState.lastError || state.classifiedError,
        },
        actions,
        videoRef,
        containerRef,
        registerVideo,
      }}
    >
      {children}
    </VideoPlayerContext.Provider>
  )
}

export function useVideoPlayer(): VideoPlayerContextValue {
  const context = useContext(VideoPlayerContext)
  if (!context) {
    throw new Error("useVideoPlayer must be used within a VideoPlayerProvider")
  }
  return context
}
