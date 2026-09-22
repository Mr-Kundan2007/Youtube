export interface VideoQualityMetadata {
  videoWidth: number
  videoHeight: number
  qualityLabel: string
  aspectRatio: string
  formattedResolution: string
  readyStatus: string
  bufferedPercent: number
  sourceType?: string
}

export type VideoQualityData = VideoQualityMetadata
export type VideoQualityInfoType = VideoQualityMetadata

/**
 * Maps a video pixel height to a standard user-friendly quality label.
 */
export function getQualityLabel(videoHeight: number): string {
  if (
    typeof videoHeight !== "number" ||
    isNaN(videoHeight) ||
    !isFinite(videoHeight) ||
    videoHeight <= 0
  ) {
    return "Auto"
  }

  if (videoHeight >= 2160) return "4K"
  if (videoHeight >= 1440) return "1440p"
  if (videoHeight >= 1080) return "1080p"
  if (videoHeight >= 720) return "720p"
  if (videoHeight >= 480) return "480p"
  if (videoHeight >= 360) return "360p"
  if (videoHeight >= 240) return "240p"

  return `${Math.floor(videoHeight)}p`
}

/**
 * Calculates the aspect ratio string (e.g. "16:9", "4:3") with divide-by-zero protection.
 */
export function calculateAspectRatio(width: number, height: number): string {
  if (
    typeof width !== "number" ||
    typeof height !== "number" ||
    isNaN(width) ||
    isNaN(height) ||
    !isFinite(width) ||
    !isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return "16:9"
  }

  const ratio = width / height

  if (Math.abs(ratio - 16 / 9) < 0.05) return "16:9"
  if (Math.abs(ratio - 4 / 3) < 0.05) return "4:3"
  if (Math.abs(ratio - 21 / 9) < 0.08) return "21:9"
  if (Math.abs(ratio - 1) < 0.03) return "1:1"
  if (Math.abs(ratio - 9 / 16) < 0.05) return "9:16"

  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
  const roundedWidth = Math.round(width)
  const roundedHeight = Math.round(height)
  const divisor = gcd(roundedWidth, roundedHeight)

  if (divisor > 1) {
    return `${Math.round(roundedWidth / divisor)}:${Math.round(roundedHeight / divisor)}`
  }

  return `${ratio.toFixed(2)}:1`
}

/**
 * Formats width and height into a clean resolution string.
 */
export function formatResolution(width: number, height: number): string {
  if (!width || !height || width <= 0 || height <= 0) {
    return "Unknown"
  }
  return `${Math.round(width)} × ${Math.round(height)}`
}

/**
 * Maps readyState and buffering status to a friendly user status.
 */
export function getReadyStatusLabel(
  readyState: number,
  isBuffering: boolean,
  hasError = false
): string {
  if (hasError) return "Playback Error"
  if (isBuffering) return "Buffering..."
  switch (readyState) {
    case 0:
      return "No Media"
    case 1:
      return "Loading Metadata"
    case 2:
      return "Loading Data"
    case 3:
    case 4:
      return "Ready"
    default:
      return "Ready"
  }
}
