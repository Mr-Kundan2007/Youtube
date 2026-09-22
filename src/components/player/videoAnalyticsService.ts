import type {
  AnalyticsEventType,
  VideoAnalyticsConfig,
  VideoAnalyticsEvent,
} from "./analyticsTypes"
import { createAnalyticsEvent } from "./analyticsUtils"
import { HttpAnalyticsTransport } from "./analyticsTransport"
import { AnalyticsQueue } from "./analyticsQueue"

export class VideoAnalyticsService {
  private config: VideoAnalyticsConfig
  private queue: AnalyticsQueue
  private isEnabled = true

  constructor(config: VideoAnalyticsConfig = {}) {
    this.config = {
      endpoint: config.endpoint || "/api/analytics",
      batchSize: config.batchSize || 10,
      flushInterval: config.flushInterval || 15000,
      maxQueueSize: config.maxQueueSize || 100,
      debug: Boolean(config.debug),
      analyticsConsent: config.analyticsConsent || "granted",
      ...config,
    }

    const transport =
      config.customTransport || new HttpAnalyticsTransport(this.config.endpoint)

    this.queue = new AnalyticsQueue({
      transport,
      batchSize: this.config.batchSize,
      flushInterval: this.config.flushInterval,
      maxQueueSize: this.config.maxQueueSize,
      debug: this.config.debug,
      onBatchSent: (events) => {
        if (this.config.onTrackEvent) {
          events.forEach((e) => this.config.onTrackEvent?.(e))
        }
      },
    })
  }

  updateConfig(newConfig: Partial<VideoAnalyticsConfig>): void {
    this.config = { ...this.config, ...newConfig }
    if (newConfig.debug !== undefined) {
      this.queue.setDebug(newConfig.debug)
    }
    if (newConfig.customTransport) {
      this.queue.setTransport(newConfig.customTransport)
    }
  }

  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled
  }

  track(
    eventType: AnalyticsEventType,
    data: {
      videoId: string | null
      playerId: string
      sessionId: string
      currentTime: number
      duration: number
      metadata?: Record<string, unknown>
    }
  ): VideoAnalyticsEvent | null {
    // Check consent and enabled flags
    if (!this.isEnabled) return null
    if (this.config.analyticsConsent === "denied") return null

    const event = createAnalyticsEvent({
      eventType,
      videoId: data.videoId,
      playerId: data.playerId,
      sessionId: data.sessionId,
      currentTime: data.currentTime,
      duration: data.duration,
      metadata: data.metadata,
    })

    this.queue.enqueue(event)

    if (this.config.debug) {
      console.log(`[Video Analytics] ${eventType}`, event)
    }

    return event
  }

  async flush(): Promise<boolean> {
    return this.queue.flush()
  }

  flushBeacon(): boolean {
    return this.queue.flushBeacon()
  }

  getQueue(): AnalyticsQueue {
    return this.queue
  }

  destroy(): void {
    this.queue.destroy()
  }
}

// Default export singleton
export const videoAnalyticsService = new VideoAnalyticsService()
