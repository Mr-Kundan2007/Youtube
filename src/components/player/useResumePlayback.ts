import { useMemo, useCallback } from "react"
import { useVideoPlayer } from "./VideoPlayerContext"
import { formatVideoTime } from "./timelineUtils"

export interface UseResumePlaybackReturn {
  shouldShowResumePrompt: boolean
  resumePosition: number
  resumeFormattedTime: string
  handleResume: () => void
  handleStartOver: () => void
  dismissPrompt: () => void
}

/**
 * Custom hook providing state and actions for the resume playback prompt.
 */
export function useResumePlayback(): UseResumePlaybackReturn {
  const { state, actions } = useVideoPlayer()

  const handleResume = useCallback(() => {
    actions.restoreWatchPosition(state.resumePosition)
  }, [actions, state.resumePosition])

  const handleStartOver = useCallback(() => {
    actions.startOver()
  }, [actions])

  const dismissPrompt = useCallback(() => {
    actions.dismissResumePrompt()
  }, [actions])

  return useMemo(
    () => ({
      shouldShowResumePrompt: state.shouldShowResumePrompt,
      resumePosition: state.resumePosition,
      resumeFormattedTime: formatVideoTime(state.resumePosition),
      handleResume,
      handleStartOver,
      dismissPrompt,
    }),
    [
      state.shouldShowResumePrompt,
      state.resumePosition,
      handleResume,
      handleStartOver,
      dismissPrompt,
    ]
  )
}

export default useResumePlayback
