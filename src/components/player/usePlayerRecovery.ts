import { useRef, useState, useCallback, useEffect } from "react"
import type { PlayerRecoveryConfig, PlayerRecoveryState } from "./analyticsTypes"
import {
  PlayerErrorRecoveryManager,
  type RecoveryAttemptCallbackParams,
} from "./playerErrorRecovery"
import type { VideoSource } from "./VideoElement"

export interface UsePlayerRecoveryOptions extends PlayerRecoveryConfig {
  onRetryAttempt?: (params: RecoveryAttemptCallbackParams) => void
  onRecoverySuccess?: () => void
  onRecoveryFailed?: (error: unknown) => void
}

/**
 * Hook exposing error recovery state and controls for the player and error overlay.
 */
export function usePlayerRecovery(options: UsePlayerRecoveryOptions = {}) {
  const [recoveryState, setRecoveryState] = useState<PlayerRecoveryState>({
    isRecovering: false,
    retryCount: 0,
    maxRetries: options.maxRetries ?? 3,
    nextRetryDelayMs: 0,
    lastError: null,
    sourceIndex: 0,
  })

  const managerRef = useRef<PlayerErrorRecoveryManager | null>(null)

  if (!managerRef.current) {
    managerRef.current = new PlayerErrorRecoveryManager(options, (newState) => {
      setRecoveryState(newState)
    })
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      managerRef.current?.destroy()
      managerRef.current = null
    }
  }, [])

  const handleError = useCallback(
    (
      rawError: unknown,
      mediaElement: HTMLVideoElement | null,
      sources: VideoSource[] = [],
      onAttempt: (params: RecoveryAttemptCallbackParams) => void
    ) => {
      return (
        managerRef.current?.handleError(
          rawError,
          mediaElement,
          sources,
          onAttempt
        ) || null
      )
    },
    []
  )

  const manualRetry = useCallback(
    (
      sources: VideoSource[] = [],
      onAttempt: (params: RecoveryAttemptCallbackParams) => void
    ) => {
      managerRef.current?.manualRetry(sources, onAttempt)
    },
    []
  )

  const cancelRecovery = useCallback(() => {
    managerRef.current?.cancelRecovery()
  }, [])

  const restorePlayback = useCallback(
    (mediaElement: HTMLVideoElement | null) => {
      managerRef.current?.restorePlayback(mediaElement)
    },
    []
  )

  const resetRecovery = useCallback(() => {
    managerRef.current?.reset()
  }, [])

  return {
    recoveryState,
    handleError,
    manualRetry,
    cancelRecovery,
    restorePlayback,
    resetRecovery,
  }
}
