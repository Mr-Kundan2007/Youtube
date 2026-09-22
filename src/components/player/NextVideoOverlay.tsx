import React, { useEffect, useRef } from "react"
import { useVideoPlayer } from "./VideoPlayerContext"
import { NextVideoCard } from "./NextVideoCard"

export const NextVideoOverlay: React.FC = () => {
  const { state, actions } = useVideoPlayer()
  const playButtonRef = useRef<HTMLButtonElement | null>(null)

  const isVisible =
    state.isNextVideoCountdownActive &&
    !state.isAutoplayCancelled &&
    Boolean(state.resolvedNextVideo)

  // Focus primary action when overlay appears
  useEffect(() => {
    if (isVisible && playButtonRef.current) {
      playButtonRef.current.focus()
    }
  }, [isVisible])

  // Handle Escape key to cancel countdown
  useEffect(() => {
    if (!isVisible) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        actions.cancelAutoplayCountdown()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isVisible, actions])

  if (!isVisible || !state.resolvedNextVideo) {
    return null
  }

  const countdown = state.countdownRemaining
  const total = state.autoplayCountdown || 10
  const progressPercent = Math.max(0, Math.min(100, ((total - countdown) / total) * 100))

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md transition-all duration-300 animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="next-video-overlay-title"
    >
      <div className="relative w-full max-w-md bg-neutral-900/95 border border-white/15 rounded-2xl p-4 sm:p-5 shadow-2xl backdrop-blur-xl flex flex-col gap-4 text-white">
        <h3 id="next-video-overlay-title" className="sr-only">
          Next Video Autoplay Countdown
        </h3>

        {/* Top Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="bg-red-600 text-white text-xs font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm shadow-red-600/50">
              Up Next
            </span>
            <span className="text-xs sm:text-sm font-medium text-white/90">
              Playing in <strong className="text-red-400 font-bold">{countdown}s</strong>
            </span>
          </div>

          <button
            type="button"
            onClick={actions.cancelAutoplayCountdown}
            className="text-white/60 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors focus:ring-2 focus:ring-white/40 focus:outline-none"
            aria-label="Cancel autoplay"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Next Video Card Preview */}
        <NextVideoCard
          video={state.resolvedNextVideo}
          onClick={() => actions.playNextVideo()}
        />

        {/* Countdown Progress Bar */}
        <div
          className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={countdown}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-label="Countdown until next video"
        >
          <div
            className="bg-red-600 h-full rounded-full transition-all duration-300 ease-linear shadow-sm shadow-red-500/50"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={actions.cancelAutoplayCountdown}
            className="px-4 py-2 text-xs sm:text-sm font-medium text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors focus:ring-2 focus:ring-white/40 focus:outline-none cursor-pointer"
          >
            Cancel
          </button>

          <button
            ref={playButtonRef}
            type="button"
            onClick={() => actions.playNextVideo()}
            className="flex items-center gap-2 px-5 py-2 text-xs sm:text-sm font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg shadow-lg hover:shadow-red-600/30 transition-all focus:ring-2 focus:ring-red-400 focus:outline-none cursor-pointer"
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            Play Now
          </button>
        </div>
      </div>
    </div>
  )
}

