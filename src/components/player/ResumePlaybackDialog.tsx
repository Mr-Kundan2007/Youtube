import React, { useEffect, useRef } from "react"
import { Play, RotateCcw, X } from "lucide-react"
import { useResumePlayback } from "./useResumePlayback"

export interface ResumePlaybackDialogProps {
  className?: string
}

/**
 * ResumePlaybackDialog
 * Presents an accessible banner/dialog giving users the choice to continue
 * from their last saved timestamp or start over from the beginning.
 */
export const ResumePlaybackDialog: React.FC<ResumePlaybackDialogProps> = ({ className = "" }) => {
  const {
    shouldShowResumePrompt,
    resumePosition,
    resumeFormattedTime,
    handleResume,
    handleStartOver,
    dismissPrompt,
  } = useResumePlayback()

  const resumeBtnRef = useRef<HTMLButtonElement | null>(null)

  // Auto-focus the primary "Resume" action when dialog appears
  useEffect(() => {
    if (shouldShowResumePrompt) {
      resumeBtnRef.current?.focus()
    }
  }, [shouldShowResumePrompt])

  if (!shouldShowResumePrompt || resumePosition <= 0) {
    return null
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation()
      dismissPrompt()
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Resume playback prompt"
      onKeyDown={handleKeyDown}
      className={`absolute bottom-16 sm:bottom-20 left-4 sm:left-6 z-30 max-w-[320px] sm:max-w-[380px] p-3.5 sm:p-4 rounded-xl bg-neutral-900/95 backdrop-blur-md border border-white/10 shadow-2xl text-white transition-all duration-300 ease-out animate-in fade-in slide-in-from-bottom-3 ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h3 className="text-sm sm:text-base font-semibold text-white tracking-tight flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            Resume watching?
          </h3>
          <p className="mt-1 text-xs sm:text-sm text-neutral-300">
            Continue from{" "}
            <span className="font-mono font-medium text-white px-1.5 py-0.5 rounded bg-white/10">
              {resumeFormattedTime}
            </span>
          </p>
        </div>

        <button
          type="button"
          onClick={dismissPrompt}
          className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          aria-label="Dismiss resume prompt"
        >
          <X size={16} />
        </button>
      </div>

      <div className="mt-3.5 flex items-center gap-2">
        <button
          ref={resumeBtnRef}
          type="button"
          onClick={handleResume}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 sm:py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-medium shadow-md transition-all transform hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
        >
          <Play size={14} className="fill-white" />
          Resume
        </button>

        <button
          type="button"
          onClick={handleStartOver}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 sm:py-2 rounded-lg bg-white/10 hover:bg-white/20 text-neutral-200 hover:text-white text-xs sm:text-sm font-medium transition-all transform hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        >
          <RotateCcw size={13} />
          Start Over
        </button>
      </div>
    </div>
  )
}

export default ResumePlaybackDialog
