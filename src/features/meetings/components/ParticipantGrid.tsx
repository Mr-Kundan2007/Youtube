"use client"

import React, { useMemo } from "react"
import { Room } from "livekit-client"
import { MeetingParticipantInfo } from "../types/meeting"
import { ParticipantVideo } from "./ParticipantVideo"

interface ParticipantGridProps {
  participants: MeetingParticipantInfo[]
  room?: Room | null
  pinnedId: string | null
  onTogglePin: (userId: string) => void
}

export const ParticipantGrid: React.FC<ParticipantGridProps> = ({
  participants,
  room,
  pinnedId,
  onTogglePin,
}) => {
  // If someone is screen sharing or pinned, show spotlight mode
  const screenSharingParticipant = useMemo(
    () => participants.find((p) => p.isScreenSharing),
    [participants]
  )

  // Calculate dynamic active speaker or spotlight
  const activeSpeaker = useMemo(
    () => participants.find((p) => p.isSpeaking && !p.isLocal),
    [participants]
  )

  const spotlightParticipant = useMemo(() => {
    if (pinnedId) {
      return participants.find((p) => p.userId === pinnedId) || null
    }
    if (screenSharingParticipant) {
      return screenSharingParticipant
    }
    // On small screens with 5+ participants, spotlight the active speaker
    if (participants.length >= 5 && activeSpeaker) {
      return activeSpeaker
    }
    return null
  }, [pinnedId, screenSharingParticipant, activeSpeaker, participants])

  // Non-spotlight peers
  const otherParticipants = useMemo(() => {
    if (!spotlightParticipant) return participants
    return participants.filter((p) => p.userId !== spotlightParticipant.userId)
  }, [spotlightParticipant, participants])

  // Spotlight layout (used for Screen Share, Pinned, or 5+ peers active speaker on mobile)
  if (spotlightParticipant) {
    return (
      <section
        role="region"
        aria-label="Meeting video grid spotlight"
        className="w-full h-full flex flex-col lg:flex-row gap-2.5 sm:gap-3 p-2 sm:p-4 overflow-hidden"
      >
        {/* Main Spotlight Video */}
        <div className="flex-1 h-full min-h-[220px] sm:min-h-[350px] relative rounded-2xl overflow-hidden shadow-2xl">
          <ParticipantVideo
            participant={spotlightParticipant}
            room={room}
            isPinned={Boolean(pinnedId && pinnedId === spotlightParticipant.userId)}
            onTogglePin={() => onTogglePin(spotlightParticipant.userId)}
          />
        </div>

        {/* Side / Bottom Thumbnail Strip (touch scrollable with snap on mobile) */}
        {otherParticipants.length > 0 && (
          <div className="lg:w-72 flex lg:flex-col flex-row gap-2.5 sm:gap-3 overflow-x-auto lg:overflow-y-auto lg:h-full max-h-[140px] sm:max-h-[160px] lg:max-h-full py-1 snap-x scrollbar-thin">
            {otherParticipants.map((p) => (
              <div
                key={p.userId}
                className="w-36 sm:w-44 lg:w-full h-24 sm:h-32 lg:h-44 flex-shrink-0 relative rounded-xl overflow-hidden shadow-md snap-start"
              >
                <ParticipantVideo
                  participant={p}
                  room={room}
                  isPinned={false}
                  onTogglePin={() => onTogglePin(p.userId)}
                />
              </div>
            ))}
          </div>
        )}
      </section>
    )
  }

  // Dynamic grid layouts optimized for mobile portrait & landscape
  const count = participants.length

  if (count === 1) {
    return (
      <section
        role="region"
        aria-label="Meeting video feed"
        className="w-full h-full p-2 sm:p-4 flex items-center justify-center overflow-hidden"
      >
        <div className="w-full h-full relative rounded-2xl overflow-hidden shadow-2xl">
          <ParticipantVideo
            participant={participants[0]}
            room={room}
            isPinned={Boolean(pinnedId && pinnedId === participants[0].userId)}
            onTogglePin={() => onTogglePin(participants[0].userId)}
          />
        </div>
      </section>
    )
  }

  if (count === 2) {
    return (
      <section
        role="region"
        aria-label="Meeting video grid"
        className="w-full h-full p-2 sm:p-4 grid grid-cols-1 sm:grid-cols-2 grid-rows-2 sm:grid-rows-1 gap-2.5 sm:gap-4 overflow-hidden"
      >
        {participants.map((participant) => (
          <div
            key={participant.userId}
            className="w-full h-full min-h-[180px] sm:min-h-[260px] relative rounded-2xl overflow-hidden shadow-lg"
          >
            <ParticipantVideo
              participant={participant}
              room={room}
              isPinned={Boolean(pinnedId && pinnedId === participant.userId)}
              onTogglePin={() => onTogglePin(participant.userId)}
            />
          </div>
        ))}
      </section>
    )
  }

  if (count === 3 || count === 4) {
    return (
      <section
        role="region"
        aria-label="Meeting video grid"
        className="w-full h-full p-2 sm:p-4 grid grid-cols-2 grid-rows-2 gap-2.5 sm:gap-4 overflow-hidden"
      >
        {participants.map((participant) => (
          <div
            key={participant.userId}
            className="w-full h-full min-h-[140px] sm:min-h-[220px] relative rounded-2xl overflow-hidden shadow-lg"
          >
            <ParticipantVideo
              participant={participant}
              room={room}
              isPinned={Boolean(pinnedId && pinnedId === participant.userId)}
              onTogglePin={() => onTogglePin(participant.userId)}
            />
          </div>
        ))}
      </section>
    )
  }

  // 5+ participants: Responsive grid on tablet/desktop, scrollable on mobile
  return (
    <section
      role="region"
      aria-label="Meeting video grid"
      className="w-full h-full p-2 sm:p-4 overflow-y-auto"
    >
      <div className="w-full min-h-full grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4 auto-rows-fr items-center justify-center">
        {participants.map((participant) => (
          <div
            key={participant.userId}
            className="w-full h-full min-h-[150px] sm:min-h-[220px] relative rounded-2xl overflow-hidden shadow-lg"
          >
            <ParticipantVideo
              participant={participant}
              room={room}
              isPinned={Boolean(pinnedId && pinnedId === participant.userId)}
              onTogglePin={() => onTogglePin(participant.userId)}
            />
          </div>
        ))}
      </div>
    </section>
  )
}

