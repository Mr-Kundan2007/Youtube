import type { ClassifiedVideoError, VideoErrorCategory } from "./analyticsTypes"

/**
 * Classify a video error into standardized categories with recoverability metadata.
 */
export function classifyVideoError(
  error: unknown,
  mediaElement?: HTMLVideoElement | null
): ClassifiedVideoError {
  const nativeError = mediaElement?.error

  // 1. Inspect Native MediaError if available
  if (nativeError) {
    switch (nativeError.code) {
      case 1: // MEDIA_ERR_ABORTED
        return {
          code: 1,
          message: "Video playback was aborted.",
          category: "MEDIA",
          recoverable: true,
          originalError: nativeError,
        }
      case 2: // MEDIA_ERR_NETWORK
        return {
          code: 2,
          message: "Network error interrupted video playback.",
          category: "NETWORK",
          recoverable: true,
          originalError: nativeError,
        }
      case 3: // MEDIA_ERR_DECODE
        return {
          code: 3,
          message: "Video decode error: corruption or format mismatch.",
          category: "DECODE",
          recoverable: true,
          originalError: nativeError,
        }
      case 4: // MEDIA_ERR_SRC_NOT_SUPPORTED
        return {
          code: 4,
          message: "Video source format is not supported or source is unreachable.",
          category: "SOURCE",
          recoverable: true, // Recoverable via alternative sources or reload
          originalError: nativeError,
        }
    }
  }

  // 2. Inspect Error object / message
  if (error instanceof Error || (error && typeof error === "object")) {
    const errObj = error as Record<string, unknown>
    const name = typeof errObj.name === "string" ? errObj.name : ""
    const message = typeof errObj.message === "string" ? errObj.message : ""

    // Autoplay policy rejection
    if (
      name === "NotAllowedError" ||
      message.toLowerCase().includes("notallowederror") ||
      message.toLowerCase().includes("play() failed because the user didn't interact") ||
      message.toLowerCase().includes("autoplay")
    ) {
      return {
        code: 403,
        message: "Autoplay blocked by browser policy. User interaction required.",
        category: "AUTOPLAY",
        recoverable: false, // Never auto-retry autoplay rejections (requires user tap/click)
        originalError: error,
      }
    }

    // CORS policy rejection
    if (
      message.toLowerCase().includes("cors") ||
      message.toLowerCase().includes("cross-origin")
    ) {
      return {
        code: 403,
        message: "Cross-Origin (CORS) security restriction prevented playback.",
        category: "CORS",
        recoverable: false,
        originalError: error,
      }
    }

    // Network / Fetch failure
    if (
      name === "NetworkError" ||
      message.toLowerCase().includes("network") ||
      message.toLowerCase().includes("failed to fetch")
    ) {
      return {
        code: 2,
        message: "Network connection lost.",
        category: "NETWORK",
        recoverable: true,
        originalError: error,
      }
    }

    return {
      code: typeof errObj.code === "number" ? errObj.code : 0,
      message: message || "An unexpected playback error occurred.",
      category: "UNKNOWN",
      recoverable: true,
      originalError: error,
    }
  }

  return {
    code: 0,
    message: typeof error === "string" ? error : "An unknown error occurred.",
    category: "UNKNOWN",
    recoverable: true,
    originalError: error,
  }
}

/**
 * Compute exponential backoff delay: baseDelay * 2^retryCount (clamped to maxDelay).
 */
export function calculateExponentialBackoff(
  retryCount: number,
  baseDelay = 1000,
  maxDelay = 10000
): number {
  if (retryCount <= 0) return baseDelay
  const delay = baseDelay * Math.pow(2, retryCount)
  return Math.min(maxDelay, Math.max(baseDelay, delay))
}

/**
 * Determine whether automated recovery should proceed for the classified error.
 */
export function canAttemptRecovery(
  error: ClassifiedVideoError,
  currentRetryCount: number,
  maxRetries = 3
): boolean {
  if (!error.recoverable) return false
  if (error.category === "AUTOPLAY") return false
  if (error.category === "CORS") return false
  return currentRetryCount < maxRetries
}

/**
 * Generate user-friendly, non-technical feedback string for the error overlay.
 */
export function getRecoveryStatusMessage(
  error: ClassifiedVideoError,
  retryCount: number,
  maxRetries: number,
  isRecovering: boolean
): string {
  if (isRecovering) {
    return `Connection interrupted. Retrying video... (${retryCount + 1} of ${maxRetries})`
  }

  switch (error.category) {
    case "NETWORK":
      return "Unable to connect. Please check your internet connection."
    case "SOURCE":
      return "This video stream is currently unavailable."
    case "DECODE":
      return "There was a problem rendering the video."
    case "AUTOPLAY":
      return "Click play to start video."
    default:
      return error.message || "An error occurred while loading this video."
  }
}
