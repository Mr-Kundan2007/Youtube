/**
 * Watch Progress Data Model and Utility Functions
 * Provides stable video ID resolution, progress percentage calculations,
 * completion detection, resume eligibility validation, and position clamping.
 */

export interface WatchProgressData {
  videoId: string
  currentTime: number
  duration: number
  progressPercentage: number
  isCompleted: boolean
  lastWatchedAt: string // ISO 8601 string
  playbackRate?: number
}

export interface ResumeEligibilityOptions {
  minimumSeconds?: number
  endThresholdSeconds?: number
}

export const DEFAULT_RESUME_MINIMUM_SECONDS = 10
export const DEFAULT_RESUME_END_THRESHOLD_SECONDS = 15
export const DEFAULT_PROGRESS_SAVE_INTERVAL = 10
export const DEFAULT_COMPLETION_THRESHOLD = 90
export const WATCH_PROGRESS_STORAGE_PREFIX = "youtube_watch_progress:"

/**
 * Resolves a stable, unique video identifier from video properties or explicit ID.
 */
export function resolveVideoId(
  video?: {
    _id?: string
    id?: string
    videotitle?: string
    filepath?: string
    videoUrl?: string
    videofilepath?: string
  } | null,
  explicitId?: string
): string | null {
  if (explicitId && typeof explicitId === "string" && explicitId.trim()) {
    return explicitId.trim()
  }

  if (!video) return null

  if (video._id && typeof video._id === "string" && video._id.trim()) {
    return video._id.trim()
  }
  if (video.id && typeof video.id === "string" && video.id.trim()) {
    return video.id.trim()
  }
  if (video.videotitle && typeof video.videotitle === "string" && video.videotitle.trim()) {
    return `title-${video.videotitle.trim()}`
  }
  if (video.filepath && typeof video.filepath === "string" && video.filepath.trim()) {
    return `path-${video.filepath.trim()}`
  }
  if (video.videoUrl && typeof video.videoUrl === "string" && video.videoUrl.trim()) {
    return `url-${video.videoUrl.trim()}`
  }
  if (video.videofilepath && typeof video.videofilepath === "string" && video.videofilepath.trim()) {
    return `vpath-${video.videofilepath.trim()}`
  }

  return null
}

/**
 * Calculates watch progress percentage relative to duration.
 * Returns clean float clamped between 0 and 100 with zero/NaN guards.
 */
export function calculateWatchPercentage(currentTime: number, duration: number): number {
  if (!duration || !Number.isFinite(duration) || duration <= 0) return 0
  if (!currentTime || !Number.isFinite(currentTime) || currentTime <= 0) return 0

  const pct = (currentTime / duration) * 100
  if (!Number.isFinite(pct)) return 0

  return Math.min(100, Math.max(0, Number(pct.toFixed(2))))
}

/**
 * Determines whether a video has met or exceeded the completion threshold.
 */
export function isVideoCompleted(
  percentage: number,
  currentTime: number,
  duration: number,
  completionThreshold = DEFAULT_COMPLETION_THRESHOLD
): boolean {
  if (!duration || !Number.isFinite(duration) || duration <= 0) return false
  if (currentTime >= duration && duration > 0) return true

  const threshold = Math.min(100, Math.max(1, completionThreshold))
  return percentage >= threshold
}

/**
 * Validates whether saved watch progress is eligible for automatic or prompted resume.
 * Criteria:
 * 1. Progress exists and has valid currentTime >= minimumSeconds
 * 2. Video is not marked completed
 * 3. Position is not within the end threshold
 * 4. Duration is finite and > 0 (excludes live streams)
 */
export function isResumeEligible(
  progress: WatchProgressData | null | undefined,
  duration: number,
  options: ResumeEligibilityOptions = {}
): boolean {
  if (!progress) return false
  if (progress.isCompleted) return false

  const minSeconds = options.minimumSeconds ?? DEFAULT_RESUME_MINIMUM_SECONDS
  const endThreshold = options.endThresholdSeconds ?? DEFAULT_RESUME_END_THRESHOLD_SECONDS

  const pos = progress.currentTime
  if (typeof pos !== "number" || !Number.isFinite(pos) || pos < minSeconds) {
    return false
  }

  // If duration is known, verify not in end threshold
  if (duration && Number.isFinite(duration) && duration > 0) {
    if (pos >= duration - endThreshold) {
      return false
    }
  }

  return true
}

/**
 * Clamps resume position within safe playable bounds.
 * Prevents seeking beyond duration or into the end threshold.
 */
export function clampResumePosition(
  position: number,
  duration: number,
  endThresholdSeconds = DEFAULT_RESUME_END_THRESHOLD_SECONDS
): number {
  if (typeof position !== "number" || !Number.isFinite(position) || position <= 0) {
    return 0
  }

  if (duration && Number.isFinite(duration) && duration > 0) {
    const maxSafe = Math.max(0, duration - endThresholdSeconds)
    return Math.max(0, Math.min(position, maxSafe))
  }

  return Math.max(0, position)
}

/**
 * Generates local storage key for a specific video ID.
 */
export function getProgressStorageKey(videoId: string): string {
  return `${WATCH_PROGRESS_STORAGE_PREFIX}${videoId}`
}
