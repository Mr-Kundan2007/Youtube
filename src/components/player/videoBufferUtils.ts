/**
 * Video Buffer and Loading State Utilities
 * Provides safe TimeRanges extraction, range comparison, percentage calculations,
 * and semantic state labeling for HTML5 video buffering.
 */

export interface BufferedRange {
  start: number
  end: number
}

/**
 * Extracts buffered time ranges from HTML5 video element into serializable plain objects.
 * Handles missing video, missing buffered, non-finite bounds, and inverted ranges safely.
 */
export function getBufferedRanges(
  video: HTMLVideoElement | { buffered?: TimeRanges } | null | undefined
): BufferedRange[] {
  if (!video || !video.buffered) return []

  const ranges: BufferedRange[] = []
  const count = video.buffered.length

  for (let i = 0; i < count; i++) {
    try {
      const start = video.buffered.start(i)
      const end = video.buffered.end(i)
      if (
        typeof start === "number" &&
        typeof end === "number" &&
        Number.isFinite(start) &&
        Number.isFinite(end) &&
        end >= start
      ) {
        ranges.push({
          start: Math.max(0, start),
          end: Math.max(0, end),
        })
      }
    } catch {
      // Browsers may throw IndexSizeError if length changes concurrently
      break
    }
  }

  return ranges
}

/**
 * Calculates overall buffered percentage relative to video duration.
 * Uses the maximum buffered position or range covering playback.
 * Returns a clean integer clamped between 0 and 100.
 */
export function calculateBufferedPercentage(
  ranges: BufferedRange[],
  duration: number
): number {
  if (!duration || !Number.isFinite(duration) || duration <= 0) return 0
  if (!ranges || ranges.length === 0) return 0

  let maxEnd = 0
  for (const range of ranges) {
    if (range.end > maxEnd) {
      maxEnd = range.end
    }
  }

  const rawPercent = (maxEnd / duration) * 100
  if (!Number.isFinite(rawPercent)) return 0

  return Math.min(100, Math.max(0, Math.round(rawPercent)))
}

/**
 * Compares two buffered range arrays to prevent redundant state updates
 * during frequent 'progress' event dispatches.
 */
export function areBufferedRangesEqual(
  a: BufferedRange[],
  b: BufferedRange[]
): boolean {
  if (a === b) return true
  if (!a || !b) return false
  if (a.length !== b.length) return false

  for (let i = 0; i < a.length; i++) {
    const rangeA = a[i]
    const rangeB = b[i]
    // 0.1s threshold avoids excessive re-renders for sub-second buffer chunks
    if (
      Math.abs(rangeA.start - rangeB.start) > 0.1 ||
      Math.abs(rangeA.end - rangeB.end) > 0.1
    ) {
      return false
    }
  }

  return true
}

/**
 * Maps numeric HTML5 video.networkState to a human-readable label.
 */
export function getNetworkStateLabel(networkState: number): string {
  switch (networkState) {
    case 0: // NETWORK_EMPTY
      return "Empty"
    case 1: // NETWORK_IDLE
      return "Idle"
    case 2: // NETWORK_LOADING
      return "Loading"
    case 3: // NETWORK_NO_SOURCE
      return "No Source"
    default:
      return "Unknown"
  }
}

/**
 * Maps numeric HTML5 video.readyState to a human-readable label.
 */
export function getReadyStateLabel(readyState: number): string {
  switch (readyState) {
    case 0: // HAVE_NOTHING
      return "No Media"
    case 1: // HAVE_METADATA
      return "Metadata Loaded"
    case 2: // HAVE_CURRENT_DATA
      return "Current Frame Ready"
    case 3: // HAVE_FUTURE_DATA
      return "Future Data Ready"
    case 4: // HAVE_ENOUGH_DATA
      return "Playback Ready"
    default:
      return "Unknown"
  }
}
