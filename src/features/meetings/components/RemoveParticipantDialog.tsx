"use client"

import React from "react"
import { AlertTriangle, UserX } from "lucide-react"

interface RemoveParticipantDialogProps {
  isOpen: boolean
  participantName: string
  onClose: () => void
  onConfirm: () => void
  isProcessing?: boolean
}

export const RemoveParticipantDialog: React.FC<RemoveParticipantDialogProps> = ({
  isOpen,
  participantName,
  onClose,
  onConfirm,
  isProcessing = false,
}) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-sm bg-zinc-900 border border-white/15 rounded-2xl p-6 shadow-2xl space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-500">
          <UserX className="w-6 h-6" />
        </div>

        <div>
          <h3 className="text-lg font-bold text-white">Remove {participantName}?</h3>
          <p className="mt-1.5 text-sm text-zinc-400">
            This participant will be immediately disconnected and prevented from rejoining this meeting room.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 rounded-xl text-sm font-medium text-zinc-300 hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isProcessing}
            className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-sm font-semibold text-white transition-all shadow-lg disabled:opacity-50"
          >
            {isProcessing ? "Removing..." : "Remove Participant"}
          </button>
        </div>
      </div>
    </div>
  )
}
