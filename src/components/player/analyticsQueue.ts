import type { AnalyticsTransport, VideoAnalyticsEvent } from "./analyticsTypes"
import { isCriticalEvent, EventDeduplicator } from "./analyticsUtils"

const OFFLINE_STORE_KEY = "yt_offline_analytics_queue"
const OFFLINE_MAX_ITEMS = 100
const OFFLINE_EXPIRY_MS = 24 * 60 * 60 * 1000 // 24 hours

export interface StoredOfflineItem {
  event: VideoAnalyticsEvent
  queuedAt: number
}

/**
 * Offline storage manager using localStorage with expiry and bounds protection.
 */
export class OfflineAnalyticsStore {
  static saveEvents(events: VideoAnalyticsEvent[]): void {
    if (typeof window === "undefined" || !window.localStorage) return
    try {
      const existing = this.loadEvents()
      const now = Date.now()

      const combined: StoredOfflineItem[] = [
        ...existing.map((e) => ({ event: e, queuedAt: now })),
        ...events.map((e) => ({ event: e, queuedAt: now })),
      ]

      // Filter expired and limit max size
      const valid = combined
        .filter((item) => now - item.queuedAt < OFFLINE_EXPIRY_MS)
        .slice(-OFFLINE_MAX_ITEMS)

      window.localStorage.setItem(OFFLINE_STORE_KEY, JSON.stringify(valid))
    } catch {
      // Safe fallback if quota exceeded
    }
  }

  static loadEvents(): VideoAnalyticsEvent[] {
    if (typeof window === "undefined" || !window.localStorage) return []
    try {
      const raw = window.localStorage.getItem(OFFLINE_STORE_KEY)
      if (!raw) return []
      const parsed = JSON.parse(raw) as StoredOfflineItem[]
      const now = Date.now()
      return parsed
        .filter((item) => now - item.queuedAt < OFFLINE_EXPIRY_MS)
        .map((item) => item.event)
    } catch {
      return []
    }
  }

  static clear(): void {
    if (typeof window === "undefined" || !window.localStorage) return
    try {
      window.localStorage.removeItem(OFFLINE_STORE_KEY)
    } catch {
      // Ignore
    }
  }
}

export interface AnalyticsQueueOptions {
  transport: AnalyticsTransport
  batchSize?: number
  flushInterval?: number
  maxQueueSize?: number
  debug?: boolean
  onBatchSent?: (events: VideoAnalyticsEvent[]) => void
}

/**
 * AnalyticsQueue: Manages buffering, batching, priority retention,
 * offline recovery, and resilient dispatch of video events.
 */
export class AnalyticsQueue {
  private queue: VideoAnalyticsEvent[] = []
  private transport: AnalyticsTransport
  private batchSize: number
  private flushInterval: number
  private maxQueueSize: number
  private debug: boolean
  private onBatchSent?: (events: VideoAnalyticsEvent[]) => void

  private flushTimer: ReturnType<typeof setInterval> | null = null
  private isFlushing = false
  private deduplicator = new EventDeduplicator(1000)
  private onlineListener: (() => void) | null = null

  constructor(options: AnalyticsQueueOptions) {
    this.transport = options.transport
    this.batchSize = options.batchSize || 10
    this.flushInterval = options.flushInterval || 15000
    this.maxQueueSize = options.maxQueueSize || 100
    this.debug = Boolean(options.debug)
    this.onBatchSent = options.onBatchSent

    this.startInterval()
    this.setupOnlineRecovery()
  }

  private startInterval(): void {
    if (this.flushTimer) clearInterval(this.flushTimer)
    this.flushTimer = setInterval(() => {
      this.flush().catch(() => {})
    }, this.flushInterval)
  }

  private setupOnlineRecovery(): void {
    if (typeof window !== "undefined") {
      this.onlineListener = () => {
        if (this.debug) {
          console.debug("[Video Analytics] Online event detected, restoring offline queue...")
        }
        this.restoreOfflineEvents()
        this.flush().catch(() => {})
      }
      window.addEventListener("online", this.onlineListener)
      // Initial check for existing offline items
      this.restoreOfflineEvents()
    }
  }

  private restoreOfflineEvents(): void {
    const offlineEvents = OfflineAnalyticsStore.loadEvents()
    if (offlineEvents.length > 0) {
      OfflineAnalyticsStore.clear()
      for (const evt of offlineEvents) {
        this.enqueue(evt)
      }
    }
  }

  setDebug(debug: boolean): void {
    this.debug = debug
  }

  setTransport(transport: AnalyticsTransport): void {
    this.transport = transport
  }

  /**
   * Add an event to the queue with deduplication and size bounding.
   */
  enqueue(event: VideoAnalyticsEvent): void {
    if (this.deduplicator.isDuplicate(event.eventId)) {
      return
    }

    // Queue size management with critical event protection
    if (this.queue.length >= this.maxQueueSize) {
      // Find oldest non-critical event to drop
      const dropIndex = this.queue.findIndex((e) => !isCriticalEvent(e.eventType))
      if (dropIndex >= 0) {
        this.queue.splice(dropIndex, 1)
      } else {
        // If all are critical, drop the oldest event
        this.queue.shift()
      }
    }

    this.queue.push(event)

    if (this.debug) {
      console.debug(
        `[Video Analytics] Queued: ${event.eventType} (Queue size: ${this.queue.length})`,
        event
      )
    }

    // Immediate flush if batch size threshold reached
    if (this.queue.length >= this.batchSize) {
      this.flush().catch(() => {})
    }
  }

  /**
   * Flush pending queued events via the transport.
   */
  async flush(): Promise<boolean> {
    if (this.isFlushing || this.queue.length === 0) return true
    this.isFlushing = true

    // Check online status
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      if (this.debug) {
        console.debug("[Video Analytics] Device is offline. Preserving queue in offline storage.")
      }
      OfflineAnalyticsStore.saveEvents(this.queue)
      this.isFlushing = false
      return false
    }

    const batchToSend = this.queue.splice(0, this.batchSize)

    try {
      const success = await this.transport.send(batchToSend)
      if (success) {
        if (this.debug) {
          console.debug(
            `[Video Analytics] Successfully sent batch of ${batchToSend.length} events.`
          )
        }
        if (this.onBatchSent) {
          this.onBatchSent(batchToSend)
        }
        this.isFlushing = false
        // If remaining events still meet batchSize, flush again
        if (this.queue.length >= this.batchSize) {
          this.flush().catch(() => {})
        }
        return true
      } else {
        // Transport failed: return batch to front of queue
        this.queue.unshift(...batchToSend)
        OfflineAnalyticsStore.saveEvents(batchToSend)
        this.isFlushing = false
        return false
      }
    } catch {
      this.queue.unshift(...batchToSend)
      OfflineAnalyticsStore.saveEvents(batchToSend)
      this.isFlushing = false
      return false
    }
  }

  /**
   * Synchronous or keepalive beacon flush for page unload.
   */
  flushBeacon(): boolean {
    if (this.queue.length === 0) return true
    const batch = [...this.queue]
    this.queue = []
    return this.transport.sendBeacon(batch)
  }

  getQueueLength(): number {
    return this.queue.length
  }

  getQueuedEvents(): VideoAnalyticsEvent[] {
    return [...this.queue]
  }

  clear(): void {
    this.queue = []
    this.deduplicator.clear()
  }

  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }
    if (this.onlineListener && typeof window !== "undefined") {
      window.removeEventListener("online", this.onlineListener)
      this.onlineListener = null
    }
    this.flushBeacon()
    this.clear()
  }
}
