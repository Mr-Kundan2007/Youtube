/**
 * Formats seconds into a clean timestamp string (e.g. 0:00, 1:05, 1:00:00, 1:01:05).
 * Handles invalid values, NaN, Infinity, and negative numbers safely by returning "0:00".
 */
export function formatVideoTime(seconds: number): string {
  if (typeof seconds !== "number" || isNaN(seconds) || !isFinite(seconds) || seconds < 0) {
    return "0:00"
  }

  const totalSeconds = Math.floor(seconds)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const secs = totalSeconds % 60

  const pad = (num: number): string => String(num).padStart(2, "0")

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(secs)}`
  }

  return `${minutes}:${pad(secs)}`
}

/**
 * Calculates playback progress as a percentage between 0 and 100.
 * Includes division-by-zero protection, NaN handling, and clamping.
 */
export function calculateProgress(currentTime: number, duration: number): number {
  if (
    typeof currentTime !== "number" ||
    typeof duration !== "number" ||
    isNaN(currentTime) ||
    isNaN(duration) ||
    !isFinite(duration) ||
    duration <= 0 ||
    currentTime <= 0
  ) {
    return 0
  }

  const progress = (currentTime / duration) * 100
  return Math.max(0, Math.min(100, Number(progress.toFixed(4))))
}

/**
 * Converts a percentage (0 to 100) into playback time in seconds.
 * Clamps result between 0 and duration.
 */
export function calculateTimeFromPercentage(percentage: number, duration: number): number {
  if (
    typeof percentage !== "number" ||
    typeof duration !== "number" ||
    isNaN(percentage) ||
    isNaN(duration) ||
    !isFinite(duration) ||
    duration <= 0 ||
    percentage <= 0
  ) {
    return 0
  }

  const clampedPercentage = Math.max(0, Math.min(100, percentage))
  const time = (clampedPercentage / 100) * duration
  return Math.max(0, Math.min(duration, time))
}

/**
 * Calculates remaining video duration in seconds.
 * Clamps minimum to 0, defends against NaN, null, and non-finite duration.
 */
export function calculateRemainingTime(currentTime: number, duration: number): number {
  if (
    typeof currentTime !== "number" ||
    typeof duration !== "number" ||
    isNaN(currentTime) ||
    isNaN(duration) ||
    !isFinite(duration) ||
    duration <= 0
  ) {
    return 0
  }

  const validCurrent = isNaN(currentTime) || currentTime < 0 ? 0 : currentTime
  return Math.max(0, Number((duration - validCurrent).toFixed(4)))
}

/**
 * Formats remaining seconds as a countdown string prefixed with minus (e.g. -1:05, -12:30).
 */
export function formatRemainingTime(remainingSeconds: number): string {
  const formatted = formatVideoTime(remainingSeconds)
  return `-${formatted}`
}

export const TIME_DISPLAY_MODES = {
  CURRENT_TOTAL: "current-total",
  CURRENT_REMAINING: "current-remaining",
  CURRENT_ONLY: "current-only",
} as const

export type TimeDisplayMode = (typeof TIME_DISPLAY_MODES)[keyof typeof TIME_DISPLAY_MODES]
