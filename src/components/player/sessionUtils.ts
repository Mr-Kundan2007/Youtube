/**
 * Watch Session and Engagement Tracking Utilities
 * Phase 11
 */

/**
 * Generate a cryptographically strong unique session ID.
 */
export function generateSessionId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    try {
      return `ws_${crypto.randomUUID()}`
    } catch {
      // Fallback below
    }
  }
  const timestamp = Date.now().toString(36)
  const rand = Math.random().toString(36).substring(2, 12)
  return `ws_${timestamp}_${rand}`
}

import { calculateWatchPercentage } from "./watchProgressUtils"

/**
 * Determine whether a session qualifies as abandoned.
 * A session is abandoned if playback ended before completion, but meaningful playback occurred (>= 5s).
 */
export function isSessionAbandoned(
  isCompleted: boolean,
  actualWatchedDuration: number,
  watchPercentage: number
): boolean {
  if (isCompleted) return false
  if (actualWatchedDuration < 5) return false
  return watchPercentage < 90
}

/**
 * Watched Time Accumulator
 * Tracks true wall-clock time spent actively playing, accounting for playback speed,
 * and pausing accumulation during buffering, seeking, pauses, or tab backgrounding.
 */
export class WatchedTimeTracker {
  private totalWatchedSeconds = 0
  private lastActiveTimestamp: number | null = null
  private isCurrentlyActive = false
  private currentPlaybackRate = 1

  startPlayback(rate = 1): void {
    if (this.isCurrentlyActive) return
    this.currentPlaybackRate = rate > 0 ? rate : 1
    this.lastActiveTimestamp = Date.now()
    this.isCurrentlyActive = true
  }

  stopPlayback(): void {
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

  updatePlaybackRate(rate: number): void {
    if (rate <= 0) return
    if (this.isCurrentlyActive) {
      // Flush elapsed at old rate and start fresh at new rate
      this.stopPlayback()
      this.startPlayback(rate)
    } else {
      this.currentPlaybackRate = rate
    }
  }

  getWatchedDuration(): number {
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

  reset(): void {
    this.totalWatchedSeconds = 0
    this.lastActiveTimestamp = null
    this.isCurrentlyActive = false
    this.currentPlaybackRate = 1
  }
}

/**
 * Extract dropped frames metric from native HTMLVideoElement if supported.
 */
export function getPlaybackQualityMetrics(
  videoElement: HTMLVideoElement | null
): { totalFrames?: number; droppedFrames?: number } | undefined {
  if (!videoElement) return undefined

  // Standard HTML5 Video Playback Quality API
  if (typeof videoElement.getVideoPlaybackQuality === "function") {
    try {
      const quality = videoElement.getVideoPlaybackQuality()
      return {
        totalFrames: quality.totalVideoFrames,
        droppedFrames: quality.droppedVideoFrames,
      }
    } catch {
      // Ignore unsupported browser implementations
    }
  }

  // Webkit legacy fallback
  const webkitEl = videoElement as unknown as {
    webkitDecodedFrameCount?: number
    webkitDroppedFrameCount?: number
  }

  if (
    typeof webkitEl.webkitDecodedFrameCount === "number" &&
    typeof webkitEl.webkitDroppedFrameCount === "number"
  ) {
    return {
      totalFrames: webkitEl.webkitDecodedFrameCount,
      droppedFrames: webkitEl.webkitDroppedFrameCount,
    }
  }

  return undefined
}
