import { useMemo } from "react"
import { useVideoPlayer } from "./VideoPlayerContext"

export interface UsePlayerControlsVisibilityReturn {
  areControlsVisible: boolean
  isControlsVisible: boolean
  isUserInteracting: boolean
  isMenuOpen: boolean
  isDragging: boolean
  isFocusWithinControls: boolean
  showControls: () => void
  hideControls: () => void
  resetTimer: () => void
}

/**
 * Custom hook providing controls visibility state and interaction actions.
 */
export function usePlayerControlsVisibility(): UsePlayerControlsVisibilityReturn {
  const { state, actions } = useVideoPlayer()

  return useMemo(
    () => ({
      areControlsVisible: state.isControlsVisible,
      isControlsVisible: state.isControlsVisible,
      isUserInteracting: state.isUserInteracting,
      isMenuOpen: state.isMenuOpen,
      isDragging: state.isDragging,
      isFocusWithinControls: state.isFocusWithinControls,
      showControls: actions.showControls,
      hideControls: actions.hideControls,
      resetTimer: actions.resetControlsTimer,
    }),
    [
      state.isControlsVisible,
      state.isUserInteracting,
      state.isMenuOpen,
      state.isDragging,
      state.isFocusWithinControls,
      actions.showControls,
      actions.hideControls,
      actions.resetControlsTimer,
    ]
  )
}

export default usePlayerControlsVisibility
