import { useVideoPlayer } from "./VideoPlayerContext"

export interface PlayerDisplayModes {
  isFullscreen: boolean
  isTheaterMode: boolean
  isTheater: boolean
  isPictureInPicture: boolean
  isPiP: boolean
  fullscreenSupported: boolean
  pictureInPictureSupported: boolean
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
}

/**
 * usePlayerDisplayModes
 * Modular hook providing state and action handlers for player viewing modes:
 * Fullscreen, Theater Mode, and Picture-in-Picture.
 */
export function usePlayerDisplayModes(): PlayerDisplayModes {
  const { state, actions } = useVideoPlayer()

  return {
    isFullscreen: state.isFullscreen,
    isTheaterMode: state.isTheaterMode,
    isTheater: state.isTheater,
    isPictureInPicture: state.isPictureInPicture,
    isPiP: state.isPiP,
    fullscreenSupported: state.fullscreenSupported,
    pictureInPictureSupported: state.pictureInPictureSupported,
    toggleFullscreen: actions.toggleFullscreen,
    enterFullscreen: actions.enterFullscreen,
    exitFullscreen: actions.exitFullscreen,
    toggleTheaterMode: actions.toggleTheaterMode,
    enterTheaterMode: actions.enterTheaterMode,
    exitTheaterMode: actions.exitTheaterMode,
    toggleTheater: actions.toggleTheater,
    togglePictureInPicture: actions.togglePictureInPicture,
    enterPictureInPicture: actions.enterPictureInPicture,
    exitPictureInPicture: actions.exitPictureInPicture,
    togglePiP: actions.togglePiP,
  }
}

export default usePlayerDisplayModes
