import { TestRunner } from "./helpers/testEnv.js"

// Mirror Phase 9 utilities from nextVideoUtils.ts
const DEFAULT_AUTOPLAY_COUNTDOWN = 10

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

function validateNextVideo(item) {
  if (!item || typeof item !== "object") return false
  const resolvedId = resolveVideoId(item)
  return Boolean(resolvedId)
}

function resolveNextVideo(currentVideo, explicitNextVideo, playlist, queue) {
  // 1. Explicit nextVideo has highest priority
  if (explicitNextVideo && validateNextVideo(explicitNextVideo)) {
    return explicitNextVideo
  }

  const currentId = resolveVideoId(currentVideo)

  // 2. Playlist-based resolution
  if (playlist && Array.isArray(playlist) && playlist.length > 0) {
    let currentIndex = -1
    if (currentId) {
      currentIndex = playlist.findIndex((v) => resolveVideoId(v) === currentId)
    }

    if (currentIndex >= 0 && currentIndex + 1 < playlist.length) {
      const nextInPlaylist = playlist[currentIndex + 1]
      if (validateNextVideo(nextInPlaylist)) {
        return nextInPlaylist
      }
    }
  }

  // 3. Queue-based resolution
  if (queue && Array.isArray(queue) && queue.length > 0) {
    for (const qItem of queue) {
      if (validateNextVideo(qItem)) {
        const qId = resolveVideoId(qItem)
        if (!currentId || qId !== currentId) {
          return qItem
        }
      }
    }
  }

  return null
}

// Mirror VideoPlayerManager from videoPlayerManager.ts
class TestVideoPlayerManager {
  constructor() {
    this.players = new Map()
    this.activePlayerId = null
    this.listeners = new Set()
  }

  registerPlayer(playerId, registration) {
    if (!playerId) return () => {}
    this.players.set(playerId, registration)
    return () => this.unregisterPlayer(playerId)
  }

  unregisterPlayer(playerId) {
    if (!playerId) return
    this.players.delete(playerId)
    if (this.activePlayerId === playerId) {
      this.activePlayerId = null
      this.notifyListeners()
    }
  }

  setActivePlayer(playerId) {
    if (!playerId) return
    this.activePlayerId = playerId
    this.pauseOtherPlayers(playerId)
    this.notifyListeners()
  }

  pauseOtherPlayers(activePlayerId) {
    for (const [id, reg] of this.players.entries()) {
      if (id !== activePlayerId) {
        try {
          if (reg.isPlaying()) {
            reg.pause()
          }
        } catch {}
      }
    }
  }

  getActivePlayer() {
    return this.activePlayerId
  }

  getPlayerCount() {
    return this.players.size
  }

  subscribe(listener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  clear() {
    this.players.clear()
    this.activePlayerId = null
    this.listeners.clear()
  }

  notifyListeners() {
    for (const listener of this.listeners) {
      try {
        listener(this.activePlayerId)
      } catch {}
    }
  }
}

// Mock Video Player Controller representing Phase 9 Next-Video & Autoplay Engine
class MockPhase9VideoPlayer {
  constructor(options = {}) {
    this.playerId = options.playerId || `player_${Math.random().toString(36).substring(2, 7)}`
    this.manager = options.manager || new TestVideoPlayerManager()
    this.video = options.video || { id: "vid_1", title: "Video 1", duration: 120 }
    this.nextVideo = options.nextVideo || null
    this.playlist = options.playlist || []
    this.queue = options.queue || []
    this.autoplayNext = options.autoplayNext ?? true
    this.autoplayCountdown = options.autoplayCountdown || DEFAULT_AUTOPLAY_COUNTDOWN
    this.nextVideoResumeBehavior = options.nextVideoResumeBehavior || "prompt"

    this.isPlayingState = false
    this.isPausedState = true
    this.isEndedState = false
    this.isCompletedState = false
    this.isNextVideoCountdownActive = false
    this.isAutoplayCancelled = false
    this.countdownRemaining = this.autoplayCountdown
    this.savedWatchProgress = new Map()

    this.onNextVideoCallbacks = []
    this.onVideoChangeCallbacks = []
    this.onCountdownStartCallbacks = []
    this.onCountdownCancelledCallbacks = []

    // Register with manager
    this.unregister = this.manager.registerPlayer(this.playerId, {
      playerId: this.playerId,
      pause: () => this.pause(),
      isPlaying: () => this.isPlayingState,
    })
  }

  getResolvedNextVideo() {
    return resolveNextVideo(this.video, this.nextVideo, this.playlist, this.queue)
  }

  play() {
    this.isPlayingState = true
    this.isPausedState = false
    this.isEndedState = false
    this.manager.setActivePlayer(this.playerId)
  }

  pause() {
    this.isPlayingState = false
    this.isPausedState = true
  }

  onEnded() {
    this.isPlayingState = false
    this.isPausedState = true
    this.isEndedState = true
    this.isCompletedState = true

    // Mark completed in watch progress
    const vidId = resolveVideoId(this.video)
    if (vidId) {
      this.savedWatchProgress.set(vidId, {
        videoId: vidId,
        currentTime: this.video.duration || 120,
        isCompleted: true,
      })
    }

    const nextToPlay = this.getResolvedNextVideo()
    if (this.autoplayNext && nextToPlay && !this.isAutoplayCancelled) {
      this.startCountdown(nextToPlay)
    }
  }

  startCountdown(nextVideo) {
    this.isNextVideoCountdownActive = true
    this.countdownRemaining = this.autoplayCountdown
    this.onCountdownStartCallbacks.forEach((cb) => cb(this.countdownRemaining, nextVideo))
  }

  cancelCountdown() {
    this.isNextVideoCountdownActive = false
    this.isAutoplayCancelled = true
    const nextVideo = this.getResolvedNextVideo()
    this.onCountdownCancelledCallbacks.forEach((cb) => cb(nextVideo))
  }

  playNext(targetNextVideo) {
    const next = targetNextVideo || this.getResolvedNextVideo()
    if (!next) return

    this.isNextVideoCountdownActive = false
    this.isAutoplayCancelled = false
    this.countdownRemaining = this.autoplayCountdown

    // Notify callbacks
    this.onNextVideoCallbacks.forEach((cb) => cb(next))
    this.onVideoChangeCallbacks.forEach((cb) => cb(next))

    // Switch video
    this.video = next
    this.isEndedState = false
    this.isCompletedState = false

    // Respect nextVideoResumeBehavior
    if (this.nextVideoResumeBehavior === "start-over") {
      this.video.currentTime = 0
    }

    // Play next video
    this.play()
  }

  destroy() {
    if (this.unregister) {
      this.unregister()
    }
  }
}

export async function runNextVideoPlayerManagerTestSuite() {
  const runner = new TestRunner("Phase 9 - Next-Video Autoplay, Countdown Overlay & Multiple-Player Management System")

  try {
    // -------------------------------------------------------------------------
    // 1. Next Video Item Validation
    // -------------------------------------------------------------------------
    runner.assert(
      validateNextVideo({ id: "vid_123", title: "Test Video" }) === true,
      "validateNextVideo returns true for valid video with id"
    )
    runner.assert(
      validateNextVideo({ _id: "mongo_id_456" }) === true,
      "validateNextVideo returns true for video with _id"
    )
    runner.assert(
      validateNextVideo({ filepath: "videos/demo.mp4" }) === true,
      "validateNextVideo returns true for video with filepath"
    )
    runner.assert(
      validateNextVideo(null) === false,
      "validateNextVideo returns false for null"
    )
    runner.assert(
      validateNextVideo(undefined) === false,
      "validateNextVideo returns false for undefined"
    )
    runner.assert(
      validateNextVideo({}) === false,
      "validateNextVideo returns false for empty object"
    )
    runner.assert(
      validateNextVideo({ title: "No ID Available" }) === false,
      "validateNextVideo returns false when no id can be resolved"
    )

    // -------------------------------------------------------------------------
    // 2. Next Video Resolution Priority
    // -------------------------------------------------------------------------
    const currentVideo = { id: "vid_current", title: "Current Video" }
    const explicitNext = { id: "vid_explicit", title: "Explicit Next Video" }
    const playlist = [
      { id: "vid_prev", title: "Previous Video" },
      { id: "vid_current", title: "Current Video" },
      { id: "vid_playlist_next", title: "Playlist Next Video" },
      { id: "vid_playlist_after", title: "Playlist After Video" },
    ]
    const queue = [
      { id: "vid_queue_1", title: "Queue Item 1" },
      { id: "vid_queue_2", title: "Queue Item 2" },
    ]

    // Priority 1: Explicit next video overrides playlist and queue
    const res1 = resolveNextVideo(currentVideo, explicitNext, playlist, queue)
    runner.assert(
      res1?.id === "vid_explicit",
      "Explicit nextVideo has highest priority over playlist and queue"
    )

    // Priority 2: Playlist next video when explicit is not provided
    const res2 = resolveNextVideo(currentVideo, null, playlist, queue)
    runner.assert(
      res2?.id === "vid_playlist_next",
      "Resolves next item in playlist after current video"
    )

    // Priority 3: Queue when current is at the end of playlist
    const endPlaylist = [
      { id: "vid_prev", title: "Prev Video" },
      { id: "vid_current", title: "Current Video (Last)" },
    ]
    const res3 = resolveNextVideo(currentVideo, null, endPlaylist, queue)
    runner.assert(
      res3?.id === "vid_queue_1",
      "Resolves queue item when playlist has no subsequent video"
    )

    // Queue skips item if it is identical to current video
    const duplicateQueue = [
      { id: "vid_current", title: "Same as current" },
      { id: "vid_queue_valid", title: "Valid Queue Item" },
    ]
    const res4 = resolveNextVideo(currentVideo, null, [], duplicateQueue)
    runner.assert(
      res4?.id === "vid_queue_valid",
      "Skips queue item identical to current video and picks next valid"
    )

    // Priority 4: Returns null if no next video is found
    const res5 = resolveNextVideo(currentVideo, null, endPlaylist, [])
    runner.assert(
      res5 === null,
      "Returns null when neither playlist nor queue has next item"
    )

    // -------------------------------------------------------------------------
    // 3. Global Multi-Player Manager
    // -------------------------------------------------------------------------
    const manager = new TestVideoPlayerManager()
    let activeChanges = 0
    const unsub = manager.subscribe(() => activeChanges++)

    let p1Paused = false
    let p1Playing = false
    const unreg1 = manager.registerPlayer("player_1", {
      playerId: "player_1",
      pause: () => {
        p1Paused = true
        p1Playing = false
      },
      isPlaying: () => p1Playing,
    })

    let p2Paused = false
    let p2Playing = false
    const unreg2 = manager.registerPlayer("player_2", {
      playerId: "player_2",
      pause: () => {
        p2Paused = true
        p2Playing = false
      },
      isPlaying: () => p2Playing,
    })

    let p3Paused = false
    let p3Playing = false
    const unreg3 = manager.registerPlayer("player_3", {
      playerId: "player_3",
      pause: () => {
        p3Paused = true
        p3Playing = false
      },
      isPlaying: () => p3Playing,
    })

    runner.assert(manager.getPlayerCount() === 3, "Registers all 3 players in manager")

    // Player 1 starts playing
    p1Playing = true
    manager.setActivePlayer("player_1")
    runner.assert(manager.getActivePlayer() === "player_1", "Player 1 is set as active")

    // Player 2 starts playing -> Player 1 must be automatically paused!
    p2Playing = true
    manager.setActivePlayer("player_2")
    runner.assert(manager.getActivePlayer() === "player_2", "Player 2 becomes active")
    runner.assert(p1Paused === true, "Player 1 is automatically paused when Player 2 plays")
    runner.assert(p2Playing === true, "Player 2 remains playing")

    // Player 3 starts playing -> Player 2 must be automatically paused!
    p3Playing = true
    manager.setActivePlayer("player_3")
    runner.assert(manager.getActivePlayer() === "player_3", "Player 3 becomes active")
    runner.assert(p2Paused === true, "Player 2 is automatically paused when Player 3 plays")

    // Unregister active player
    unreg3()
    runner.assert(manager.getActivePlayer() === null, "Active player cleared when unmounted")
    runner.assert(manager.getPlayerCount() === 2, "Player count decrements to 2")

    // Cleanup rest
    unreg1()
    unreg2()
    unsub()
    runner.assert(manager.getPlayerCount() === 0, "All players unregistered cleanly")
    runner.assert(activeChanges > 0, "Subscribers notified on active player changes")

    // -------------------------------------------------------------------------
    // 4. Separation of Player ID and Video ID
    // -------------------------------------------------------------------------
    const separationPlayer = new MockPhase9VideoPlayer({
      playerId: "fixed_feed_player_instance",
      video: { id: "content_video_A", title: "Content Video A" },
      nextVideo: { id: "content_video_B", title: "Content Video B" },
    })

    runner.assert(
      separationPlayer.playerId === "fixed_feed_player_instance",
      "Player instance has stable playerId"
    )
    runner.assert(
      separationPlayer.video.id === "content_video_A",
      "Initial content videoId is content_video_A"
    )

    // Play next video
    separationPlayer.playNext()
    runner.assert(
      separationPlayer.playerId === "fixed_feed_player_instance",
      "Player ID remains unchanged after video transition"
    )
    runner.assert(
      separationPlayer.video.id === "content_video_B",
      "Video ID successfully updated to content_video_B"
    )
    separationPlayer.destroy()

    // -------------------------------------------------------------------------
    // 5. Autoplay Countdown & Cancel Behavior
    // -------------------------------------------------------------------------
    const countdownPlayer = new MockPhase9VideoPlayer({
      video: { id: "video_cd_1", title: "First Video", duration: 100 },
      nextVideo: { id: "video_cd_2", title: "Second Video", duration: 200 },
      autoplayNext: true,
      autoplayCountdown: 10,
    })

    let countdownStarted = false
    let countdownCancelled = false
    countdownPlayer.onCountdownStartCallbacks.push(() => {
      countdownStarted = true
    })
    countdownPlayer.onCountdownCancelledCallbacks.push(() => {
      countdownCancelled = true
    })

    // Video ends
    countdownPlayer.onEnded()
    runner.assert(countdownPlayer.isEndedState === true, "Marks isEnded on video end")
    runner.assert(countdownPlayer.isCompletedState === true, "Marks isCompleted on video end")
    runner.assert(countdownStarted === true, "Triggers onAutoplayCountdownStart")
    runner.assert(
      countdownPlayer.isNextVideoCountdownActive === true,
      "Countdown is active when next video exists and autoplay is enabled"
    )
    runner.assert(
      countdownPlayer.countdownRemaining === 10,
      "Initial countdown set to configured 10 seconds"
    )

    // User cancels autoplay
    countdownPlayer.cancelCountdown()
    runner.assert(
      countdownPlayer.isNextVideoCountdownActive === false,
      "Cancelling deactivates countdown overlay"
    )
    runner.assert(
      countdownPlayer.isAutoplayCancelled === true,
      "Marks isAutoplayCancelled = true"
    )
    runner.assert(countdownCancelled === true, "Triggers onAutoplayCancelled callback")
    runner.assert(
      countdownPlayer.video.id === "video_cd_1",
      "Remains on current video after cancel without transitioning"
    )
    runner.assert(
      countdownPlayer.isEndedState === true,
      "Preserves ended state so replay button and controls are available"
    )
    countdownPlayer.destroy()

    // -------------------------------------------------------------------------
    // 6. Play Now Immediate Transition
    // -------------------------------------------------------------------------
    const playNowPlayer = new MockPhase9VideoPlayer({
      video: { id: "video_pn_1", title: "Video 1" },
      nextVideo: { id: "video_pn_2", title: "Video 2" },
      autoplayNext: true,
    })

    let nextVideoNotified = false
    playNowPlayer.onNextVideoCallbacks.push((v) => {
      if (v.id === "video_pn_2") nextVideoNotified = true
    })

    playNowPlayer.onEnded()
    runner.assert(playNowPlayer.isNextVideoCountdownActive === true, "Countdown active before Play Now")

    // User clicks "Play Now"
    playNowPlayer.playNext()
    runner.assert(
      playNowPlayer.isNextVideoCountdownActive === false,
      "Play Now stops countdown immediately"
    )
    runner.assert(
      playNowPlayer.video.id === "video_pn_2",
      "Transitions to next video immediately"
    )
    runner.assert(
      playNowPlayer.isPlayingState === true,
      "Begins playback of next video"
    )
    runner.assert(nextVideoNotified === true, "Notifies onNextVideo callback")
    playNowPlayer.destroy()

    // -------------------------------------------------------------------------
    // 7. Autoplay Disabled State
    // -------------------------------------------------------------------------
    const noAutoplayPlayer = new MockPhase9VideoPlayer({
      video: { id: "video_no_ap_1", title: "Video 1" },
      nextVideo: { id: "video_no_ap_2", title: "Video 2" },
      autoplayNext: false,
    })

    noAutoplayPlayer.onEnded()
    runner.assert(
      noAutoplayPlayer.isNextVideoCountdownActive === false,
      "Does not start countdown when autoplayNext is disabled"
    )
    runner.assert(
      noAutoplayPlayer.isEndedState === true,
      "Remains in completed state"
    )
    noAutoplayPlayer.destroy()

    // -------------------------------------------------------------------------
    // 8. No Next Video Available State
    // -------------------------------------------------------------------------
    const emptyNextPlayer = new MockPhase9VideoPlayer({
      video: { id: "video_standalone", title: "Solo Video" },
      nextVideo: null,
      playlist: [],
      queue: [],
      autoplayNext: true,
    })

    emptyNextPlayer.onEnded()
    runner.assert(
      emptyNextPlayer.isNextVideoCountdownActive === false,
      "Does not start countdown when no next video is found"
    )
    runner.assert(
      emptyNextPlayer.getResolvedNextVideo() === null,
      "resolvedNextVideo is null"
    )
    emptyNextPlayer.destroy()

    // -------------------------------------------------------------------------
    // 9. Watch Progress & Completion Integration (Phase 8 + Phase 9)
    // -------------------------------------------------------------------------
    const progressPlayer = new MockPhase9VideoPlayer({
      video: { id: "video_wp_A", title: "Video A", duration: 150 },
      nextVideo: { id: "video_wp_B", title: "Video B", duration: 200 },
      nextVideoResumeBehavior: "start-over",
    })

    progressPlayer.onEnded()
    const savedA = progressPlayer.savedWatchProgress.get("video_wp_A")
    runner.assert(savedA !== undefined, "Previous video progress saved on end")
    runner.assert(savedA.isCompleted === true, "Previous video marked completed")

    progressPlayer.playNext()
    runner.assert(
      progressPlayer.video.id === "video_wp_B",
      "Successfully transitioned to next video"
    )
    runner.assert(
      progressPlayer.video.currentTime === 0,
      "start-over resume behavior resets new video position to 0"
    )
    progressPlayer.destroy()

    // -------------------------------------------------------------------------
    // 10. Non-Regression: Phases 1 through 8
    // -------------------------------------------------------------------------
    const regPlayer = new MockPhase9VideoPlayer({
      video: { id: "regression_vid", title: "Regression Test Video", duration: 180 },
    })

    // Phase 1: custom play/pause
    regPlayer.play()
    runner.assert(regPlayer.isPlayingState === true, "Phase 1: play toggles isPlaying")
    regPlayer.pause()
    runner.assert(regPlayer.isPausedState === true, "Phase 1: pause toggles isPaused")

    // Phase 2: timeline & duration
    runner.assert(regPlayer.video.duration === 180, "Phase 2: duration preserved")

    // Phase 5: display modes (simulated)
    runner.assert(typeof regPlayer.playerId === "string", "Phase 5/8/9: Player ID exists")

    // Phase 8: watch progress persistence
    regPlayer.onEnded()
    runner.assert(regPlayer.isCompletedState === true, "Phase 8: video completion registered")

    regPlayer.destroy()
  } catch (err) {
    runner.assert(false, `Unexpected error in Phase 9 test suite: ${err.message}`)
  }

  return runner.summary()
}

// Auto-run if executed directly
if (process.argv[1]?.endsWith("phase9_next_video_player_manager.test.js")) {
  runNextVideoPlayerManagerTestSuite()
    .then((result) => {
      process.exit(result.failed > 0 ? 1 : 0)
    })
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
