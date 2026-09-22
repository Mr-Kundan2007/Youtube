"use client"

import React from "react"
import { Hand } from "lucide-react"

interface ReactionBarProps {
  onSendReaction: (emoji: string) => void
  isHandRaised: boolean
  onToggleHandRaise: () => void
  onClose?: () => void
}

const EMOJIS = ["❤️", "👍", "👏", "🎉", "🔥", "😂", "😮"]

export const ReactionBar: React.FC<ReactionBarProps> = ({
  onSendReaction,
  isHandRaised,
  onToggleHandRaise,
  onClose,
}) => {
  return (
    <div className="flex items-center gap-1.5 p-2 rounded-2xl bg-zinc-900/95 backdrop-blur-xl border border-white/15 shadow-2xl animate-in zoom-in-95 duration-150 select-none">
      {/* Popular Emojis */}
      <div className="flex items-center gap-1">
        {EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => {
              onSendReaction(emoji)
              onClose?.()
            }}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-xl hover:bg-white/10 hover:scale-125 active:scale-95 transition-all duration-150"
            title={`React with ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>

      <div className="w-px h-6 bg-white/15 mx-1" />

      {/* Raise Hand Toggle */}
      <button
        onClick={() => {
          onToggleHandRaise()
          onClose?.()
        }}
        className={`px-3 py-1.5 rounded-xl flex items-center gap-2 text-xs font-semibold transition-all duration-150 ${
          isHandRaised
            ? "bg-amber-500 text-amber-950 shadow-[0_0_15px_rgba(245,158,11,0.4)]"
            : "bg-white/10 text-white hover:bg-white/20"
        }`}
      >
        <Hand className={`w-4 h-4 ${isHandRaised ? "fill-amber-950 animate-bounce" : ""}`} />
        <span>{isHandRaised ? "Lower Hand" : "Raise Hand"}</span>
      </button>
    </div>
  )
}
