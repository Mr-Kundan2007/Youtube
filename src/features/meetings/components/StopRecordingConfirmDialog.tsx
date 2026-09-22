"use client"

import React from "react"
import { Square, AlertCircle, Loader2 } from "lucide-react"

interface StopRecordingConfirmDialogProps {
  isOpen: boolean
  durationSeconds: number
  isStopping?: boolean
  onClose: () => void
  onConfirm: () => void
}

export const StopRecordingConfirmDialog: React.FC<StopRecordingConfirmDialogProps> = ({
  isOpen,
  durationSeconds,
  isStopping = false,
  onClose,
  onConfirm,
}) => {
  if (!isOpen) return null

  const formatDuration = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}m ${seconds}s`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6 text-zinc-100 flex flex-col gap-4 animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-500">
            <Square className="w-5 h-5 fill-current" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Stop Meeting Recording?</h3>
            <p className="text-xs text-zinc-400">
              Current recording duration: <span className="font-semibold text-zinc-200">{formatDuration(durationSeconds)}</span>
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-400 leading-relaxed flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span>
            Stopping the recording will finalize the media stream, encode the video, and save it directly to encrypted private storage. All participants will be notified that the recording has ended.
          </span>
        </div>

        <div className="flex items-center justify-end gap-3 mt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isStopping}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-zinc-300 hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isStopping}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-500 transition-all shadow-lg shadow-red-950/50 disabled:opacity-50"
          >
            {isStopping ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Finalizing...</span>
              </>
            ) : (
              <>
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop & Save Recording</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
