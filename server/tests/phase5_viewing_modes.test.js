import { TestRunner } from "./helpers/testEnv.js"

// Phase 5 Viewing Modes State Machine Simulator
class VideoPlayerStateMachinePhase5 {
  constructor(options = {}) {
    this.containerElement = { id: "player-container" }
    this.videoElement = { id: "player-video", paused: true, currentTime: 0, duration: options.duration || 120 }

    // Mock document state
    this.documentMock = {
      fullscreenElement: null,
      pictureInPictureElement: null,
      fullscreenEnabled: options.fullscreenEnabled !== undefined ? options.fullscreenEnabled : true,
      pictureInPictureEnabled: options.pictureInPictureEnabled !== undefined ? options.pictureInPictureEnabled : true,
    }

    this.wasTheaterBeforeFullscreen = false

    this.state = {
      isPlaying: options.isPlaying || false,
      isPaused: options.isPlaying ? false : true,
      currentTime: options.initialTime || 0,
      duration: options.duration || 120,
      volume: options.initialVolume !== undefined ? options.initialVolume : 1.0,
      isMuted: options.initialMuted || false,
      playbackRate: options.initialPlaybackRate || 1.0,
      seekInterval: options.seekInterval || 10,
      timeDisplayMode: "current-total",
      seekFeedback: null,
      isFullscreen: false,
      isTheaterMode: false,
      isTheater: false,
      isPictureInPicture: false,
      isPiP: false,
      fullscreenSupported: this.documentMock.fullscreenEnabled,
      pictureInPictureSupported: this.documentMock.pictureInPictureEnabled,
    }
  }

  // --- Theater Mode Actions ---
  enterTheaterMode() {
    this.state.isTheaterMode = true
    this.state.isTheater = true
  }

  exitTheaterMode() {
    this.state.isTheaterMode = false
    this.state.isTheater = false
  }

  toggleTheaterMode() {
    const next = !this.state.isTheaterMode
    this.state.isTheaterMode = next
    this.state.isTheater = next
  }

  toggleTheater() {
    this.toggleTheaterMode()
  }

  // --- Fullscreen Actions & Synchronization ---
  async enterFullscreen() {
    if (!this.state.fullscreenSupported) return
    this.wasTheaterBeforeFullscreen = this.state.isTheaterMode
    this.documentMock.fullscreenElement = this.containerElement
    this.onFullscreenChange()
  }

  async exitFullscreen() {
    this.documentMock.fullscreenElement = null
    this.onFullscreenChange()
  }

  async toggleFullscreen() {
    if (this.documentMock.fullscreenElement === this.containerElement) {
      await this.exitFullscreen()
    } else {
      await this.enterFullscreen()
    }
  }

  onFullscreenChange() {
    const isCurrentFs = this.documentMock.fullscreenElement === this.containerElement
    if (this.state.isFullscreen && !isCurrentFs) {
      // Restoring theater mode if active before entering fullscreen
      const restoreTheater = this.wasTheaterBeforeFullscreen
      this.state.isFullscreen = false
      this.state.isTheaterMode = restoreTheater
      this.state.isTheater = restoreTheater
    } else {
      this.state.isFullscreen = isCurrentFs
    }
  }

  onFullscreenError() {
    this.state.isFullscreen = false
  }

  // --- Picture-in-Picture Actions & Synchronization ---
  async enterPictureInPicture() {
    if (!this.state.pictureInPictureSupported) return
    this.documentMock.pictureInPictureElement = this.videoElement
    this.onEnterPictureInPicture()
  }

  async exitPictureInPicture() {
    this.documentMock.pictureInPictureElement = null
    this.onLeavePictureInPicture()
  }

  async togglePictureInPicture() {
    if (this.documentMock.pictureInPictureElement === this.videoElement) {
      await this.exitPictureInPicture()
    } else {
      await this.enterPictureInPicture()
    }
  }

  togglePiP() {
    return this.togglePictureInPicture()
  }

  onEnterPictureInPicture() {
    this.state.isPictureInPicture = true
    this.state.isPiP = true
  }

  onLeavePictureInPicture() {
    this.state.isPictureInPicture = false
    this.state.isPiP = false
  }

  // Helper methods to simulate button ARIA attributes
  getTheaterButtonAria() {
    return {
      label: this.state.isTheaterMode ? "Exit theater mode (t)" : "Enter theater mode (t)",
      pressed: this.state.isTheaterMode,
    }
  }

  getFullscreenButtonAria() {
    return {
      label: this.state.isFullscreen ? "Exit fullscreen (f)" : "Enter fullscreen (f)",
      pressed: this.state.isFullscreen,
    }
  }

  getPiPButtonAria() {
    return {
      label: this.state.isPictureInPicture ? "Exit Picture-in-Picture (p)" : "Enter Picture-in-Picture (p)",
      pressed: this.state.isPictureInPicture,
    }
  }
}

export async function runViewingModesTestSuite() {
  const runner = new TestRunner("Phase 5: Advanced Viewing Modes (Theater, Fullscreen & Picture-in-Picture)")
  runner.start()

  try {
    // -------------------------------------------------------------------------
    // 1. Theater Mode Tests
    // -------------------------------------------------------------------------
    const thPlayer = new VideoPlayerStateMachinePhase5()
    runner.assert(!thPlayer.state.isTheaterMode, "Initial state: isTheaterMode starts false")
    runner.assert(!thPlayer.state.isTheater, "Initial state: isTheater alias starts false")

    thPlayer.enterTheaterMode()
    runner.assert(thPlayer.state.isTheaterMode === true, "enterTheaterMode sets isTheaterMode to true")
    runner.assert(thPlayer.state.isTheater === true, "enterTheaterMode sets isTheater alias to true")

    thPlayer.exitTheaterMode()
    runner.assert(thPlayer.state.isTheaterMode === false, "exitTheaterMode sets isTheaterMode to false")
    runner.assert(thPlayer.state.isTheater === false, "exitTheaterMode sets isTheater alias to false")

    thPlayer.toggleTheaterMode()
    runner.assert(thPlayer.state.isTheaterMode === true, "First toggleTheaterMode turns theater mode on")
    thPlayer.toggleTheaterMode()
    runner.assert(thPlayer.state.isTheaterMode === false, "Second toggleTheaterMode turns theater mode off")

    thPlayer.toggleTheater()
    runner.assert(thPlayer.state.isTheaterMode === true, "toggleTheater backward-compatible alias turns theater mode on")
    thPlayer.toggleTheater()
    runner.assert(thPlayer.state.isTheaterMode === false, "toggleTheater backward-compatible alias turns theater mode off")

    // Theater mode preserves playback continuity and parameters
    const playPreserve = new VideoPlayerStateMachinePhase5({
      isPlaying: true,
      initialTime: 42.5,
      initialVolume: 0.8,
      initialPlaybackRate: 1.25,
    })
    playPreserve.toggleTheaterMode()
    runner.assert(playPreserve.state.isPlaying === true, "Theater mode preserves isPlaying=true")
    runner.assert(playPreserve.state.isPaused === false, "Theater mode preserves isPaused=false")
    runner.assert(playPreserve.state.currentTime === 42.5, "Theater mode preserves currentTime=42.5s")
    runner.assert(playPreserve.state.volume === 0.8, "Theater mode preserves volume=0.8")
    runner.assert(playPreserve.state.playbackRate === 1.25, "Theater mode preserves playbackRate=1.25x")

    playPreserve.exitTheaterMode()
    runner.assert(playPreserve.state.isPlaying === true, "Exiting theater mode preserves isPlaying=true")
    runner.assert(playPreserve.state.currentTime === 42.5, "Exiting theater mode preserves currentTime=42.5s")

    // -------------------------------------------------------------------------
    // 2. Fullscreen Mode & Authoritative State Synchronization
    // -------------------------------------------------------------------------
    const fsPlayer = new VideoPlayerStateMachinePhase5()
    runner.assert(!fsPlayer.state.isFullscreen, "Initial state: isFullscreen starts false")

    const supported = new VideoPlayerStateMachinePhase5({ fullscreenEnabled: true })
    runner.assert(supported.state.fullscreenSupported === true, "Feature detection: fullscreenSupported is true")

    const unsupported = new VideoPlayerStateMachinePhase5({ fullscreenEnabled: false })
    runner.assert(unsupported.state.fullscreenSupported === false, "Feature detection: fullscreenSupported is false")

    await fsPlayer.enterFullscreen()
    runner.assert(fsPlayer.state.isFullscreen === true, "enterFullscreen synchronizes isFullscreen to true")
    runner.assert(fsPlayer.documentMock.fullscreenElement === fsPlayer.containerElement, "authoritative document element set")

    await fsPlayer.exitFullscreen()
    runner.assert(fsPlayer.state.isFullscreen === false, "exitFullscreen synchronizes isFullscreen to false")
    runner.assert(fsPlayer.documentMock.fullscreenElement === null, "authoritative document element cleared")

    await fsPlayer.toggleFullscreen()
    runner.assert(fsPlayer.state.isFullscreen === true, "toggleFullscreen enters fullscreen")
    await fsPlayer.toggleFullscreen()
    runner.assert(fsPlayer.state.isFullscreen === false, "toggleFullscreen exits fullscreen")

    // External fullscreen exit (e.g. Escape key)
    await fsPlayer.enterFullscreen()
    runner.assert(fsPlayer.state.isFullscreen === true, "In fullscreen before Escape")
    fsPlayer.documentMock.fullscreenElement = null
    fsPlayer.onFullscreenChange()
    runner.assert(fsPlayer.state.isFullscreen === false, "isFullscreen synchronized to false after external exit / Escape")

    // Safe error handling
    fsPlayer.onFullscreenError()
    runner.assert(fsPlayer.state.isFullscreen === false, "fullscreenerror handled safely without crash")

    // Fullscreen preserves playback parameters
    const fsPlayPreserve = new VideoPlayerStateMachinePhase5({
      isPlaying: true,
      initialTime: 85,
      initialVolume: 0.6,
    })
    await fsPlayPreserve.enterFullscreen()
    runner.assert(fsPlayPreserve.state.isPlaying === true, "Fullscreen preserves playback state")
    runner.assert(fsPlayPreserve.state.currentTime === 85, "Fullscreen preserves currentTime")
    runner.assert(fsPlayPreserve.state.volume === 0.6, "Fullscreen preserves volume")

    await fsPlayPreserve.exitFullscreen()
    runner.assert(fsPlayPreserve.state.isPlaying === true, "Exiting fullscreen preserves playback state")
    runner.assert(fsPlayPreserve.state.currentTime === 85, "Exiting fullscreen preserves currentTime")

    // -------------------------------------------------------------------------
    // 3. Picture-in-Picture (PiP) Mode & Event Synchronization
    // -------------------------------------------------------------------------
    const pipPlayer = new VideoPlayerStateMachinePhase5()
    runner.assert(!pipPlayer.state.isPictureInPicture, "Initial state: isPictureInPicture starts false")
    runner.assert(!pipPlayer.state.isPiP, "Initial state: isPiP alias starts false")

    const pipSupported = new VideoPlayerStateMachinePhase5({ pictureInPictureEnabled: true })
    runner.assert(pipSupported.state.pictureInPictureSupported === true, "pictureInPictureSupported is true when enabled")

    const pipUnsupported = new VideoPlayerStateMachinePhase5({ pictureInPictureEnabled: false })
    runner.assert(pipUnsupported.state.pictureInPictureSupported === false, "pictureInPictureSupported is false when disabled")

    await pipPlayer.enterPictureInPicture()
    runner.assert(pipPlayer.state.isPictureInPicture === true, "enterPictureInPicture sets isPictureInPicture=true")
    runner.assert(pipPlayer.state.isPiP === true, "enterPictureInPicture sets isPiP alias to true")
    runner.assert(pipPlayer.documentMock.pictureInPictureElement === pipPlayer.videoElement, "document pictureInPictureElement matches")

    await pipPlayer.exitPictureInPicture()
    runner.assert(pipPlayer.state.isPictureInPicture === false, "exitPictureInPicture sets isPictureInPicture=false")
    runner.assert(pipPlayer.state.isPiP === false, "exitPictureInPicture sets isPiP alias to false")

    // External close (user closes PiP floating window)
    await pipPlayer.enterPictureInPicture()
    runner.assert(pipPlayer.state.isPictureInPicture === true, "In PiP before external close")
    pipPlayer.documentMock.pictureInPictureElement = null
    pipPlayer.onLeavePictureInPicture()
    runner.assert(pipPlayer.state.isPictureInPicture === false, "isPictureInPicture=false after external close")
    runner.assert(pipPlayer.state.isPiP === false, "isPiP=false after external close")

    await pipPlayer.togglePictureInPicture()
    runner.assert(pipPlayer.state.isPictureInPicture === true, "togglePictureInPicture enters PiP")
    await pipPlayer.togglePiP()
    runner.assert(pipPlayer.state.isPictureInPicture === false, "togglePiP alias exits PiP")

    // Unsupported PiP fails safely
    const unsuppPiP = new VideoPlayerStateMachinePhase5({ pictureInPictureEnabled: false })
    await unsuppPiP.enterPictureInPicture()
    runner.assert(unsuppPiP.state.isPictureInPicture === false, "Unsupported PiP fails safely without throwing")

    // -------------------------------------------------------------------------
    // 4. Mode Interactions & Conflict Management
    // -------------------------------------------------------------------------
    const conflictPlayer = new VideoPlayerStateMachinePhase5()
    conflictPlayer.enterTheaterMode()
    runner.assert(conflictPlayer.state.isTheaterMode === true, "Theater mode is active before fullscreen")

    await conflictPlayer.enterFullscreen()
    runner.assert(conflictPlayer.state.isFullscreen === true, "Fullscreen engaged")
    runner.assert(conflictPlayer.wasTheaterBeforeFullscreen === true, "Prior theater mode remembered")

    await conflictPlayer.exitFullscreen()
    runner.assert(conflictPlayer.state.isFullscreen === false, "Fullscreen exited")
    runner.assert(conflictPlayer.state.isTheaterMode === true, "Theater mode automatically restored upon exiting fullscreen")
    runner.assert(conflictPlayer.state.isTheater === true, "Theater mode alias restored")

    // Normal mode does not engage theater when exiting fullscreen
    const normalPlayer = new VideoPlayerStateMachinePhase5()
    runner.assert(normalPlayer.state.isTheaterMode === false, "Normal mode starts without theater")
    await normalPlayer.enterFullscreen()
    await normalPlayer.exitFullscreen()
    runner.assert(normalPlayer.state.isFullscreen === false, "Exited fullscreen")
    runner.assert(normalPlayer.state.isTheaterMode === false, "Remains in normal mode")

    // Theater mode + PiP coexistence
    const theaterPipPlayer = new VideoPlayerStateMachinePhase5()
    theaterPipPlayer.enterTheaterMode()
    await theaterPipPlayer.enterPictureInPicture()
    runner.assert(theaterPipPlayer.state.isTheaterMode === true, "Theater mode preserved when entering PiP")
    runner.assert(theaterPipPlayer.state.isPictureInPicture === true, "PiP is active alongside theater mode")

    await theaterPipPlayer.exitPictureInPicture()
    runner.assert(theaterPipPlayer.state.isTheaterMode === true, "Theater mode preserved after exiting PiP")

    // -------------------------------------------------------------------------
    // 5. Accessibility & ARIA Attribute Semantics
    // -------------------------------------------------------------------------
    const ariaPlayer = new VideoPlayerStateMachinePhase5()
    let thAria = ariaPlayer.getTheaterButtonAria()
    runner.assert(thAria.label === "Enter theater mode (t)", "Initial theater aria-label is 'Enter theater mode (t)'")
    runner.assert(thAria.pressed === false, "Initial theater aria-pressed is false")

    ariaPlayer.enterTheaterMode()
    thAria = ariaPlayer.getTheaterButtonAria()
    runner.assert(thAria.label === "Exit theater mode (t)", "Active theater aria-label is 'Exit theater mode (t)'")
    runner.assert(thAria.pressed === true, "Active theater aria-pressed is true")

    let fsAria = ariaPlayer.getFullscreenButtonAria()
    runner.assert(fsAria.label === "Enter fullscreen (f)", "Initial fullscreen aria-label is 'Enter fullscreen (f)'")
    runner.assert(fsAria.pressed === false, "Initial fullscreen aria-pressed is false")

    await ariaPlayer.enterFullscreen()
    fsAria = ariaPlayer.getFullscreenButtonAria()
    runner.assert(fsAria.label === "Exit fullscreen (f)", "Active fullscreen aria-label is 'Exit fullscreen (f)'")
    runner.assert(fsAria.pressed === true, "Active fullscreen aria-pressed is true")

    let pipAria = ariaPlayer.getPiPButtonAria()
    runner.assert(pipAria.label === "Enter Picture-in-Picture (p)", "Initial PiP aria-label is 'Enter Picture-in-Picture (p)'")
    runner.assert(pipAria.pressed === false, "Initial PiP aria-pressed is false")

    await ariaPlayer.enterPictureInPicture()
    pipAria = ariaPlayer.getPiPButtonAria()
    runner.assert(pipAria.label === "Exit Picture-in-Picture (p)", "Active PiP aria-label is 'Exit Picture-in-Picture (p)'")
    runner.assert(pipAria.pressed === true, "Active PiP aria-pressed is true")

  } catch (err) {
    runner.assert(false, `Unexpected error in Phase 5 test suite: ${err.message}`)
  }

  return runner.summary()
}

// Auto-run if executed directly
if (process.argv[1].endsWith("phase5_viewing_modes.test.js")) {
  runViewingModesTestSuite()
    .then((result) => {
      process.exit(result.failed > 0 ? 1 : 0)
    })
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
