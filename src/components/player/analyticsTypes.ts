/**
 * Analytics and Error Recovery Type Definitions for HTML5 VideoPlayer
 * Phase 11
 */

export type AnalyticsEventType =
  | "VIDEO_LOAD"
  | "VIDEO_READY"
  | "VIDEO_PLAY"
  | "VIDEO_PAUSE"
  | "VIDEO_SEEK"
  | "VIDEO_BUFFER_START"
  | "VIDEO_BUFFER_END"
  | "VIDEO_ENDED"
  | "VIDEO_COMPLETED"
  | "VIDEO_ERROR"
  | "VIDEO_RETRY"
  | "VIDEO_SOURCE_CHANGED"
  | "VIDEO_QUALITY_CHANGED"
  | "VIDEO_VOLUME_CHANGED"
  | "VIDEO_MUTED"
  | "VIDEO_UNMUTED"
  | "VIDEO_SPEED_CHANGED"
  | "VIDEO_FULLSCREEN_ENTER"
  | "VIDEO_FULLSCREEN_EXIT"
  | "VIDEO_PIP_ENTER"
  | "VIDEO_PIP_EXIT"
  | "VIDEO_SUBTITLE_ENABLED"
  | "VIDEO_SUBTITLE_DISABLED"
  | "VIDEO_NEXT"
  | "VIDEO_AUTOPLAY_CANCELLED"
  | "WATCH_SESSION_START"
  | "WATCH_SESSION_END"
  | "VIDEO_ABANDONED"
  | "PAGE_HIDDEN"
  | "PAGE_VISIBLE"

export interface VideoAnalyticsEvent {
  eventId: string
  eventType: AnalyticsEventType
  timestamp: number
  videoId: string | null
  playerId: string
  sessionId: string
  currentTime: number
  duration: number
  metadata?: Record<string, unknown>
}

export type VideoErrorCategory =
  | "NETWORK"
  | "MEDIA"
  | "DECODE"
  | "SOURCE"
  | "AUTOPLAY"
  | "CORS"
  | "UNKNOWN"

export interface ClassifiedVideoError {
  code: number
  message: string
  category: VideoErrorCategory
  recoverable: boolean
  originalError?: unknown
}

export type AnalyticsConsent = "granted" | "denied" | "unknown"

export interface AnalyticsTransport {
  send(events: VideoAnalyticsEvent[]): Promise<boolean>
  sendBeacon(events: VideoAnalyticsEvent[]): boolean
}

export interface VideoAnalyticsConfig {
  endpoint?: string
  batchSize?: number
  flushInterval?: number
  maxQueueSize?: number
  debug?: boolean
  analyticsConsent?: AnalyticsConsent
  customTransport?: AnalyticsTransport
  onTrackEvent?: (event: VideoAnalyticsEvent) => void
}

export interface PlayerRecoveryConfig {
  maxRetries?: number
  baseDelay?: number
  maxDelay?: number
  enableSourceFallback?: boolean
}

export interface WatchSessionMetrics {
  sessionId: string
  videoId: string | null
  playerId: string
  sessionStartTime: number
  sessionEndTime?: number
  initialPosition: number
  finalPosition: number
  actualWatchedDuration: number
  totalSessionDuration: number
  pauseCount: number
  seekCount: number
  bufferCount: number
  totalBufferDuration: number
  isCompleted: boolean
  isAbandoned: boolean
  watchPercentage: number
}

export interface PlayerRecoveryState {
  isRecovering: boolean
  retryCount: number
  maxRetries: number
  nextRetryDelayMs: number
  lastError: ClassifiedVideoError | null
  sourceIndex: number
}
