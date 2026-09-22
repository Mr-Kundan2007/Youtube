"use client"

import React, { useEffect, useRef } from "react"
import { Room, Track, Participant, RoomEvent, ParticipantEvent } from "livekit-client"
import { MeetingParticipantInfo } from "../types/meeting"
import { videoService } from "../services/videoService"
import {
  Mic,
  MicOff,
  Hand,
  Wifi,
  WifiOff,
  Shield,
  Star,
  Pin,
  Maximize2,
} from "lucide-react"

interface ParticipantVideoProps {
  participant: MeetingParticipantInfo
  room?: Room | null
  isPinned?: boolean
  onTogglePin?: () => void
  showControls?: boolean
}

export const ParticipantVideo: React.FC<ParticipantVideoProps> = ({
  participant,
  room,
  isPinned = false,
  onTogglePin,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Attach Video & Audio tracks via LiveKit Track API with robust fallback
  useEffect(() => {
    let isCancelled = false
    const currentVideoEl = videoRef.current
    const currentAudioEl = audioRef.current

    let targetParticipant: Participant | undefined
    if (room) {
      if (participant.isLocal) {
        targetParticipant = room.localParticipant
      } else {
        targetParticipant = room.remoteParticipants.get(participant.userId)
      }
    }

    const attachTracks = () => {
      if (!currentVideoEl || isCancelled) return

      // Camera is explicitly turned off and not screen sharing
      if (participant.isCameraOff && !participant.isScreenSharing) {
        if (currentVideoEl.srcObject) {
          currentVideoEl.srcObject = null
        }
        return
      }

      let attached = false

      // Case 1: Screen Sharing
      if (participant.isScreenSharing) {
        if (participant.isLocal) {
          const screenStream = videoService.getLocalScreenStream()
          if (screenStream && currentVideoEl) {
            if (currentVideoEl.srcObject !== screenStream) {
              currentVideoEl.srcObject = screenStream
            }
            currentVideoEl.play().catch(() => {})
            attached = true
          }
        }
        if (!attached && targetParticipant) {
          const screenPub = targetParticipant.getTrackPublication(Track.Source.ScreenShare)
          const screenTrack = screenPub?.track
          if (screenTrack) {
            screenTrack.attach(currentVideoEl)
            currentVideoEl.play().catch(() => {})
            attached = true
          }
        }
      }

      // Case 2: Camera Feed
      if (!attached && !participant.isCameraOff) {
        if (participant.isLocal) {
          // Priority A: Try LiveKit's published local camera track
          const camPub = room?.localParticipant?.getTrackPublication(Track.Source.Camera)
          const lkTrack = camPub?.track
          const lkMediaTrack = lkTrack?.mediaStreamTrack

          if (lkMediaTrack && lkMediaTrack.readyState === "live") {
            const currentStream = currentVideoEl.srcObject as MediaStream | null
            const currentTrack = currentStream?.getVideoTracks()?.[0]
            if (!currentStream || currentTrack?.id !== lkMediaTrack.id || currentTrack?.readyState !== "live") {
              currentVideoEl.srcObject = new MediaStream([lkMediaTrack])
              currentVideoEl.play().catch(() => {})
            }
            attached = true
          }

          // Priority B: Try videoService active local camera stream
          if (!attached) {
            const localCamStream = videoService.getLocalCameraStream()
            const liveTrack = localCamStream?.getVideoTracks()?.find((t) => t.readyState === "live")
            if (liveTrack) {
              const currentStream = currentVideoEl.srcObject as MediaStream | null
              const currentTrack = currentStream?.getVideoTracks()?.[0]
              if (!currentStream || currentTrack?.id !== liveTrack.id || currentTrack?.readyState !== "live") {
                currentVideoEl.srcObject = new MediaStream([liveTrack])
                currentVideoEl.play().catch(() => {})
              }
              attached = true
            }
          }

          // Priority C: Asynchronously ensure camera stream via videoService
          if (!attached) {
            videoService
              .ensureCameraStream()
              .then((stream) => {
                if (isCancelled || !currentVideoEl || participant.isCameraOff) return
                const liveTrack = stream?.getVideoTracks()?.find((t) => t.readyState === "live")
                if (liveTrack) {
                  const currentStream = currentVideoEl.srcObject as MediaStream | null
                  const currentTrack = currentStream?.getVideoTracks()?.[0]
                  if (!currentStream || currentTrack?.id !== liveTrack.id || currentTrack?.readyState !== "live") {
                    currentVideoEl.srcObject = new MediaStream([liveTrack])
                    currentVideoEl.play().catch(() => {})
                  }
                }
              })
              .catch(() => {})
          }
        } else if (targetParticipant) {
          // Remote participant camera
          const camPub = targetParticipant.getTrackPublication(Track.Source.Camera)
          const camTrack = camPub?.track
          const remoteMediaTrack = camTrack?.mediaStreamTrack
          if (remoteMediaTrack && remoteMediaTrack.readyState === "live") {
            const currentStream = currentVideoEl.srcObject as MediaStream | null
            const currentTrack = currentStream?.getVideoTracks()?.[0]
            if (!currentStream || currentTrack?.id !== remoteMediaTrack.id || currentTrack?.readyState !== "live") {
              currentVideoEl.srcObject = new MediaStream([remoteMediaTrack])
              currentVideoEl.play().catch(() => {})
            }
            attached = true
          } else if (camTrack) {
            camTrack.attach(currentVideoEl)
            currentVideoEl.play().catch(() => {})
            attached = true
          }
        }
      }

      // Audio track (only for remote participants)
      if (!participant.isLocal && currentAudioEl && targetParticipant) {
        const audioPub = targetParticipant.getTrackPublication(Track.Source.Microphone)
        const audioTrack = audioPub?.track
        if (audioTrack) {
          audioTrack.attach(currentAudioEl)
          currentAudioEl.play().catch(() => {})
        }
      }
    }

    attachTracks()

    // Safety re-check after brief delay in case hardware camera is still warming up
    const warmUpTimer = setTimeout(() => {
      if (!isCancelled) attachTracks()
    }, 400)

    // Room level events
    if (room) {
      room.on(RoomEvent.TrackPublished, attachTracks)
      room.on(RoomEvent.TrackUnpublished, attachTracks)
      room.on(RoomEvent.LocalTrackPublished, attachTracks)
      room.on(RoomEvent.LocalTrackUnpublished, attachTracks)
      room.on(RoomEvent.TrackSubscribed, attachTracks)
      room.on(RoomEvent.TrackUnsubscribed, attachTracks)
      room.on(RoomEvent.TrackMuted, attachTracks)
      room.on(RoomEvent.TrackUnmuted, attachTracks)
    }

    // Participant level events
    if (targetParticipant) {
      targetParticipant.on(ParticipantEvent.TrackMuted, attachTracks)
      targetParticipant.on(ParticipantEvent.TrackUnmuted, attachTracks)
      targetParticipant.on(ParticipantEvent.TrackPublished, attachTracks)
      targetParticipant.on(ParticipantEvent.TrackUnpublished, attachTracks)
    }

    return () => {
      isCancelled = true
      clearTimeout(warmUpTimer)
      if (room) {
        room.off(RoomEvent.TrackPublished, attachTracks)
        room.off(RoomEvent.TrackUnpublished, attachTracks)
        room.off(RoomEvent.LocalTrackPublished, attachTracks)
        room.off(RoomEvent.LocalTrackUnpublished, attachTracks)
        room.off(RoomEvent.TrackSubscribed, attachTracks)
        room.off(RoomEvent.TrackUnsubscribed, attachTracks)
        room.off(RoomEvent.TrackMuted, attachTracks)
        room.off(RoomEvent.TrackUnmuted, attachTracks)
      }
      if (targetParticipant) {
        targetParticipant.off(ParticipantEvent.TrackMuted, attachTracks)
        targetParticipant.off(ParticipantEvent.TrackUnmuted, attachTracks)
        targetParticipant.off(ParticipantEvent.TrackPublished, attachTracks)
        targetParticipant.off(ParticipantEvent.TrackUnpublished, attachTracks)
      }
    }
  }, [room, participant.userId, participant.isLocal, participant.isCameraOff, participant.isScreenSharing])

  const initials = participant.name
    ? participant.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U"

  return (
    <div
      role="region"
      aria-label={`Participant ${participant.name}${participant.isLocal ? " (You)" : ""}, ${
        participant.isSpeaking ? "currently speaking, " : ""
      }${participant.isMuted ? "microphone muted" : "microphone on"}, ${
        participant.isCameraOff ? "camera turned off" : "camera on"
      }${participant.isHandRaised ? ", hand raised" : ""}`}
      className={`relative w-full h-full bg-zinc-900/90 rounded-2xl overflow-hidden flex items-center justify-center border transition-all duration-200 group select-none ${
        participant.isSpeaking
          ? "border-emerald-500/80 ring-2 ring-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.25)]"
          : isPinned
          ? "border-amber-500/80 ring-2 ring-amber-500/30"
          : "border-white/10 hover:border-white/20"
      }`}
    >
      {/* Remote Audio element */}
      {!participant.isLocal && <audio ref={audioRef} autoPlay playsInline />}

      {/* Video Element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={participant.isLocal} // CRITICAL: Mute local video to prevent audio feedback loops
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          participant.isCameraOff ? "opacity-0 pointer-events-none" : "opacity-100"
        } ${participant.isLocal && !participant.isScreenSharing ? "-scale-x-100" : ""}`}
      />

      {/* Avatar Fallback when Camera is Off */}
      {participant.isCameraOff && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
          <div className="relative">
            {participant.image ? (
              <img
                src={participant.image}
                alt={`Avatar for ${participant.name}`}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border-2 border-white/20 shadow-xl"
              />
            ) : (
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-tr from-red-600 via-rose-600 to-amber-500 flex items-center justify-center text-white text-2xl sm:text-3xl font-bold shadow-xl">
                {initials}
              </div>
            )}
            {participant.isSpeaking && (
              <span className="absolute -inset-1 rounded-full border-2 border-emerald-400 animate-ping opacity-75" />
            )}
          </div>
          <span className="mt-3 text-sm font-medium text-zinc-300">Camera Off</span>
        </div>
      )}

      {/* Top Overlay Badges */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
        {/* Hand Raised Banner */}
        {participant.isHandRaised ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/90 text-amber-950 text-xs font-bold shadow-lg animate-bounce pointer-events-auto">
            <Hand className="w-3.5 h-3.5 fill-amber-950" />
            <span>Hand Raised</span>
          </div>
        ) : (
          <div />
        )}

        {/* Pin Button */}
        {onTogglePin && (
          <button
            onClick={onTogglePin}
            aria-label={isPinned ? `Unpin ${participant.name}` : `Pin ${participant.name}`}
            className={`p-2 rounded-lg backdrop-blur-md transition-all pointer-events-auto touch-target-44 flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none ${
              isPinned
                ? "bg-amber-500/80 text-black opacity-100"
                : "bg-black/50 text-white/80 hover:bg-black/80 hover:text-white"
            }`}
            title={isPinned ? "Unpin video" : "Pin video"}
          >
            <Pin className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Bottom Overlay Info Bar */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
        {/* Name & Role */}
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 max-w-[70%]">
          {/* Role Icon */}
          {participant.role === "HOST" && (
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-600/90 text-white">
              Host
            </span>
          )}
          {participant.role === "CO_HOST" && (
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-600/90 text-white">
              Co-Host
            </span>
          )}

          <span className="text-xs font-medium text-white truncate">
            {participant.name} {participant.isLocal && "(You)"}
          </span>
        </div>

        {/* Device & Network Badges */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          {/* Mic Status */}
          <div
            aria-label={participant.isMuted ? "Microphone muted" : "Microphone active"}
            className={`p-1.5 rounded-lg backdrop-blur-md border flex items-center justify-center ${
              participant.isMuted
                ? "bg-red-500/20 border-red-500/40 text-red-400"
                : "bg-black/60 border-white/10 text-emerald-400"
            }`}
          >
            {participant.isMuted ? (
              <MicOff className="w-3.5 h-3.5" />
            ) : (
              <Mic className="w-3.5 h-3.5" />
            )}
          </div>

          {/* Connection Quality */}
          {participant.connectionQuality === "poor" ? (
            <div
              aria-label="Connection quality: poor"
              className="p-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-400 backdrop-blur-md flex items-center justify-center"
              title="Unstable connection"
            >
              <WifiOff className="w-3.5 h-3.5" />
            </div>
          ) : (
            <div
              aria-label="Connection quality: good"
              className="p-1.5 rounded-lg bg-black/60 border border-white/10 text-zinc-400 backdrop-blur-md flex items-center justify-center"
              title="Good connection"
            >
              <Wifi className="w-3.5 h-3.5" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


