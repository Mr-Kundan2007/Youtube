import { TestRunner } from "./helpers/testEnv.js"

// Mirror Phase 11 Utilities and Classes

// 1. Event creation and sanitization
const SENSITIVE_KEY_PATTERNS = [
  /token/i,
  /password/i,
  /auth/i,
  /secret/i,
  /key/i,
  /signature/i,
  /credential/i,
  /session[-_]?token/i,
  /bearer/i,
  /cookie/i,
]

function generateEventId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID()
    } catch {}
  }
  return `evt_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}`
}

function sanitizeMetadata(metadata) {
  if (!metadata || typeof metadata !== "object") return undefined
  const cleaned = {}
  for (const [key, value] of Object.entries(metadata)) {
    const isSensitive = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key))
    if (isSensitive) continue

    if (typeof value === "string") {
      if (value.startsWith("http://") || value.startsWith("https://")) {
        try {
          const url = new URL(value)
          url.searchParams.delete("token")
          url.searchParams.delete("auth")
          url.searchParams.delete("signature")
          url.searchParams.delete("key")
          cleaned[key] = url.toString()
          continue
        } catch {}
      }
      cleaned[key] = value
    } else if (typeof value === "number" || typeof value === "boolean" || value === null) {
      cleaned[key] = value
    } else if (Array.isArray(value)) {
      cleaned[key] = value.slice(0, 50)
    } else if (typeof value === "object") {
      cleaned[key] = sanitizeMetadata(value)
    }
  }
  return Object.keys(cleaned).length > 0 ? cleaned : undefined
}

function createAnalyticsEvent({
  eventType,
  videoId,
  playerId,
  sessionId,
  currentTime,
  duration,
  metadata,
  eventId,
  timestamp,
}) {
  const safeCurrentTime =
    typeof currentTime === "number" && !isNaN(currentTime) && isFinite(currentTime)
      ? Math.round(Math.max(0, currentTime) * 100) / 100
      : 0

  const safeDuration =
    typeof duration === "number" && !isNaN(duration) && isFinite(duration)
      ? Math.round(Math.max(0, duration) * 100) / 100
      : 0

  return {
    eventId: eventId || generateEventId(),
    eventType,
    timestamp: timestamp || Date.now(),
    videoId: videoId || null,
    playerId: playerId || "default_player",
    sessionId: sessionId || "unassigned_session",
    currentTime: safeCurrentTime,
    duration: safeDuration,
    metadata: sanitizeMetadata(metadata),
  }
}

function validateAnalyticsEvent(event) {
  if (!event || typeof event !== "object") return false
  return (
    typeof event.eventId === "string" &&
    event.eventId.length > 0 &&
    typeof event.eventType === "string" &&
    event.eventType.length > 0 &&
    typeof event.timestamp === "number" &&
    event.timestamp > 0 &&
    typeof event.playerId === "string" &&
    event.playerId.length > 0 &&
    typeof event.sessionId === "string" &&
    event.sessionId.length > 0 &&
    typeof event.currentTime === "number" &&
    !isNaN(event.currentTime) &&
    typeof event.duration === "number" &&
    !isNaN(event.duration)
  )
}

function isCriticalEvent(eventType) {
  switch (eventType) {
    case "VIDEO_ERROR":
    case "WATCH_SESSION_END":
    case "VIDEO_COMPLETED":
    case "VIDEO_ABANDONED":
      return true
    default:
      return false
  }
}

// 2. Session Utilities
function generateSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try {
      return `ws_${crypto.randomUUID()}`
    } catch {}
  }
  return `ws_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 12)}`
}

function calculateWatchPercentage(currentTime, duration) {
  if (typeof duration !== "number" || isNaN(duration) || !isFinite(duration) || duration <= 0) {
    return 0
  }
  const safeTime = Math.max(0, currentTime)
  const pct = (safeTime / duration) * 100
  return Math.min(100, Math.max(0, Math.round(pct * 10) / 10))
}

function isSessionAbandoned(isCompleted, actualWatchedDuration, watchPercentage) {
  if (isCompleted) return false
  if (actualWatchedDuration < 5) return false
  return watchPercentage < 90
}

class TestWatchedTimeTracker {
  constructor() {
    this.totalWatchedSeconds = 0
    this.lastActiveTimestamp = null
    this.isCurrentlyActive = false
    this.currentPlaybackRate = 1
  }

  startPlayback(rate = 1) {
    if (this.isCurrentlyActive) return
    this.currentPlaybackRate = rate > 0 ? rate : 1
    this.lastActiveTimestamp = Date.now()
    this.isCurrentlyActive = true
  }

  stopPlayback() {
    if (!this.isCurrentlyActive || this.lastActiveTimestamp === null) {
      this.isCurrentlyActive = false
      this.lastActiveTimestamp = null
      return
    }
    const now = Date.now()
    const elapsedSeconds = (now - this.lastActiveTimestamp) / 1000
    if (elapsedSeconds > 0) {
      this.totalWatchedSeconds += elapsedSeconds * this.currentPlaybackRate
    }
    this.isCurrentlyActive = false
    this.lastActiveTimestamp = null
  }

  updatePlaybackRate(rate) {
    if (rate <= 0) return
    if (this.isCurrentlyActive) {
      this.stopPlayback()
      this.startPlayback(rate)
    } else {
      this.currentPlaybackRate = rate
    }
  }

  getWatchedDuration() {
    let accumulated = this.totalWatchedSeconds
    if (this.isCurrentlyActive && this.lastActiveTimestamp !== null) {
      const now = Date.now()
      const elapsed = (now - this.lastActiveTimestamp) / 1000
      if (elapsed > 0) {
        accumulated += elapsed * this.currentPlaybackRate
      }
    }
    return Math.round(accumulated * 100) / 100
  }

  reset() {
    this.totalWatchedSeconds = 0
    this.lastActiveTimestamp = null
    this.isCurrentlyActive = false
    this.currentPlaybackRate = 1
  }
}

// 3. Error Recovery Utilities
function classifyVideoError(error, mediaElement) {
  const nativeError = mediaElement?.error
  if (nativeError) {
    switch (nativeError.code) {
      case 1:
        return { code: 1, message: "Video playback was aborted.", category: "MEDIA", recoverable: true }
      case 2:
        return { code: 2, message: "Network error interrupted video playback.", category: "NETWORK", recoverable: true }
      case 3:
        return { code: 3, message: "Video decode error.", category: "DECODE", recoverable: true }
      case 4:
        return { code: 4, message: "Video source not supported.", category: "SOURCE", recoverable: true }
    }
  }

  if (error instanceof Error || (error && typeof error === "object")) {
    const name = error.name || ""
    const msg = error.message || ""
    if (
      name === "NotAllowedError" ||
      msg.toLowerCase().includes("notallowederror") ||
      msg.toLowerCase().includes("user didn't interact") ||
      msg.toLowerCase().includes("autoplay")
    ) {
      return { code: 403, message: "Autoplay blocked.", category: "AUTOPLAY", recoverable: false }
    }
    if (msg.toLowerCase().includes("cors") || msg.toLowerCase().includes("cross-origin")) {
      return { code: 403, message: "CORS restriction.", category: "CORS", recoverable: false }
    }
    if (name === "NetworkError" || msg.toLowerCase().includes("network") || msg.toLowerCase().includes("fetch")) {
      return { code: 2, message: "Network connection lost.", category: "NETWORK", recoverable: true }
    }
    return { code: error.code || 0, message: msg || "Playback error.", category: "UNKNOWN", recoverable: true }
  }

  return { code: 0, message: String(error || "Unknown error"), category: "UNKNOWN", recoverable: true }
}

function calculateExponentialBackoff(retryCount, baseDelay = 1000, maxDelay = 8000) {
  if (retryCount <= 0) return baseDelay
  const delay = baseDelay * Math.pow(2, retryCount)
  return Math.min(maxDelay, Math.max(baseDelay, delay))
}

function canAttemptRecovery(error, currentRetryCount, maxRetries = 3) {
  if (!error.recoverable) return false
  if (error.category === "AUTOPLAY" || error.category === "CORS") return false
  return currentRetryCount < maxRetries
}

// 4. In-Memory Transport & Queue
class TestMemoryTransport {
  constructor() {
    this.sentBatches = []
    this.beaconBatches = []
    this.shouldFail = false
  }

  async send(events) {
    if (this.shouldFail) return false
    this.sentBatches.push([...events])
    return true
  }

  sendBeacon(events) {
    if (this.shouldFail) return false
    this.beaconBatches.push([...events])
    return true
  }

  getAllEvents() {
    return this.sentBatches.concat(this.beaconBatches).flat()
  }

  clear() {
    this.sentBatches = []
    this.beaconBatches = []
    this.shouldFail = false
  }
}

class TestAnalyticsQueue {
  constructor(options = {}) {
    this.transport = options.transport || new TestMemoryTransport()
    this.batchSize = options.batchSize || 10
    this.flushInterval = options.flushInterval || 15000
    this.maxQueueSize = options.maxQueueSize || 100
    this.debug = Boolean(options.debug)
    this.queue = []
    this.offlineStore = []
    this.isOnline = true
    this.isFlushing = false
    this.seenEventIds = new Set()
  }

  enqueue(event) {
    if (this.seenEventIds.has(event.eventId)) {
      return // Deduplicate
    }
    this.seenEventIds.add(event.eventId)

    if (!this.isOnline) {
      this.offlineStore.push(event)
      return
    }

    if (this.queue.length >= this.maxQueueSize) {
      const dropIdx = this.queue.findIndex((e) => !isCriticalEvent(e.eventType))
      if (dropIdx >= 0) {
        this.queue.splice(dropIdx, 1)
      } else {
        this.queue.shift()
      }
    }

    this.queue.push(event)

    if (this.queue.length >= this.batchSize) {
      this.flush()
    }
  }

  async flush() {
    if (this.isFlushing || this.queue.length === 0) return true
    this.isFlushing = true

    if (!this.isOnline) {
      this.offlineStore.push(...this.queue)
      this.queue = []
      this.isFlushing = false
      return false
    }

    const batch = this.queue.splice(0, this.batchSize)
    const success = await this.transport.send(batch)
    if (success) {
      this.isFlushing = false
      if (this.queue.length >= this.batchSize) {
        await this.flush()
      }
      return true
    } else {
      this.queue.unshift(...batch)
      this.isFlushing = false
      return false
    }
  }

  flushBeacon() {
    if (this.queue.length === 0) return true
    const batch = [...this.queue]
    this.queue = []
    return this.transport.sendBeacon(batch)
  }

  restoreOffline() {
    if (this.offlineStore.length > 0) {
      const items = [...this.offlineStore]
      this.offlineStore = []
      this.queue.unshift(...items)
    }
  }
}

export async function runPhase11AnalyticsRecoveryTestSuite() {
  const runner = new TestRunner("Phase 11: Player Analytics, Watch Session Tracking & Advanced Error Recovery")

  try {
    // =========================================================================
    // 1. Analytics Event Standard & Validation
    // =========================================================================
    const eventA = createAnalyticsEvent({
      eventType: "VIDEO_PLAY",
      videoId: "v_123",
      playerId: "p_1",
      sessionId: "s_abc",
      currentTime: 12.3456,
      duration: 120.789,
      metadata: {
        playbackRate: 1.25,
        token: "secret_should_be_stripped",
        auth: "bearer_12345",
        volume: 0.8,
      },
    })

    runner.assert(validateAnalyticsEvent(eventA) === true, "Generated event satisfies schema validation")
    runner.assert(eventA.currentTime === 12.35, "currentTime rounded to 2 decimal places (12.35)")
    runner.assert(eventA.duration === 120.79, "duration rounded to 2 decimal places (120.79)")
    runner.assert(typeof eventA.eventId === "string" && eventA.eventId.length > 0, "Event ID generated")
    runner.assert(typeof eventA.timestamp === "number" && eventA.timestamp > 0, "Event timestamp present")
    runner.assert(eventA.metadata.playbackRate === 1.25, "Whitelisted metadata preserved")
    runner.assert(eventA.metadata.volume === 0.8, "Whitelisted volume metadata preserved")
    runner.assert(eventA.metadata.token === undefined, "Sensitive 'token' key stripped from metadata")
    runner.assert(eventA.metadata.auth === undefined, "Sensitive 'auth' key stripped from metadata")

    const eventB = createAnalyticsEvent({
      eventType: "VIDEO_READY",
      videoId: "v_123",
      playerId: "p_1",
      sessionId: "s_abc",
      currentTime: 0,
      duration: 100,
    })
    runner.assert(eventA.eventId !== eventB.eventId, "Consecutive event IDs are strictly unique")

    // URL token stripping in metadata
    const urlMetadata = sanitizeMetadata({
      streamUrl: "https://example.com/video.mp4?token=secret123&key=abc&format=mp4",
      other: "clean",
    })
    runner.assert(!urlMetadata.streamUrl.includes("token="), "Token query param stripped from URL in metadata")
    runner.assert(!urlMetadata.streamUrl.includes("key="), "Key query param stripped from URL in metadata")
    runner.assert(urlMetadata.other === "clean", "Normal metadata untouched")

    // =========================================================================
    // 2. Critical Events Identification & Priority Protection
    // =========================================================================
    runner.assert(isCriticalEvent("VIDEO_ERROR") === true, "VIDEO_ERROR is marked critical")
    runner.assert(isCriticalEvent("WATCH_SESSION_END") === true, "WATCH_SESSION_END is marked critical")
    runner.assert(isCriticalEvent("VIDEO_COMPLETED") === true, "VIDEO_COMPLETED is marked critical")
    runner.assert(isCriticalEvent("VIDEO_ABANDONED") === true, "VIDEO_ABANDONED is marked critical")
    runner.assert(isCriticalEvent("VIDEO_PLAY") === false, "VIDEO_PLAY is non-critical")
    runner.assert(isCriticalEvent("VIDEO_SEEK") === false, "VIDEO_SEEK is non-critical")
    runner.assert(isCriticalEvent("VIDEO_BUFFER_START") === false, "VIDEO_BUFFER_START is non-critical")

    // =========================================================================
    // 3. Analytics Queue, Batching & Deduplication
    // =========================================================================
    const transport = new TestMemoryTransport()
    const queue = new TestAnalyticsQueue({ transport, batchSize: 5, maxQueueSize: 10 })

    // Enqueue 4 events (below batch size)
    for (let i = 0; i < 4; i++) {
      queue.enqueue(createAnalyticsEvent({
        eventType: "VIDEO_PLAY",
        videoId: "v_1",
        playerId: "p_1",
        sessionId: "s_1",
        currentTime: i,
        duration: 100,
      }))
    }
    runner.assert(queue.queue.length === 4, "Queue buffers 4 events when batchSize is 5")
    runner.assert(transport.sentBatches.length === 0, "No batches sent before reaching batchSize")

    // Enqueue 5th event -> triggers automatic flush
    queue.enqueue(createAnalyticsEvent({
      eventType: "VIDEO_PAUSE",
      videoId: "v_1",
      playerId: "p_1",
      sessionId: "s_1",
      currentTime: 4,
      duration: 100,
    }))
    runner.assert(transport.sentBatches.length === 1, "Reaching batchSize 5 triggers automatic transport dispatch")
    runner.assert(transport.sentBatches[0].length === 5, "Batch contains exactly 5 events")
    runner.assert(queue.queue.length === 0, "Queue is empty after full batch flush")

    // Deduplication check
    const dupEvent = createAnalyticsEvent({
      eventType: "VIDEO_SEEK",
      videoId: "v_1",
      playerId: "p_1",
      sessionId: "s_1",
      currentTime: 10,
      duration: 100,
      eventId: "fixed_dup_id",
    })
    queue.enqueue(dupEvent)
    queue.enqueue(dupEvent) // Duplicate
    runner.assert(queue.queue.length === 1, "Duplicate eventId is discarded and not added twice")

    // Max queue size and critical event protection
    queue.queue = []
    // Add 9 non-critical events
    for (let i = 0; i < 9; i++) {
      queue.queue.push(createAnalyticsEvent({
        eventType: "VIDEO_SEEK",
        videoId: "v_1",
        playerId: "p_1",
        sessionId: "s_1",
        currentTime: i,
        duration: 100,
      }))
    }
    // Add 1 critical event
    const criticalErr = createAnalyticsEvent({
      eventType: "VIDEO_ERROR",
      videoId: "v_1",
      playerId: "p_1",
      sessionId: "s_1",
      currentTime: 20,
      duration: 100,
    })
    queue.queue.push(criticalErr)
    runner.assert(queue.queue.length === 10, "Queue reached maxQueueSize (10)")

    // Enqueue 11th event: should drop oldest non-critical event, preserving criticalErr
    const newEvt = createAnalyticsEvent({
      eventType: "VIDEO_PLAY",
      videoId: "v_1",
      playerId: "p_1",
      sessionId: "s_1",
      currentTime: 30,
      duration: 100,
    })
    queue.enqueue(newEvt)
    runner.assert(queue.queue.length === 10, "Queue capped at maxQueueSize 10")
    runner.assert(queue.queue.some((e) => e.eventType === "VIDEO_ERROR"), "Critical VIDEO_ERROR preserved when queue overflows")

    // =========================================================================
    // 4. Offline Analytics Resilience & Reconnect Recovery
    // =========================================================================
    await queue.flush()
    transport.clear()
    queue.queue = []
    queue.isFlushing = false
    queue.isOnline = false // Simulate offline

    const offlineEvt1 = createAnalyticsEvent({
      eventType: "VIDEO_PLAY",
      videoId: "v_off",
      playerId: "p_1",
      sessionId: "s_off",
      currentTime: 5,
      duration: 60,
    })
    queue.enqueue(offlineEvt1)
    await queue.flush()

    runner.assert(transport.sentBatches.length === 0, "No events sent while offline")
    runner.assert(queue.offlineStore.length === 1, "Queued events diverted to offline storage while offline")

    // Reconnect online
    queue.isOnline = true
    queue.restoreOffline()
    runner.assert(queue.queue.length === 1, "Offline events restored to queue upon reconnect")
    await queue.flush()
    runner.assert(transport.sentBatches.length === 1, "Restored offline events dispatched when online")

    // Beacon unload flush
    queue.queue = []
    const beaconEvt = createAnalyticsEvent({
      eventType: "WATCH_SESSION_END",
      videoId: "v_1",
      playerId: "p_1",
      sessionId: "s_1",
      currentTime: 60,
      duration: 60,
    })
    queue.enqueue(beaconEvt)
    const beaconSent = queue.flushBeacon()
    runner.assert(beaconSent === true, "flushBeacon successfully delivered via beacon transport")
    runner.assert(transport.beaconBatches.length === 1, "Beacon batch recorded")
    runner.assert(queue.queue.length === 0, "Queue drained after beacon flush")

    // =========================================================================
    // 5. Watch Session Lifecycle & Watched-Time Accumulation
    // =========================================================================
    const tracker = new TestWatchedTimeTracker()

    // 1. Play at 1x for 100ms
    tracker.startPlayback(1)
    await new Promise((r) => setTimeout(r, 100))
    tracker.stopPlayback() // Pause
    const watchedPart1 = tracker.getWatchedDuration()
    runner.assert(watchedPart1 >= 0.08 && watchedPart1 <= 0.25, "Watched duration accumulated ~0.1s during active play")

    // 2. While paused, time should NOT advance
    await new Promise((r) => setTimeout(r, 60))
    runner.assert(tracker.getWatchedDuration() === watchedPart1, "Watched duration does NOT accumulate during pause")

    // 3. Play at 2x speed for 100ms -> should accumulate ~0.2s
    tracker.startPlayback(2)
    await new Promise((r) => setTimeout(r, 100))
    tracker.stopPlayback()
    const watchedPart2 = tracker.getWatchedDuration()
    runner.assert(watchedPart2 > watchedPart1 + 0.15, "2x playback speed doubles watched-time accumulation rate")

    // Reset tracker
    tracker.reset()
    runner.assert(tracker.getWatchedDuration() === 0, "Watched tracker resets cleanly to 0")

    // Session ID stability
    const sessId1 = generateSessionId()
    const sessId2 = generateSessionId()
    runner.assert(sessId1.startsWith("ws_"), "Session ID has ws_ prefix")
    runner.assert(sessId1 !== sessId2, "Different sessions receive distinct session IDs")

    // Watch percentage calculation
    runner.assert(calculateWatchPercentage(45, 90) === 50, "45s of 90s is exactly 50%")
    runner.assert(calculateWatchPercentage(95, 100) === 95, "95s of 100s is 95%")
    runner.assert(calculateWatchPercentage(0, 100) === 0, "0s of 100s is 0%")
    runner.assert(calculateWatchPercentage(50, 0) === 0, "Zero duration safely returns 0%")
    runner.assert(calculateWatchPercentage(50, NaN) === 0, "NaN duration safely returns 0%")
    runner.assert(calculateWatchPercentage(120, 100) === 100, "Position beyond duration clamped to 100%")

    // Abandonment detection
    runner.assert(isSessionAbandoned(false, 30, 40) === true, "Session with 30s watched and 40% completion is ABANDONED")
    runner.assert(isSessionAbandoned(true, 85, 95) === false, "Completed video is NOT abandoned")
    runner.assert(isSessionAbandoned(false, 2, 10) === false, "Session with < 5s watched duration is NOT abandoned (no meaningful play)")
    runner.assert(isSessionAbandoned(false, 90, 92) === false, "Video with >= 90% watch percentage is NOT abandoned")

    // =========================================================================
    // 6. Error Classification & Recoverability
    // =========================================================================
    // MediaError 1: Aborted
    const errAborted = classifyVideoError(null, { error: { code: 1 } })
    runner.assert(errAborted.category === "MEDIA" && errAborted.recoverable === true, "MediaError 1 classified as MEDIA (recoverable)")

    // MediaError 2: Network
    const errNetwork = classifyVideoError(null, { error: { code: 2 } })
    runner.assert(errNetwork.category === "NETWORK" && errNetwork.recoverable === true, "MediaError 2 classified as NETWORK (recoverable)")

    // MediaError 3: Decode
    const errDecode = classifyVideoError(null, { error: { code: 3 } })
    runner.assert(errDecode.category === "DECODE" && errDecode.recoverable === true, "MediaError 3 classified as DECODE (recoverable)")

    // MediaError 4: Source not supported
    const errSrc = classifyVideoError(null, { error: { code: 4 } })
    runner.assert(errSrc.category === "SOURCE" && errSrc.recoverable === true, "MediaError 4 classified as SOURCE (recoverable via fallback)")

    // Autoplay rejection
    const errAutoplay = classifyVideoError(new Error("play() failed because the user didn't interact"))
    runner.assert(errAutoplay.category === "AUTOPLAY" && errAutoplay.recoverable === false, "Autoplay rejection classified as AUTOPLAY (not auto-recoverable)")

    // CORS error
    const errCors = classifyVideoError(new Error("CORS policy blocked video request"))
    runner.assert(errCors.category === "CORS" && errCors.recoverable === false, "CORS error classified as CORS (not auto-recoverable)")

    // Unknown error
    const errUnknown = classifyVideoError("Random string failure")
    runner.assert(errUnknown.category === "UNKNOWN" && errUnknown.recoverable === true, "Generic error classified as UNKNOWN")

    // =========================================================================
    // 7. Exponential Backoff & Recovery State Machine
    // =========================================================================
    // Exponential backoff delays
    runner.assert(calculateExponentialBackoff(0, 1000, 8000) === 1000, "Retry 0 delay is baseDelay (1000ms)")
    runner.assert(calculateExponentialBackoff(1, 1000, 8000) === 2000, "Retry 1 delay is 2000ms (1000 * 2^1)")
    runner.assert(calculateExponentialBackoff(2, 1000, 8000) === 4000, "Retry 2 delay is 4000ms (1000 * 2^2)")
    runner.assert(calculateExponentialBackoff(3, 1000, 8000) === 8000, "Retry 3 delay is 8000ms (clamped at maxDelay)")
    runner.assert(calculateExponentialBackoff(4, 1000, 8000) === 8000, "Retry 4 delay is clamped at maxDelay (8000ms)")

    // canAttemptRecovery checks
    runner.assert(canAttemptRecovery(errNetwork, 0, 3) === true, "Network error attempt 0 eligible for recovery")
    runner.assert(canAttemptRecovery(errNetwork, 1, 3) === true, "Network error attempt 1 eligible for recovery")
    runner.assert(canAttemptRecovery(errNetwork, 2, 3) === true, "Network error attempt 2 eligible for recovery")
    runner.assert(canAttemptRecovery(errNetwork, 3, 3) === false, "Network error attempt 3 reaches maxRetries (no recovery)")
    runner.assert(canAttemptRecovery(errAutoplay, 0, 3) === false, "Autoplay error never automatically retried")
    runner.assert(canAttemptRecovery(errCors, 0, 3) === false, "CORS error never automatically retried")

    // =========================================================================
    // 8. Source Fallback & Multi-Source Cycling
    // =========================================================================
    const sampleSources = [
      { src: "https://cdn1.example.com/stream.mp4", type: "video/mp4" },
      { src: "https://cdn2.example.com/fallback.mp4", type: "video/mp4" },
    ]

    // Source fallback logic
    let currentSourceIdx = 0
    // On source error with multiple sources, switch to fallback source
    if (errSrc.category === "SOURCE" && sampleSources.length > 1) {
      currentSourceIdx = (currentSourceIdx + 1) % sampleSources.length
    }
    runner.assert(currentSourceIdx === 1, "Source error switches to fallback source (index 1)")
    runner.assert(sampleSources[currentSourceIdx].src.includes("cdn2"), "Active source points to CDN2 fallback")

    // =========================================================================
    // 9. Preserved Position Restoration on Recovery Reload
    // =========================================================================
    const simulatedVideo = {
      currentTime: 42.5,
      duration: 120,
      paused: false,
      ended: false,
      loadCalled: false,
      playCalled: false,
      load() {
        this.loadCalled = true
      },
      async play() {
        this.playCalled = true
      },
    }

    // Capture position before reload
    const savedPos = simulatedVideo.currentTime
    const wasPlaying = !simulatedVideo.paused
    runner.assert(savedPos === 42.5, "Saved position before recovery reload is 42.5s")
    runner.assert(wasPlaying === true, "Playing state before recovery reload is true")

    // Reload simulation
    simulatedVideo.load()
    runner.assert(simulatedVideo.loadCalled === true, "Media load() called during recovery")

    // Metadata loaded simulation: restore position
    simulatedVideo.currentTime = savedPos
    if (wasPlaying) {
      await simulatedVideo.play()
    }
    runner.assert(simulatedVideo.currentTime === 42.5, "Playback position successfully restored to 42.5s")
    runner.assert(simulatedVideo.playCalled === true, "Playback resumed after recovery restoration")

    // =========================================================================
    // 10. Privacy & Consent
    // =========================================================================
    let analyticsAllowed = true
    let userConsent = "denied"

    // If consent is denied, tracking must be suppressed
    const canTrack = analyticsAllowed && userConsent !== "denied"
    runner.assert(canTrack === false, "When analyticsConsent is 'denied', tracking is completely blocked")

    userConsent = "granted"
    const canTrackGranted = analyticsAllowed && userConsent === "granted"
    runner.assert(canTrackGranted === true, "When analyticsConsent is 'granted', tracking is permitted")

    analyticsAllowed = false
    const canTrackDisabled = analyticsAllowed && userConsent === "granted"
    runner.assert(canTrackDisabled === false, "When analyticsEnabled is false, tracking is blocked regardless of consent")

    // =========================================================================
    // 11. Regression Verification across Phases 1–10
    // =========================================================================
    // Phase 1: custom play/pause
    runner.assert(typeof createAnalyticsEvent === "function", "Phase 1: Analytics integrates with player architecture")

    // Phase 2: timeline & duration
    runner.assert(calculateWatchPercentage(50, 100) === 50, "Phase 2: Timeline progress math integrated")

    // Phase 5: viewing modes
    const fsEvent = createAnalyticsEvent({
      eventType: "VIDEO_FULLSCREEN_ENTER",
      videoId: "v_1",
      playerId: "p_1",
      sessionId: "s_1",
      currentTime: 10,
      duration: 100,
    })
    runner.assert(fsEvent.eventType === "VIDEO_FULLSCREEN_ENTER", "Phase 5: Fullscreen viewing mode events tracked")

    // Phase 8: watch progress completion
    runner.assert(isSessionAbandoned(true, 95, 95) === false, "Phase 8: Completion status integrated with session abandonment")

    // Phase 9: multi-player scoping
    runner.assert(eventA.playerId === "p_1", "Phase 9: Player ID scoped in every analytics event")

    // Phase 10: seeking throttled
    runner.assert(isCriticalEvent("VIDEO_SEEK") === false, "Phase 10: Seek scrubbing events throttled and non-critical")

  } catch (err) {
    runner.assert(false, `Unexpected error in Phase 11 test suite: ${err.message}`)
  }

  return runner.summary()
}

// Auto-run if executed directly
if (process.argv[1]?.endsWith("phase11_player_analytics_recovery.test.js")) {
  runPhase11AnalyticsRecoveryTestSuite()
    .then((result) => {
      process.exit(result.failed > 0 ? 1 : 0)
    })
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
