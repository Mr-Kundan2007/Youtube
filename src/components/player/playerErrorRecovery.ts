import type {
  ClassifiedVideoError,
  PlayerRecoveryConfig,
  PlayerRecoveryState,
} from "./analyticsTypes"
import {
  classifyVideoError,
  calculateExponentialBackoff,
  canAttemptRecovery,
} from "./errorRecoveryUtils"
import type { VideoSource } from "./VideoElement"

export interface RecoveryAttemptCallbackParams {
  retryCount: number
  delayMs: number
  sourceIndex: number
  nextSource?: VideoSource
  isManual: boolean
}

/**
 * Manages video playback error classification, exponential backoff retries,
 * source fallback switching, position restoration, and cleanup.
 */
export class PlayerErrorRecoveryManager {
  private maxRetries: number
  private baseDelay: number
  private maxDelay: number
  private enableSourceFallback: boolean

  private state: PlayerRecoveryState = {
    isRecovering: false,
    retryCount: 0,
    maxRetries: 3,
    nextRetryDelayMs: 0,
    lastError: null,
    sourceIndex: 0,
  }

  private lastKnownPosition = 0
  private wasPlayingBeforeError = false
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private onStateChange?: (state: PlayerRecoveryState) => void

  constructor(
    config: PlayerRecoveryConfig = {},
    onStateChange?: (state: PlayerRecoveryState) => void
  ) {
    this.maxRetries = config.maxRetries ?? 3
    this.baseDelay = config.baseDelay ?? 1000
    this.maxDelay = config.maxDelay ?? 8000
    this.enableSourceFallback = config.enableSourceFallback ?? true
    this.onStateChange = onStateChange
    this.state.maxRetries = this.maxRetries
  }

  getState(): PlayerRecoveryState {
    return { ...this.state }
  }

  getLastKnownPosition(): number {
    return this.lastKnownPosition
  }

  getWasPlaying(): boolean {
    return this.wasPlayingBeforeError
  }

  private updateState(updates: Partial<PlayerRecoveryState>): void {
    this.state = { ...this.state, ...updates }
    if (this.onStateChange) {
      this.onStateChange({ ...this.state })
    }
  }

  /**
   * Handle an error event from the video element.
   */
  handleError(
    rawError: unknown,
    mediaElement: HTMLVideoElement | null,
    sources: VideoSource[] = [],
    onAttempt: (params: RecoveryAttemptCallbackParams) => void
  ): ClassifiedVideoError {
    this.clearTimer()

    const classified = classifyVideoError(rawError, mediaElement)

    // Preserve playback position and playing state before error
    if (mediaElement) {
      this.lastKnownPosition = Math.max(
        0,
        mediaElement.currentTime || this.lastKnownPosition
      )
      this.wasPlayingBeforeError = !mediaElement.paused && !mediaElement.ended
    }

    const isEligible = canAttemptRecovery(
      classified,
      this.state.retryCount,
      this.maxRetries
    )

    if (!isEligible) {
      this.updateState({
        isRecovering: false,
        lastError: classified,
      })
      return classified
    }

    const currentRetry = this.state.retryCount
    const delay = calculateExponentialBackoff(
      currentRetry,
      this.baseDelay,
      this.maxDelay
    )

    // Determine if source fallback should be triggered
    let nextSourceIdx = this.state.sourceIndex
    if (
      this.enableSourceFallback &&
      sources.length > 1 &&
      (classified.category === "SOURCE" || currentRetry >= 1)
    ) {
      nextSourceIdx = (this.state.sourceIndex + 1) % sources.length
    }

    this.updateState({
      isRecovering: true,
      retryCount: currentRetry + 1,
      nextRetryDelayMs: delay,
      lastError: classified,
      sourceIndex: nextSourceIdx,
    })

    this.retryTimer = setTimeout(() => {
      this.retryTimer = null
      onAttempt({
        retryCount: this.state.retryCount,
        delayMs: delay,
        sourceIndex: nextSourceIdx,
        nextSource: sources[nextSourceIdx],
        isManual: false,
      })
    }, delay)

    return classified
  }

  /**
   * Immediately trigger manual recovery.
   */
  manualRetry(
    sources: VideoSource[] = [],
    onAttempt: (params: RecoveryAttemptCallbackParams) => void
  ): void {
    this.clearTimer()

    let nextSourceIdx = this.state.sourceIndex
    if (this.enableSourceFallback && sources.length > 1) {
      nextSourceIdx = (this.state.sourceIndex + 1) % sources.length
    }

    this.updateState({
      isRecovering: true,
      retryCount: this.state.retryCount + 1,
      nextRetryDelayMs: 0,
      sourceIndex: nextSourceIdx,
    })

    onAttempt({
      retryCount: this.state.retryCount,
      delayMs: 0,
      sourceIndex: nextSourceIdx,
      nextSource: sources[nextSourceIdx],
      isManual: true,
    })
  }

  /**
   * Cancel pending recovery and remain in error state.
   */
  cancelRecovery(): void {
    this.clearTimer()
    this.updateState({
      isRecovering: false,
      nextRetryDelayMs: 0,
    })
  }

  /**
   * Call after successful reload and metadata loading to restore position and playback.
   */
  restorePlayback(mediaElement: HTMLVideoElement | null): void {
    this.clearTimer()
    if (mediaElement && this.lastKnownPosition > 0) {
      const dur = mediaElement.duration || 0
      const safePos = dur > 0 ? Math.min(this.lastKnownPosition, Math.max(0, dur - 1)) : this.lastKnownPosition
      try {
        mediaElement.currentTime = safePos
      } catch {
        // Ignore seek error during restore
      }
    }

    if (mediaElement && this.wasPlayingBeforeError) {
      mediaElement.play().catch(() => {
        // Fallback safely if browser blocks play
      })
    }

    this.updateState({
      isRecovering: false,
      retryCount: 0,
      nextRetryDelayMs: 0,
      lastError: null,
    })
  }

  reset(): void {
    this.clearTimer()
    this.lastKnownPosition = 0
    this.wasPlayingBeforeError = false
    this.updateState({
      isRecovering: false,
      retryCount: 0,
      nextRetryDelayMs: 0,
      lastError: null,
      sourceIndex: 0,
    })
  }

  clearTimer(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }
  }

  destroy(): void {
    this.clearTimer()
    this.onStateChange = undefined
  }
}
