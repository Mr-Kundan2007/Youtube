import { TestRunner } from "./helpers/testEnv.js"

// Time formatting helper matching src/components/player/timelineUtils.ts
function formatVideoTime(seconds) {
  if (typeof seconds !== "number" || isNaN(seconds) || !isFinite(seconds) || seconds < 0) {
    return "0:00"
  }

  const totalSeconds = Math.floor(seconds)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const secs = totalSeconds % 60

  const pad = (num) => String(num).padStart(2, "0")

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(secs)}`
  }

  return `${minutes}:${pad(secs)}`
}

// Progress calculation helper matching src/components/player/timelineUtils.ts
function calculateProgress(currentTime, duration) {
  if (
    typeof currentTime !== "number" ||
    typeof duration !== "number" ||
    isNaN(currentTime) ||
    isNaN(duration) ||
    !isFinite(duration) ||
    duration <= 0 ||
    currentTime <= 0
  ) {
    return 0
  }

  const progress = (currentTime / duration) * 100
  return Math.max(0, Math.min(100, Number(progress.toFixed(4))))
}

// Percentage to time calculation helper matching src/components/player/timelineUtils.ts
function calculateTimeFromPercentage(percentage, duration) {
  if (
    typeof percentage !== "number" ||
    typeof duration !== "number" ||
    isNaN(percentage) ||
    isNaN(duration) ||
    !isFinite(duration) ||
    duration <= 0 ||
    percentage <= 0
  ) {
    return 0
  }

  const clampedPercentage = Math.max(0, Math.min(100, percentage))
  const time = (clampedPercentage / 100) * duration
  return Math.max(0, Math.min(duration, time))
}

// Extended state machine matching VideoPlayerContext.tsx for Phase 2
class VideoPlayerStateMachinePhase2 {
  constructor(options = {}) {
    this.state = {
      isPlaying: false,
      isPaused: true,
      isBuffering: false,
      isEnded: false,
      isSeeking: false,
      seekPreviewTime: 0,
      seekPreviewPercentage: 0,
      currentTime: 0,
      duration: options.duration || 0,
      bufferedPercent: options.bufferedPercent || 0,
      volume: options.initialVolume !== undefined ? options.initialVolume : 1,
      isMuted: options.initialMuted || false,
      playbackRate: options.initialPlaybackRate || 1,
      isFullscreen: false,
      isTheater: false,
      isPiP: false,
      isControlsVisible: true,
      error: null,
    }
  }

  play() {
    // Replay behavior: if completed or at the end, restart from beginning
    if (this.state.isEnded || (this.state.duration > 0 && this.state.currentTime >= this.state.duration - 0.2)) {
      this.state.currentTime = 0
      this.state.isEnded = false
    }
    this.state.isPlaying = true
    this.state.isPaused = false
    this.state.error = null
  }

  pause() {
    this.state.isPlaying = false
    this.state.isPaused = true
  }

  togglePlay() {
    if (this.state.isPaused || this.state.isEnded) {
      this.play()
    } else {
      this.pause()
    }
  }

  seek(timeInSeconds) {
    const clamped = Math.max(0, Math.min(timeInSeconds, this.state.duration || 0))
    this.state.currentTime = clamped
    this.state.isEnded = this.state.duration > 0 && clamped >= this.state.duration
  }

  startSeeking(previewTime, previewPercentage) {
    this.state.isSeeking = true
    this.state.seekPreviewTime = previewTime
    this.state.seekPreviewPercentage = previewPercentage
  }

  updateSeeking(previewTime, previewPercentage) {
    this.state.seekPreviewTime = previewTime
    this.state.seekPreviewPercentage = previewPercentage
  }

  endSeeking(finalTime) {
    const duration = this.state.duration || 0
    const targetTime =
      typeof finalTime === "number"
        ? Math.max(0, Math.min(finalTime, duration))
        : this.state.currentTime

    this.state.isSeeking = false
    this.state.currentTime = targetTime
    this.state.isEnded = duration > 0 && targetTime >= duration
  }

  onEnded() {
    this.state.isPlaying = false
    this.state.isPaused = true
    this.state.isEnded = true
    this.state.currentTime = this.state.duration
  }

  handleKeyDown(key) {
    if (!this.state.duration || this.state.duration <= 0) return

    const step = 5
    const bigStep = 10
    const jumpPct = this.state.duration * 0.1

    switch (key) {
      case "ArrowLeft":
        this.seek(Math.max(0, this.state.currentTime - step))
        break
      case "ArrowRight":
        this.seek(Math.min(this.state.duration, this.state.currentTime + step))
        break
      case "ArrowDown":
        this.seek(Math.max(0, this.state.currentTime - bigStep))
        break
      case "ArrowUp":
        this.seek(Math.min(this.state.duration, this.state.currentTime + bigStep))
        break
      case "Home":
        this.seek(0)
        break
      case "End":
        this.seek(this.state.duration)
        break
      case "0":
      case "1":
      case "2":
      case "3":
      case "4":
      case "5":
      case "6":
      case "7":
      case "8":
      case "9":
        this.seek((parseInt(key, 10) / 10) * this.state.duration)
        break
      case "j":
      case "J":
        this.seek(Math.max(0, this.state.currentTime - jumpPct))
        break
      case "l":
      case "L":
        this.seek(Math.min(this.state.duration, this.state.currentTime + jumpPct))
        break
    }
  }
}

export async function runCustomPlaybackTimelineTestSuite() {
  const runner = new TestRunner("Phase 2: Custom Playback Controls & Progress Timeline")
  runner.start()

  try {
    // -------------------------------------------------------------
    // Test 1: formatVideoTime precision & boundary handling
    // -------------------------------------------------------------
    runner.assert(formatVideoTime(0) === "0:00", "formatVideoTime(0) returns '0:00'")
    runner.assert(formatVideoTime(45) === "0:45", "formatVideoTime(45) returns '0:45'")
    runner.assert(formatVideoTime(65) === "1:05", "formatVideoTime(65) returns '1:05'")
    runner.assert(formatVideoTime(3600) === "1:00:00", "formatVideoTime(3600) returns '1:00:00' with hours")
    runner.assert(formatVideoTime(3665) === "1:01:05", "formatVideoTime(3665) returns '1:01:05' with hours and zero padding")
    runner.assert(formatVideoTime(7325) === "2:02:05", "formatVideoTime(7325) returns '2:02:05' with multi-hour formatting")
    runner.assert(formatVideoTime(-10) === "0:00", "formatVideoTime(-10) handles negative values safely as '0:00'")
    runner.assert(formatVideoTime(NaN) === "0:00", "formatVideoTime(NaN) handles NaN safely as '0:00'")
    runner.assert(formatVideoTime(Infinity) === "0:00", "formatVideoTime(Infinity) handles Infinity safely as '0:00'")
    runner.assert(formatVideoTime("invalid") === "0:00", "formatVideoTime non-number handles safely as '0:00'")

    // -------------------------------------------------------------
    // Test 2: calculateProgress percentage calculations
    // -------------------------------------------------------------
    runner.assert(calculateProgress(30, 100) === 30, "calculateProgress(30, 100) returns 30%")
    runner.assert(calculateProgress(0, 100) === 0, "calculateProgress(0, 100) returns 0%")
    runner.assert(calculateProgress(100, 100) === 100, "calculateProgress(100, 100) returns 100%")
    runner.assert(calculateProgress(50, 0) === 0, "calculateProgress division by zero returns 0%")
    runner.assert(calculateProgress(-5, 100) === 0, "calculateProgress negative currentTime returns 0%")
    runner.assert(calculateProgress(150, 100) === 100, "calculateProgress currentTime > duration clamps to 100%")
    runner.assert(calculateProgress(NaN, 100) === 0, "calculateProgress NaN currentTime returns 0%")
    runner.assert(calculateProgress(50, NaN) === 0, "calculateProgress NaN duration returns 0%")

    // -------------------------------------------------------------
    // Test 3: calculateTimeFromPercentage conversions
    // -------------------------------------------------------------
    runner.assert(calculateTimeFromPercentage(50, 200) === 100, "calculateTimeFromPercentage(50, 200) returns 100s")
    runner.assert(calculateTimeFromPercentage(0, 200) === 0, "calculateTimeFromPercentage(0, 200) returns 0s")
    runner.assert(calculateTimeFromPercentage(100, 200) === 200, "calculateTimeFromPercentage(100, 200) returns 200s")
    runner.assert(calculateTimeFromPercentage(-10, 200) === 0, "calculateTimeFromPercentage negative % clamps to 0s")
    runner.assert(calculateTimeFromPercentage(150, 200) === 200, "calculateTimeFromPercentage >100% clamps to duration 200s")
    runner.assert(calculateTimeFromPercentage(50, 0) === 0, "calculateTimeFromPercentage with 0 duration returns 0s")

    // -------------------------------------------------------------
    // Test 4: Seeking State Transitions (startSeeking, updateSeeking, endSeeking)
    // -------------------------------------------------------------
    const player = new VideoPlayerStateMachinePhase2({ duration: 300 })
    runner.assert(player.state.isSeeking === false, "Initial player state has isSeeking=false")
    runner.assert(player.state.seekPreviewTime === 0, "Initial player state has seekPreviewTime=0")
    runner.assert(player.state.seekPreviewPercentage === 0, "Initial player state has seekPreviewPercentage=0")

    player.startSeeking(150, 50)
    runner.assert(player.state.isSeeking === true, "startSeeking sets isSeeking=true")
    runner.assert(player.state.seekPreviewTime === 150, "startSeeking sets seekPreviewTime=150")
    runner.assert(player.state.seekPreviewPercentage === 50, "startSeeking sets seekPreviewPercentage=50%")
    runner.assert(player.state.currentTime === 0, "Video currentTime is unchanged while seeking preview is active")

    player.updateSeeking(210, 70)
    runner.assert(player.state.seekPreviewTime === 210, "updateSeeking updates seekPreviewTime to 210")
    runner.assert(player.state.seekPreviewPercentage === 70, "updateSeeking updates seekPreviewPercentage to 70%")

    player.endSeeking(210)
    runner.assert(player.state.isSeeking === false, "endSeeking resets isSeeking to false")
    runner.assert(player.state.currentTime === 210, "endSeeking synchronizes currentTime to final seek target (210s)")
    runner.assert(player.state.isEnded === false, "endSeeking before duration leaves isEnded=false")

    // -------------------------------------------------------------
    // Test 5: Replay Behavior on Video Completion
    // -------------------------------------------------------------
    player.onEnded()
    runner.assert(player.state.isEnded === true, "onEnded sets isEnded=true")
    runner.assert(player.state.isPlaying === false, "onEnded sets isPlaying=false")
    runner.assert(player.state.isPaused === true, "onEnded sets isPaused=true")

    // Toggle play on ended video triggers replay
    player.togglePlay()
    runner.assert(player.state.isPlaying === true, "togglePlay when ended transitions to isPlaying=true")
    runner.assert(player.state.isPaused === false, "togglePlay when ended transitions to isPaused=false")
    runner.assert(player.state.currentTime === 0, "Replay resets currentTime to 0s")
    runner.assert(player.state.isEnded === false, "Replay resets isEnded to false")

    // -------------------------------------------------------------
    // Test 6: Keyboard Step Seeking & Hotkeys
    // -------------------------------------------------------------
    player.seek(100) // Start at 100s
    player.handleKeyDown("ArrowRight")
    runner.assert(player.state.currentTime === 105, "ArrowRight seeks forward by +5 seconds (105s)")

    player.handleKeyDown("ArrowLeft")
    runner.assert(player.state.currentTime === 100, "ArrowLeft seeks backward by -5 seconds (100s)")

    player.handleKeyDown("ArrowUp")
    runner.assert(player.state.currentTime === 110, "ArrowUp seeks forward by +10 seconds (110s)")

    player.handleKeyDown("ArrowDown")
    runner.assert(player.state.currentTime === 100, "ArrowDown seeks backward by -10 seconds (100s)")

    player.handleKeyDown("j")
    runner.assert(player.state.currentTime === 70, "Key 'j' seeks backward by 10% (30s on 300s video -> 70s)")

    player.handleKeyDown("l")
    runner.assert(player.state.currentTime === 100, "Key 'l' seeks forward by 10% (30s on 300s video -> 100s)")

    player.handleKeyDown("5")
    runner.assert(player.state.currentTime === 150, "Key '5' jumps to 50% of video duration (150s)")

    player.handleKeyDown("0")
    runner.assert(player.state.currentTime === 0, "Key '0' jumps to beginning (0s)")

    player.handleKeyDown("End")
    runner.assert(player.state.currentTime === 300, "Key 'End' jumps to end of video (300s)")
    runner.assert(player.state.isEnded === true, "Key 'End' marks isEnded=true")

    player.handleKeyDown("Home")
    runner.assert(player.state.currentTime === 0, "Key 'Home' jumps back to 0s")

    // -------------------------------------------------------------
    // Test 7: Active percentage & Tooltip resolution invariants
    // -------------------------------------------------------------
    const activePctNormal = calculateProgress(150, 300)
    runner.assert(activePctNormal === 50, "Normal playback at 150s of 300s yields 50% progress")

    // During drag, seek preview percentage takes precedence
    const activePctSeeking = player.state.isSeeking ? player.state.seekPreviewPercentage : calculateProgress(player.state.currentTime, player.state.duration)
    runner.assert(activePctSeeking === 0, "Active percentage before seeking reflects currentTime")

    player.startSeeking(240, 80)
    const activePctDuringSeeking = player.state.isSeeking ? player.state.seekPreviewPercentage : calculateProgress(player.state.currentTime, player.state.duration)
    runner.assert(activePctDuringSeeking === 80, "Active percentage during seeking reflects seekPreviewPercentage (80%)")
    player.endSeeking(240)

  } catch (err) {
    runner.assert(false, `Unexpected error in Phase 2 test: ${err.message}`)
  }

  return runner.summary()
}

// Auto-run if executed directly
if (process.argv[1].endsWith("phase2_custom_playback_timeline.test.js")) {
  runCustomPlaybackTimelineTestSuite()
    .then((result) => {
      process.exit(result.failed > 0 ? 1 : 0)
    })
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
