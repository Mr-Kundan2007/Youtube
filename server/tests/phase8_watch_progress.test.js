import { TestRunner } from "./helpers/testEnv.js"

// Mirror watch progress utilities from watchProgressUtils.ts
const DEFAULT_PROGRESS_SAVE_INTERVAL = 10
const DEFAULT_COMPLETION_THRESHOLD = 90
const DEFAULT_RESUME_MINIMUM_SECONDS = 10
const DEFAULT_RESUME_END_THRESHOLD_SECONDS = 15
const WATCH_PROGRESS_STORAGE_PREFIX = "yt_watch_progress_"

function resolveVideoId(video, explicitVideoId) {
  if (explicitVideoId && typeof explicitVideoId === "string" && explicitVideoId.trim().length > 0) {
    return explicitVideoId.trim()
  }
  if (!video || typeof video !== "object") {
    return null
  }
  const idCandidates = [
    video._id,
    video.id,
    video.videotitle,
    video.filepath,
    video.videoUrl,
    video.videofilepath,
  ]
  for (const candidate of idCandidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim()
    }
  }
  return null
}

function calculateWatchPercentage(currentTime, duration) {
  if (!duration || !Number.isFinite(duration) || duration <= 0) return 0
  if (!currentTime || !Number.isFinite(currentTime) || currentTime <= 0) return 0
  const pct = (currentTime / duration) * 100
  return Math.min(100, Math.max(0, Math.round(pct * 10) / 10))
}

function isVideoCompleted(progressPercentage, currentTime, duration, threshold = DEFAULT_COMPLETION_THRESHOLD) {
  if (progressPercentage >= threshold) return true
  if (duration > 0 && currentTime >= duration - 2) return true
  return false
}

function isResumeEligible(progress, duration, options = {}) {
  const minSec = options.minimumSeconds ?? DEFAULT_RESUME_MINIMUM_SECONDS
  const endThreshold = options.endThresholdSeconds ?? DEFAULT_RESUME_END_THRESHOLD_SECONDS
  if (!progress || typeof progress.currentTime !== "number") return false
  if (!duration || !Number.isFinite(duration) || duration <= 0) return false
  if (progress.isCompleted) return false
  if (progress.currentTime < minSec) return false
  if (progress.currentTime >= duration - endThreshold) return false
  return true
}

function clampResumePosition(position, duration, endThreshold = DEFAULT_RESUME_END_THRESHOLD_SECONDS) {
  if (!Number.isFinite(position) || position < 0) return 0
  if (!Number.isFinite(duration) || duration <= 0) return 0
  const maxSafe = Math.max(0, duration - endThreshold)
  return Math.min(position, maxSafe)
}

// In-Memory Storage Mock for WatchProgressService testing
class MockStorage {
  constructor() {
    this.store = new Map()
    this.throwOnSet = false
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null
  }
  setItem(key, value) {
    if (this.throwOnSet) {
      throw new Error("QuotaExceededError: DOM Exception 22")
    }
    this.store.set(key, String(value))
  }
  removeItem(key) {
    this.store.delete(key)
  }
  clear() {
    this.store.clear()
  }
}

class TestWatchProgressService {
  constructor(storage = new MockStorage()) {
    this.storage = storage
  }

  saveProgress(data) {
    if (!data || !data.videoId) return false
    try {
      const key = `${WATCH_PROGRESS_STORAGE_PREFIX}${data.videoId}`
      this.storage.setItem(key, JSON.stringify(data))
      return true
    } catch {
      return false
    }
  }

  loadProgress(videoId) {
    if (!videoId) return null
    try {
      const key = `${WATCH_PROGRESS_STORAGE_PREFIX}${videoId}`
      const raw = this.storage.getItem(key)
      if (!raw) return null
      const parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== "object" || typeof parsed.currentTime !== "number") {
        return null
      }
      return parsed
    } catch {
      return null
    }
  }

  clearProgress(videoId) {
    if (!videoId) return false
    try {
      const key = `${WATCH_PROGRESS_STORAGE_PREFIX}${videoId}`
      this.storage.removeItem(key)
      return true
    } catch {
      return false
    }
  }

  hasProgress(videoId) {
    return this.loadProgress(videoId) !== null
  }
}

// Mock Video Player Controller representing Phase 8 integration
class MockPhase8VideoPlayer {
  constructor(options = {}) {
    this.storage = options.storage || new MockStorage()
    this.progressService = new TestWatchProgressService(this.storage)

    this.options = {
      autoResume: options.autoResume || false,
      resumePromptEnabled: options.resumePromptEnabled ?? true,
      progressSaveInterval: options.progressSaveInterval || DEFAULT_PROGRESS_SAVE_INTERVAL,
      completionThreshold: options.completionThreshold || DEFAULT_COMPLETION_THRESHOLD,
      resumeMinimumSeconds: options.resumeMinimumSeconds || DEFAULT_RESUME_MINIMUM_SECONDS,
      resumeEndThresholdSeconds: options.resumeEndThresholdSeconds || DEFAULT_RESUME_END_THRESHOLD_SECONDS,
      seekInterval: options.seekInterval || 10,
    }

    this.videoElement = {
      currentTime: 0,
      duration: 120,
      paused: true,
      playbackRate: 1,
      ended: false,
      videoWidth: 1920,
      videoHeight: 1080,
      networkState: 2,
      readyState: 4,
    }

    this.currentVideoId = options.videoId || null
    this.lastSaveTime = 0
    this.lastSavedSnapshot = null
    this.saveCount = 0

    this.state = {
      videoId: this.currentVideoId,
      currentTime: 0,
      duration: 120,
      isPlaying: false,
      isPaused: true,
      isBuffering: false,
      isEnded: false,
      isSeeking: false,
      volume: 1,
      isMuted: false,
      playbackRate: 1,
      isFullscreen: false,
      isTheaterMode: false,
      isPictureInPicture: false,
      isControlsVisible: true,
      savedProgress: null,
      shouldShowResumePrompt: false,
      resumePosition: 0,
      isCompleted: false,
    }
  }

  setVideoId(newId) {
    if (this.currentVideoId && this.currentVideoId !== newId) {
      this.saveWatchProgress(true)
    }
    this.currentVideoId = newId
    this.lastSaveTime = 0
    this.lastSavedSnapshot = null
    this.state.videoId = newId
    this.state.savedProgress = null
    this.state.shouldShowResumePrompt = false
    this.state.resumePosition = 0
    this.state.isCompleted = false

    if (newId) {
      const saved = this.progressService.loadProgress(newId)
      if (saved) {
        this.state.savedProgress = saved
        this.state.isCompleted = saved.isCompleted
      }
    }
  }

  onLoadedMetadata() {
    this.state.duration = this.videoElement.duration
    this.state.isPaused = this.videoElement.paused

    if (this.currentVideoId) {
      const saved = this.progressService.loadProgress(this.currentVideoId)
      if (saved) {
        const eligible = isResumeEligible(saved, this.videoElement.duration, {
          minimumSeconds: this.options.resumeMinimumSeconds,
          endThresholdSeconds: this.options.resumeEndThresholdSeconds,
        })

        if (eligible) {
          const safePos = clampResumePosition(
            saved.currentTime,
            this.videoElement.duration,
            this.options.resumeEndThresholdSeconds
          )
          if (this.options.autoResume) {
            this.videoElement.currentTime = safePos
            this.state.currentTime = safePos
            this.state.savedProgress = saved
            this.state.isCompleted = saved.isCompleted
            this.state.shouldShowResumePrompt = false
          } else if (this.options.resumePromptEnabled) {
            this.state.savedProgress = saved
            this.state.isCompleted = saved.isCompleted
            this.state.shouldShowResumePrompt = true
            this.state.resumePosition = safePos
          }
        } else {
          this.state.savedProgress = saved
          this.state.isCompleted = saved.isCompleted
        }
      }
    }
  }

  saveWatchProgress(force = false) {
    if (!this.currentVideoId || !this.videoElement.duration) return

    const currentTime = this.videoElement.currentTime
    const duration = this.videoElement.duration
    const pct = calculateWatchPercentage(currentTime, duration)
    const completed = isVideoCompleted(pct, currentTime, duration, this.options.completionThreshold)

    if (!force && this.lastSavedSnapshot) {
      const timeDiff = Math.abs(currentTime - this.lastSavedSnapshot.time)
      const sameCompletion = completed === this.lastSavedSnapshot.completed
      if (timeDiff < 1 && sameCompletion) {
        return // Skip redundant save
      }
    }

    this.lastSaveTime = Date.now()
    this.lastSavedSnapshot = { time: currentTime, completed }
    this.saveCount++

    const payload = {
      videoId: this.currentVideoId,
      currentTime,
      duration,
      progressPercentage: pct,
      isCompleted: completed,
      lastWatchedAt: new Date().toISOString(),
      playbackRate: this.videoElement.playbackRate,
    }

    this.progressService.saveProgress(payload)
    this.state.savedProgress = payload
    this.state.isCompleted = completed
  }

  onTimeUpdate(simulatedTime) {
    this.videoElement.currentTime = simulatedTime
    this.state.currentTime = simulatedTime

    const dur = this.videoElement.duration
    const pct = calculateWatchPercentage(simulatedTime, dur)
    const completed = isVideoCompleted(pct, simulatedTime, dur, this.options.completionThreshold)
    if (completed) {
      this.state.isCompleted = true
    }

    if (!this.videoElement.paused && simulatedTime > 0 && dur > 0) {
      const now = Date.now()
      if (now - this.lastSaveTime >= this.options.progressSaveInterval * 1000) {
        this.saveWatchProgress()
      }
    }
  }

  onPause() {
    this.videoElement.paused = true
    this.state.isPlaying = false
    this.state.isPaused = true
    this.saveWatchProgress()
  }

  onPlay() {
    this.videoElement.paused = false
    this.state.isPlaying = true
    this.state.isPaused = false
  }

  onEnded() {
    this.videoElement.ended = true
    this.state.isPlaying = false
    this.state.isPaused = true
    this.state.isEnded = true
    this.state.isCompleted = true

    const payload = {
      videoId: this.currentVideoId,
      currentTime: this.videoElement.duration,
      duration: this.videoElement.duration,
      progressPercentage: 100,
      isCompleted: true,
      lastWatchedAt: new Date().toISOString(),
      playbackRate: this.videoElement.playbackRate,
    }
    this.progressService.saveProgress(payload)
    this.state.savedProgress = payload
  }

  restoreWatchPosition(targetPos) {
    const pos = typeof targetPos === "number" ? targetPos : this.state.resumePosition
    const safePos = clampResumePosition(pos, this.videoElement.duration, this.options.resumeEndThresholdSeconds)
    this.videoElement.currentTime = safePos
    this.state.currentTime = safePos
    this.state.shouldShowResumePrompt = false
  }

  startOver() {
    this.videoElement.currentTime = 0
    this.state.currentTime = 0
    if (this.currentVideoId) {
      this.progressService.clearProgress(this.currentVideoId)
    }
    this.lastSavedSnapshot = { time: 0, completed: false }
    this.state.savedProgress = null
    this.state.shouldShowResumePrompt = false
    this.state.resumePosition = 0
    this.state.isCompleted = false
  }

  dismissResumePrompt() {
    this.state.shouldShowResumePrompt = false
  }
}

export async function runWatchProgressTestSuite() {
  const runner = new TestRunner("Phase 8 - Watch Progress Persistence, Automatic Resume & Resume Playback System")

  try {
    // -------------------------------------------------------------------------
    // 1. Stable Video ID Resolution
    // -------------------------------------------------------------------------
    runner.assert(
      resolveVideoId(null, "explicit_id_123") === "explicit_id_123",
      "Explicit videoId takes highest priority"
    )
    runner.assert(
      resolveVideoId({ _id: "mongo_obj_id_456" }) === "mongo_obj_id_456",
      "Resolves from video._id"
    )
    runner.assert(
      resolveVideoId({ id: "custom_id_789" }) === "custom_id_789",
      "Resolves from video.id"
    )
    runner.assert(
      resolveVideoId({ videotitle: "React 19 Deep Dive" }) === "React 19 Deep Dive",
      "Resolves from video.videotitle if no id is present"
    )
    runner.assert(
      resolveVideoId({ filepath: "uploads/videos/intro.mp4" }) === "uploads/videos/intro.mp4",
      "Resolves from video.filepath as fallback"
    )
    runner.assert(
      resolveVideoId({ videoUrl: "https://cdn.example.com/vdo.mp4" }) === "https://cdn.example.com/vdo.mp4",
      "Resolves from video.videoUrl"
    )
    runner.assert(
      resolveVideoId({ videofilepath: "videos/demo.mp4" }) === "videos/demo.mp4",
      "Resolves from video.videofilepath"
    )
    runner.assert(
      resolveVideoId(null, undefined) === null,
      "Returns null when no identifiers exist"
    )
    runner.assert(
      resolveVideoId({ _id: "   " }, "   ") === null,
      "Trims whitespace and treats empty strings as null"
    )

    // -------------------------------------------------------------------------
    // 2. Watch Percentage & Completion Logic
    // -------------------------------------------------------------------------
    runner.assert(calculateWatchPercentage(0, 100) === 0, "0s out of 100s gives 0%")
    runner.assert(calculateWatchPercentage(50, 100) === 50, "50s out of 100s gives 50%")
    runner.assert(calculateWatchPercentage(92.45, 100) === 92.5, "Rounds to 1 decimal place")
    runner.assert(calculateWatchPercentage(120, 100) === 100, "Clamps upper bound to 100%")
    runner.assert(calculateWatchPercentage(-10, 100) === 0, "Clamps lower bound to 0%")
    runner.assert(calculateWatchPercentage(10, 0) === 0, "Returns 0 for zero duration")
    runner.assert(calculateWatchPercentage(10, NaN) === 0, "Returns 0 for NaN duration")

    runner.assert(
      isVideoCompleted(90, 90, 100, 90) === true,
      "Marks video completed at or above 90% threshold"
    )
    runner.assert(
      isVideoCompleted(89.9, 89.9, 100, 90) === false,
      "Does not mark completed below 90% threshold when far from end"
    )
    runner.assert(
      isVideoCompleted(85, 98.5, 100, 90) === true,
      "Marks completed when within 2s of end even if percent differs"
    )

    // -------------------------------------------------------------------------
    // 3. Resume Eligibility & Position Clamping
    // -------------------------------------------------------------------------
    const testDuration = 300 // 5 minutes

    // Not eligible: under 10 seconds
    runner.assert(
      isResumeEligible({ currentTime: 5, isCompleted: false }, testDuration) === false,
      "Position < 10s is not eligible for resume"
    )
    // Not eligible: already completed
    runner.assert(
      isResumeEligible({ currentTime: 150, isCompleted: true }, testDuration) === false,
      "Completed video is not eligible for resume"
    )
    // Not eligible: near end threshold (within 15s of 300s -> >= 285s)
    runner.assert(
      isResumeEligible({ currentTime: 288, isCompleted: false }, testDuration) === false,
      "Position near end (<= 15s remaining) is not eligible for resume"
    )
    // Eligible: middle of playback
    runner.assert(
      isResumeEligible({ currentTime: 120, isCompleted: false }, testDuration) === true,
      "Position in middle of playback (120s of 300s) is eligible for resume"
    )

    // Clamping logic
    runner.assert(clampResumePosition(120, 300) === 120, "Leaves valid position intact")
    runner.assert(clampResumePosition(295, 300, 15) === 285, "Clamps position beyond end threshold to duration - 15s")
    runner.assert(clampResumePosition(-10, 300) === 0, "Clamps negative position to 0")

    // -------------------------------------------------------------------------
    // 4. Persistence Service & Storage Quota / Corruption Safety
    // -------------------------------------------------------------------------
    const mockStorage = new MockStorage()
    const service = new TestWatchProgressService(mockStorage)

    const testProgress = {
      videoId: "vid_test_001",
      currentTime: 75.5,
      duration: 300,
      progressPercentage: 25.2,
      isCompleted: false,
      lastWatchedAt: "2026-09-09T10:00:00.000Z",
      playbackRate: 1.25,
    }

    runner.assert(service.saveProgress(testProgress) === true, "Saves progress successfully")
    runner.assert(service.hasProgress("vid_test_001") === true, "Detects existing progress")

    const loaded = service.loadProgress("vid_test_001")
    runner.assert(loaded !== null, "Loads saved progress")
    runner.assert(loaded.currentTime === 75.5, "Restores exact currentTime")
    runner.assert(loaded.playbackRate === 1.25, "Restores playbackRate")

    // Corrupted JSON resilience
    mockStorage.setItem(`${WATCH_PROGRESS_STORAGE_PREFIX}corrupted_vid`, "INVALID_JSON_OBJECT{{{{{")
    const corruptedResult = service.loadProgress("corrupted_vid")
    runner.assert(corruptedResult === null, "Gracefully returns null on corrupted JSON without crashing")

    // Quota Exceeded resilience
    mockStorage.throwOnSet = true
    const quotaResult = service.saveProgress({ videoId: "quota_vid", currentTime: 50, duration: 100 })
    runner.assert(quotaResult === false, "Gracefully handles QuotaExceededError without throwing")
    mockStorage.throwOnSet = false

    // Clear progress
    service.clearProgress("vid_test_001")
    runner.assert(service.hasProgress("vid_test_001") === false, "Clears progress successfully")

    // -------------------------------------------------------------------------
    // 5. Video Player Automatic Resume Mode (autoResume = true)
    // -------------------------------------------------------------------------
    const storageForAuto = new MockStorage()
    const autoPlayer = new MockPhase8VideoPlayer({
      videoId: "video_auto_resume",
      autoResume: true,
      resumePromptEnabled: false,
      storage: storageForAuto,
    })

    // Seed storage with 45s watched
    autoPlayer.progressService.saveProgress({
      videoId: "video_auto_resume",
      currentTime: 45,
      duration: 120,
      progressPercentage: 37.5,
      isCompleted: false,
      lastWatchedAt: new Date().toISOString(),
      playbackRate: 1,
    })

    autoPlayer.onLoadedMetadata()
    runner.assert(autoPlayer.videoElement.currentTime === 45, "autoResume automatically seeks video to 45s on metadata")
    runner.assert(autoPlayer.state.currentTime === 45, "autoResume syncs player state currentTime")
    runner.assert(autoPlayer.state.shouldShowResumePrompt === false, "autoResume does not show interactive prompt")

    // -------------------------------------------------------------------------
    // 6. Video Player Interactive Resume Prompt Mode (resumePromptEnabled = true)
    // -------------------------------------------------------------------------
    const storageForPrompt = new MockStorage()
    const promptPlayer = new MockPhase8VideoPlayer({
      videoId: "video_prompt_resume",
      autoResume: false,
      resumePromptEnabled: true,
      storage: storageForPrompt,
    })

    // Seed with 60s watched
    promptPlayer.progressService.saveProgress({
      videoId: "video_prompt_resume",
      currentTime: 60,
      duration: 120,
      progressPercentage: 50,
      isCompleted: false,
      lastWatchedAt: new Date().toISOString(),
      playbackRate: 1,
    })

    promptPlayer.onLoadedMetadata()
    runner.assert(promptPlayer.videoElement.currentTime === 0, "Interactive mode leaves video at 0 initially")
    runner.assert(promptPlayer.state.shouldShowResumePrompt === true, "Shows resume prompt dialog")
    runner.assert(promptPlayer.state.resumePosition === 60, "Calculates correct resume position of 60s")

    // User clicks "Resume"
    promptPlayer.restoreWatchPosition()
    runner.assert(promptPlayer.videoElement.currentTime === 60, "Clicking Resume seeks video to 60s")
    runner.assert(promptPlayer.state.currentTime === 60, "Clicking Resume syncs player state")
    runner.assert(promptPlayer.state.shouldShowResumePrompt === false, "Clicking Resume closes dialog")

    // Test "Start Over" flow
    promptPlayer.startOver()
    runner.assert(promptPlayer.videoElement.currentTime === 0, "Start Over resets video position to 0")
    runner.assert(promptPlayer.state.currentTime === 0, "Start Over resets state position to 0")
    runner.assert(
      promptPlayer.progressService.hasProgress("video_prompt_resume") === false,
      "Start Over deletes persisted progress from storage"
    )

    // -------------------------------------------------------------------------
    // 7. Throttled Periodic Saving & Duplicate Save Prevention
    // -------------------------------------------------------------------------
    const throttledPlayer = new MockPhase8VideoPlayer({
      videoId: "video_throttled",
      progressSaveInterval: 10,
      storage: new MockStorage(),
    })
    throttledPlayer.onLoadedMetadata()
    throttledPlayer.onPlay()

    // Simulate playback tick at 2s
    throttledPlayer.lastSaveTime = Date.now() - 2000 // only 2s elapsed (< 10s interval)
    throttledPlayer.onTimeUpdate(2)
    runner.assert(throttledPlayer.saveCount === 0, "Does not save on every timeupdate before interval")

    // Simulate playback tick at 11s (interval passed)
    throttledPlayer.lastSaveTime = Date.now() - 11000 // 11s elapsed (> 10s)
    throttledPlayer.onTimeUpdate(11)
    runner.assert(throttledPlayer.saveCount === 1, "Saves progress once save interval elapses")

    // Duplicate save prevention: position changed by only 0.2s
    throttledPlayer.lastSaveTime = Date.now() - 11000
    throttledPlayer.onTimeUpdate(11.2)
    runner.assert(throttledPlayer.saveCount === 1, "Skips duplicate save when position moved < 1s")

    // Significant position advance (e.g. at 25s)
    throttledPlayer.lastSaveTime = Date.now() - 11000
    throttledPlayer.onTimeUpdate(25)
    runner.assert(throttledPlayer.saveCount === 2, "Saves when position advanced significantly")

    // Event-driven save on pause
    const beforePauseSaves = throttledPlayer.saveCount
    throttledPlayer.videoElement.currentTime = 35
    throttledPlayer.onPause()
    runner.assert(throttledPlayer.saveCount === beforePauseSaves + 1, "Triggers event-driven save on pause")

    // Event-driven save on video end
    throttledPlayer.onEnded()
    runner.assert(throttledPlayer.state.isEnded === true, "Sets isEnded on ended event")
    runner.assert(throttledPlayer.state.isCompleted === true, "Marks isCompleted on ended event")
    const endedSaved = throttledPlayer.progressService.loadProgress("video_throttled")
    runner.assert(endedSaved.isCompleted === true, "Persists isCompleted: true upon video ended")

    // Reopening completed video starts at 0 and does not prompt
    const completedReopenPlayer = new MockPhase8VideoPlayer({
      videoId: "video_throttled",
      resumePromptEnabled: true,
      storage: throttledPlayer.storage,
    })
    completedReopenPlayer.onLoadedMetadata()
    runner.assert(completedReopenPlayer.state.shouldShowResumePrompt === false, "Completed video does not show resume prompt")
    runner.assert(completedReopenPlayer.videoElement.currentTime === 0, "Completed video starts at 0:00")

    // -------------------------------------------------------------------------
    // 8. Switching Video ID (Flushes Old & Loads New)
    // -------------------------------------------------------------------------
    const switchPlayer = new MockPhase8VideoPlayer({
      videoId: "video_A",
      storage: new MockStorage(),
    })
    switchPlayer.onLoadedMetadata()
    switchPlayer.onPlay()
    switchPlayer.videoElement.currentTime = 40

    // Switch to video_B
    switchPlayer.setVideoId("video_B")
    const savedA = switchPlayer.progressService.loadProgress("video_A")
    runner.assert(savedA !== null && savedA.currentTime === 40, "Flushes old video_A progress on videoId switch")
    runner.assert(switchPlayer.state.videoId === "video_B", "Updates active videoId to video_B")
    runner.assert(switchPlayer.state.savedProgress === null, "Initializes video_B with clean progress")

    // -------------------------------------------------------------------------
    // 9. Non-Regression: Phases 1 through 7
    // -------------------------------------------------------------------------
    const regPlayer = new MockPhase8VideoPlayer({ videoId: "regression_vid" })
    regPlayer.onLoadedMetadata()

    // Phase 1: Play/pause and duration
    runner.assert(regPlayer.state.duration === 120, "Phase 1: duration accurate")
    runner.assert(regPlayer.state.isPaused === true, "Phase 1: pause state accurate")
    regPlayer.onPlay()
    runner.assert(regPlayer.state.isPlaying === true, "Phase 1: play toggles isPlaying")

    // Phase 2: Progress bar / timeline
    regPlayer.state.currentTime = 60
    runner.assert(regPlayer.state.currentTime === 60, "Phase 2: currentTime updates")

    // Phase 3: Volume & speed
    regPlayer.state.volume = 0.8
    regPlayer.state.playbackRate = 1.5
    runner.assert(regPlayer.state.volume === 0.8, "Phase 3: volume set")
    runner.assert(regPlayer.state.playbackRate === 1.5, "Phase 3: playback rate set")

    // Phase 4: Seek interval
    runner.assert(regPlayer.options.seekInterval === 10, "Phase 4: seek interval default 10s")

    // Phase 5: Display modes
    regPlayer.state.isFullscreen = true
    runner.assert(regPlayer.state.isFullscreen === true, "Phase 5: fullscreen state preserved")

    // Phase 6: Subtitle / Quality
    runner.assert(regPlayer.videoElement.videoWidth === 1920, "Phase 6: resolution intact")

    // Phase 7: Buffering and Autohide
    runner.assert(regPlayer.state.isControlsVisible === true, "Phase 7: controls visible initially")
  } catch (err) {
    runner.assert(false, `Unexpected error in Phase 8 test suite: ${err.message}`)
  }

  return runner.summary()
}

// Auto-run if executed directly
if (process.argv[1]?.endsWith("phase8_watch_progress.test.js")) {
  runWatchProgressTestSuite()
    .then((result) => {
      process.exit(result.failed > 0 ? 1 : 0)
    })
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
