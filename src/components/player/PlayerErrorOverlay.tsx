import React from "react"
import { AlertTriangle, RefreshCw, XCircle } from "lucide-react"
import { useVideoPlayer } from "./VideoPlayerContext"

export interface PlayerErrorOverlayProps {
  className?: string
}

export const PlayerErrorOverlay: React.FC<PlayerErrorOverlayProps> = ({ className = "" }) => {
  const { state, actions } = useVideoPlayer()

  const error = state.classifiedError || state.error
  const recovery = state.recoveryState
  const isRecovering = Boolean(recovery?.isRecovering)

  if (!error && !isRecovering) return null

  const retryCount = recovery?.retryCount || 0
  const maxRetries = recovery?.maxRetries || 3

  return (
    <div
      className={`absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center text-white z-30 select-none animate-fadeIn ${className}`}
      role="alert"
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className={`w-14 h-14 rounded-full flex items-center justify-center mb-3 ${
          isRecovering
            ? "bg-amber-500/20 text-amber-400 animate-pulse"
            : "bg-red-500/20 text-red-500"
        }`}
      >
        {isRecovering ? (
          <RefreshCw size={28} className="animate-spin" />
        ) : (
          <AlertTriangle size={32} />
        )}
      </div>

      <h3 className="text-lg font-bold mb-1">
        {isRecovering ? "Connection Interrupted" : "Playback Error"}
      </h3>

      <p className="text-sm text-neutral-300 max-w-md mb-2 leading-relaxed">
        {isRecovering
          ? `Attempting to restore video connection... (Attempt ${retryCount} of ${maxRetries})`
          : error?.message || "An error occurred while attempting to play this video."}
      </p>

      {error?.code ? (
        <span className="text-xs font-mono text-neutral-500 mb-5">
          Error Code: {error.code}
        </span>
      ) : (
        <div className="mb-4" />
      )}

      <div className="flex items-center gap-3">
        {isRecovering ? (
          <>
            <button
              type="button"
              onClick={actions.manualRetry || actions.retry}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white text-sm font-semibold shadow-lg hover:shadow-red-600/30 transition-all active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-white cursor-pointer"
            >
              <RefreshCw size={15} />
              Retry Now
            </button>
            <button
              type="button"
              onClick={actions.cancelRecovery}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-neutral-200 text-sm font-semibold transition-all active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-white cursor-pointer"
            >
              <XCircle size={16} />
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={actions.manualRetry || actions.retry}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white text-sm font-semibold shadow-lg hover:shadow-red-600/30 transition-all active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-white cursor-pointer"
          >
            <RefreshCw size={16} />
            Retry Playback
          </button>
        )}
      </div>
    </div>
  )
}

export default PlayerErrorOverlay

