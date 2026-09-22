import { TestRunner } from "./helpers/testEnv.js"

// Time formatting helpers matching timelineUtils.ts
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

function calculateRemainingTime(currentTime, duration) {
  if (
    typeof currentTime !== "number" ||
    typeof duration !== "number" ||
    isNaN(currentTime) ||
    isNaN(duration) ||
    !isFinite(duration) ||
    duration <= 0
  ) {
    return 0
  }

  const validCurrent = isNaN(currentTime) || currentTime < 0 ? 0 : currentTime
  return Math.max(0, Number((duration - validCurrent).toFixed(4)))
}

function formatRemainingTime(remainingSeconds) {
  const formatted = formatVideoTime(remainingSeconds)
  return `-${formatted}`
}

const TIME_DISPLAY_MODES = {
  CURRENT_TOTAL: "current-total",
  CURRENT_REMAINING: "current-remaining",
  CURRENT_ONLY: "current-only",
}

// Phase 4 Seeking & Time Management State Machine Simulator
class VideoPlayerStateMachinePhase4 {
  constructor(options = {}) {
    this.state = {
      isPlaying: options.isPlaying || false,
      isPaused: options.isPlaying ? false : true,
      currentTime: options.initialTime || 0,
      duration: options.duration || 100,
      isEnded: false,
      isSeeking: false,
      seekInterval: options.seekInterval || 10,
      timeDisplayMode: options.initialTimeDisplayMode || "current-total",
      seekFeedback: null,
    }
  }

  seekTo(timeInSeconds) {
    if (typeof timeInSeconds !== "number" || isNaN(timeInSeconds)) return
    const maxDur = this.state.duration || 0
    if (!Number.isFinite(maxDur)) return
    const clamped = Math.max(0, Math.min(timeInSeconds, maxDur))
    this.state.currentTime = clamped
    this.state.isEnded = maxDur > 0 && clamped >= maxDur
  }

  triggerSeekFeedback(direction, seconds) {
    this.state.seekFeedback = {
      direction,
      seconds,
      timestamp: Date.now(),
    }
  }

  clearSeekFeedback() {
    this.state.seekFeedback = null
  }

  skipBackward(seconds) {
    const interval = typeof seconds === "number" && seconds > 0 ? seconds : this.state.seekInterval
    this.triggerSeekFeedback("backward", interval)
    this.seekTo(this.state.currentTime - interval)
  }

  skipForward(seconds) {
    const interval = typeof seconds === "number" && seconds > 0 ? seconds : this.state.seekInterval
    this.triggerSeekFeedback("forward", interval)
    this.seekTo(this.state.currentTime + interval)
  }

  setTimeDisplayMode(mode) {
    this.state.timeDisplayMode = mode
  }

  toggleTimeDisplayMode() {
    if (this.state.timeDisplayMode === "current-total") {
      this.state.timeDisplayMode = "current-remaining"
    } else if (this.state.timeDisplayMode === "current-remaining") {
      this.state.timeDisplayMode = "current-only"
    } else {
      this.state.timeDisplayMode = "current-total"
    }
  }

  // Double click handler simulation: left 50% skips backward, right 50% skips forward
  handleDoubleClick(offsetX, totalWidth) {
    if (!totalWidth || totalWidth <= 0) return
    const isLeft = offsetX < totalWidth / 2
    if (isLeft) {
      this.skipBackward()
    } else {
      this.skipForward()
    }
  }

  // Simulated HTML5 video event handlers
  onSeeking() {
    this.state.isSeeking = true
  }

  onSeeked(elementCurrentTime) {
    this.state.isSeeking = false
    this.state.currentTime = elementCurrentTime
    this.state.isEnded = this.state.duration > 0 && elementCurrentTime >= this.state.duration
  }
}

export async function runCustomSeekingTimeTestSuite() {
  const runner = new TestRunner("Phase 4: Advanced Video Seeking & Complete Time Management")
  runner.start()

  try {
    // -------------------------------------------------------------
    // Test 1: Advanced seekTo boundary handling & validation
    // -------------------------------------------------------------
    const player = new VideoPlayerStateMachinePhase4({ duration: 120, initialTime: 0 })
    runner.assert(player.state.currentTime === 0, "Initial player time is 0s")

    player.seekTo(45)
    runner.assert(player.state.currentTime === 45, "seekTo(45) updates currentTime to 45s")
    runner.assert(player.state.isEnded === false, "seekTo(45) maintains isEnded=false")

    player.seekTo(150) // exceeds duration (120)
    runner.assert(player.state.currentTime === 120, "seekTo beyond duration clamps to duration (120s)")
    runner.assert(player.state.isEnded === true, "seekTo at duration marks isEnded=true")

    player.seekTo(30)
    runner.assert(player.state.currentTime === 30, "seekTo away from end updates currentTime to 30s")
    runner.assert(player.state.isEnded === false, "seekTo away from end resets isEnded to false")

    player.seekTo(-15)
    runner.assert(player.state.currentTime === 0, "seekTo negative time clamps to 0s")

    player.seekTo(NaN)
    runner.assert(player.state.currentTime === 0, "seekTo(NaN) safely rejected without state mutation")

    player.seekTo("invalid")
    runner.assert(player.state.currentTime === 0, "seekTo(non-number) safely rejected without state mutation")

    // -------------------------------------------------------------
    // Test 2: Skip Backward functionality & boundaries
    // -------------------------------------------------------------
    const backPlayer = new VideoPlayerStateMachinePhase4({ duration: 100, initialTime: 30 })

    // Skip from 30s to 20s
    backPlayer.skipBackward()
    runner.assert(backPlayer.state.currentTime === 20, "skipBackward from 30s decreases to 20s (default 10s interval)")
    runner.assert(backPlayer.state.seekFeedback !== null, "skipBackward triggers seekFeedback")
    runner.assert(backPlayer.state.seekFeedback.direction === "backward", "seekFeedback direction is 'backward'")
    runner.assert(backPlayer.state.seekFeedback.seconds === 10, "seekFeedback seconds is 10")

    // Skip from 5s to 0s (clamps at 0)
    backPlayer.seekTo(5)
    backPlayer.skipBackward()
    runner.assert(backPlayer.state.currentTime === 0, "skipBackward from 5s clamps safely at 0s")

    // Skip from 0s remains 0s
    backPlayer.skipBackward()
    runner.assert(backPlayer.state.currentTime === 0, "skipBackward from 0s remains at 0s")

    // Preserves play/pause state
    const pausedPlayer = new VideoPlayerStateMachinePhase4({ duration: 100, initialTime: 50, isPlaying: false })
    pausedPlayer.skipBackward()
    runner.assert(pausedPlayer.state.isPaused === true, "skipBackward while paused leaves player paused")
    runner.assert(pausedPlayer.state.currentTime === 40, "skipBackward while paused updates currentTime to 40s")

    const playingPlayer = new VideoPlayerStateMachinePhase4({ duration: 100, initialTime: 50, isPlaying: true })
    playingPlayer.skipBackward()
    runner.assert(playingPlayer.state.isPlaying === true, "skipBackward while playing leaves player playing")
    runner.assert(playingPlayer.state.currentTime === 40, "skipBackward while playing updates currentTime to 40s")

    // -------------------------------------------------------------
    // Test 3: Skip Forward functionality & boundaries
    // -------------------------------------------------------------
    const fwdPlayer = new VideoPlayerStateMachinePhase4({ duration: 100, initialTime: 10 })

    // Skip from 10s to 20s
    fwdPlayer.skipForward()
    runner.assert(fwdPlayer.state.currentTime === 20, "skipForward from 10s increases to 20s (default 10s interval)")
    runner.assert(fwdPlayer.state.seekFeedback !== null, "skipForward triggers seekFeedback")
    runner.assert(fwdPlayer.state.seekFeedback.direction === "forward", "seekFeedback direction is 'forward'")
    runner.assert(fwdPlayer.state.seekFeedback.seconds === 10, "seekFeedback seconds is 10")

    // Skip near end (95s on 100s video -> 100s)
    fwdPlayer.seekTo(95)
    fwdPlayer.skipForward()
    runner.assert(fwdPlayer.state.currentTime === 100, "skipForward near end clamps at duration (100s)")
    runner.assert(fwdPlayer.state.isEnded === true, "skipForward reaching duration sets isEnded=true")

    // Skip at end remains at end
    fwdPlayer.skipForward()
    runner.assert(fwdPlayer.state.currentTime === 100, "skipForward at end remains at 100s without overflow")

    // -------------------------------------------------------------
    // Test 4: Configurable Seek Interval
    // -------------------------------------------------------------
    const customIntervalPlayer = new VideoPlayerStateMachinePhase4({ duration: 100, initialTime: 50, seekInterval: 15 })
    runner.assert(customIntervalPlayer.state.seekInterval === 15, "seekInterval configured to 15s")

    customIntervalPlayer.skipForward()
    runner.assert(customIntervalPlayer.state.currentTime === 65, "skipForward with 15s interval advances from 50s to 65s")
    runner.assert(customIntervalPlayer.state.seekFeedback.seconds === 15, "seekFeedback reflects configured 15s interval")

    customIntervalPlayer.skipBackward(5) // Overriding with 5s
    runner.assert(customIntervalPlayer.state.currentTime === 60, "skipBackward with explicit 5s parameter steps back to 60s")
    runner.assert(customIntervalPlayer.state.seekFeedback.seconds === 5, "seekFeedback reflects explicit 5s parameter")

    customIntervalPlayer.skipForward(30) // Overriding with 30s
    runner.assert(customIntervalPlayer.state.currentTime === 90, "skipForward with explicit 30s parameter advances to 90s")
    runner.assert(customIntervalPlayer.state.seekFeedback.seconds === 30, "seekFeedback reflects explicit 30s parameter")

    // -------------------------------------------------------------
    // Test 5: Remaining Time Calculations & Formatting
    // -------------------------------------------------------------
    runner.assert(calculateRemainingTime(30, 100) === 70, "calculateRemainingTime(30, 100) yields 70s")
    runner.assert(calculateRemainingTime(100, 100) === 0, "calculateRemainingTime(100, 100) yields 0s")
    runner.assert(calculateRemainingTime(110, 100) === 0, "calculateRemainingTime(110, 100) clamps at 0s")
    runner.assert(calculateRemainingTime(-10, 100) === 100, "calculateRemainingTime with negative currentTime yields full duration 100s")
    runner.assert(calculateRemainingTime(50, 0) === 0, "calculateRemainingTime with 0 duration yields 0s")
    runner.assert(calculateRemainingTime(50, NaN) === 0, "calculateRemainingTime with NaN duration yields 0s")

    runner.assert(formatRemainingTime(70) === "-1:10", "formatRemainingTime(70) formats as '-1:10'")
    runner.assert(formatRemainingTime(5) === "-0:05", "formatRemainingTime(5) formats as '-0:05'")
    runner.assert(formatRemainingTime(3665) === "-1:01:05", "formatRemainingTime(3665) formats as '-1:01:05'")

    // -------------------------------------------------------------
    // Test 6: Time Display Modes & Toggling
    // -------------------------------------------------------------
    const timePlayer = new VideoPlayerStateMachinePhase4({ duration: 600, initialTime: 120 })
    runner.assert(timePlayer.state.timeDisplayMode === "current-total", "Initial timeDisplayMode defaults to 'current-total'")

    timePlayer.toggleTimeDisplayMode()
    runner.assert(timePlayer.state.timeDisplayMode === "current-remaining", "First toggle changes timeDisplayMode to 'current-remaining'")

    timePlayer.toggleTimeDisplayMode()
    runner.assert(timePlayer.state.timeDisplayMode === "current-only", "Second toggle changes timeDisplayMode to 'current-only'")

    timePlayer.toggleTimeDisplayMode()
    runner.assert(timePlayer.state.timeDisplayMode === "current-total", "Third toggle cycles back to 'current-total'")

    timePlayer.setTimeDisplayMode(TIME_DISPLAY_MODES.CURRENT_REMAINING)
    runner.assert(timePlayer.state.timeDisplayMode === "current-remaining", "setTimeDisplayMode explicitly sets mode")

    // -------------------------------------------------------------
    // Test 7: Double-Click Video Seeking Simulation
    // -------------------------------------------------------------
    const dblClickPlayer = new VideoPlayerStateMachinePhase4({ duration: 200, initialTime: 100 })

    // Click on left half (200px of 800px width = 25% < 50%) -> skip backward
    dblClickPlayer.handleDoubleClick(200, 800)
    runner.assert(dblClickPlayer.state.currentTime === 90, "Double-click on left half of video skips backward 10s (to 90s)")
    runner.assert(dblClickPlayer.state.seekFeedback.direction === "backward", "Double-click on left sets backward feedback")

    // Click on right half (600px of 800px width = 75% > 50%) -> skip forward
    dblClickPlayer.handleDoubleClick(600, 800)
    runner.assert(dblClickPlayer.state.currentTime === 100, "Double-click on right half of video skips forward 10s (to 100s)")
    runner.assert(dblClickPlayer.state.seekFeedback.direction === "forward", "Double-click on right sets forward feedback")

    // -------------------------------------------------------------
    // Test 8: Seek Feedback Clearing
    // -------------------------------------------------------------
    runner.assert(dblClickPlayer.state.seekFeedback !== null, "seekFeedback exists")
    dblClickPlayer.clearSeekFeedback()
    runner.assert(dblClickPlayer.state.seekFeedback === null, "clearSeekFeedback clears seekFeedback to null")

    // -------------------------------------------------------------
    // Test 9: HTML5 seeking / seeked Event Synchronization
    // -------------------------------------------------------------
    const syncPlayer = new VideoPlayerStateMachinePhase4({ duration: 180, initialTime: 10 })

    syncPlayer.onSeeking()
    runner.assert(syncPlayer.state.isSeeking === true, "onSeeking event marks isSeeking=true")

    syncPlayer.onSeeked(75)
    runner.assert(syncPlayer.state.isSeeking === false, "onSeeked event marks isSeeking=false")
    runner.assert(syncPlayer.state.currentTime === 75, "onSeeked event synchronizes currentTime to 75s")
    runner.assert(syncPlayer.state.isEnded === false, "onSeeked event sets isEnded=false when before duration")

    syncPlayer.onSeeked(180)
    runner.assert(syncPlayer.state.currentTime === 180, "onSeeked at duration updates currentTime to 180s")
    runner.assert(syncPlayer.state.isEnded === true, "onSeeked at duration updates isEnded to true")
  } catch (err) {
    runner.assert(false, `Unexpected error in Phase 4 test: ${err.message}`)
  }

  return runner.summary()
}

// Auto-run if executed directly
if (process.argv[1].endsWith("phase4_advanced_seeking_time.test.js")) {
  runCustomSeekingTimeTestSuite()
    .then((result) => {
      process.exit(result.failed > 0 ? 1 : 0)
    })
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
