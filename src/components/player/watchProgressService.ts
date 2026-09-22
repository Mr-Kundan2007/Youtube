/**
 * Watch Progress Persistence Service Layer
 * Decouples video player persistence logic from concrete storage implementations.
 * Provides LocalWatchProgressProvider for localStorage and is architected for API backends.
 */

import {
  type WatchProgressData,
  getProgressStorageKey,
} from "./watchProgressUtils"

export interface WatchProgressProvider {
  loadProgress(videoId: string): Promise<WatchProgressData | null> | WatchProgressData | null
  saveProgress(data: WatchProgressData): Promise<void> | void
  clearProgress(videoId: string): Promise<void> | void
}

/**
 * LocalStorage implementation of WatchProgressProvider with robust error handling,
 * quota management, and corrupted data protection.
 */
export class LocalWatchProgressProvider implements WatchProgressProvider {
  loadProgress(videoId: string): WatchProgressData | null {
    if (typeof window === "undefined" || !videoId) return null

    try {
      const key = getProgressStorageKey(videoId)
      const raw = localStorage.getItem(key)
      if (!raw) return null

      const parsed = JSON.parse(raw)
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        parsed.videoId === videoId &&
        typeof parsed.currentTime === "number" &&
        Number.isFinite(parsed.currentTime) &&
        parsed.currentTime >= 0
      ) {
        return {
          videoId: parsed.videoId,
          currentTime: parsed.currentTime,
          duration: typeof parsed.duration === "number" && Number.isFinite(parsed.duration) ? parsed.duration : 0,
          progressPercentage: typeof parsed.progressPercentage === "number" ? parsed.progressPercentage : 0,
          isCompleted: Boolean(parsed.isCompleted),
          lastWatchedAt: parsed.lastWatchedAt || new Date().toISOString(),
          playbackRate: parsed.playbackRate || 1,
        }
      }

      // Corrupted entry: clean up safely
      localStorage.removeItem(key)
      return null
    } catch {
      return null
    }
  }

  saveProgress(data: WatchProgressData): void {
    if (typeof window === "undefined" || !data || !data.videoId) return

    try {
      const key = getProgressStorageKey(data.videoId)
      localStorage.setItem(key, JSON.stringify(data))
    } catch {
      // Handles QuotaExceededError or private browsing restrictions silently
    }
  }

  clearProgress(videoId: string): void {
    if (typeof window === "undefined" || !videoId) return

    try {
      const key = getProgressStorageKey(videoId)
      localStorage.removeItem(key)
    } catch {
      // Ignore storage cleanup failures
    }
  }
}

/**
 * API-backed implementation of WatchProgressProvider with local fallback and conflict resolution.
 */
export class ApiWatchProgressProvider implements WatchProgressProvider {
  private localFallback = new LocalWatchProgressProvider()

  async loadProgress(videoId: string): Promise<WatchProgressData | null> {
    if (!videoId) return null

    // 1. Load local copy first
    const local = this.localFallback.loadProgress(videoId)

    // 2. If client is offline or server unavailable, return local copy
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return local
    }

    try {
      const { apiClient } = await import("@/services/apiClient")
      const res = await apiClient.get<{ success: boolean; progress?: any }>(
        `/videos/${encodeURIComponent(videoId)}/progress`,
        { timeoutMs: 3000 }
      )

      if (res?.success && res.progress) {
        const remote = res.progress
        const remoteData: WatchProgressData = {
          videoId,
          currentTime: typeof remote.currentTime === "number" ? remote.currentTime : 0,
          duration: typeof remote.duration === "number" ? remote.duration : 0,
          progressPercentage: typeof remote.progressPercentage === "number" ? remote.progressPercentage : 0,
          isCompleted: Boolean(remote.isCompleted || remote.completed),
          lastWatchedAt: remote.lastWatchedAt || new Date().toISOString(),
          playbackRate: typeof remote.playbackRate === "number" ? remote.playbackRate : 1,
        }

        // Conflict resolution: compare timestamps if local also exists
        if (local && local.lastWatchedAt) {
          const localTime = new Date(local.lastWatchedAt).getTime()
          const remoteTime = new Date(remoteData.lastWatchedAt).getTime()

          if (localTime > remoteTime + 1000 && (local.isCompleted || local.currentTime > remoteData.currentTime)) {
            return local
          }
        }

        // Cache remote data locally for offline availability
        this.localFallback.saveProgress(remoteData)
        return remoteData
      }
    } catch {
      // On network failure or auth error, fallback to local storage
    }

    return local
  }

  async saveProgress(data: WatchProgressData): Promise<void> {
    if (!data || !data.videoId) return

    // 1. Always save locally immediately
    this.localFallback.saveProgress(data)

    // 2. If offline, defer backend sync
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return
    }

    try {
      const { apiClient } = await import("@/services/apiClient")
      await apiClient.post(
        `/videos/${encodeURIComponent(data.videoId)}/progress`,
        {
          currentTime: data.currentTime,
          duration: data.duration,
          progressPercentage: data.progressPercentage,
          completed: data.isCompleted,
          lastWatchedAt: data.lastWatchedAt,
          playbackRate: data.playbackRate,
        },
        { timeoutMs: 4000 }
      )
    } catch {
      // Silent failure: local storage preserves state
    }
  }

  async clearProgress(videoId: string): Promise<void> {
    if (!videoId) return
    this.localFallback.clearProgress(videoId)
  }
}

/**
 * Watch Progress Service facade delegating to the active provider.
 * Uses ApiWatchProgressProvider by default for multi-device sync with Local fallback.
 */
class WatchProgressServiceClass {
  private provider: WatchProgressProvider = new ApiWatchProgressProvider()

  setProvider(provider: WatchProgressProvider): void {
    this.provider = provider
  }

  getProvider(): WatchProgressProvider {
    return this.provider
  }

  async loadProgress(videoId: string): Promise<WatchProgressData | null> {
    if (!videoId) return null
    try {
      return await this.provider.loadProgress(videoId)
    } catch {
      return null
    }
  }

  async saveProgress(data: WatchProgressData): Promise<void> {
    if (!data || !data.videoId) return
    try {
      await this.provider.saveProgress(data)
    } catch {
      // Failsafe: never crash playback on save failure
    }
  }

  async clearProgress(videoId: string): Promise<void> {
    if (!videoId) return
    try {
      await this.provider.clearProgress(videoId)
    } catch {
      // Ignore
    }
  }
}

export const WatchProgressService = new WatchProgressServiceClass()
export default WatchProgressService
