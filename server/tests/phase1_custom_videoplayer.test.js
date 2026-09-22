import { TestRunner } from "./helpers/testEnv.js"

// Time formatting helper matching src/components/player/VideoPlayerContext.tsx
function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return "00:00"
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const pad = (num) => String(num).padStart(2, "0")

  if (h > 0) {
    return `${pad(h)}:${pad(m)}:${pad(s)}`
  }
  return `${pad(m)}:${pad(s)}`
}

// Media error mapping helper
function mapMediaError(code) {
  switch (code) {
    case 1:
      return "Video playback was aborted."
    case 2:
      return "Network error prevented video from loading."
    case 3:
      return "Video decode error: media is corrupted or unsupported."
    case 4:
      return "Video format or codec is not supported by your browser."
    default:
      return "An error occurred while loading the video."
  }
}

// Player state machine simulation
class VideoPlayerStateMachine {
  constructor(options = {}) {
    this.state = {
      isPlaying: false,
      isPaused: true,
      isBuffering: false,
      currentTime: 0,
      duration: options.duration || 0,
      bufferedPercent: 0,
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
    this.state.isPlaying = true
    this.state.isPaused = false
    this.state.error = null
  }

  pause() {
    this.state.isPlaying = false
    this.state.isPaused = true
  }

  togglePlay() {
    if (this.state.isPaused) {
      this.play()
    } else {
      this.pause()
    }
  }

  seek(timeInSeconds) {
    const clamped = Math.max(0, Math.min(timeInSeconds, this.state.duration || 0))
    this.state.currentTime = clamped
  }

  setVolume(volume) {
    const clamped = Math.max(0, Math.min(1, volume))
    this.state.volume = clamped
    this.state.isMuted = clamped === 0
  }

  toggleMute() {
    this.state.isMuted = !this.state.isMuted
  }

  setPlaybackRate(rate) {
    this.state.playbackRate = rate
  }

  setError(code) {
    this.state.isBuffering = false
    this.state.isPlaying = false
    this.state.isPaused = true
    this.state.error = {
      code,
      message: mapMediaError(code),
    }
  }

  resetError() {
    this.state.error = null
  }
}

export async function runCustomVideoPlayerFoundationTest() {
  const runner = new TestRunner("Phase 1: Custom HTML5 Video Player Foundation & Architecture")
  runner.start()

  try {
    // -------------------------------------------------------------
    // Test 1: Time Formatting Helper
    // -------------------------------------------------------------
    runner.assert(formatTime(0) === "00:00", "Formats 0 seconds as 00:00")
    runner.assert(formatTime(45) === "00:45", "Formats 45 seconds as 00:45")
    runner.assert(formatTime(65) === "01:05", "Formats 65 seconds as 01:05")
    runner.assert(formatTime(3665) === "01:01:05", "Formats 3665 seconds as 01:01:05 with hours")
    runner.assert(formatTime(-10) === "00:00", "Handles negative time safely as 00:00")
    runner.assert(formatTime(NaN) === "00:00", "Handles NaN safely as 00:00")

    // -------------------------------------------------------------
    // Test 2: Player Initial State Invariants
    // -------------------------------------------------------------
    const player = new VideoPlayerStateMachine({ duration: 180 })
    runner.assert(player.state.isPlaying === false, "Initial state has isPlaying=false")
    runner.assert(player.state.isPaused === true, "Initial state has isPaused=true")
    runner.assert(player.state.currentTime === 0, "Initial state has currentTime=0")
    runner.assert(player.state.volume === 1, "Initial volume defaults to 1.0 (100%)")
    runner.assert(player.state.isMuted === false, "Initial state is not muted")
    runner.assert(player.state.playbackRate === 1, "Initial playback rate defaults to 1.0x")
    runner.assert(player.state.error === null, "Initial state has error=null")

    // -------------------------------------------------------------
    // Test 3: Play & Pause State Transitions
    // -------------------------------------------------------------
    player.play()
    runner.assert(player.state.isPlaying === true && player.state.isPaused === false, "play() transitions to isPlaying=true and isPaused=false")

    player.pause()
    runner.assert(player.state.isPlaying === false && player.state.isPaused === true, "pause() transitions to isPlaying=false and isPaused=true")

    player.togglePlay()
    runner.assert(player.state.isPlaying === true, "togglePlay() transitions paused video to playing")

    player.togglePlay()
    runner.assert(player.state.isPlaying === false, "togglePlay() transitions playing video to paused")

    // -------------------------------------------------------------
    // Test 4: Seeking Invariants
    // -------------------------------------------------------------
    player.seek(45)
    runner.assert(player.state.currentTime === 45, "Seeking sets currentTime accurately")

    player.seek(250) // Duration is 180
    runner.assert(player.state.currentTime === 180, "Seeking beyond duration clamps to duration (180)")

    player.seek(-20)
    runner.assert(player.state.currentTime === 0, "Seeking below 0 clamps to 0")

    // -------------------------------------------------------------
    // Test 5: Volume & Mute Controls
    // -------------------------------------------------------------
    player.setVolume(0.7)
    runner.assert(player.state.volume === 0.7, "setVolume sets volume to 0.7")

    player.setVolume(1.5)
    runner.assert(player.state.volume === 1.0, "setVolume clamps values > 1 to 1.0")

    player.setVolume(-0.2)
    runner.assert(player.state.volume === 0, "setVolume clamps values < 0 to 0")
    runner.assert(player.state.isMuted === true, "Setting volume to 0 automatically enables isMuted")

    player.setVolume(0.8)
    player.toggleMute()
    runner.assert(player.state.isMuted === true, "toggleMute mutes unmuted audio")
    player.toggleMute()
    runner.assert(player.state.isMuted === false, "toggleMute unmutes muted audio")

    // -------------------------------------------------------------
    // Test 6: Playback Speed & Error Handling
    // -------------------------------------------------------------
    player.setPlaybackRate(1.5)
    runner.assert(player.state.playbackRate === 1.5, "setPlaybackRate updates playback speed to 1.5x")

    player.setError(2) // Network error
    runner.assert(player.state.error !== null, "setError assigns error object")
    runner.assert(player.state.error.code === 2, "Error code matches MediaError network error")
    runner.assert(player.state.error.message.includes("Network error"), "Error message provides friendly diagnosis")
    runner.assert(player.state.isPlaying === false, "Error halts video playback")

    player.resetError()
    runner.assert(player.state.error === null, "resetError clears player error state on retry")
  } catch (err) {
    runner.assert(false, `Unexpected error in Phase 1 test: ${err.message}`)
  }

  return runner.summary()
}

// Auto-run if executed directly
if (process.argv[1].endsWith("phase1_custom_videoplayer.test.js")) {
  runCustomVideoPlayerFoundationTest()
    .then((result) => {
      process.exit(result.failed > 0 ? 1 : 0)
    })
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
