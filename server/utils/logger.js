/**
 * Structured Security & Audit Logger for Video Meeting Events.
 * Strictly redacts and prevents logging of tokens, secrets, or passwords.
 */

const SENSITIVE_KEYS = new Set([
  "password",
  "token",
  "jwt",
  "secret",
  "apikey",
  "api_key",
  "livekit_secret",
  "authorization",
])

const sanitizePayload = (data) => {
  if (!data || typeof data !== "object") return data

  const cleaned = Array.isArray(data) ? [] : {}
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      cleaned[key] = "[REDACTED]"
    } else if (value && typeof value === "object") {
      cleaned[key] = sanitizePayload(value)
    } else {
      cleaned[key] = value
    }
  }
  return cleaned
}

export const logger = {
  info: (event, payload = {}) => {
    const entry = {
      timestamp: new Date().toISOString(),
      level: "INFO",
      event,
      ...sanitizePayload(payload),
    }
    console.log(JSON.stringify(entry))
  },

  warn: (event, payload = {}) => {
    const entry = {
      timestamp: new Date().toISOString(),
      level: "WARN",
      event,
      ...sanitizePayload(payload),
    }
    console.warn(JSON.stringify(entry))
  },

  error: (event, error, payload = {}) => {
    const entry = {
      timestamp: new Date().toISOString(),
      level: "ERROR",
      event,
      errorMessage: error?.message || String(error),
      errorCode: error?.code,
      ...sanitizePayload(payload),
    }
    console.error(JSON.stringify(entry))
  },
}

export const MeetingEvents = {
  MEETING_CREATED: "MEETING_CREATED",
  MEETING_LOOKUP: "MEETING_LOOKUP",
  MEETING_JOIN_REQUESTED: "MEETING_JOIN_REQUESTED",
  MEETING_JOINED: "MEETING_JOINED",
  MEETING_JOIN_DENIED: "MEETING_JOIN_DENIED",
  MEETING_FULL: "MEETING_FULL",
  MEETING_LEFT: "MEETING_LEFT",
  MEETING_ENDED: "MEETING_ENDED",
  MEETING_ACCESS_REQUESTED: "MEETING_ACCESS_REQUESTED",
  MEETING_ACCESS_GRANTED: "MEETING_ACCESS_GRANTED",
  MEETING_ACCESS_DENIED: "MEETING_ACCESS_DENIED",
  UNAUTHORIZED_MEETING_ACCESS: "UNAUTHORIZED_MEETING_ACCESS",
  INVALID_MEETING_TOKEN: "INVALID_MEETING_TOKEN",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  ROLE_CHANGE_ATTEMPT: "ROLE_CHANGE_ATTEMPT",
  PERMISSION_DENIED: "PERMISSION_DENIED",
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  HOST_ACTION_EXECUTED: "HOST_ACTION_EXECUTED",
  PARTICIPANT_REMOVED: "PARTICIPANT_REMOVED",
  PARTICIPANT_MUTED: "PARTICIPANT_MUTED",
  PERMISSION_CHANGED: "PERMISSION_CHANGED",
  MEETING_LOCKED: "MEETING_LOCKED",
  MEETING_UNLOCKED: "MEETING_UNLOCKED",
  RECORDING_STARTED: "RECORDING_STARTED",
  RECORDING_STOPPED: "RECORDING_STOPPED",
  RECORDING_UPLOADED: "RECORDING_UPLOADED",
  RECORDING_ACCESSED: "RECORDING_ACCESSED",
  RECORDING_STREAMED: "RECORDING_STREAMED",
  RECORDING_DOWNLOADED: "RECORDING_DOWNLOADED",
  RECORDING_DELETED: "RECORDING_DELETED",
  RECORDING_FAILED: "RECORDING_FAILED",
  TOKEN_GENERATED: "TOKEN_GENERATED",
  AUTHORIZATION_FAILED: "AUTHORIZATION_FAILED",
}
