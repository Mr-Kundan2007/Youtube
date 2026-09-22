import type { AnalyticsEventType, VideoAnalyticsEvent } from "./analyticsTypes"

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

/**
 * Generate a unique cryptographically strong event ID.
 */
export function generateEventId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    try {
      return crypto.randomUUID()
    } catch {
      // Fallback below
    }
  }
  const timestamp = Date.now().toString(36)
  const randomStr = Math.random().toString(36).substring(2, 10)
  return `evt_${timestamp}_${randomStr}`
}

/**
 * Sanitize metadata to remove secrets, tokens, passwords, and private identifiers.
 */
export function sanitizeMetadata(
  metadata?: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!metadata || typeof metadata !== "object") return undefined

  const cleaned: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(metadata)) {
    const isSensitive = SENSITIVE_KEY_PATTERNS.some((pattern) =>
      pattern.test(key)
    )

    if (isSensitive) {
      continue
    }

    if (typeof value === "string") {
      // Sanitize URL strings with query params containing potential tokens
      if (value.startsWith("http://") || value.startsWith("https://")) {
        try {
          const url = new URL(value)
          url.searchParams.delete("token")
          url.searchParams.delete("auth")
          url.searchParams.delete("signature")
          url.searchParams.delete("key")
          cleaned[key] = url.toString()
          continue
        } catch {
          // Leave as is if URL parse fails
        }
      }
      cleaned[key] = value
    } else if (
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null
    ) {
      cleaned[key] = value
    } else if (Array.isArray(value)) {
      cleaned[key] = value.slice(0, 50)
    } else if (typeof value === "object") {
      cleaned[key] = sanitizeMetadata(value as Record<string, unknown>)
    }
  }

  return Object.keys(cleaned).length > 0 ? cleaned : undefined
}

export interface CreateAnalyticsEventParams {
  eventType: AnalyticsEventType
  videoId: string | null
  playerId: string
  sessionId: string
  currentTime: number
  duration: number
  metadata?: Record<string, unknown>
  eventId?: string
  timestamp?: number
}

/**
 * Create a structured, validated analytics event payload.
 */
export function createAnalyticsEvent({
  eventType,
  videoId,
  playerId,
  sessionId,
  currentTime,
  duration,
  metadata,
  eventId,
  timestamp,
}: CreateAnalyticsEventParams): VideoAnalyticsEvent {
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

/**
 * Validate that an analytics event satisfies structural integrity requirements.
 */
export function validateAnalyticsEvent(
  event: unknown
): event is VideoAnalyticsEvent {
  if (!event || typeof event !== "object") return false
  const e = event as Partial<VideoAnalyticsEvent>

  return (
    typeof e.eventId === "string" &&
    e.eventId.length > 0 &&
    typeof e.eventType === "string" &&
    e.eventType.length > 0 &&
    typeof e.timestamp === "number" &&
    e.timestamp > 0 &&
    typeof e.playerId === "string" &&
    e.playerId.length > 0 &&
    typeof e.sessionId === "string" &&
    e.sessionId.length > 0 &&
    typeof e.currentTime === "number" &&
    !isNaN(e.currentTime) &&
    typeof e.duration === "number" &&
    !isNaN(e.duration)
  )
}

/**
 * Flag events that represent critical session or error state transitions.
 * When an analytics queue reaches capacity, critical events are never purged.
 */
export function isCriticalEvent(eventType: AnalyticsEventType): boolean {
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

/**
 * Lightweight in-memory event deduplication tracker.
 */
export class EventDeduplicator {
  private seenIds = new Set<string>()
  private maxItems: number

  constructor(maxItems = 1000) {
    this.maxItems = maxItems
  }

  isDuplicate(eventId: string): boolean {
    if (this.seenIds.has(eventId)) {
      return true
    }
    this.add(eventId)
    return false
  }

  add(eventId: string): void {
    if (this.seenIds.size >= this.maxItems) {
      // Clear half the entries to maintain bounded memory
      const it = this.seenIds.values()
      const toDelete = Math.floor(this.maxItems / 2)
      for (let i = 0; i < toDelete; i++) {
        const item = it.next().value
        if (item) this.seenIds.delete(item)
      }
    }
    this.seenIds.add(eventId)
  }

  clear(): void {
    this.seenIds.clear()
  }
}
