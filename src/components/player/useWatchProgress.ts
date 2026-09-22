import { useMemo, useCallback } from "react"
import { useVideoPlayer } from "./VideoPlayerContext"
import type { WatchProgressData } from "./watchProgressUtils"

export interface UseWatchProgressReturn {
  videoId: string | null
  savedProgress: WatchProgressData | null
  isCompleted: boolean
  progressPercentage: number
  saveProgress: () => void
  restorePosition: (position?: number) => void
  startOver: () => void
  markCompleted: () => void
}

/**
 * Custom hook providing access to watch progress state and persistence actions.
 */
export function useWatchProgress(): UseWatchProgressReturn {
  const { state, actions } = useVideoPlayer()

  const saveProgress = useCallback(() => {
    actions.saveWatchProgress()
  }, [actions])

  const restorePosition = useCallback((position?: number) => {
    actions.restoreWatchPosition(position)
  }, [actions])

  const startOver = useCallback(() => {
    actions.startOver()
  }, [actions])

  const markCompleted = useCallback(() => {
    actions.markVideoCompleted()
  }, [actions])

  return useMemo(
    () => ({
      videoId: state.videoId,
      savedProgress: state.savedProgress,
      isCompleted: state.isCompleted,
      progressPercentage: state.duration > 0
        ? Math.min(100, Math.max(0, Number(((state.currentTime / state.duration) * 100).toFixed(2))))
        : 0,
      saveProgress,
      restorePosition,
      startOver,
      markCompleted,
    }),
    [
      state.videoId,
      state.savedProgress,
      state.isCompleted,
      state.duration,
      state.currentTime,
      saveProgress,
      restorePosition,
      startOver,
      markCompleted,
    ]
  )
}

export default useWatchProgress
