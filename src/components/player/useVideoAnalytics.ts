import { useEffect, useRef, useCallback } from "react"
import type {
  AnalyticsEventType,
  VideoAnalyticsConfig,
} from "./analyticsTypes"
import { videoAnalyticsService } from "./videoAnalyticsService"
import { useWatchSession } from "./useWatchSession"
import { usePageVisibility } from "./usePageVisibility"
import { getPlaybackQualityMetrics } from "./sessionUtils"

export interface UseVideoAnalyticsOptions {
  videoId: string | null
  playerId: string
  currentTime: number
  duration: number
  isPlaying: boolean
  isPaused: boolean
  isBuffering: boolean
  isSeeking: boolean
  isCompleted: boolean
  isEnded: boolean
  playbackRate: number
  volume: number
  isMuted: boolean
  isFullscreen: boolean
  isPiP: boolean
  areSubtitlesEnabled: boolean
  activeSubtitleTrackLang?: string
  analyticsEnabled?: boolean
  analyticsConfig?: VideoAnalyticsConfig
  debug?: boolean
  mediaElement?: HTMLVideoElement | null
}

/**
 * Master analytics coordinator hook for HTML5 VideoPlayer.
 */
export function useVideoAnalytics({
  videoId,
  playerId,
  currentTime,
  duration,
  isPlaying,
  isPaused,
  isBuffering,
  isSeeking,
  isCompleted,
  isEnded,
  playbackRate,
  volume,
  isMuted,
  isFullscreen,
  isPiP,
  areSubtitlesEnabled,
  activeSubtitleTrackLang,
  analyticsEnabled = true,
  analyticsConfig,
  debug,
  mediaElement,
}: UseVideoAnalyticsOptions) {
  // Sync configuration to singleton service
  useEffect(() => {
    videoAnalyticsService.setEnabled(analyticsEnabled)
    if (analyticsConfig || debug !== undefined) {
      videoAnalyticsService.updateConfig({
        ...analyticsConfig,
        debug: debug !== undefined ? debug : analyticsConfig?.debug,
      })
    }
  }, [analyticsEnabled, analyticsConfig, debug])

  // Watch session hook
  const watchSession = useWatchSession({
    videoId,
    playerId,
    currentTime,
    duration,
    isPlaying,
    isCompleted,
    playbackRate,
    analyticsEnabled,
  })

  // Startup metrics
  const playerInitTimeRef = useRef<number>(performance.now())
  const hasLoggedReadyRef = useRef<boolean>(false)
  const hasLoggedFirstFrameRef = useRef<boolean>(false)
  const hasLoggedCompletionRef = useRef<boolean>(false)

  // Track previous states to avoid duplicate event dispatch
  const prevPlayingRef = useRef(isPlaying)
  const prevSeekingRef = useRef(isSeeking)
  const prevBufferingRef = useRef(isBuffering)
  const prevRateRef = useRef(playbackRate)
  const prevMutedRef = useRef(isMuted)
  const prevVolumeRef = useRef(volume)
  const prevFullscreenRef = useRef(isFullscreen)
  const prevPiPRef = useRef(isPiP)
  const prevSubtitlesRef = useRef(areSubtitlesEnabled)
  const seekStartTimeRef = useRef<number | null>(null)
  const currentVideoIdRef = useRef(videoId)

  /**
   * Helper to dispatch track event via service
   */
  const track = useCallback(
    (eventType: AnalyticsEventType, metadata?: Record<string, unknown>) => {
      if (!analyticsEnabled) return null
      return videoAnalyticsService.track(eventType, {
        videoId,
        playerId,
        sessionId: watchSession.sessionId,
        currentTime,
        duration,
        metadata,
      })
    },
    [analyticsEnabled, videoId, playerId, watchSession.sessionId, currentTime, duration]
  )

  // Video ID switch -> reset session & track VIDEO_LOAD
  useEffect(() => {
    if (currentVideoIdRef.current !== videoId) {
      watchSession.resetSession()
      currentVideoIdRef.current = videoId
      hasLoggedReadyRef.current = false
      hasLoggedFirstFrameRef.current = false
      hasLoggedCompletionRef.current = false
      playerInitTimeRef.current = performance.now()

      track("VIDEO_SOURCE_CHANGED", { nextVideoId: videoId })
      track("VIDEO_LOAD", { videoId })
    }
  }, [videoId, watchSession, track])

  // Initial mount VIDEO_LOAD
  useEffect(() => {
    track("VIDEO_LOAD", { videoId })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Ready State Tracking (Metadata loaded)
  useEffect(() => {
    if (duration > 0 && !hasLoggedReadyRef.current) {
      hasLoggedReadyRef.current = true
      const timeToMetadata = Math.round(performance.now() - playerInitTimeRef.current)
      track("VIDEO_READY", {
        duration,
        timeToMetadataMs: timeToMetadata,
        quality: getPlaybackQualityMetrics(mediaElement || null),
      })
    }
  }, [duration, mediaElement, track])

  // Play / Pause Tracking
  useEffect(() => {
    if (isPlaying && !prevPlayingRef.current) {
      // First frame render metric
      if (!hasLoggedFirstFrameRef.current) {
        hasLoggedFirstFrameRef.current = true
        const timeToFirstFrame = Math.round(performance.now() - playerInitTimeRef.current)
        track("VIDEO_PLAY", {
          playbackRate,
          volume,
          isMuted,
          startupDurationMs: timeToFirstFrame,
          isFirstPlay: true,
        })
      } else {
        track("VIDEO_PLAY", {
          playbackRate,
          volume,
          isMuted,
          isFirstPlay: false,
        })
      }
      watchSession.recordPlay(playbackRate)
    } else if (isPaused && prevPlayingRef.current) {
      track("VIDEO_PAUSE", {
        watchedDuration: watchSession.getWatchedDuration(),
      })
      watchSession.recordPause()
    }
    prevPlayingRef.current = isPlaying
  }, [isPlaying, isPaused, playbackRate, volume, isMuted, watchSession, track])

  // Seek Tracking (Throttled: records only upon seek completion)
  useEffect(() => {
    if (isSeeking && !prevSeekingRef.current) {
      // Seek started
      seekStartTimeRef.current = currentTime
    } else if (!isSeeking && prevSeekingRef.current) {
      // Seek completed
      const fromTime = seekStartTimeRef.current !== null ? seekStartTimeRef.current : currentTime
      const toTime = currentTime
      const distance = Math.round(Math.abs(toTime - fromTime) * 100) / 100

      if (distance > 0.1) {
        track("VIDEO_SEEK", {
          fromTime,
          toTime,
          direction: toTime >= fromTime ? "forward" : "backward",
          distance,
        })
        watchSession.recordSeek()
      }
      seekStartTimeRef.current = null
    }
    prevSeekingRef.current = isSeeking
  }, [isSeeking, currentTime, watchSession, track])

  // Buffering Tracking
  useEffect(() => {
    if (isBuffering && !prevBufferingRef.current) {
      track("VIDEO_BUFFER_START")
      watchSession.recordBufferStart()
    } else if (!isBuffering && prevBufferingRef.current) {
      track("VIDEO_BUFFER_END")
      watchSession.recordBufferEnd()
    }
    prevBufferingRef.current = isBuffering
  }, [isBuffering, watchSession, track])

  // Completion Tracking (Deduplicated)
  useEffect(() => {
    if (isCompleted && !hasLoggedCompletionRef.current) {
      hasLoggedCompletionRef.current = true
      track("VIDEO_COMPLETED", {
        watchedDuration: watchSession.getWatchedDuration(),
        finalPosition: currentTime,
        duration,
      })
    }
  }, [isCompleted, currentTime, duration, watchSession, track])

  // Ended Event Tracking
  useEffect(() => {
    if (isEnded) {
      track("VIDEO_ENDED", {
        finalPosition: currentTime,
        duration,
      })
      watchSession.endSession(currentTime, duration, true)
    }
  }, [isEnded, currentTime, duration, watchSession, track])

  // Playback Rate Changed
  useEffect(() => {
    if (playbackRate !== prevRateRef.current) {
      track("VIDEO_SPEED_CHANGED", {
        previousRate: prevRateRef.current,
        newRate: playbackRate,
      })
      prevRateRef.current = playbackRate
    }
  }, [playbackRate, track])

  // Volume & Mute Changed
  useEffect(() => {
    if (isMuted !== prevMutedRef.current) {
      track(isMuted ? "VIDEO_MUTED" : "VIDEO_UNMUTED", { volume })
      prevMutedRef.current = isMuted
    } else if (volume !== prevVolumeRef.current) {
      track("VIDEO_VOLUME_CHANGED", {
        previousVolume: prevVolumeRef.current,
        newVolume: volume,
      })
      prevVolumeRef.current = volume
    }
  }, [isMuted, volume, track])

  // Fullscreen Changed
  useEffect(() => {
    if (isFullscreen !== prevFullscreenRef.current) {
      track(isFullscreen ? "VIDEO_FULLSCREEN_ENTER" : "VIDEO_FULLSCREEN_EXIT")
      prevFullscreenRef.current = isFullscreen
    }
  }, [isFullscreen, track])

  // PiP Changed
  useEffect(() => {
    if (isPiP !== prevPiPRef.current) {
      track(isPiP ? "VIDEO_PIP_ENTER" : "VIDEO_PIP_EXIT")
      prevPiPRef.current = isPiP
    }
  }, [isPiP, track])

  // Subtitles Changed
  useEffect(() => {
    if (areSubtitlesEnabled !== prevSubtitlesRef.current) {
      track(areSubtitlesEnabled ? "VIDEO_SUBTITLE_ENABLED" : "VIDEO_SUBTITLE_DISABLED", {
        language: activeSubtitleTrackLang,
      })
      prevSubtitlesRef.current = areSubtitlesEnabled
    }
  }, [areSubtitlesEnabled, activeSubtitleTrackLang, track])

  // Page Visibility & Unload Tracking
  usePageVisibility({
    onHidden: () => {
      track("PAGE_HIDDEN")
      videoAnalyticsService.flush().catch(() => {})
    },
    onVisible: () => {
      track("PAGE_VISIBLE")
    },
    onPageHide: () => {
      watchSession.endSession(currentTime, duration, isCompleted)
      videoAnalyticsService.flushBeacon()
    },
  })

  return {
    trackEvent: track,
    sessionId: watchSession.sessionId,
    getWatchedDuration: watchSession.getWatchedDuration,
    endSession: watchSession.endSession,
    flush: () => videoAnalyticsService.flush(),
  }
}
