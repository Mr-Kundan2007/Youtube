import { useVideoPlayer } from "./VideoPlayerContext"
import type { NextVideoItem } from "./nextVideoUtils"

export interface UseNextVideoReturn {
  nextVideo: NextVideoItem | null
  resolvedNextVideo: NextVideoItem | null
  playlist: NextVideoItem[]
  queue: NextVideoItem[]
  isNextVideoCountdownActive: boolean
  countdownRemaining: number
  isAutoplayCancelled: boolean
  autoplayNext: boolean
  autoplayCountdown: number
  playNext: (targetNextVideo?: NextVideoItem) => void
  cancelCountdown: () => void
  setAutoplayNext: (enabled: boolean) => void
  setPlaylist: (playlist: NextVideoItem[]) => void
  setQueue: (queue: NextVideoItem[]) => void
}

/**
 * Custom hook providing access to Next-Video state, countdown and actions.
 */
export function useNextVideo(): UseNextVideoReturn {
  const { state, actions } = useVideoPlayer()

  return {
    nextVideo: state.nextVideo,
    resolvedNextVideo: state.resolvedNextVideo,
    playlist: state.playlist,
    queue: state.queue,
    isNextVideoCountdownActive: state.isNextVideoCountdownActive,
    countdownRemaining: state.countdownRemaining,
    isAutoplayCancelled: state.isAutoplayCancelled,
    autoplayNext: state.autoplayNext,
    autoplayCountdown: state.autoplayCountdown,
    playNext: actions.playNextVideo,
    cancelCountdown: actions.cancelAutoplayCountdown,
    setAutoplayNext: actions.setAutoplayNext,
    setPlaylist: actions.setPlaylist,
    setQueue: actions.setQueue,
  }
}
