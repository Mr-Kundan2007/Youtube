"use client"

import React from "react"
import { FloatingReaction } from "../types/meeting"

interface FloatingReactionOverlayProps {
  reactions: FloatingReaction[]
}

export const FloatingReactionOverlay: React.FC<FloatingReactionOverlayProps> = ({
  reactions,
}) => {
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {reactions.map((reaction) => (
        <div
          key={reaction.id}
          className="absolute bottom-24 flex flex-col items-center animate-reaction-float transition-all"
          style={{
            left: `${reaction.x}%`,
          }}
        >
          {/* Emoji */}
          <span className="text-4xl sm:text-5xl filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)] transform hover:scale-125 transition-transform select-none">
            {reaction.emoji}
          </span>

          {/* Sender Badge */}
          {reaction.senderName && (
            <span className="mt-1 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-medium text-white border border-white/10 shadow-lg whitespace-nowrap select-none">
              {reaction.senderName}
            </span>
          )}
        </div>
      ))}

      <style jsx global>{`
        @keyframes reactionFloat {
          0% {
            transform: translateY(0) scale(0.6);
            opacity: 0;
          }
          15% {
            transform: translateY(-20px) scale(1.1);
            opacity: 1;
          }
          30% {
            transform: translateY(-60px) scale(1);
            opacity: 1;
          }
          70% {
            transform: translateY(-160px) scale(1);
            opacity: 0.8;
          }
          100% {
            transform: translateY(-260px) scale(0.8);
            opacity: 0;
          }
        }
        .animate-reaction-float {
          animation: reactionFloat 3.2s ease-out forwards;
        }
      `}</style>
    </div>
  )
}
