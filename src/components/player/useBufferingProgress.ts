import { useMemo } from "react"
import { useVideoPlayer } from "./VideoPlayerContext"
import type { BufferedRange } from "./videoBufferUtils"

export interface UseBufferingProgressReturn {
  bufferedRanges: BufferedRange[]
  bufferedPercent: number
  isBuffering: boolean
  isLoading: boolean
  networkState: number
  readyState: number
  readyStatus: string
}

/**
 * Custom hook providing access to buffering ranges, overall buffered percentage,
 * and media ready/loading states.
 */
export function useBufferingProgress(): UseBufferingProgressReturn {
  const { state } = useVideoPlayer()

  return useMemo(() => {
    return {
      bufferedRanges: state.bufferedRanges || [],
      bufferedPercent: state.bufferedPercent || 0,
      isBuffering: state.isBuffering || false,
      isLoading: state.isLoading || false,
      networkState: state.networkState ?? 0,
      readyState: state.readyState ?? 0,
      readyStatus: state.videoQuality.readyStatus || "Loading",
    }
  }, [
    state.bufferedRanges,
    state.bufferedPercent,
    state.isBuffering,
    state.isLoading,
    state.networkState,
    state.readyState,
    state.videoQuality.readyStatus,
  ])
}

export default useBufferingProgress
