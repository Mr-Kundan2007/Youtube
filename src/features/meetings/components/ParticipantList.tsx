"use client"

import React, { useState } from "react"
import { MeetingParticipantInfo, MeetingRole } from "../types/meeting"
import {
  X,
  Search,
  Hand,
  Mic,
  MicOff,
  Video,
  VideoOff,
  MoreVertical,
  Shield,
  UserX,
  ArrowUpCircle,
  ArrowDownCircle,
} from "lucide-react"

interface ParticipantListProps {
  participants: MeetingParticipantInfo[]
  currentUserRole: MeetingRole
  currentUserId?: string
  isOpen: boolean
  onClose: () => void
  onMuteParticipant: (userId: string) => void
  onRemoveParticipant: (userId: string) => void
  onPromoteCoHost: (userId: string) => void
  onDemoteCoHost: (userId: string) => void
}

export const ParticipantList: React.FC<ParticipantListProps> = ({
  participants,
  currentUserRole,
  currentUserId,
  isOpen,
  onClose,
  onMuteParticipant,
  onRemoveParticipant,
  onPromoteCoHost,
  onDemoteCoHost,
}) => {
  const [searchQuery, setSearchQuery] = useState("")
  const [activeMenuUserId, setActiveMenuUserId] = useState<string | null>(null)

  // Close on Escape key
  React.useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const isHost = currentUserRole === "HOST"
  const isCoHost = currentUserRole === "CO_HOST"
  const canModerate = isHost || isCoHost

  // Filter participants
  const filtered = participants.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
  )

  // Hand raised participants ordered by handRaisedAt
  const handRaisedParticipants = filtered.filter((p) => p.isHandRaised)

  return (
    <>
      {/* Backdrop for mobile */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 sm:hidden animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="participants-dialog-title"
        className="fixed z-40 bg-zinc-950/95 backdrop-blur-xl border-white/10 flex flex-col shadow-2xl animate-in duration-200
          max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-14 max-sm:rounded-t-3xl max-sm:border-t max-sm:slide-in-from-bottom pb-safe
          sm:inset-y-0 sm:right-0 sm:w-80 md:w-96 sm:border-l sm:slide-in-from-right"
      >
        {/* Mobile drag handle */}
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mt-3 mb-1 sm:hidden" />

        {/* Panel Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 id="participants-dialog-title" className="text-base font-semibold text-white">Participants</h2>
            <p className="text-xs text-zinc-400">{participants.length} in this call</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close participants panel"
            className="min-w-[44px] min-h-[44px] rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center touch-target-44"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

      {/* Search Input */}
      <div className="p-3 border-b border-white/10">
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search participants..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
          />
        </div>
      </div>

      {/* List Container */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Hand Raised Queue */}
        {handRaisedParticipants.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-amber-400 tracking-wider uppercase">
              <Hand className="w-3.5 h-3.5" />
              <span>Hands Raised ({handRaisedParticipants.length})</span>
            </div>
            <div className="mt-1 space-y-1">
              {handRaisedParticipants.map((p, idx) => (
                <div
                  key={`hand-${p.userId}`}
                  className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="text-sm font-medium text-white truncate">
                      {p.name} {p.isLocal && "(You)"}
                    </span>
                  </div>
                  <Hand className="w-4 h-4 text-amber-400 flex-shrink-0 animate-bounce" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All Participants List */}
        <div>
          <div className="px-2 py-1 text-xs font-semibold text-zinc-400 tracking-wider uppercase">
            In Call ({filtered.length})
          </div>

          <div className="mt-1 space-y-1">
            {filtered.map((p) => {
              const initials = p.name
                ? p.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)
                : "U"

              const isUserHost = p.role === "HOST"
              const isUserCoHost = p.role === "CO_HOST"
              const canModerateThisUser =
                canModerate && !p.isLocal && !isUserHost && !(isCoHost && isUserCoHost)

              return (
                <div
                  key={p.userId}
                  className="p-2.5 rounded-xl hover:bg-white/5 transition-colors flex items-center justify-between relative group"
                >
                  {/* Left info */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    {p.image ? (
                      <img
                        src={p.image}
                        alt={p.name}
                        className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-red-600 to-amber-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {initials}
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-white truncate">
                          {p.name}
                        </span>
                        {p.isLocal && (
                          <span className="text-xs text-zinc-400">(You)</span>
                        )}
                      </div>
                      {/* Role Pill */}
                      {isUserHost && (
                        <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">
                          Host
                        </span>
                      )}
                      {isUserCoHost && (
                        <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">
                          Co-Host
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right Status / Actions */}
                  <div className="flex items-center gap-1">
                    {p.isMuted ? (
                      <MicOff className="w-4 h-4 text-red-400" />
                    ) : (
                      <Mic className="w-4 h-4 text-zinc-400" />
                    )}

                    {p.isCameraOff ? (
                      <VideoOff className="w-4 h-4 text-zinc-500" />
                    ) : (
                      <Video className="w-4 h-4 text-emerald-400" />
                    )}

                    {/* Moderation Dropdown Trigger */}
                    {canModerateThisUser && (
                      <div className="relative">
                        <button
                          onClick={() =>
                            setActiveMenuUserId(activeMenuUserId === p.userId ? null : p.userId)
                          }
                          aria-label={`Moderation options for ${p.name}`}
                          className="min-w-[44px] min-h-[44px] p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 flex items-center justify-center touch-target-44"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {/* Dropdown Menu */}
                        {activeMenuUserId === p.userId && (
                          <div className="absolute right-0 top-11 z-50 w-48 rounded-xl bg-zinc-900 border border-white/10 p-1.5 shadow-2xl text-xs space-y-1">
                            {/* Mute */}
                            {!p.isMuted && (
                              <button
                                onClick={() => {
                                  onMuteParticipant(p.userId)
                                  setActiveMenuUserId(null)
                                }}
                                className="w-full px-3 py-2.5 rounded-lg flex items-center gap-2 text-zinc-300 hover:bg-white/10 hover:text-white transition-colors touch-target-44"
                              >
                                <MicOff className="w-4 h-4 text-red-400" />
                                <span>Mute microphone</span>
                              </button>
                            )}

                            {/* Promote to Co-Host */}
                            {isHost && !isUserCoHost && (
                              <button
                                onClick={() => {
                                  onPromoteCoHost(p.userId)
                                  setActiveMenuUserId(null)
                                }}
                                className="w-full px-3 py-2.5 rounded-lg flex items-center gap-2 text-zinc-300 hover:bg-white/10 hover:text-white transition-colors touch-target-44"
                              >
                                <ArrowUpCircle className="w-4 h-4 text-blue-400" />
                                <span>Make Co-Host</span>
                              </button>
                            )}

                            {/* Demote Co-Host */}
                            {isHost && isUserCoHost && (
                              <button
                                onClick={() => {
                                  onDemoteCoHost(p.userId)
                                  setActiveMenuUserId(null)
                                }}
                                className="w-full px-3 py-2.5 rounded-lg flex items-center gap-2 text-zinc-300 hover:bg-white/10 hover:text-white transition-colors touch-target-44"
                              >
                                <ArrowDownCircle className="w-4 h-4 text-amber-400" />
                                <span>Remove Co-Host</span>
                              </button>
                            )}

                            {/* Remove from Call */}
                            <button
                              onClick={() => {
                                onRemoveParticipant(p.userId)
                                setActiveMenuUserId(null)
                              }}
                              className="w-full px-3 py-2.5 rounded-lg flex items-center gap-2 text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors touch-target-44"
                            >
                              <UserX className="w-4 h-4" />
                              <span>Remove from call</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
    </>
  )
}
