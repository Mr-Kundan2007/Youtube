import { TestRunner } from "./helpers/testEnv.js"

// Constants matching src/components/player/VideoPlayerContext.tsx
const SUPPORTED_PLAYBACK_RATES = [0.5, 1, 1.25, 1.5, 2]
const DEFAULT_VOLUME_STEP = 0.05

function formatPlaybackRate(rate) {
  return rate === 1 ? "1×" : `${rate}×`
}

function getVolumeIconName(volume, isMuted) {
  const isEffectiveMuted = isMuted || volume === 0
  if (isEffectiveMuted) return "VolumeX"
  if (volume < 0.4) return "Volume"
  if (volume < 0.7) return "Volume1"
  return "Volume2"
}

function calculateVolumeFromOffset(offsetX, width) {
  if (!width || width <= 0 || isNaN(width)) return 0
  if (typeof offsetX !== "number" || isNaN(offsetX)) return 0
  const clampedOffset = Math.max(0, Math.min(offsetX, width))
  return Number((clampedOffset / width).toFixed(4))
}

// Phase 3 Audio & Speed State Machine Simulator
class VideoPlayerStateMachinePhase3 {
  constructor(options = {}) {
    this.state = {
      isPlaying: false,
      isPaused: true,
      volume: options.initialVolume !== undefined ? options.initialVolume : 1,
      isMuted: options.initialMuted || false,
      playbackRate: options.initialPlaybackRate || 1,
      currentTime: 0,
      duration: options.duration || 100,
    }
    this.previousVolume = options.initialVolume > 0 ? options.initialVolume : 0.7
  }

  setVolume(volume) {
    if (typeof volume !== "number" || isNaN(volume)) return
    const clamped = Math.max(0, Math.min(1, Number(volume.toFixed(4))))
    if (clamped > 0) {
      this.state.isMuted = false
      this.previousVolume = clamped
    } else {
      this.state.isMuted = true
    }
    this.state.volume = clamped
  }

  toggleMute() {
    const isCurrentlyMuted = this.state.isMuted || this.state.volume === 0
    if (isCurrentlyMuted) {
      // Unmute: restore previous volume or fallback to 0.7
      const restored = this.previousVolume > 0 ? this.previousVolume : 0.7
      this.state.isMuted = false
      if (this.state.volume === 0) {
        this.state.volume = restored
      }
    } else {
      // Mute: store previous volume
      if (this.state.volume > 0) {
        this.previousVolume = this.state.volume
      }
      this.state.isMuted = true
    }
  }

  increaseVolume(step = DEFAULT_VOLUME_STEP) {
    const currentEffective = this.state.isMuted ? 0 : this.state.volume
    const newVolume = Math.min(1, Number((currentEffective + step).toFixed(4)))
    this.setVolume(newVolume)
  }

  decreaseVolume(step = DEFAULT_VOLUME_STEP) {
    const currentEffective = this.state.isMuted ? 0 : this.state.volume
    const newVolume = Math.max(0, Number((currentEffective - step).toFixed(4)))
    this.setVolume(newVolume)
  }

  setPlaybackRate(rate) {
    if (
      typeof rate !== "number" ||
      isNaN(rate) ||
      !isFinite(rate) ||
      rate <= 0 ||
      !SUPPORTED_PLAYBACK_RATES.includes(rate)
    ) {
      return
    }
    this.state.playbackRate = rate
  }

  // Simulate external volumechange event from HTML5 video element
  onVolumeChange(elementVolume, elementMuted) {
    this.state.volume = elementVolume
    this.state.isMuted = elementMuted
  }

  // Simulate external ratechange event from HTML5 video element
  onRateChange(elementPlaybackRate) {
    this.state.playbackRate = elementPlaybackRate
  }

  handleKeyDown(key) {
    const effectiveVolume = this.state.isMuted ? 0 : this.state.volume
    const step = DEFAULT_VOLUME_STEP
    const bigStep = step * 2

    switch (key) {
      case "ArrowUp":
      case "ArrowRight":
        this.setVolume(Math.min(1, effectiveVolume + step))
        break
      case "ArrowDown":
      case "ArrowLeft":
        this.setVolume(Math.max(0, effectiveVolume - step))
        break
      case "PageUp":
        this.setVolume(Math.min(1, effectiveVolume + bigStep))
        break
      case "PageDown":
        this.setVolume(Math.max(0, effectiveVolume - bigStep))
        break
      case "Home":
        this.setVolume(0)
        break
      case "End":
        this.setVolume(1)
        break
      case "m":
      case "M":
        this.toggleMute()
        break
    }
  }
}

export async function runCustomAudioPlaybackSpeedTestSuite() {
  const runner = new TestRunner("Phase 3: Custom Volume, Mute & Playback Speed Controls")
  runner.start()

  try {
    // -------------------------------------------------------------
    // Test 1: Volume Calculation & Precision Clamping
    // -------------------------------------------------------------
    runner.assert(calculateVolumeFromOffset(50, 100) === 0.5, "calculateVolumeFromOffset(50, 100) yields 0.5 (50%)")
    runner.assert(calculateVolumeFromOffset(0, 100) === 0, "calculateVolumeFromOffset(0, 100) yields 0.0 (0%)")
    runner.assert(calculateVolumeFromOffset(100, 100) === 1, "calculateVolumeFromOffset(100, 100) yields 1.0 (100%)")
    runner.assert(calculateVolumeFromOffset(75, 100) === 0.75, "calculateVolumeFromOffset(75, 100) yields 0.75 (75%)")
    runner.assert(calculateVolumeFromOffset(25, 100) === 0.25, "calculateVolumeFromOffset(25, 100) yields 0.25 (25%)")
    runner.assert(calculateVolumeFromOffset(150, 100) === 1, "calculateVolumeFromOffset beyond slider width clamps to 1.0")
    runner.assert(calculateVolumeFromOffset(-20, 100) === 0, "calculateVolumeFromOffset negative offset clamps to 0.0")
    runner.assert(calculateVolumeFromOffset(50, 0) === 0, "calculateVolumeFromOffset with 0 width safely returns 0")
    runner.assert(calculateVolumeFromOffset(NaN, 100) === 0, "calculateVolumeFromOffset with NaN offset safely returns 0")

    // -------------------------------------------------------------
    // Test 2: Volume State & Slider Setting
    // -------------------------------------------------------------
    const player = new VideoPlayerStateMachinePhase3({ initialVolume: 1.0 })
    runner.assert(player.state.volume === 1.0, "Initial volume starts at 1.0 (100%)")
    runner.assert(player.state.isMuted === false, "Initial state is unmuted")

    player.setVolume(0.25)
    runner.assert(player.state.volume === 0.25, "Set volume to 25% sets state.volume to 0.25")
    runner.assert(player.state.isMuted === false, "Setting volume to 0.25 leaves isMuted=false")

    player.setVolume(0.5)
    runner.assert(player.state.volume === 0.5, "Set volume to 50% sets state.volume to 0.5")

    player.setVolume(0.75)
    runner.assert(player.state.volume === 0.75, "Set volume to 75% sets state.volume to 0.75")

    player.setVolume(1.0)
    runner.assert(player.state.volume === 1.0, "Set volume to 100% sets state.volume to 1.0")

    player.setVolume(1.5)
    runner.assert(player.state.volume === 1.0, "Set volume > 1 clamps to 1.0")

    player.setVolume(-0.5)
    runner.assert(player.state.volume === 0, "Set volume < 0 clamps to 0.0")
    runner.assert(player.state.isMuted === true, "Setting volume to 0 automatically marks isMuted=true")

    // -------------------------------------------------------------
    // Test 3: Mute, Unmute & Previous Volume Memory
    // -------------------------------------------------------------
    const mutePlayer = new VideoPlayerStateMachinePhase3({ initialVolume: 0.8 })
    runner.assert(mutePlayer.state.volume === 0.8, "Player starts with volume 0.8")
    runner.assert(mutePlayer.previousVolume === 0.8, "previousVolume initialized to 0.8")

    // Mute video
    mutePlayer.toggleMute()
    runner.assert(mutePlayer.state.isMuted === true, "toggleMute sets isMuted=true")
    runner.assert(mutePlayer.previousVolume === 0.8, "previousVolume persists as 0.8 during mute")

    // Unmute video
    mutePlayer.toggleMute()
    runner.assert(mutePlayer.state.isMuted === false, "toggleMute when muted restores isMuted=false")
    runner.assert(mutePlayer.state.volume === 0.8, "toggleMute when muted restores previous volume 0.8")

    // Mute when volume is 100%
    mutePlayer.setVolume(1.0)
    mutePlayer.toggleMute()
    runner.assert(mutePlayer.state.isMuted === true, "Muting at 100% sets isMuted=true")
    mutePlayer.toggleMute()
    runner.assert(mutePlayer.state.isMuted === false, "Unmuting restores 100% volume")
    runner.assert(mutePlayer.state.volume === 1.0, "Restored volume matches 1.0")

    // Mute when volume is 50%
    mutePlayer.setVolume(0.5)
    mutePlayer.toggleMute()
    runner.assert(mutePlayer.state.isMuted === true, "Muting at 50% sets isMuted=true")
    mutePlayer.toggleMute()
    runner.assert(mutePlayer.state.isMuted === false && mutePlayer.state.volume === 0.5, "Unmuting restores exactly 50% volume (0.5)")

    // Volume 0 Behavior & Unmute
    mutePlayer.setVolume(0)
    runner.assert(mutePlayer.state.isMuted === true, "Setting volume to 0 automatically engages mute")
    mutePlayer.toggleMute()
    runner.assert(mutePlayer.state.isMuted === false, "Unmuting when volume was 0 clears isMuted")
    runner.assert(mutePlayer.state.volume > 0, "Unmuting when volume was 0 restores previously cached volume")

    // Setting volume > 0 while muted automatically unmuts
    mutePlayer.toggleMute()
    runner.assert(mutePlayer.state.isMuted === true, "Player is muted")
    mutePlayer.setVolume(0.65)
    runner.assert(mutePlayer.state.isMuted === false, "Setting volume > 0 while muted automatically clears isMuted")
    runner.assert(mutePlayer.state.volume === 0.65, "Volume updated to 0.65")

    // -------------------------------------------------------------
    // Test 4: Dynamic Volume Icon Thresholds
    // -------------------------------------------------------------
    runner.assert(getVolumeIconName(0.8, false) === "Volume2", "Volume >= 0.7 unmuted renders Volume2 (High)")
    runner.assert(getVolumeIconName(0.55, false) === "Volume1", "0.4 <= Volume < 0.7 unmuted renders Volume1 (Medium)")
    runner.assert(getVolumeIconName(0.25, false) === "Volume", "0 < Volume < 0.4 unmuted renders Volume (Low)")
    runner.assert(getVolumeIconName(0, false) === "VolumeX", "Volume === 0 renders VolumeX (Muted)")
    runner.assert(getVolumeIconName(0.9, true) === "VolumeX", "Volume 0.9 with isMuted=true renders VolumeX (Muted)")

    // -------------------------------------------------------------
    // Test 5: Playback Speed Controls & Validation
    // -------------------------------------------------------------
    const speedPlayer = new VideoPlayerStateMachinePhase3()
    runner.assert(speedPlayer.state.playbackRate === 1.0, "Initial playback rate defaults to 1×")

    // Set valid speeds
    speedPlayer.setPlaybackRate(0.5)
    runner.assert(speedPlayer.state.playbackRate === 0.5, "Sets speed to 0.5×")

    speedPlayer.setPlaybackRate(1.25)
    runner.assert(speedPlayer.state.playbackRate === 1.25, "Sets speed to 1.25×")

    speedPlayer.setPlaybackRate(1.5)
    runner.assert(speedPlayer.state.playbackRate === 1.5, "Sets speed to 1.5×")

    speedPlayer.setPlaybackRate(2.0)
    runner.assert(speedPlayer.state.playbackRate === 2.0, "Sets speed to 2×")

    speedPlayer.setPlaybackRate(1.0)
    runner.assert(speedPlayer.state.playbackRate === 1.0, "Sets speed back to 1× (Normal)")

    // Reject invalid rates safely
    speedPlayer.setPlaybackRate(0)
    runner.assert(speedPlayer.state.playbackRate === 1.0, "Rejects playbackRate=0 safely without change")

    speedPlayer.setPlaybackRate(-1.5)
    runner.assert(speedPlayer.state.playbackRate === 1.0, "Rejects negative playbackRate safely without change")

    speedPlayer.setPlaybackRate(NaN)
    runner.assert(speedPlayer.state.playbackRate === 1.0, "Rejects NaN playbackRate safely without change")

    speedPlayer.setPlaybackRate(Infinity)
    runner.assert(speedPlayer.state.playbackRate === 1.0, "Rejects Infinity playbackRate safely without change")

    speedPlayer.setPlaybackRate(3.0)
    runner.assert(speedPlayer.state.playbackRate === 1.0, "Rejects unsupported rate 3.0× safely without change")

    speedPlayer.setPlaybackRate(0.8)
    runner.assert(speedPlayer.state.playbackRate === 1.0, "Rejects unsupported rate 0.8× safely without change")

    // Format speed labels
    runner.assert(formatPlaybackRate(1.0) === "1×", "formatPlaybackRate(1.0) returns '1×'")
    runner.assert(formatPlaybackRate(0.5) === "0.5×", "formatPlaybackRate(0.5) returns '0.5×'")
    runner.assert(formatPlaybackRate(1.25) === "1.25×", "formatPlaybackRate(1.25) returns '1.25×'")
    runner.assert(formatPlaybackRate(1.5) === "1.5×", "formatPlaybackRate(1.5) returns '1.5×'")
    runner.assert(formatPlaybackRate(2.0) === "2×", "formatPlaybackRate(2.0) returns '2×'")

    // -------------------------------------------------------------
    // Test 6: Keyboard Step Seeking & Shortcuts
    // -------------------------------------------------------------
    const kbPlayer = new VideoPlayerStateMachinePhase3({ initialVolume: 0.5 })
    kbPlayer.handleKeyDown("ArrowUp")
    runner.assert(Math.abs(kbPlayer.state.volume - 0.55) < 0.001, "ArrowUp increments volume by +5% (to 0.55)")

    kbPlayer.handleKeyDown("ArrowRight")
    runner.assert(Math.abs(kbPlayer.state.volume - 0.60) < 0.001, "ArrowRight increments volume by +5% (to 0.60)")

    kbPlayer.handleKeyDown("ArrowDown")
    runner.assert(Math.abs(kbPlayer.state.volume - 0.55) < 0.001, "ArrowDown decrements volume by -5% (to 0.55)")

    kbPlayer.handleKeyDown("ArrowLeft")
    runner.assert(Math.abs(kbPlayer.state.volume - 0.50) < 0.001, "ArrowLeft decrements volume by -5% (to 0.50)")

    kbPlayer.handleKeyDown("PageUp")
    runner.assert(Math.abs(kbPlayer.state.volume - 0.60) < 0.001, "PageUp increments volume by +10% (to 0.60)")

    kbPlayer.handleKeyDown("PageDown")
    runner.assert(Math.abs(kbPlayer.state.volume - 0.50) < 0.001, "PageDown decrements volume by -10% (to 0.50)")

    kbPlayer.handleKeyDown("Home")
    runner.assert(kbPlayer.state.volume === 0, "Home key sets volume to 0%")
    runner.assert(kbPlayer.state.isMuted === true, "Home key engaging 0% sets isMuted=true")

    kbPlayer.handleKeyDown("End")
    runner.assert(kbPlayer.state.volume === 1.0, "End key sets volume to 100%")
    runner.assert(kbPlayer.state.isMuted === false, "End key engaging 100% unmuts")

    kbPlayer.handleKeyDown("m")
    runner.assert(kbPlayer.state.isMuted === true, "Pressing 'm' toggles mute on")

    kbPlayer.handleKeyDown("m")
    runner.assert(kbPlayer.state.isMuted === false, "Pressing 'm' toggles mute off")

    // -------------------------------------------------------------
    // Test 7: HTML5 Video Event Synchronization
    // -------------------------------------------------------------
    const syncPlayer = new VideoPlayerStateMachinePhase3({ initialVolume: 0.7 })

    // Simulate external volumechange
    syncPlayer.onVolumeChange(0.35, false)
    runner.assert(syncPlayer.state.volume === 0.35, "volumechange event updates state.volume to 0.35")
    runner.assert(syncPlayer.state.isMuted === false, "volumechange event preserves isMuted=false")

    syncPlayer.onVolumeChange(0.35, true)
    runner.assert(syncPlayer.state.isMuted === true, "volumechange event updates isMuted to true")

    // Simulate external ratechange
    syncPlayer.onRateChange(1.5)
    runner.assert(syncPlayer.state.playbackRate === 1.5, "ratechange event synchronizes state.playbackRate to 1.5")
  } catch (err) {
    runner.assert(false, `Unexpected error in Phase 3 test: ${err.message}`)
  }

  return runner.summary()
}

// Auto-run if executed directly
if (process.argv[1].endsWith("phase3_volume_playback_speed.test.js")) {
  runCustomAudioPlaybackSpeedTestSuite()
    .then((result) => {
      process.exit(result.failed > 0 ? 1 : 0)
    })
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
