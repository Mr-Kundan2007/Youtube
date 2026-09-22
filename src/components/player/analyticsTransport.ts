import type { AnalyticsTransport, VideoAnalyticsEvent } from "./analyticsTypes"

/**
 * Standard HTTP POST analytics transport with sendBeacon and fetch fallback.
 */
export class HttpAnalyticsTransport implements AnalyticsTransport {
  private endpoint: string
  private timeoutMs: number

  constructor(endpoint = "/api/analytics", timeoutMs = 5000) {
    this.endpoint = endpoint
    this.timeoutMs = timeoutMs
  }

  setEndpoint(endpoint: string): void {
    if (endpoint && typeof endpoint === "string") {
      this.endpoint = endpoint
    }
  }

  async send(events: VideoAnalyticsEvent[]): Promise<boolean> {
    if (!events || events.length === 0) return true
    if (typeof fetch === "undefined") return false

    const controller =
      typeof AbortController !== "undefined" ? new AbortController() : null
    const timeoutId = controller
      ? setTimeout(() => controller.abort(), this.timeoutMs)
      : null

    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ events }),
        signal: controller?.signal,
      })

      if (timeoutId) clearTimeout(timeoutId)
      return response.ok
    } catch {
      if (timeoutId) clearTimeout(timeoutId)
      return false
    }
  }

  sendBeacon(events: VideoAnalyticsEvent[]): boolean {
    if (!events || events.length === 0) return true

    const payload = JSON.stringify({ events })

    // 1. Primary: navigator.sendBeacon
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.sendBeacon === "function"
    ) {
      try {
        const blob = new Blob([payload], { type: "application/json" })
        const sent = navigator.sendBeacon(this.endpoint, blob)
        if (sent) return true
      } catch {
        // Fallback below
      }
    }

    // 2. Secondary fallback: fetch with keepalive: true
    if (typeof fetch !== "undefined") {
      try {
        fetch(this.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        }).catch(() => {})
        return true
      } catch {
        return false
      }
    }

    return false
  }
}

/**
 * In-memory Analytics Transport useful for unit testing, SSR, or local diagnostics.
 */
export class MemoryAnalyticsTransport implements AnalyticsTransport {
  public dispatchedBatches: VideoAnalyticsEvent[][] = []
  public beaconBatches: VideoAnalyticsEvent[][] = []
  private shouldFail = false

  setShouldFail(fail: boolean): void {
    this.shouldFail = fail
  }

  async send(events: VideoAnalyticsEvent[]): Promise<boolean> {
    if (this.shouldFail) return false
    this.dispatchedBatches.push([...events])
    return true
  }

  sendBeacon(events: VideoAnalyticsEvent[]): boolean {
    if (this.shouldFail) return false
    this.beaconBatches.push([...events])
    return true
  }

  getAllEvents(): VideoAnalyticsEvent[] {
    return this.dispatchedBatches.concat(this.beaconBatches).flat()
  }

  clear(): void {
    this.dispatchedBatches = []
    this.beaconBatches = []
    this.shouldFail = false
  }
}
