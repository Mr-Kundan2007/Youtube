/**
 * Keyboard Shortcuts Utilities & Configuration for Phase 10
 * Handles key normalization, input element protection, and modifier validation.
 */

export interface KeyboardShortcutConfig {
  enabled?: boolean
  seekSeconds?: number
  largeSeekSeconds?: number
  volumeStep?: number
}

export const DEFAULT_KEYBOARD_SHORTCUT_CONFIG: Required<KeyboardShortcutConfig> = {
  enabled: true,
  seekSeconds: 10,
  largeSeekSeconds: 30,
  volumeStep: 0.05,
}

export type ShortcutAction =
  | "togglePlay"
  | "seekBackward"
  | "seekForward"
  | "largeSeekBackward"
  | "largeSeekForward"
  | "volumeUp"
  | "volumeDown"
  | "toggleMute"
  | "speedUp"
  | "speedDown"
  | "speedReset"
  | "toggleFullscreen"
  | "toggleTheater"
  | "togglePiP"
  | "toggleSubtitles"
  | "nextVideo"
  | "toggleHelp"

export interface ShortcutDefinition {
  key: string
  action: ShortcutAction
  description: string
  category: "playback" | "seeking" | "volume" | "display" | "general"
  displayKey: string
  allowsRepeat?: boolean
}

export const KEYBOARD_SHORTCUTS_LIST: ShortcutDefinition[] = [
  {
    key: " ",
    action: "togglePlay",
    description: "Play / Pause toggle",
    category: "playback",
    displayKey: "Space",
    allowsRepeat: false,
  },
  {
    key: "k",
    action: "togglePlay",
    description: "Play / Pause toggle",
    category: "playback",
    displayKey: "K",
    allowsRepeat: false,
  },
  {
    key: "ArrowLeft",
    action: "seekBackward",
    description: "Seek backward 10 seconds",
    category: "seeking",
    displayKey: "←",
    allowsRepeat: true,
  },
  {
    key: "ArrowRight",
    action: "seekForward",
    description: "Seek forward 10 seconds",
    category: "seeking",
    displayKey: "→",
    allowsRepeat: true,
  },
  {
    key: "Shift+ArrowLeft",
    action: "largeSeekBackward",
    description: "Seek backward 30 seconds",
    category: "seeking",
    displayKey: "Shift + ←",
    allowsRepeat: true,
  },
  {
    key: "Shift+ArrowRight",
    action: "largeSeekForward",
    description: "Seek forward 30 seconds",
    category: "seeking",
    displayKey: "Shift + →",
    allowsRepeat: true,
  },
  {
    key: "j",
    action: "largeSeekBackward",
    description: "Seek backward 10 seconds",
    category: "seeking",
    displayKey: "J",
    allowsRepeat: true,
  },
  {
    key: "l",
    action: "largeSeekForward",
    description: "Seek forward 10 seconds",
    category: "seeking",
    displayKey: "L",
    allowsRepeat: true,
  },
  {
    key: "ArrowUp",
    action: "volumeUp",
    description: "Increase volume 5%",
    category: "volume",
    displayKey: "↑",
    allowsRepeat: true,
  },
  {
    key: "ArrowDown",
    action: "volumeDown",
    description: "Decrease volume 5%",
    category: "volume",
    displayKey: "↓",
    allowsRepeat: true,
  },
  {
    key: "m",
    action: "toggleMute",
    description: "Mute / Unmute toggle",
    category: "volume",
    displayKey: "M",
    allowsRepeat: false,
  },
  {
    key: ">",
    action: "speedUp",
    description: "Increase playback speed",
    category: "playback",
    displayKey: ">",
    allowsRepeat: false,
  },
  {
    key: "<",
    action: "speedDown",
    description: "Decrease playback speed",
    category: "playback",
    displayKey: "<",
    allowsRepeat: false,
  },
  {
    key: "0",
    action: "speedReset",
    description: "Reset playback speed to 1×",
    category: "playback",
    displayKey: "0",
    allowsRepeat: false,
  },
  {
    key: "f",
    action: "toggleFullscreen",
    description: "Toggle Fullscreen",
    category: "display",
    displayKey: "F",
    allowsRepeat: false,
  },
  {
    key: "t",
    action: "toggleTheater",
    description: "Toggle Theater mode",
    category: "display",
    displayKey: "T",
    allowsRepeat: false,
  },
  {
    key: "p",
    action: "togglePiP",
    description: "Toggle Picture-in-Picture",
    category: "display",
    displayKey: "P",
    allowsRepeat: false,
  },
  {
    key: "c",
    action: "toggleSubtitles",
    description: "Toggle Subtitles / Captions",
    category: "display",
    displayKey: "C",
    allowsRepeat: false,
  },
  {
    key: "n",
    action: "nextVideo",
    description: "Play Next Video",
    category: "general",
    displayKey: "N",
    allowsRepeat: false,
  },
  {
    key: "?",
    action: "toggleHelp",
    description: "Open Keyboard Shortcuts Help",
    category: "general",
    displayKey: "?",
    allowsRepeat: false,
  },
]

/**
 * Validates whether the event target is an interactive or typing input element.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false

  const tagName = target.tagName.toUpperCase()
  if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") {
    return true
  }
  if (target.isContentEditable) {
    return true
  }
  if (target.getAttribute("role") === "textbox") {
    return true
  }
  return false
}

/**
 * Checks whether an event uses system/browser modifier keys (Ctrl, Meta, Alt).
 */
export function hasSystemModifiers(e: KeyboardEvent): boolean {
  return e.ctrlKey || e.metaKey || e.altKey
}

/**
 * Maps a KeyboardEvent to a matching ShortcutAction if one exists.
 */
export function matchShortcutAction(e: KeyboardEvent): ShortcutAction | null {
  // Disregard if typing in an input or using system modifier keys
  if (isTypingTarget(e.target) || hasSystemModifiers(e)) {
    return null
  }

  const key = e.key
  const isShift = e.shiftKey

  // Check Shift modifier combinations first (Priority checking)
  if (isShift && key === "ArrowLeft") return "largeSeekBackward"
  if (isShift && key === "ArrowRight") return "largeSeekForward"
  if (key === ">" || (isShift && key === ".")) return "speedUp"
  if (key === "<" || (isShift && key === ",")) return "speedDown"
  if (key === "?" || (isShift && key === "/")) return "toggleHelp"

  // Check single key mappings
  switch (key) {
    case " ":
    case "Spacebar":
    case "k":
    case "K":
      return "togglePlay"

    case "ArrowLeft":
      return "seekBackward"

    case "ArrowRight":
      return "seekForward"

    case "j":
    case "J":
      return "largeSeekBackward"

    case "l":
    case "L":
      return "largeSeekForward"

    case "ArrowUp":
      return "volumeUp"

    case "ArrowDown":
      return "volumeDown"

    case "m":
    case "M":
      return "toggleMute"

    case "0":
      return "speedReset"

    case "f":
    case "F":
      return "toggleFullscreen"

    case "t":
    case "T":
      return "toggleTheater"

    case "p":
    case "P":
      return "togglePiP"

    case "c":
    case "C":
      return "toggleSubtitles"

    case "n":
    case "N":
      return "nextVideo"

    default:
      return null
  }
}

/**
 * Determines whether a shortcut action allows repeated execution when key is held down.
 */
export function doesActionAllowRepeat(action: ShortcutAction): boolean {
  return (
    action === "seekBackward" ||
    action === "seekForward" ||
    action === "largeSeekBackward" ||
    action === "largeSeekForward" ||
    action === "volumeUp" ||
    action === "volumeDown"
  )
}
