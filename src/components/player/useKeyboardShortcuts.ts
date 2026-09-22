import { useEffect, useRef } from "react"
import {
  type KeyboardShortcutConfig,
  DEFAULT_KEYBOARD_SHORTCUT_CONFIG,
  matchShortcutAction,
  doesActionAllowRepeat,
} from "./keyboardShortcuts"
import { videoPlayerManager } from "./videoPlayerManager"
import type { VideoPlayerActions, VideoPlayerState } from "./VideoPlayerContext"

export interface UseKeyboardShortcutsOptions {
  config?: KeyboardShortcutConfig
  playerId: string
  state: VideoPlayerState
  actions: VideoPlayerActions
  containerRef: React.RefObject<HTMLDivElement | null>
}

/**
 * Custom hook providing scoped keyboard shortcuts for the active player.
 */
export function useKeyboardShortcuts({
  config,
  playerId,
  state,
  actions,
  containerRef,
}: UseKeyboardShortcutsOptions): void {
  const mergedConfig = {
    ...DEFAULT_KEYBOARD_SHORTCUT_CONFIG,
    ...(config || {}),
  }

  // Keep references to prevent stale closures in global event listener
  const actionsRef = useRef(actions)
  actionsRef.current = actions

  const stateRef = useRef(state)
  stateRef.current = state

  const configRef = useRef(mergedConfig)
  configRef.current = mergedConfig

  useEffect(() => {
    if (configRef.current.enabled === false) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. If shortcut help overlay is open, handle Escape or allow close
      if (stateRef.current.isShortcutHelpOpen) {
        if (e.key === "Escape" || e.key === "?" || (e.shiftKey && e.key === "/")) {
          e.preventDefault()
          actionsRef.current.closeShortcutHelp()
        }
        return
      }

      // 2. Scoped Active Player Check
      const activeId = videoPlayerManager.getActivePlayer()
      const isFocused =
        containerRef.current &&
        (containerRef.current === document.activeElement ||
          containerRef.current.contains(document.activeElement))

      // If another player is actively playing and this player is neither active nor focused, ignore
      if (activeId && activeId !== playerId && !isFocused) {
        return
      }

      // 3. Match action against keystroke
      const action = matchShortcutAction(e)
      if (!action) return

      // 4. Repeat key handling
      if (e.repeat && !doesActionAllowRepeat(action)) {
        return
      }

      // 5. Prevent default browser behavior (such as scrolling on Space or Arrow keys)
      e.preventDefault()

      // 6. Ensure this player is registered as active when interacted with
      videoPlayerManager.setActivePlayer(playerId)

      const act = actionsRef.current
      const cfg = configRef.current

      // 7. Dispatch action
      switch (action) {
        case "togglePlay":
          act.togglePlay()
          break

        case "seekBackward":
          act.skipBackward(cfg.seekSeconds)
          break

        case "seekForward":
          act.skipForward(cfg.seekSeconds)
          break

        case "largeSeekBackward":
          act.skipBackward(cfg.largeSeekSeconds)
          break

        case "largeSeekForward":
          act.skipForward(cfg.largeSeekSeconds)
          break

        case "volumeUp":
          act.increaseVolume(cfg.volumeStep)
          break

        case "volumeDown":
          act.decreaseVolume(cfg.volumeStep)
          break

        case "toggleMute":
          act.toggleMute()
          break

        case "speedUp":
          act.stepPlaybackRate("up")
          break

        case "speedDown":
          act.stepPlaybackRate("down")
          break

        case "speedReset":
          act.resetPlaybackRate()
          break

        case "toggleFullscreen":
          act.toggleFullscreen().catch(() => {})
          break

        case "toggleTheater":
          act.toggleTheaterMode()
          break

        case "togglePiP":
          act.togglePictureInPicture().catch(() => {})
          break

        case "toggleSubtitles":
          act.toggleSubtitles()
          break

        case "nextVideo":
          act.playNextVideo()
          break

        case "toggleHelp":
          act.toggleShortcutHelp()
          break
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [playerId, containerRef])
}
