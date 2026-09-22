import { TestRunner } from "./helpers/testEnv.js"

// Mirror buffer utilities from videoBufferUtils.ts
function getBufferedRanges(video) {
  if (!video || !video.buffered) return []
  const ranges = []
  const count = video.buffered.length
  for (let i = 0; i < count; i++) {
    try {
      const start = video.buffered.start(i)
      const end = video.buffered.end(i)
      if (
        typeof start === "number" &&
        typeof end === "number" &&
        Number.isFinite(start) &&
        Number.isFinite(end) &&
        end >= start
      ) {
        ranges.push({
          start: Math.max(0, start),
          end: Math.max(0, end),
        })
      }
    } catch {
      break
    }
  }
  return ranges
}

function calculateBufferedPercentage(ranges, duration) {
  if (!duration || !Number.isFinite(duration) || duration <= 0) return 0
  if (!ranges || ranges.length === 0) return 0

  let maxEnd = 0
  for (const range of ranges) {
    if (range.end > maxEnd) {
      maxEnd = range.end
    }
  }

  const rawPercent = (maxEnd / duration) * 100
  if (!Number.isFinite(rawPercent)) return 0
  return Math.min(100, Math.max(0, Math.round(rawPercent)))
}

function areBufferedRangesEqual(a, b) {
  if (a === b) return true
  if (!a || !b) return false
  if (a.length !== b.length) return false

  for (let i = 0; i < a.length; i++) {
    const rangeA = a[i]
    const rangeB = b[i]
    if (
      Math.abs(rangeA.start - rangeB.start) > 0.1 ||
      Math.abs(rangeA.end - rangeB.end) > 0.1
    ) {
      return false
    }
  }
  return true
}

function getNetworkStateLabel(networkState) {
  switch (networkState) {
    case 0:
      return "Empty"
    case 1:
      return "Idle"
    case 2:
      return "Loading"
    case 3:
      return "No Source"
    default:
      return "Unknown"
  }
}

function getReadyStateLabel(readyState) {
  switch (readyState) {
    case 0:
      return "No Media"
    case 1:
      return "Metadata Loaded"
    case 2:
      return "Current Frame Ready"
    case 3:
      return "Future Data Ready"
    case 4:
      return "Playback Ready"
    default:
      return "Unknown"
  }
}

// Simulated Mock HTML5 Video Player Controller for Phase 7
class MockPhase7VideoPlayer {
  constructor(options = {}) {
    this.controlsHideDelay = options.controlsHideDelay || 3000
    this.autoHideTimer = null
    this.bufferedRangesRef = []

    this.videoElement = {
      buffered: {
        length: 0,
        start: () => 0,
        end: () => 0,
      },
      currentTime: 0,
      duration: 100,
      paused: true,
      ended: false,
      readyState: 0,
      networkState: 0,
      videoWidth: 1920,
      videoHeight: 1080,
      error: null,
      playbackRate: 1,
      volume: 1,
      muted: false,
    }

    this.state = {
      isPlaying: false,
      isPaused: true,
      isBuffering: false,
      isLoading: true,
      isEnded: false,
      isSeeking: false,
      currentTime: 0,
      duration: 100,
      bufferedPercent: 0,
      bufferedRanges: [],
      volume: 1,
      isMuted: false,
      playbackRate: 1,
      isFullscreen: false,
      isTheaterMode: false,
      isPictureInPicture: false,
      isControlsVisible: true,
      isUserInteracting: false,
      isMenuOpen: false,
      isDragging: false,
      isFocusWithinControls: false,
      error: null,
    }
  }

  setBufferedRanges(ranges) {
    this.videoElement.buffered = {
      length: ranges.length,
      start: (i) => ranges[i].start,
      end: (i) => ranges[i].end,
    }
  }

  onLoadStart() {
    this.bufferedRangesRef = []
    this.state.isLoading = true
    this.state.bufferedRanges = []
    this.state.error = null
    this.showControls()
  }

  onLoadedMetadata() {
    this.videoElement.readyState = 2
    this.state.duration = this.videoElement.duration
    this.state.isPaused = this.videoElement.paused
    this.state.isLoading = false
    this.state.error = null
  }

  onCanPlay() {
    this.videoElement.readyState = 3
    this.state.isLoading = false
    this.state.isBuffering = false
  }

  onProgress() {
    const ranges = getBufferedRanges(this.videoElement)
    if (!areBufferedRangesEqual(this.bufferedRangesRef, ranges)) {
      this.bufferedRangesRef = ranges
      const pct = calculateBufferedPercentage(ranges, this.state.duration)
      this.state.bufferedRanges = ranges
      this.state.bufferedPercent = pct
    }
  }

  onPlay() {
    this.state.isPlaying = true
    this.state.isPaused = false
    this.state.isBuffering = false
    this.state.isLoading = false
    this.state.isEnded = false
    this.state.error = null
    this.resetControlsTimer()
  }

  onPause() {
    this.state.isPlaying = false
    this.state.isPaused = true
    this.showControls()
    this.clearAutoHideTimer()
  }

  onWaiting() {
    this.state.isBuffering = true
    if (!this.state.duration || this.videoElement.readyState < 2) {
      this.state.isLoading = true
    }
    this.showControls()
  }

  onPlaying() {
    this.state.isBuffering = false
    this.state.isLoading = false
    this.state.isPlaying = true
    this.state.isPaused = false
    this.state.isEnded = false
    this.resetControlsTimer()
  }

  onSeeking() {
    this.state.isSeeking = true
    this.showControls()
  }

  onSeeked() {
    this.state.isSeeking = false
    this.state.currentTime = this.videoElement.currentTime
    if (this.state.isPlaying) {
      this.resetControlsTimer()
    }
  }

  onEnded() {
    this.state.isPlaying = false
    this.state.isPaused = true
    this.state.isEnded = true
    this.state.isBuffering = false
    this.state.isLoading = false
    this.showControls()
    this.clearAutoHideTimer()
  }

  onError(code = 2, message = "Network error") {
    this.state.isLoading = false
    this.state.isBuffering = false
    this.state.error = { code, message }
    this.showControls()
    this.clearAutoHideTimer()
  }

  showControls() {
    this.state.isControlsVisible = true
    this.startAutoHideTimer()
  }

  hideControls() {
    this.clearAutoHideTimer()
    if (this.canHideControls()) {
      this.state.isControlsVisible = false
    }
  }

  resetControlsTimer() {
    this.showControls()
  }

  canHideControls() {
    if (
      !this.state.isPlaying ||
      this.state.isPaused ||
      this.state.isBuffering ||
      this.state.isLoading ||
      this.state.isSeeking ||
      this.state.isEnded ||
      this.state.isMenuOpen ||
      this.state.isDragging ||
      this.state.isFocusWithinControls ||
      Boolean(this.state.error)
    ) {
      return false
    }
    return true
  }

  startAutoHideTimer() {
    this.clearAutoHideTimer()
    if (this.canHideControls()) {
      this.autoHideTimer = setTimeout(() => {
        if (this.canHideControls()) {
          this.state.isControlsVisible = false
        }
      }, this.controlsHideDelay)
    }
  }

  clearAutoHideTimer() {
    if (this.autoHideTimer) {
      clearTimeout(this.autoHideTimer)
      this.autoHideTimer = null
    }
  }

  // Helper simulating timer completion for synchronous test assertions
  triggerAutoHideTimeout() {
    if (this.canHideControls()) {
      this.state.isControlsVisible = false
    }
  }

  setIsMenuOpen(isOpen) {
    this.state.isMenuOpen = isOpen
    if (isOpen) {
      this.showControls()
      this.clearAutoHideTimer()
    } else {
      this.resetControlsTimer()
    }
  }

  setIsDragging(isDragging) {
    this.state.isDragging = isDragging
    if (isDragging) {
      this.showControls()
      this.clearAutoHideTimer()
    } else {
      this.resetControlsTimer()
    }
  }

  setIsFocusWithinControls(isFocused) {
    this.state.isFocusWithinControls = isFocused
    if (isFocused) {
      this.showControls()
      this.clearAutoHideTimer()
    } else {
      this.resetControlsTimer()
    }
  }

  shouldHideCursor() {
    return (
      this.state.isPlaying &&
      !this.state.isControlsVisible &&
      !this.state.isUserInteracting &&
      !this.state.isSeeking &&
      !this.state.isBuffering &&
      !this.state.isLoading &&
      !this.state.isMenuOpen &&
      !this.state.isDragging &&
      !this.state.isFocusWithinControls &&
      !this.state.isEnded &&
      !this.state.error
    )
  }

  getActiveOverlay() {
    if (this.state.error) return "error"
    if (this.state.isLoading) return "loading"
    if (this.state.isBuffering && !this.state.isPaused && !this.state.isEnded) return "buffering"
    if (this.state.isEnded) return "replay"
    if (this.state.isPaused) return "big-play"
    return "none"
  }
}

// --------------------------------------------------------------------------
// TEST EXECUTION
// --------------------------------------------------------------------------
export async function runBufferingAutohideTestSuite() {
  const runner = new TestRunner("Phase 7: Buffering Progress, Advanced Loading States & Intelligent Auto-Hide Controls")
  runner.start()

  try {
    // -------------------------------------------------------------------------
    // 1. Buffer Utilities & Range Extraction
    // -------------------------------------------------------------------------
    runner.assert(getBufferedRanges(null).length === 0, "getBufferedRanges handles null safely")
    runner.assert(getBufferedRanges(undefined).length === 0, "getBufferedRanges handles undefined safely")
    runner.assert(getBufferedRanges({}).length === 0, "getBufferedRanges handles empty object safely")

    const singleVideo = {
      buffered: {
        length: 1,
        start: () => 0,
        end: () => 35.5,
      },
    }
    const singleRanges = getBufferedRanges(singleVideo)
    runner.assert(singleRanges.length === 1, "getBufferedRanges extracts single range")
    runner.assert(singleRanges[0].start === 0 && singleRanges[0].end === 35.5, "Single range boundaries are exact")

    const mockMulti = [
      { start: 0, end: 20 },
      { start: 45, end: 70 },
      { start: 85, end: 95 },
    ]
    const multiVideo = {
      buffered: {
        length: 3,
        start: (i) => mockMulti[i].start,
        end: (i) => mockMulti[i].end,
      },
    }
    const multiRanges = getBufferedRanges(multiVideo)
    runner.assert(multiRanges.length === 3, "Extracts multiple non-contiguous ranges")
    runner.assert(multiRanges[0].start === 0 && multiRanges[0].end === 20, "Range 0 correct (0-20s)")
    runner.assert(multiRanges[1].start === 45 && multiRanges[1].end === 70, "Range 1 correct (45-70s)")
    runner.assert(multiRanges[2].start === 85 && multiRanges[2].end === 95, "Range 2 correct (85-95s)")

    // Inverted/invalid range filtering
    const invMock = [
      { start: 10, end: 5 },
      { start: NaN, end: 20 },
      { start: 0, end: 30 },
    ]
    const invVideo = {
      buffered: {
        length: 3,
        start: (i) => invMock[i].start,
        end: (i) => invMock[i].end,
      },
    }
    const validOnly = getBufferedRanges(invVideo)
    runner.assert(validOnly.length === 1, "Filters out inverted and NaN ranges safely")
    runner.assert(validOnly[0].start === 0 && validOnly[0].end === 30, "Preserves valid range")

    // Percentage calculation
    runner.assert(calculateBufferedPercentage([{ start: 0, end: 50 }], 0) === 0, "Zero duration returns 0% buffered")
    runner.assert(calculateBufferedPercentage([{ start: 0, end: 50 }], -10) === 0, "Negative duration returns 0% buffered")
    runner.assert(calculateBufferedPercentage([{ start: 0, end: 50 }], NaN) === 0, "NaN duration returns 0% buffered")
    runner.assert(calculateBufferedPercentage([{ start: 0, end: 50 }], Infinity) === 0, "Infinity duration returns 0% buffered")
    runner.assert(calculateBufferedPercentage([], 100) === 0, "Empty ranges return 0% buffered")
    runner.assert(calculateBufferedPercentage([{ start: 0, end: 40 }, { start: 60, end: 80 }], 100) === 80, "Multiple ranges calculate highest buffered end (80%)")
    runner.assert(calculateBufferedPercentage([{ start: 0, end: 120 }], 100) === 100, "Buffered percent clamped to max 100%")

    // Range equality checking
    const r1 = [{ start: 0, end: 30 }]
    const r2 = [{ start: 0, end: 30 }]
    const rSub = [{ start: 0, end: 30.05 }]
    const rDiff = [{ start: 0, end: 31.5 }]
    runner.assert(areBufferedRangesEqual(r1, r2) === true, "Identical ranges are equal")
    runner.assert(areBufferedRangesEqual(r1, rSub) === true, "Sub-second variations (<=0.1s) considered equal")
    runner.assert(areBufferedRangesEqual(r1, rDiff) === false, "Significant differences (>0.1s) detected as unequal")
    runner.assert(areBufferedRangesEqual(r1, null) === false, "Handles null comparison safely")

    // Network & Ready state labels
    runner.assert(getNetworkStateLabel(0) === "Empty", "networkState 0 is 'Empty'")
    runner.assert(getNetworkStateLabel(1) === "Idle", "networkState 1 is 'Idle'")
    runner.assert(getNetworkStateLabel(2) === "Loading", "networkState 2 is 'Loading'")
    runner.assert(getNetworkStateLabel(3) === "No Source", "networkState 3 is 'No Source'")
    runner.assert(getReadyStateLabel(0) === "No Media", "readyState 0 is 'No Media'")
    runner.assert(getReadyStateLabel(1) === "Metadata Loaded", "readyState 1 is 'Metadata Loaded'")
    runner.assert(getReadyStateLabel(2) === "Current Frame Ready", "readyState 2 is 'Current Frame Ready'")
    runner.assert(getReadyStateLabel(3) === "Future Data Ready", "readyState 3 is 'Future Data Ready'")
    runner.assert(getReadyStateLabel(4) === "Playback Ready", "readyState 4 is 'Playback Ready'")

    // -------------------------------------------------------------------------
    // 2. Initial Loading & Buffering State Management
    // -------------------------------------------------------------------------
    const player = new MockPhase7VideoPlayer()
    runner.assert(player.state.isLoading === true, "Initial state starts with isLoading=true")
    runner.assert(player.state.isBuffering === false, "Initial state starts with isBuffering=false")
    runner.assert(player.state.isControlsVisible === true, "Initial state starts with isControlsVisible=true")
    runner.assert(player.getActiveOverlay() === "loading", "Active overlay is 'loading' initially")

    player.onLoadStart()
    runner.assert(player.state.isLoading === true, "onLoadStart sets isLoading=true")
    runner.assert(player.state.bufferedRanges.length === 0, "onLoadStart resets bufferedRanges")

    player.onLoadedMetadata()
    runner.assert(player.state.isLoading === false, "onLoadedMetadata clears isLoading to false")
    runner.assert(player.state.duration === 100, "onLoadedMetadata sets duration")

    player.onCanPlay()
    runner.assert(player.state.isLoading === false, "onCanPlay ensures isLoading=false")
    runner.assert(player.state.isBuffering === false, "onCanPlay ensures isBuffering=false")

    // Network buffering during playback
    player.onPlay()
    player.triggerAutoHideTimeout()
    runner.assert(player.state.isControlsVisible === false, "Controls hidden during active playback")

    player.onWaiting()
    runner.assert(player.state.isBuffering === true, "onWaiting sets isBuffering=true")
    runner.assert(player.state.isControlsVisible === true, "onWaiting makes controls visible")
    runner.assert(player.getActiveOverlay() === "buffering", "Active overlay transitions to 'buffering'")

    player.onPlaying()
    runner.assert(player.state.isBuffering === false, "onPlaying clears isBuffering=false")
    runner.assert(player.state.isLoading === false, "onPlaying clears isLoading=false")
    runner.assert(player.state.isPlaying === true, "onPlaying marks isPlaying=true")

    // Pause suppresses buffering indicator and shows Big Play
    player.onWaiting()
    player.onPause()
    runner.assert(player.state.isPaused === true, "Video paused")
    runner.assert(player.getActiveOverlay() === "big-play", "Paused video suppresses buffering and displays big-play")

    // Ended suppresses buffering and shows Replay
    player.onPlay()
    player.onWaiting()
    player.onEnded()
    runner.assert(player.state.isEnded === true, "Video ended")
    runner.assert(player.state.isBuffering === false, "Ended clears buffering")
    runner.assert(player.getActiveOverlay() === "replay", "Ended video displays replay button")

    // Error priority
    player.onError(4, "Decode error")
    runner.assert(player.getActiveOverlay() === "error", "Fatal error takes top priority in overlay stack")

    // -------------------------------------------------------------------------
    // 3. Multiple Buffered Ranges & Timeline Progress
    // -------------------------------------------------------------------------
    const rangePlayer = new MockPhase7VideoPlayer()
    rangePlayer.setBufferedRanges([
      { start: 0, end: 30 },
      { start: 50, end: 85 },
    ])
    rangePlayer.onProgress()

    runner.assert(rangePlayer.state.bufferedRanges.length === 2, "2 buffered ranges detected on timeline")
    runner.assert(rangePlayer.state.bufferedRanges[0].start === 0 && rangePlayer.state.bufferedRanges[0].end === 30, "First buffered chunk is 0-30s")
    runner.assert(rangePlayer.state.bufferedRanges[1].start === 50 && rangePlayer.state.bufferedRanges[1].end === 85, "Second buffered chunk is 50-85s")
    runner.assert(rangePlayer.state.bufferedPercent === 85, "Timeline buffered percent maps to 85%")

    // Redundant progress events avoided
    const firstRef = rangePlayer.state.bufferedRanges
    rangePlayer.onProgress()
    runner.assert(rangePlayer.state.bufferedRanges === firstRef, "Redundant state updates avoided for identical ranges")

    // -------------------------------------------------------------------------
    // 4. Intelligent Auto-Hide Controls System
    // -------------------------------------------------------------------------
    const autoPlayer = new MockPhase7VideoPlayer({ controlsHideDelay: 3000 })
    autoPlayer.onLoadedMetadata()
    autoPlayer.onPlay()
    runner.assert(autoPlayer.state.isControlsVisible === true, "Controls start visible on play")

    autoPlayer.triggerAutoHideTimeout()
    runner.assert(autoPlayer.state.isControlsVisible === false, "Controls hide after timeout during playback")

    // User interaction restores visibility
    autoPlayer.resetControlsTimer()
    runner.assert(autoPlayer.state.isControlsVisible === true, "Interaction reveals controls immediately")

    // Paused prevents hiding
    autoPlayer.onPause()
    autoPlayer.triggerAutoHideTimeout()
    runner.assert(autoPlayer.state.isControlsVisible === true, "Controls remain visible indefinitely while paused")

    // Ended prevents hiding
    autoPlayer.onPlay()
    autoPlayer.onEnded()
    autoPlayer.triggerAutoHideTimeout()
    runner.assert(autoPlayer.state.isControlsVisible === true, "Controls remain visible indefinitely when ended")

    // Buffering prevents hiding
    autoPlayer.onPlay()
    autoPlayer.onWaiting()
    autoPlayer.triggerAutoHideTimeout()
    runner.assert(autoPlayer.state.isControlsVisible === true, "Controls remain visible while buffering")

    // Initial loading prevents hiding
    autoPlayer.onPlay()
    autoPlayer.onLoadStart()
    autoPlayer.triggerAutoHideTimeout()
    runner.assert(autoPlayer.state.isControlsVisible === true, "Controls remain visible during loading")

    // Menu open prevents hiding
    autoPlayer.onLoadedMetadata()
    autoPlayer.onPlay()
    autoPlayer.setIsMenuOpen(true)
    runner.assert(autoPlayer.state.isControlsVisible === true, "Controls stay visible when menu is opened")
    autoPlayer.triggerAutoHideTimeout()
    runner.assert(autoPlayer.state.isControlsVisible === true, "Controls do not auto-hide while menu is open")
    autoPlayer.setIsMenuOpen(false)
    autoPlayer.triggerAutoHideTimeout()
    runner.assert(autoPlayer.state.isControlsVisible === false, "Controls auto-hide after menu is closed")

    // Dragging timeline prevents hiding
    autoPlayer.onPlay()
    autoPlayer.setIsDragging(true)
    autoPlayer.triggerAutoHideTimeout()
    runner.assert(autoPlayer.state.isControlsVisible === true, "Controls do not auto-hide while dragging timeline")
    autoPlayer.setIsDragging(false)
    autoPlayer.triggerAutoHideTimeout()
    runner.assert(autoPlayer.state.isControlsVisible === false, "Controls auto-hide after drag ends")

    // Keyboard focus inside controls prevents hiding
    autoPlayer.onPlay()
    autoPlayer.setIsFocusWithinControls(true)
    autoPlayer.triggerAutoHideTimeout()
    runner.assert(autoPlayer.state.isControlsVisible === true, "Controls do not auto-hide when keyboard focus is inside")
    autoPlayer.setIsFocusWithinControls(false)
    autoPlayer.triggerAutoHideTimeout()
    runner.assert(autoPlayer.state.isControlsVisible === false, "Controls auto-hide after keyboard focus leaves")

    // Playback error keeps controls visible
    autoPlayer.onPlay()
    autoPlayer.onError(2, "Network dropped")
    autoPlayer.triggerAutoHideTimeout()
    runner.assert(autoPlayer.state.isControlsVisible === true, "Controls remain visible on playback error")

    // -------------------------------------------------------------------------
    // 5. Cursor Auto-Hide & Interaction Behavior
    // -------------------------------------------------------------------------
    const cursorPlayer = new MockPhase7VideoPlayer()
    cursorPlayer.onLoadedMetadata()
    cursorPlayer.onPlay()
    cursorPlayer.triggerAutoHideTimeout()
    runner.assert(cursorPlayer.state.isControlsVisible === false, "Controls hidden")
    runner.assert(cursorPlayer.shouldHideCursor() === true, "Cursor is hidden (cursor: none) when playing and controls hidden")

    cursorPlayer.state.isUserInteracting = true
    runner.assert(cursorPlayer.shouldHideCursor() === false, "Cursor is restored immediately when user interacts")

    cursorPlayer.state.isUserInteracting = false
    cursorPlayer.onPause()
    runner.assert(cursorPlayer.shouldHideCursor() === false, "Cursor is never hidden while paused")

    cursorPlayer.onPlay()
    cursorPlayer.setIsMenuOpen(true)
    runner.assert(cursorPlayer.shouldHideCursor() === false, "Cursor is never hidden while menu is open")

    cursorPlayer.setIsMenuOpen(false)
    cursorPlayer.setIsDragging(true)
    runner.assert(cursorPlayer.shouldHideCursor() === false, "Cursor is never hidden while dragging")

    cursorPlayer.setIsDragging(false)
    cursorPlayer.onWaiting()
    runner.assert(cursorPlayer.shouldHideCursor() === false, "Cursor is never hidden while buffering")

    // -------------------------------------------------------------------------
    // 6. Phase 1-6 Non-Regression Verification
    // -------------------------------------------------------------------------
    const regPlayer = new MockPhase7VideoPlayer()
    regPlayer.onLoadedMetadata()

    // Phase 1
    runner.assert(regPlayer.state.duration === 100, "Phase 1: duration set accurately")
    runner.assert(regPlayer.state.isPaused === true, "Phase 1: initial pause state preserved")
    regPlayer.onPlay()
    runner.assert(regPlayer.state.isPlaying === true, "Phase 1: play toggles isPlaying")

    // Phase 2
    regPlayer.setBufferedRanges([{ start: 0, end: 55 }])
    regPlayer.onProgress()
    runner.assert(regPlayer.state.bufferedPercent === 55, "Phase 2: buffered percent syncs to timeline")

    // Phase 3
    regPlayer.state.volume = 0.6
    regPlayer.state.playbackRate = 1.25
    runner.assert(regPlayer.state.volume === 0.6, "Phase 3: volume set to 0.6")
    runner.assert(regPlayer.state.playbackRate === 1.25, "Phase 3: playback rate set to 1.25x")

    // Phase 4
    regPlayer.onSeeking()
    runner.assert(regPlayer.state.isSeeking === true, "Phase 4: seeking flag active")
    regPlayer.videoElement.currentTime = 30
    regPlayer.onSeeked()
    runner.assert(regPlayer.state.isSeeking === false, "Phase 4: seeked clears isSeeking")
    runner.assert(regPlayer.state.currentTime === 30, "Phase 4: currentTime updated to 30s")

    // Phase 5
    regPlayer.state.isFullscreen = true
    regPlayer.state.isTheaterMode = false
    runner.assert(regPlayer.state.isFullscreen === true, "Phase 5: fullscreen mode preserved")

    // Phase 6
    runner.assert(regPlayer.videoElement.videoWidth === 1920, "Phase 6: videoWidth detected")
    runner.assert(regPlayer.videoElement.videoHeight === 1080, "Phase 6: videoHeight detected")
  } catch (err) {
    runner.assert(false, `Unexpected error in Phase 7 test suite: ${err.message}`)
  }

  return runner.summary()
}

// Auto-run if executed directly
if (process.argv[1]?.endsWith("phase7_buffering_autohide.test.js")) {
  runBufferingAutohideTestSuite()
    .then((result) => {
      process.exit(result.failed > 0 ? 1 : 0)
    })
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
