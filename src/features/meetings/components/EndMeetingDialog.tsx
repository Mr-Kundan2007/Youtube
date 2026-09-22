"use client"

import React from "react"
import { PhoneOff, LogOut, AlertOctagon } from "lucide-react"

interface EndMeetingDialogProps {
  isOpen: boolean
  isHost: boolean
  onClose: () => void
  onLeaveMeeting: () => void
  onEndMeetingForAll?: () => void
  isProcessing?: boolean
}

export const EndMeetingDialog: React.FC<EndMeetingDialogProps> = ({
  isOpen,
  isHost,
  onClose,
  onLeaveMeeting,
  onEndMeetingForAll,
  isProcessing = false,
}) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-sm bg-zinc-900 border border-white/15 rounded-2xl p-6 shadow-2xl space-y-5">
        <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-500">
          <PhoneOff className="w-6 h-6" />
        </div>

        <div>
          <h3 className="text-lg font-bold text-white">Leave or End Meeting</h3>
          <p className="mt-1 text-sm text-zinc-400">
            {isHost
              ? "As host, you can leave the meeting or end it for all participants."
              : "Are you sure you want to leave this meeting?"}
          </p>
        </div>

        <div className="space-y-2 pt-1">
          {/* Host can end meeting for all */}
          {isHost && onEndMeetingForAll && (
            <button
              onClick={onEndMeetingForAll}
              disabled={isProcessing}
              className="w-full py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all shadow-lg disabled:opacity-50"
            >
              <AlertOctagon className="w-4 h-4" />
              <span>{isProcessing ? "Ending..." : "End Meeting for All"}</span>
            </button>
          )}

          {/* Just leave */}
          <button
            onClick={onLeaveMeeting}
            disabled={isProcessing}
            className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-semibold text-white flex items-center justify-center gap-2 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Leave Meeting</span>
          </button>

          {/* Cancel */}
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="w-full py-2 px-4 rounded-xl text-xs font-medium text-zinc-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
