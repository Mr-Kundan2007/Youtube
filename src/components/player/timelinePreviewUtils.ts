/**
 * Timeline Hover Preview Utilities for Phase 10
 * High-precision pointer calculations, boundary clamping, sprite sheet indexing,
 * and preview data lookup caching.
 */

export interface PreviewSpriteConfig {
  image: string
  columns: number
  rows: number
  interval: number
  frameWidth?: number
  frameHeight?: number
}

export interface PreviewThumbnailItem {
  time: number
  src: string
}

export interface ResolvedPreviewData {
  time: number
  formattedTime: string
  imageUrl?: string
  spriteStyle?: {
    backgroundImage: string
    backgroundPosition: string
    backgroundSize?: string
    width: number
    height: number
  }
}

/**
 * Calculates normalized pointer position percentage [0, 1] relative to the timeline bounding rect.
 */
export function calculatePointerPercentage(
  clientX: number,
  rect: DOMRect | null | undefined
): number {
  if (!rect || rect.width <= 0) return 0
  const offsetX = Math.max(0, Math.min(clientX - rect.left, rect.width))
  return offsetX / rect.width
}

/**
 * Computes exact preview time in seconds, guarding against live streams, NaN, and negative values.
 */
export function calculatePreviewTime(percentage: number, duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) {
    return 0
  }
  const clampedPct = Math.max(0, Math.min(1, percentage))
  return clampedPct * duration
}

/**
 * Calculates horizontal left position for the preview container, clamping within timeline margins.
 */
export function calculateClampedPreviewLeft(
  pointerX: number,
  trackWidth: number,
  previewWidth = 160,
  margin = 8
): number {
  if (trackWidth <= 0) return 0
  const half = previewWidth / 2
  const minCenter = half + margin
  const maxCenter = Math.max(minCenter, trackWidth - half - margin)
  return Math.max(minCenter, Math.min(maxCenter, pointerX))
}

// In-memory cache for preview lookups to avoid expensive searches during rapid pointer movements
const previewLookupCache = new Map<string, PreviewThumbnailItem | null>()
const MAX_CACHE_ENTRIES = 100

/**
 * Finds the closest thumbnail item for a given preview timestamp.
 */
export function findClosestThumbnail(
  thumbnails: PreviewThumbnailItem[] | null | undefined,
  previewTime: number
): PreviewThumbnailItem | null {
  if (!thumbnails || !Array.isArray(thumbnails) || thumbnails.length === 0) {
    return null
  }

  // 1-second bucket key for caching
  const cacheKey = `${Math.floor(previewTime)}_${thumbnails.length}`
  if (previewLookupCache.has(cacheKey)) {
    return previewLookupCache.get(cacheKey) || null
  }

  let closest: PreviewThumbnailItem = thumbnails[0]
  let minDiff = Math.abs(previewTime - closest.time)

  for (let i = 1; i < thumbnails.length; i++) {
    const item = thumbnails[i]
    const diff = Math.abs(previewTime - item.time)
    if (diff < minDiff) {
      minDiff = diff
      closest = item
    }
  }

  if (previewLookupCache.size >= MAX_CACHE_ENTRIES) {
    previewLookupCache.clear()
  }
  previewLookupCache.set(cacheKey, closest)

  return closest
}

/**
 * Computes sprite coordinate offsets for sprite sheet based previews.
 */
export function calculateSpritePosition(
  sprite: PreviewSpriteConfig | null | undefined,
  previewTime: number
): ResolvedPreviewData["spriteStyle"] | null {
  if (!sprite || !sprite.image || sprite.columns <= 0 || sprite.rows <= 0 || sprite.interval <= 0) {
    return null
  }

  const frameWidth = sprite.frameWidth || 160
  const frameHeight = sprite.frameHeight || 90
  const frameIndex = Math.max(0, Math.floor(previewTime / sprite.interval))
  const totalFrames = sprite.columns * sprite.rows
  const clampedIndex = Math.min(totalFrames - 1, frameIndex)

  const col = clampedIndex % sprite.columns
  const row = Math.floor(clampedIndex / sprite.columns)

  return {
    backgroundImage: `url(${sprite.image})`,
    backgroundPosition: `-${col * frameWidth}px -${row * frameHeight}px`,
    backgroundSize: `${sprite.columns * frameWidth}px ${sprite.rows * frameHeight}px`,
    width: frameWidth,
    height: frameHeight,
  }
}
