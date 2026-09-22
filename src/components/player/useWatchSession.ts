import { useRef, useEffect, useCallback } from "react"
import type { VideoAnalyticsEvent } from "./analyticsTypes"
import {
  generateSessionId,
  WatchedTimeTracker,
  isSessionAbandoned,
} from "./sessionUtils"
import { calculateWatchPercentage } from "./watchProgressUtils"
import { videoAnalyticsService } from "./videoAnalyticsService"

export interface UseWatchSessionOptions {
  videoId: string | null
  playerId: string
  currentTime: number
  duration: number
  isPlaying: boolean
  isCompleted: boolean
  playbackRate: number
  analyticsEnabled?: boolean
  onSessionStart?: (sessionId: string) => void
  onSessionEnd?: (sessionId: string, metrics: Record<string, unknown>) => void
}

/**
 * Custom hook orchestrating the lifecycle, metrics accumulation, and analytics events
 * for a continuous video watch session.
 */
export function useWatchSession({
  videoId,
  playerId,
  currentTime,
  duration,
  isPlaying,
  isCompleted,
  playbackRate,
  analyticsEnabled = true,
  onSessionStart,
  onSessionEnd,
}: UseWatchSessionOptions) {
  const sessionIdRef = useRef<string>(generateSessionId())
  const sessionStartTimeRef = useRef<number | null>(null)
  const initialPositionRef = useRef<number>(0)
  const hasStartedRef = useRef(false)
  const hasEndedRef = useRef(false)

  const watchedTrackerRef = useRef(new WatchedTimeTracker())
  const pauseCountRef = useRef(0)
  const seekCountRef = useRef(0)
  const bufferCountRef = useRef(0)
  const totalBufferDurationRef = useRef(0)
  const bufferStartTimestampRef = useRef<number | null>(null)

  // Keep references updated
  const stateRef = useRef({
    videoId,
    playerId,
    currentTime,
    duration,
    isPlaying,
    isCompleted,
    playbackRate,
  })
  stateRef.current = {
    videoId,
    playerId,
    currentTime,
    duration,
    isPlaying,
    isCompleted,
    playbackRate,
  }

  // Handle Playback rate changes in tracker
  useEffect(() => {
    watchedTrackerRef.current.updatePlaybackRate(playbackRate)
  }, [playbackRate])

  /**
   * Start the watch session upon first meaningful playback.
   */
  const startSession = useCallback(
    (curTime: number, dur: number) => {
      if (hasStartedRef.current || !analyticsEnabled) return
      hasStartedRef.current = true
      hasEndedRef.current = false
      sessionStartTimeRef.current = Date.now()
      initialPositionRef.current = curTime

      watchedTrackerRef.current.startPlayback(stateRef.current.playbackRate)

      videoAnalyticsService.track("WATCH_SESSION_START", {
        videoId: stateRef.current.videoId,
        playerId: stateRef.current.playerId,
        sessionId: sessionIdRef.current,
        currentTime: curTime,
        duration: dur,
        metadata: {
          sessionStartTime: sessionStartTimeRef.current,
          initialPosition: curTime,
        },
      })

      onSessionStart?.(sessionIdRef.current)
    },
    [analyticsEnabled, onSessionStart]
  )

  /**
   * Record playback resumed
   */
  const recordPlay = useCallback(
    (rate = 1) => {
      if (!hasStartedRef.current) {
        startSession(stateRef.current.currentTime, stateRef.current.duration)
      } else {
        watchedTrackerRef.current.startPlayback(rate)
      }
    },
    [startSession]
  )

  /**
   * Record playback paused
   */
  const recordPause = useCallback(() => {
    watchedTrackerRef.current.stopPlayback()
    if (hasStartedRef.current) {
      pauseCountRef.current++
    }
  }, [])

  /**
   * Record seek action completed
   */
  const recordSeek = useCallback(() => {
    if (hasStartedRef.current) {
      seekCountRef.current++
    }
  }, [])

  /**
   * Record buffering start
   */
  const recordBufferStart = useCallback(() => {
    watchedTrackerRef.current.stopPlayback()
    if (bufferStartTimestampRef.current === null) {
      bufferStartTimestampRef.current = Date.now()
    }
  }, [])

  /**
   * Record buffering end
   */
  const recordBufferEnd = useCallback(() => {
    if (bufferStartTimestampRef.current !== null) {
      const bufDuration = (Date.now() - bufferStartTimestampRef.current) / 1000
      bufferCountRef.current++
      totalBufferDurationRef.current += bufDuration
      bufferStartTimestampRef.current = null
    }
    if (stateRef.current.isPlaying) {
      watchedTrackerRef.current.startPlayback(stateRef.current.playbackRate)
    }
  }, [])

  /**
   * End the current watch session and emit WATCH_SESSION_END & VIDEO_ABANDONED if applicable.
   */
  const endSession = useCallback(
    (finalTime?: number, totalDur?: number, completedOverride?: boolean): VideoAnalyticsEvent | null => {
      if (!hasStartedRef.current || hasEndedRef.current || !analyticsEnabled) {
        return null
      }
      hasEndedRef.current = true
      watchedTrackerRef.current.stopPlayback()

      const now = Date.now()
      const sessionDuration = sessionStartTimeRef.current
        ? (now - sessionStartTimeRef.current) / 1000
        : 0

      const pos = finalTime !== undefined ? finalTime : stateRef.current.currentTime
      const dur = totalDur !== undefined ? totalDur : stateRef.current.duration
      const completed =
        completedOverride !== undefined
          ? completedOverride
          : stateRef.current.isCompleted
      const watchedDuration = watchedTrackerRef.current.getWatchedDuration()
      const watchPercentage = calculateWatchPercentage(pos, dur)
      const isAbandoned = isSessionAbandoned(
        completed,
        watchedDuration,
        watchPercentage
      )

      const sessionMetrics = {
        sessionId: sessionIdRef.current,
        sessionDuration: Math.round(sessionDuration * 10) / 10,
        actualWatchedDuration: watchedDuration,
        initialPosition: initialPositionRef.current,
        finalPosition: pos,
        watchPercentage,
        pauseCount: pauseCountRef.current,
        seekCount: seekCountRef.current,
        bufferCount: bufferCountRef.current,
        totalBufferDuration: Math.round(totalBufferDurationRef.current * 10) / 10,
        isCompleted: completed,
        isAbandoned,
      }

      // Track WATCH_SESSION_END
      const endEvent = videoAnalyticsService.track("WATCH_SESSION_END", {
        videoId: stateRef.current.videoId,
        playerId: stateRef.current.playerId,
        sessionId: sessionIdRef.current,
        currentTime: pos,
        duration: dur,
        metadata: sessionMetrics,
      })

      // Track VIDEO_ABANDONED if user left before completion after meaningful viewing
      if (isAbandoned) {
        videoAnalyticsService.track("VIDEO_ABANDONED", {
          videoId: stateRef.current.videoId,
          playerId: stateRef.current.playerId,
          sessionId: sessionIdRef.current,
          currentTime: pos,
          duration: dur,
          metadata: {
            watchPercentage,
            actualWatchedDuration: watchedDuration,
            finalPosition: pos,
          },
        })
      }

      onSessionEnd?.(sessionIdRef.current, sessionMetrics)
      return endEvent
    },
    [analyticsEnabled, onSessionEnd]
  )

  /**
   * Reset session state for a new video or videoId change
   */
  const resetSession = useCallback(() => {
    endSession()
    sessionIdRef.current = generateSessionId()
    sessionStartTimeRef.current = null
    initialPositionRef.current = 0
    hasStartedRef.current = false
    hasEndedRef.current = false
    watchedTrackerRef.current.reset()
    pauseCountRef.current = 0
    seekCountRef.current = 0
    bufferCountRef.current = 0
    totalBufferDurationRef.current = 0
    bufferStartTimestampRef.current = null
  }, [endSession])

  // End session cleanly on unmount
  useEffect(() => {
    return () => {
      endSession()
    }
  }, [endSession])

  return {
    sessionId: sessionIdRef.current,
    startSession,
    recordPlay,
    recordPause,
    recordSeek,
    recordBufferStart,
    recordBufferEnd,
    endSession,
    resetSession,
    getWatchedDuration: () => watchedTrackerRef.current.getWatchedDuration(),
  }
}
