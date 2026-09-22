import { useVideoPlayer } from "./VideoPlayerContext"
import type { SubtitleTrack } from "./subtitleUtils"

export interface UseSubtitlesReturn {
  availableSubtitleTracks: SubtitleTrack[]
  activeSubtitleTrack: SubtitleTrack | null
  areSubtitlesEnabled: boolean
  enableSubtitleTrack: (trackIdOrIndex: string | number) => void
  disableSubtitles: () => void
  toggleSubtitles: () => void
  syncSubtitleTracks: () => void
}

/**
 * useSubtitles
 * Modular custom hook exposing subtitle tracks, active selection, and action controls.
 */
export function useSubtitles(): UseSubtitlesReturn {
  const { state, actions } = useVideoPlayer()

  return {
    availableSubtitleTracks: state.availableSubtitleTracks,
    activeSubtitleTrack: state.activeSubtitleTrack,
    areSubtitlesEnabled: state.areSubtitlesEnabled,
    enableSubtitleTrack: actions.enableSubtitleTrack,
    disableSubtitles: actions.disableSubtitles,
    toggleSubtitles: actions.toggleSubtitles,
    syncSubtitleTracks: actions.syncSubtitleTracks,
  }
}

export default useSubtitles
