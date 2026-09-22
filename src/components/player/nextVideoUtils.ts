import { resolveVideoId } from "./watchProgressUtils"

export const DEFAULT_AUTOPLAY_COUNTDOWN = 10

export type NextVideoResumeBehavior = "prompt" | "resume" | "start-over"

export interface NextVideoItem {
  id?: string
  _id?: string
  title?: string
  videotitle?: string
  description?: string
  src?: string
  videoUrl?: string
  filepath?: string
  videofilepath?: string
  poster?: string
  thumbnailUrl?: string
  duration?: number
  [key: string]: unknown
}

/**
 * Validates whether an autoplay countdown value is finite and >= 1 second.
 */
export function validateAutoplayCountdown(countdown: unknown): number {
  if (typeof countdown === "number" && Number.isFinite(countdown) && countdown >= 1) {
    return Math.floor(countdown)
  }
  return DEFAULT_AUTOPLAY_COUNTDOWN
}

/**
 * Validates whether an object can serve as a valid NextVideoItem.
 */
export function validateNextVideo(item: unknown): item is NextVideoItem {
  if (!item || typeof item !== "object") return false
  const candidate = item as NextVideoItem
  const resolvedId = resolveVideoId(candidate)
  return Boolean(resolvedId)
}

/**
 * Resolves the upcoming next video based on priority:
 * 1. Explicit nextVideo
 * 2. Next valid item in playlist following the active video
 * 3. Next item in queue
 * 4. null if no upcoming video exists
 */
export function resolveNextVideo(
  currentVideo?: unknown,
  explicitNextVideo?: NextVideoItem | null,
  playlist?: NextVideoItem[] | null,
  queue?: NextVideoItem[] | null
): NextVideoItem | null {
  // 1. Explicit nextVideo has highest priority
  if (explicitNextVideo && validateNextVideo(explicitNextVideo)) {
    return explicitNextVideo
  }

  const currentId = resolveVideoId(currentVideo as NextVideoItem | null | undefined)

  // 2. Playlist-based resolution
  if (playlist && Array.isArray(playlist) && playlist.length > 0) {
    let currentIndex = -1
    if (currentId) {
      currentIndex = playlist.findIndex((v) => resolveVideoId(v) === currentId)
    }

    const startIndex = currentIndex >= 0 ? currentIndex + 1 : 0
    for (let i = startIndex; i < playlist.length; i++) {
      const candidate = playlist[i]
      if (validateNextVideo(candidate)) {
        const candidateId = resolveVideoId(candidate)
        if (!currentId || candidateId !== currentId) {
          return candidate
        }
      }
    }
  }

  // 3. Queue-based resolution
  if (queue && Array.isArray(queue) && queue.length > 0) {
    for (const qItem of queue) {
      if (validateNextVideo(qItem)) {
        const qId = resolveVideoId(qItem)
        // Ensure queue item is not the same as current video
        if (!currentId || qId !== currentId) {
          return qItem
        }
      }
    }
  }

  return null
}

/**
 * Extracts a displayable title from a next video item.
 */
export function getNextVideoTitle(video: NextVideoItem | null | undefined): string {
  if (!video) return "Next Video"
  return video.title || video.videotitle || "Up Next"
}

/**
 * Extracts a displayable poster URL from a next video item with safe fallback.
 */
export function getNextVideoPoster(video: NextVideoItem | null | undefined): string {
  if (!video) return "/placeholder.svg?height=480&width=854"
  return video.poster || video.thumbnailUrl || "/placeholder.svg?height=480&width=854"
}

