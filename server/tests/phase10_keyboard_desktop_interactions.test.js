import { TestRunner } from "./helpers/testEnv.js"

// Mirror Phase 10 utilities from keyboardShortcuts.ts
const TYPING_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"])

function isTypingTarget(target) {
  if (!target || typeof target !== "object") return false
  if (target.tagName && TYPING_TAGS.has(target.tagName.toUpperCase())) return true
  if (target.isContentEditable === true) return true
  if (target.getAttribute && target.getAttribute("role") === "textbox") return true
  if (target.getAttribute && target.getAttribute("contenteditable") === "true") return true
  return false
}

function hasSystemModifiers(e) {
  return Boolean(e.ctrlKey || e.metaKey || e.altKey)
}

function matchShortcutAction(e) {
  if (isTypingTarget(e.target)) return null
  if (hasSystemModifiers(e)) return null

  const key = e.key
  const shift = Boolean(e.shiftKey)

  // 1. Play / Pause toggle
  if (key === " " || key === "Spacebar" || key === "k" || key === "K") {
    return "togglePlay"
  }

  // 2. Seeking: Shift + Arrow keys (Large Seek: 10s default)
  if (shift && key === "ArrowLeft") return "largeSeekBackward"
  if (shift && key === "ArrowRight") return "largeSeekForward"

  // 3. Seeking: Arrow keys (Standard Seek: 5s default)
  if (!shift && key === "ArrowLeft") return "seekBackward"
  if (!shift && key === "ArrowRight") return "seekForward"

  // 4. Seeking: J / L (10s seek)
  if (key === "j" || key === "J") return "largeSeekBackward"
  if (key === "l" || key === "L") return "largeSeekForward"

  // 5. Volume controls
  if (key === "ArrowUp") return "volumeUp"
  if (key === "ArrowDown") return "volumeDown"
  if (key === "m" || key === "M") return "toggleMute"

  // 6. Playback speed stepping & reset
  if (key === "<" || (shift && key === ",")) return "speedDown"
  if (key === ">" || (shift && key === ".")) return "speedUp"
  if (key === "0" || key === "Home") return "speedReset"

  // 7. Fullscreen, Theater, PiP
  if (key === "f" || key === "F") return "toggleFullscreen"
  if (key === "t" || key === "T") return "toggleTheater"
  if (key === "p" || key === "P") return "togglePiP"

  // 8. Subtitles / Captions
  if (key === "c" || key === "C") return "toggleSubtitles"

  // 9. Next Video
  if (shift && (key === "N" || key === "n")) return "nextVideo"
  if (!shift && (key === "n" || key === "N")) return "nextVideo"

  // 10. Help Overlay
  if (key === "?" || (shift && key === "/")) return "toggleHelp"

  return null
}

function doesActionAllowRepeat(action) {
  switch (action) {
    case "seekBackward":
    case "seekForward":
    case "largeSeekBackward":
    case "largeSeekForward":
    case "volumeUp":
    case "volumeDown":
      return true
    default:
      return false
  }
}

// Mirror Phase 10 utilities from timelinePreviewUtils.ts
function calculatePointerPercentage(clientX, trackRect) {
  if (!trackRect || trackRect.width <= 0) return 0
  const offsetX = clientX - trackRect.left
  const clampedX = Math.max(0, Math.min(trackRect.width, offsetX))
  return clampedX / trackRect.width
}

function calculatePreviewTime(percentage, duration) {
  if (
    typeof duration !== "number" ||
    isNaN(duration) ||
    !isFinite(duration) ||
    duration <= 0
  ) {
    return 0
  }
  const clampedPercentage = Math.max(0, Math.min(1, percentage))
  return clampedPercentage * duration
}

function calculateClampedPreviewLeft(previewPositionX, trackWidth, previewWidth = 160, padding = 8) {
  if (trackWidth <= 0) return padding
  const halfWidth = previewWidth / 2
  const minLeft = padding + halfWidth
  const maxLeft = Math.max(minLeft, trackWidth - padding - halfWidth)
  return Math.max(minLeft, Math.min(maxLeft, previewPositionX))
}

function findClosestThumbnail(previewTime, thumbnails) {
  if (!thumbnails || !Array.isArray(thumbnails) || thumbnails.length === 0) {
    return null
  }
  let closest = thumbnails[0]
  let minDiff = Math.abs(thumbnails[0].time - previewTime)

  for (let i = 1; i < thumbnails.length; i++) {
    const diff = Math.abs(thumbnails[i].time - previewTime)
    if (diff < minDiff) {
      minDiff = diff
      closest = thumbnails[i]
    }
  }
  return closest
}

function calculateSpritePosition(previewTime, config) {
  const {
    itemWidth = 160,
    itemHeight = 90,
    interval = 5,
    columns = 10,
    totalFrames = 100,
    spriteSheetUrl,
  } = config

  const safeTime = Math.max(0, previewTime)
  const frameIndex = Math.min(
    totalFrames - 1,
    Math.floor(safeTime / Math.max(0.1, interval))
  )

  const col = frameIndex % columns
  const row = Math.floor(frameIndex / columns)

  const offsetX = -col * itemWidth
  const offsetY = -row * itemHeight

  return {
    spriteSheetUrl,
    offsetX,
    offsetY,
    itemWidth,
    itemHeight,
    backgroundSize: `${columns * itemWidth}px auto`,
    frameIndex,
  }
}

// Mirror Active Player Manager
class TestVideoPlayerManager {
  constructor() {
    this.players = new Map()
    this.activePlayerId = null
  }

  registerPlayer(playerId, reg) {
    this.players.set(playerId, reg)
    return () => this.unregisterPlayer(playerId)
  }

  unregisterPlayer(playerId) {
    this.players.delete(playerId)
    if (this.activePlayerId === playerId) {
      this.activePlayerId = null
    }
  }

  setActivePlayer(playerId) {
    this.activePlayerId = playerId
    for (const [id, reg] of this.players) {
      if (id !== playerId && reg.onPauseOther) {
        reg.onPauseOther()
      }
    }
  }

  getActivePlayer() {
    return this.activePlayerId
  }
}

// Mock Player representing Phase 10 implementation
class MockPhase10Player {
  constructor(options = {}) {
    this.playerId = options.playerId || `player_${Math.random().toString(36).slice(2, 9)}`
    this.manager = options.manager || null
    this.currentTime = options.currentTime || 0
    this.duration = options.duration || 120
    this.volume = options.volume !== undefined ? options.volume : 0.8
    this.isMuted = Boolean(options.isMuted)
    this.playbackRate = options.playbackRate || 1
    this.isPlaying = Boolean(options.isPlaying)
    this.isFullscreen = false
    this.isTheater = false
    this.isPiP = false
    this.subtitlesEnabled = false
    this.nextVideoTriggered = false
    this.isHelpOpen = false
    this.speedFeedback = null
    this.lastSeekFeedback = null

    this.seekSeconds = options.seekSeconds || 5
    this.largeSeekSeconds = options.largeSeekSeconds || 10
    this.volumeStep = options.volumeStep || 0.05

    // Click debounce state
    this.clickTimeout = null
    this.singleClicksHandled = 0
    this.doubleClicksHandled = 0

    if (this.manager) {
      this.manager.registerPlayer(this.playerId, {
        onPauseOther: () => {
          this.isPlaying = false
        },
      })
    }
  }

  // Actions
  togglePlay() {
    this.isPlaying = !this.isPlaying
  }

  skipBackward(seconds = this.seekSeconds) {
    this.lastSeekFeedback = { direction: "backward", seconds }
    this.currentTime = Math.max(0, this.currentTime - seconds)
  }

  skipForward(seconds = this.seekSeconds) {
    this.lastSeekFeedback = { direction: "forward", seconds }
    this.currentTime = Math.min(this.duration, this.currentTime + seconds)
  }

  increaseVolume(step = this.volumeStep) {
    this.volume = Math.min(1, Math.round((this.volume + step) * 100) / 100)
    if (this.volume > 0) this.isMuted = false
  }

  decreaseVolume(step = this.volumeStep) {
    this.volume = Math.max(0, Math.round((this.volume - step) * 100) / 100)
    if (this.volume === 0) this.isMuted = true
  }

  toggleMute() {
    this.isMuted = !this.isMuted
  }

  stepPlaybackRate(direction) {
    const rates = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]
    let idx = rates.indexOf(this.playbackRate)
    if (idx === -1) idx = 3

    if (direction === "up" && idx < rates.length - 1) {
      this.playbackRate = rates[idx + 1]
    } else if (direction === "down" && idx > 0) {
      this.playbackRate = rates[idx - 1]
    }
    this.speedFeedback = `${this.playbackRate}x`
  }

  resetPlaybackRate() {
    this.playbackRate = 1
    this.speedFeedback = "1x"
  }

  toggleFullscreen() {
    this.isFullscreen = !this.isFullscreen
  }

  toggleTheater() {
    this.isTheater = !this.isTheater
  }

  togglePiP() {
    this.isPiP = !this.isPiP
  }

  toggleSubtitles() {
    this.subtitlesEnabled = !this.subtitlesEnabled
  }

  playNext() {
    this.nextVideoTriggered = true
  }

  toggleHelp() {
    this.isHelpOpen = !this.isHelpOpen
  }

  closeHelp() {
    this.isHelpOpen = false
  }

  // Click & Double click simulator
  handlePointerClick(onExecuteTogglePlay) {
    if (this.clickTimeout) {
      clearTimeout(this.clickTimeout)
      this.clickTimeout = null
      return false // Cancelled due to double click
    }

    this.clickTimeout = setTimeout(() => {
      this.clickTimeout = null
      this.singleClicksHandled++
      if (onExecuteTogglePlay) onExecuteTogglePlay()
      else this.togglePlay()
    }, 250)
    return true
  }

  handleDoubleClick(ratio) {
    if (this.clickTimeout) {
      clearTimeout(this.clickTimeout)
      this.clickTimeout = null
    }
    this.doubleClicksHandled++

    if (ratio < 0.35) {
      this.skipBackward(10)
    } else if (ratio > 0.65) {
      this.skipForward(10)
    } else {
      this.toggleFullscreen()
    }
  }

  // Keystroke handler with scoping
  handleKeyDown(event, isFocused = false) {
    if (this.isHelpOpen) {
      if (event.key === "Escape" || event.key === "?" || (event.shiftKey && event.key === "/")) {
        this.closeHelp()
        return true
      }
      return false
    }

    if (this.manager) {
      const activeId = this.manager.getActivePlayer()
      if (activeId && activeId !== this.playerId && !isFocused) {
        return false // Scoped to another active player
      }
    }

    const action = matchShortcutAction(event)
    if (!action) return false

    if (event.repeat && !doesActionAllowRepeat(action)) {
      return false // Repeat suppressed
    }

    if (this.manager) {
      this.manager.setActivePlayer(this.playerId)
    }

    switch (action) {
      case "togglePlay":
        this.togglePlay()
        break
      case "seekBackward":
        this.skipBackward(this.seekSeconds)
        break
      case "seekForward":
        this.skipForward(this.seekSeconds)
        break
      case "largeSeekBackward":
        this.skipBackward(this.largeSeekSeconds)
        break
      case "largeSeekForward":
        this.skipForward(this.largeSeekSeconds)
        break
      case "volumeUp":
        this.increaseVolume(this.volumeStep)
        break
      case "volumeDown":
        this.decreaseVolume(this.volumeStep)
        break
      case "toggleMute":
        this.toggleMute()
        break
      case "speedUp":
        this.stepPlaybackRate("up")
        break
      case "speedDown":
        this.stepPlaybackRate("down")
        break
      case "speedReset":
        this.resetPlaybackRate()
        break
      case "toggleFullscreen":
        this.toggleFullscreen()
        break
      case "toggleTheater":
        this.toggleTheater()
        break
      case "togglePiP":
        this.togglePiP()
        break
      case "toggleSubtitles":
        this.toggleSubtitles()
        break
      case "nextVideo":
        this.playNext()
        break
      case "toggleHelp":
        this.toggleHelp()
        break
    }
    return true
  }

  destroy() {
    if (this.clickTimeout) {
      clearTimeout(this.clickTimeout)
      this.clickTimeout = null
    }
    if (this.manager) {
      this.manager.unregisterPlayer(this.playerId)
    }
  }
}

export async function runPhase10DesktopInteractionsTestSuite() {
  const runner = new TestRunner("Phase 10: Advanced Desktop Interaction & Keyboard Shortcut System")

  try {
    // =========================================================================
    // 1. Play / Pause Keystroke Handling (Space, K)
    // =========================================================================
    const player = new MockPhase10Player({ currentTime: 20, duration: 100 })

    player.handleKeyDown({ key: " " })
    runner.assert(player.isPlaying === true, "Space key toggles play (false -> true)")

    player.handleKeyDown({ key: "k" })
    runner.assert(player.isPlaying === false, "k key toggles pause (true -> false)")

    player.handleKeyDown({ key: "K" })
    runner.assert(player.isPlaying === true, "Uppercase K toggles play (false -> true)")

    // =========================================================================
    // 2. Seeking: Standard (5s) & Large Seek (10s) with Shift modifier
    // =========================================================================
    player.currentTime = 50

    // ArrowLeft -> -5s
    player.handleKeyDown({ key: "ArrowLeft" })
    runner.assert(player.currentTime === 45, "ArrowLeft seeks backward by standard interval (5s)")
    runner.assert(player.lastSeekFeedback.seconds === 5, "Standard seek feedback records 5s")

    // ArrowRight -> +5s
    player.handleKeyDown({ key: "ArrowRight" })
    runner.assert(player.currentTime === 50, "ArrowRight seeks forward by standard interval (5s)")

    // Shift + ArrowLeft -> -10s
    player.handleKeyDown({ key: "ArrowLeft", shiftKey: true })
    runner.assert(player.currentTime === 40, "Shift + ArrowLeft triggers largeSeekBackward (10s)")
    runner.assert(player.lastSeekFeedback.seconds === 10, "Large seek feedback records 10s")

    // Shift + ArrowRight -> +10s
    player.handleKeyDown({ key: "ArrowRight", shiftKey: true })
    runner.assert(player.currentTime === 50, "Shift + ArrowRight triggers largeSeekForward (10s)")

    // J / L Seeking (YouTube standard 10s seek)
    player.handleKeyDown({ key: "j" })
    runner.assert(player.currentTime === 40, "j key seeks backward by 10s")

    player.handleKeyDown({ key: "l" })
    runner.assert(player.currentTime === 50, "l key seeks forward by 10s")

    // Boundaries clamping: zero & duration
    player.currentTime = 3
    player.handleKeyDown({ key: "ArrowLeft" })
    runner.assert(player.currentTime === 0, "Seek backward clamps at 0 seconds")

    player.currentTime = 98
    player.handleKeyDown({ key: "ArrowRight" })
    runner.assert(player.currentTime === 100, "Seek forward clamps at total duration (100s)")

    // =========================================================================
    // 3. Audio & Volume Controls (ArrowUp, ArrowDown, M)
    // =========================================================================
    player.volume = 0.5
    player.isMuted = false

    player.handleKeyDown({ key: "ArrowUp" })
    runner.assert(player.volume === 0.55, "ArrowUp increments volume by 0.05")

    player.handleKeyDown({ key: "ArrowDown" })
    runner.assert(player.volume === 0.5, "ArrowDown decrements volume by 0.05")

    player.handleKeyDown({ key: "m" })
    runner.assert(player.isMuted === true, "m key toggles mute (false -> true)")

    player.handleKeyDown({ key: "M" })
    runner.assert(player.isMuted === false, "Uppercase M toggles un-mute (true -> false)")

    // Clamping volume between 0 and 1
    player.volume = 0.98
    player.handleKeyDown({ key: "ArrowUp" })
    runner.assert(player.volume === 1, "Volume clamps at maximum 1.0")

    player.volume = 0.02
    player.handleKeyDown({ key: "ArrowDown" })
    runner.assert(player.volume === 0, "Volume clamps at minimum 0.0")
    runner.assert(player.isMuted === true, "Reaching 0 volume automatically mutes audio")

    // =========================================================================
    // 4. Playback Speed Stepping & Reset (<, >, 0, Home)
    // =========================================================================
    player.playbackRate = 1

    player.handleKeyDown({ key: ">" })
    runner.assert(player.playbackRate === 1.25, "> key steps playback speed up from 1x to 1.25x")
    runner.assert(player.speedFeedback === "1.25x", "Playback speed feedback set to 1.25x")

    player.handleKeyDown({ key: "<" })
    runner.assert(player.playbackRate === 1, "< key steps playback speed down from 1.25x to 1x")

    player.handleKeyDown({ key: "<" })
    runner.assert(player.playbackRate === 0.75, "< key steps playback speed down to 0.75x")

    player.handleKeyDown({ key: "0" })
    runner.assert(player.playbackRate === 1, "0 key resets playback speed to default 1x")
    runner.assert(player.speedFeedback === "1x", "Reset speed feedback set to 1x")

    player.playbackRate = 1.75
    player.handleKeyDown({ key: "Home" })
    runner.assert(player.playbackRate === 1, "Home key resets playback speed to default 1x")

    // =========================================================================
    // 5. Viewing Modes & Display Toggles (F, T, P, C, N, ?)
    // =========================================================================
    player.isFullscreen = false
    player.handleKeyDown({ key: "f" })
    runner.assert(player.isFullscreen === true, "f key toggles fullscreen mode")

    player.isTheater = false
    player.handleKeyDown({ key: "t" })
    runner.assert(player.isTheater === true, "t key toggles theater mode")

    player.isPiP = false
    player.handleKeyDown({ key: "p" })
    runner.assert(player.isPiP === true, "p key toggles picture-in-picture mode")

    player.subtitlesEnabled = false
    player.handleKeyDown({ key: "c" })
    runner.assert(player.subtitlesEnabled === true, "c key toggles subtitles")

    player.nextVideoTriggered = false
    player.handleKeyDown({ key: "N", shiftKey: true })
    runner.assert(player.nextVideoTriggered === true, "Shift + N triggers playNext")

    player.nextVideoTriggered = false
    player.handleKeyDown({ key: "n" })
    runner.assert(player.nextVideoTriggered === true, "n key triggers playNext")

    // Help overlay
    player.isHelpOpen = false
    player.handleKeyDown({ key: "?" })
    runner.assert(player.isHelpOpen === true, "? key opens shortcut help overlay")

    player.handleKeyDown({ key: "Escape" })
    runner.assert(player.isHelpOpen === false, "Escape key closes shortcut help overlay")

    // When help modal is open, other shortcuts do NOT execute
    player.isHelpOpen = true
    player.currentTime = 50
    player.handleKeyDown({ key: "ArrowLeft" })
    runner.assert(player.currentTime === 50, "Shortcuts blocked while help modal is active")
    player.handleKeyDown({ key: "Escape" })

    // =========================================================================
    // 6. Typing Targets Protection (Inputs, Textareas, Contenteditable, Role textbox)
    // =========================================================================
    const inputTarget = { tagName: "INPUT" }
    const textareaTarget = { tagName: "TEXTAREA" }
    const selectTarget = { tagName: "SELECT" }
    const contentEditableTarget = { tagName: "DIV", isContentEditable: true }
    const roleTextboxTarget = { tagName: "DIV", getAttribute: (k) => (k === "role" ? "textbox" : null) }

    runner.assert(isTypingTarget(inputTarget) === true, "Detects INPUT as typing target")
    runner.assert(isTypingTarget(textareaTarget) === true, "Detects TEXTAREA as typing target")
    runner.assert(isTypingTarget(selectTarget) === true, "Detects SELECT as typing target")
    runner.assert(isTypingTarget(contentEditableTarget) === true, "Detects isContentEditable as typing target")
    runner.assert(isTypingTarget(roleTextboxTarget) === true, "Detects role='textbox' as typing target")

    player.isPlaying = false
    const inputBlocked = player.handleKeyDown({ key: " ", target: inputTarget })
    runner.assert(inputBlocked === false, "Keystrokes in INPUT fields are ignored")
    runner.assert(player.isPlaying === false, "Player state untouched when typing in INPUT")

    const textareaBlocked = player.handleKeyDown({ key: "k", target: textareaTarget })
    runner.assert(textareaBlocked === false, "Keystrokes in TEXTAREA fields are ignored")

    // =========================================================================
    // 7. System Modifiers Protection (Ctrl, Meta, Alt)
    // =========================================================================
    runner.assert(hasSystemModifiers({ ctrlKey: true }) === true, "Detects ctrlKey modifier")
    runner.assert(hasSystemModifiers({ metaKey: true }) === true, "Detects metaKey (Cmd) modifier")
    runner.assert(hasSystemModifiers({ altKey: true }) === true, "Detects altKey modifier")
    runner.assert(hasSystemModifiers({}) === false, "No modifiers detected when clean")

    player.isPlaying = false
    const ctrlK = player.handleKeyDown({ key: "k", ctrlKey: true })
    runner.assert(ctrlK === false, "Ctrl+K does not toggle video play/pause")
    runner.assert(player.isPlaying === false, "Player state untouched for system shortcut Ctrl+K")

    const cmdSpace = player.handleKeyDown({ key: " ", metaKey: true })
    runner.assert(cmdSpace === false, "Cmd+Space does not toggle video play/pause")

    // =========================================================================
    // 8. Key Repeat Filtering
    // =========================================================================
    runner.assert(doesActionAllowRepeat("seekBackward") === true, "Repeat allowed for seekBackward")
    runner.assert(doesActionAllowRepeat("seekForward") === true, "Repeat allowed for seekForward")
    runner.assert(doesActionAllowRepeat("largeSeekBackward") === true, "Repeat allowed for largeSeekBackward")
    runner.assert(doesActionAllowRepeat("largeSeekForward") === true, "Repeat allowed for largeSeekForward")
    runner.assert(doesActionAllowRepeat("volumeUp") === true, "Repeat allowed for volumeUp")
    runner.assert(doesActionAllowRepeat("volumeDown") === true, "Repeat allowed for volumeDown")

    runner.assert(doesActionAllowRepeat("togglePlay") === false, "Repeat blocked for togglePlay")
    runner.assert(doesActionAllowRepeat("toggleMute") === false, "Repeat blocked for toggleMute")
    runner.assert(doesActionAllowRepeat("toggleFullscreen") === false, "Repeat blocked for toggleFullscreen")
    runner.assert(doesActionAllowRepeat("toggleTheater") === false, "Repeat blocked for toggleTheater")
    runner.assert(doesActionAllowRepeat("togglePiP") === false, "Repeat blocked for togglePiP")
    runner.assert(doesActionAllowRepeat("toggleSubtitles") === false, "Repeat blocked for toggleSubtitles")
    runner.assert(doesActionAllowRepeat("nextVideo") === false, "Repeat blocked for nextVideo")
    runner.assert(doesActionAllowRepeat("toggleHelp") === false, "Repeat blocked for toggleHelp")
    runner.assert(doesActionAllowRepeat("speedReset") === false, "Repeat blocked for speedReset")

    // Test repeat keystroke behavior on player
    player.isPlaying = true
    const repeatSpace = player.handleKeyDown({ key: " ", repeat: true })
    runner.assert(repeatSpace === false, "Repeated Spacebar keydown is ignored")
    runner.assert(player.isPlaying === true, "Player remains playing (no rapid toggle flap)")

    player.currentTime = 50
    const repeatSeek = player.handleKeyDown({ key: "ArrowLeft", repeat: true })
    runner.assert(repeatSeek === true, "Repeated ArrowLeft keydown is processed for scrubbing")
    runner.assert(player.currentTime === 45, "Scrubbing executed on repeat")

    // =========================================================================
    // 9. Active Player Scoping & Multi-Player Conflict Prevention
    // =========================================================================
    const manager = new TestVideoPlayerManager()
    const playerA = new MockPhase10Player({ playerId: "player_A", manager, isPlaying: true })
    const playerB = new MockPhase10Player({ playerId: "player_B", manager, isPlaying: false })

    manager.setActivePlayer("player_A")
    runner.assert(manager.getActivePlayer() === "player_A", "Player A is active player in manager")

    // Keystroke fired: should affect Player A, but NOT Player B
    playerA.handleKeyDown({ key: "k" })
    playerB.handleKeyDown({ key: "k" })

    runner.assert(playerA.isPlaying === false, "Player A received shortcut and paused")
    runner.assert(playerB.isPlaying === false, "Player B did not toggle play (ignored due to active scoping)")

    // Switch focus to Player B
    playerB.handleKeyDown({ key: "k" }, true) // isFocused = true
    runner.assert(playerB.isPlaying === true, "Player B handled shortcut when focused")
    runner.assert(manager.getActivePlayer() === "player_B", "Player B now registered as active player")
    runner.assert(playerA.isPlaying === false, "Player A automatically paused by active player manager")

    playerA.destroy()
    playerB.destroy()

    // =========================================================================
    // 10. Single-Click vs Double-Click Disambiguation (250ms Debounce Window)
    // =========================================================================
    const clickPlayer = new MockPhase10Player({ isPlaying: false })

    // Single Click test: timer fires after 250ms
    clickPlayer.handlePointerClick()
    runner.assert(clickPlayer.isPlaying === false, "Playback does NOT toggle immediately on pointer click")
    runner.assert(clickPlayer.clickTimeout !== null, "Click debounce timer is pending")

    await new Promise((resolve) => setTimeout(resolve, 270))
    runner.assert(clickPlayer.isPlaying === true, "Playback toggles to true after 250ms debounce")
    runner.assert(clickPlayer.singleClicksHandled === 1, "Exactly 1 single-click handled")

    // Double Click test: second click arrives within debounce window
    clickPlayer.handlePointerClick() // First click
    runner.assert(clickPlayer.clickTimeout !== null, "First click started 250ms timer")

    // Second click arrives at 50ms: double-click action executes
    await new Promise((resolve) => setTimeout(resolve, 50))
    clickPlayer.handleDoubleClick(0.5) // Center zone double-click

    runner.assert(clickPlayer.clickTimeout === null, "Double click immediately clears single-click timer")
    runner.assert(clickPlayer.doubleClicksHandled === 1, "Double click handled")
    runner.assert(clickPlayer.isFullscreen === true, "Center zone double click toggled fullscreen")

    // Wait 250ms to ensure the first click never fires play/pause
    const playStateBefore = clickPlayer.isPlaying
    await new Promise((resolve) => setTimeout(resolve, 250))
    runner.assert(clickPlayer.isPlaying === playStateBefore, "Play/pause did NOT toggle during/after double-click")
    runner.assert(clickPlayer.singleClicksHandled === 1, "Single-click counter remained at 1 (not incremented)")

    clickPlayer.destroy()

    // =========================================================================
    // 11. 3-Zone Click Architecture (Double Click)
    // =========================================================================
    const zonePlayer = new MockPhase10Player({ currentTime: 50, duration: 100 })

    // Left zone: ratio < 0.35 -> skip backward 10s
    zonePlayer.handleDoubleClick(0.2)
    runner.assert(zonePlayer.currentTime === 40, "Left zone (20%) double-click seeks backward 10s")
    runner.assert(zonePlayer.lastSeekFeedback.seconds === 10, "Seek feedback indicates 10s backward")

    // Right zone: ratio > 0.65 -> skip forward 10s
    zonePlayer.handleDoubleClick(0.8)
    runner.assert(zonePlayer.currentTime === 50, "Right zone (80%) double-click seeks forward 10s")
    runner.assert(zonePlayer.lastSeekFeedback.seconds === 10, "Seek feedback indicates 10s forward")

    // Center zone: ratio between 0.35 and 0.65 -> toggle fullscreen
    zonePlayer.isFullscreen = false
    zonePlayer.handleDoubleClick(0.5)
    runner.assert(zonePlayer.isFullscreen === true, "Center zone (50%) double-click toggles fullscreen")

    zonePlayer.handleDoubleClick(0.36)
    runner.assert(zonePlayer.isFullscreen === false, "Center boundary (36%) double-click toggles fullscreen")

    zonePlayer.handleDoubleClick(0.64)
    runner.assert(zonePlayer.isFullscreen === true, "Center boundary (64%) double-click toggles fullscreen")

    zonePlayer.destroy()

    // =========================================================================
    // 12. Timeline Hover Preview Calculations & Throttling
    // =========================================================================
    const trackRect = { left: 100, width: 800 }

    // Pointer percentage calculation
    runner.assert(calculatePointerPercentage(100, trackRect) === 0, "Start of track maps to 0%")
    runner.assert(calculatePointerPercentage(500, trackRect) === 0.5, "Center of track maps to 50%")
    runner.assert(calculatePointerPercentage(900, trackRect) === 1, "End of track maps to 100%")
    runner.assert(calculatePointerPercentage(50, trackRect) === 0, "Left-overshoot clamped to 0%")
    runner.assert(calculatePointerPercentage(1200, trackRect) === 1, "Right-overshoot clamped to 100%")
    runner.assert(calculatePointerPercentage(500, { left: 100, width: 0 }) === 0, "Zero width safely returns 0")

    // Preview time calculation & NaN / Infinity guards
    runner.assert(calculatePreviewTime(0.5, 120) === 60, "50% of 120s equals 60s")
    runner.assert(calculatePreviewTime(0, 120) === 0, "0% of 120s equals 0s")
    runner.assert(calculatePreviewTime(1, 120) === 120, "100% of 120s equals 120s")
    runner.assert(calculatePreviewTime(0.5, NaN) === 0, "NaN duration safely returns 0")
    runner.assert(calculatePreviewTime(0.5, Infinity) === 0, "Infinity duration safely returns 0")
    runner.assert(calculatePreviewTime(0.5, -10) === 0, "Negative duration safely returns 0")

    // Clamped preview left position (edge-clamping)
    const trackWidth = 800
    const previewWidth = 160 // half-width = 80, padding = 8
    // Min left: 8 + 80 = 88px
    // Max left: 800 - 8 - 80 = 712px
    runner.assert(calculateClampedPreviewLeft(400, trackWidth, previewWidth, 8) === 400, "Center position (400px) remains unclamped")
    runner.assert(calculateClampedPreviewLeft(10, trackWidth, previewWidth, 8) === 88, "Left position (10px) clamped to minimum 88px")
    runner.assert(calculateClampedPreviewLeft(780, trackWidth, previewWidth, 8) === 712, "Right position (780px) clamped to maximum 712px")

    // =========================================================================
    // 13. Thumbnail Array & Closest Frame Resolution
    // =========================================================================
    const sampleThumbnails = [
      { time: 0, url: "/thumbs/0.jpg" },
      { time: 10, url: "/thumbs/10.jpg" },
      { time: 20, url: "/thumbs/20.jpg" },
      { time: 30, url: "/thumbs/30.jpg" },
    ]

    const thumbAt4 = findClosestThumbnail(4, sampleThumbnails)
    runner.assert(thumbAt4.time === 0, "Preview time 4s matches closest thumbnail at 0s")

    const thumbAt7 = findClosestThumbnail(7, sampleThumbnails)
    runner.assert(thumbAt7.time === 10, "Preview time 7s matches closest thumbnail at 10s")

    const thumbAt26 = findClosestThumbnail(26, sampleThumbnails)
    runner.assert(thumbAt26.time === 30, "Preview time 26s matches closest thumbnail at 30s")

    runner.assert(findClosestThumbnail(15, null) === null, "Null thumbnails array safely returns null")
    runner.assert(findClosestThumbnail(15, []) === null, "Empty thumbnails array safely returns null")

    // =========================================================================
    // 14. Sprite Sheet Frame Offset & Background Math
    // =========================================================================
    const spriteConfig = {
      spriteSheetUrl: "/sprites/storyboard.jpg",
      itemWidth: 160,
      itemHeight: 90,
      interval: 5,
      columns: 10,
      totalFrames: 100,
    }

    // Time 0s -> frame 0 (col 0, row 0)
    const sprite0 = calculateSpritePosition(0, spriteConfig)
    runner.assert(sprite0.frameIndex === 0, "Time 0s is frame 0")
    runner.assert(sprite0.offsetX === 0 && sprite0.offsetY === 0, "Frame 0 offsets are (0, 0)")
    runner.assert(sprite0.backgroundSize === "1600px auto", "Background size is columns * itemWidth (1600px auto)")

    // Time 25s -> frame 5 (25 / 5 = 5) -> col 5, row 0 -> offsetX = -800, offsetY = 0
    const sprite25 = calculateSpritePosition(25, spriteConfig)
    runner.assert(sprite25.frameIndex === 5, "Time 25s is frame 5")
    runner.assert(sprite25.offsetX === -800 && sprite25.offsetY === 0, "Frame 5 offsets are (-800px, 0px)")

    // Time 60s -> frame 12 (60 / 5 = 12) -> col 2, row 1 -> offsetX = -320, offsetY = -90
    const sprite60 = calculateSpritePosition(60, spriteConfig)
    runner.assert(sprite60.frameIndex === 12, "Time 60s is frame 12")
    runner.assert(sprite60.offsetX === -320 && sprite60.offsetY === -90, "Frame 12 offsets are (-320px, -90px)")

    // Time over totalFrames -> clamped to last frame (frame 99 -> col 9, row 9)
    const spriteOver = calculateSpritePosition(9999, spriteConfig)
    runner.assert(spriteOver.frameIndex === 99, "Time 9999s clamps to last frame (99)")
    runner.assert(spriteOver.offsetX === -1440 && spriteOver.offsetY === -810, "Last frame offsets are (-1440px, -810px)")

    // =========================================================================
    // 15. Regression: Phases 1 through 9 Compatibility
    // =========================================================================
    const regressionPlayer = new MockPhase10Player({
      currentTime: 30,
      duration: 200,
      isPlaying: false,
    })

    // Phase 1: Play/pause state
    regressionPlayer.togglePlay()
    runner.assert(regressionPlayer.isPlaying === true, "Phase 1: togglePlay transitions to playing")

    // Phase 2: Duration & time
    runner.assert(regressionPlayer.duration === 200, "Phase 2: duration preserved")

    // Phase 3: Volume and speed
    regressionPlayer.volume = 0.7
    regressionPlayer.stepPlaybackRate("up")
    runner.assert(regressionPlayer.playbackRate === 1.25, "Phase 3: speed stepped")

    // Phase 5: Display modes
    regressionPlayer.toggleTheater()
    runner.assert(regressionPlayer.isTheater === true, "Phase 5: theater mode works")

    // Phase 6: Subtitles
    regressionPlayer.toggleSubtitles()
    runner.assert(regressionPlayer.subtitlesEnabled === true, "Phase 6: subtitles toggle works")

    // Phase 9: Play next
    regressionPlayer.playNext()
    runner.assert(regressionPlayer.nextVideoTriggered === true, "Phase 9: next video action works")

    regressionPlayer.destroy()
  } catch (err) {
    runner.assert(false, `Unexpected error in Phase 10 test suite: ${err.message}`)
  }

  return runner.summary()
}

// Auto-run when executed directly
if (process.argv[1]?.endsWith("phase10_keyboard_desktop_interactions.test.js")) {
  runPhase10DesktopInteractionsTestSuite()
    .then((result) => {
      process.exit(result.failed > 0 ? 1 : 0)
    })
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
