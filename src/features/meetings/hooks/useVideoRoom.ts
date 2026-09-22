"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  Room,
  RoomEvent,
  RemoteParticipant,
  LocalParticipant,
  Participant,
  ConnectionQuality,
  Track,
  ConnectionState,
} from "livekit-client"
import { videoService, DataChannelMessage } from "../services/videoService"
import {
  MeetingParticipantInfo,
  RoomConnectionState,
  ConnectionQualityState,
  MeetingRole,
} from "../types/meeting"

interface UseVideoRoomProps {
  roomId: string
  token: string
  livekitUrl?: string
  initialMuted?: boolean
  initialCameraOff?: boolean
  participantName?: string
  participantRole?: MeetingRole
  participantImage?: string
  onKicked?: () => void
  onLockedChange?: (isLocked: boolean) => void
}

const mapQuality = (quality: ConnectionQuality): ConnectionQualityState => {
  switch (quality) {
    case ConnectionQuality.Excellent:
      return "excellent"
    case ConnectionQuality.Good:
      return "good"
    case ConnectionQuality.Poor:
      return "poor"
    default:
      return "fair"
  }
}

export function useVideoRoom({
  roomId,
  token,
  livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || "wss://youtube-yn47nbsb.livekit.cloud",
  initialMuted = false,
  initialCameraOff = false,
  participantName = "You",
  participantRole = "HOST",
  participantImage = "",
  onKicked,
  onLockedChange,
}: UseVideoRoomProps) {
  const [connectionState, setConnectionState] = useState<RoomConnectionState>("IDLE")
  const [room, setRoom] = useState<Room | null>(null)
  const [participants, setParticipants] = useState<MeetingParticipantInfo[]>([
    {
      userId: "local-user",
      participantId: "local-user",
      name: participantName,
      displayName: participantName,
      role: participantRole,
      image: participantImage,
      isLocal: true,
      isSpeaking: false,
      isMuted: initialMuted,
      isCameraOff: initialCameraOff,
      cameraEnabled: !initialCameraOff,
      isScreenSharing: false,
      connectionQuality: "excellent",
      joinedAt: new Date().toISOString(),
    },
  ])
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null)
  const [isMicOn, setIsMicOn] = useState<boolean>(!initialMuted)
  const [isCameraOn, setIsCameraOn] = useState<boolean>(!initialCameraOff)
  const [isScreenSharing, setIsScreenSharing] = useState<boolean>(false)
  const [reconnectAttempt, setReconnectAttempt] = useState<number>(0)

  const retryTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isConnectingRef = useRef<boolean>(false)
  const onKickedRef = useRef(onKicked)
  onKickedRef.current = onKicked
  const onLockedChangeRef = useRef(onLockedChange)
  onLockedChangeRef.current = onLockedChange

  // Maps a LiveKit participant to MeetingParticipantInfo
  const mapParticipant = useCallback(
    (p: Participant, isLocal = false): MeetingParticipantInfo => {
      let role: MeetingRole = "PARTICIPANT"
      let image = ""

      if (p.metadata) {
        try {
          const parsed = JSON.parse(p.metadata)
          if (parsed.role) role = parsed.role
          if (parsed.image) image = parsed.image
        } catch {
          // ignore parsing error
        }
      }

      const micPub = p.getTrackPublication(Track.Source.Microphone)
      const camPub = p.getTrackPublication(Track.Source.Camera)
      const screenPub = p.getTrackPublication(Track.Source.ScreenShare)

      const isMuted = isLocal ? !isMicOn : micPub ? micPub.isMuted : true
      const isCameraOff = isLocal ? !isCameraOn : camPub ? camPub.isMuted : true
      const isScreenShareActive = isLocal ? isScreenSharing : Boolean(screenPub && !screenPub.isMuted)

      return {
        userId: p.identity,
        participantId: p.identity,
        name: p.name || (isLocal ? (participantName || "You") : "Participant"),
        displayName: p.name || (isLocal ? (participantName || "You") : "Participant"),
        image: image || (isLocal ? participantImage : ""),
        role: isLocal ? participantRole : role,
        isLocal,
        isSpeaking: p.isSpeaking,
        isMuted,
        isCameraOff,
        cameraEnabled: !isCameraOff,
        isScreenSharing: isScreenShareActive,
        connectionQuality: mapQuality(p.connectionQuality),
        joinedAt: new Date().toISOString(),
      }
    },
    [isMicOn, isCameraOn, isScreenSharing, participantName, participantImage, participantRole]
  )

  // Syncs all participants in the room
  const syncParticipants = useCallback(() => {
    const currentRoom = videoService.getRoom()
    const list: MeetingParticipantInfo[] = []

    if (currentRoom?.localParticipant) {
      list.push(mapParticipant(currentRoom.localParticipant, true))
    } else {
      list.push({
        userId: "local-user",
        participantId: "local-user",
        name: participantName,
        displayName: participantName,
        role: participantRole,
        image: participantImage,
        isLocal: true,
        isSpeaking: false,
        isMuted: !isMicOn,
        isCameraOff: !isCameraOn,
        cameraEnabled: isCameraOn,
        isScreenSharing,
        connectionQuality: "excellent",
        joinedAt: new Date().toISOString(),
      })
    }

    if (currentRoom) {
      currentRoom.remoteParticipants.forEach((rp) => {
        list.push(mapParticipant(rp, false))
      })
    }

    setParticipants(list)
  }, [mapParticipant, participantName, participantRole, participantImage, isMicOn, isCameraOn, isScreenSharing])

  const syncParticipantsRef = useRef(syncParticipants)
  syncParticipantsRef.current = syncParticipants

  // Connection Handler with Exponential Backoff
  const connectToRoom = useCallback(async () => {
    if (!token || !roomId || isConnectingRef.current) return
    isConnectingRef.current = true
    setConnectionState("CONNECTING")

    // Immediately initialize local camera and microphone stream so the local user sees their face instantly
    if (!initialCameraOff) {
      videoService.setCameraEnabled(true).catch(console.warn)
    }
    if (!initialMuted) {
      videoService.setMicrophoneEnabled(true).catch(console.warn)
    }

    // Handle mock token or missing credentials in development gracefully
    if (token.startsWith("mock-livekit-token-")) {
      console.info("[useVideoRoom] Dev mode detected: Mock token present. Initializing simulated media session.")
      setConnectionState("CONNECTED")
      setParticipants([
        {
          userId: "local-user",
          participantId: "local-user",
          name: participantName || "You",
          displayName: participantName || "You",
          role: participantRole,
          image: participantImage,
          isLocal: true,
          isSpeaking: false,
          isMuted: initialMuted,
          isCameraOff: initialCameraOff,
          cameraEnabled: !initialCameraOff,
          isScreenSharing: false,
          connectionQuality: "excellent",
          joinedAt: new Date().toISOString(),
        },
      ])
      isConnectingRef.current = false
      return
    }

    try {
      const activeRoom = await videoService.connect(livekitUrl, token)
      setRoom(activeRoom)
      setConnectionState("CONNECTED")
      setReconnectAttempt(0)

      // Initialize local media tracks in LiveKit
      if (!initialMuted) {
        await videoService.setMicrophoneEnabled(true).catch(console.warn)
      }
      if (!initialCameraOff) {
        await videoService.setCameraEnabled(true).catch(console.warn)
      }

      syncParticipantsRef.current()

      const handleSync = () => syncParticipantsRef.current()

      // Register Room Events
      activeRoom.on(RoomEvent.ParticipantConnected, handleSync)
      activeRoom.on(RoomEvent.ParticipantDisconnected, handleSync)
      activeRoom.on(RoomEvent.TrackSubscribed, handleSync)
      activeRoom.on(RoomEvent.TrackUnsubscribed, handleSync)
      activeRoom.on(RoomEvent.TrackPublished, handleSync)
      activeRoom.on(RoomEvent.TrackUnpublished, handleSync)
      activeRoom.on(RoomEvent.LocalTrackPublished, handleSync)
      activeRoom.on(RoomEvent.LocalTrackUnpublished, handleSync)
      activeRoom.on(RoomEvent.TrackMuted, handleSync)
      activeRoom.on(RoomEvent.TrackUnmuted, handleSync)
      activeRoom.on(RoomEvent.ParticipantMetadataChanged, handleSync)
      activeRoom.on(RoomEvent.ConnectionQualityChanged, handleSync)

      activeRoom.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        if (speakers.length > 0) {
          setActiveSpeakerId(speakers[0].identity)
        } else {
          setActiveSpeakerId(null)
        }
        syncParticipantsRef.current()
      })

      activeRoom.on(RoomEvent.Reconnecting, () => {
        setConnectionState("RECONNECTING")
      })

      activeRoom.on(RoomEvent.Reconnected, () => {
        setConnectionState("RECOVERED")
        setTimeout(() => setConnectionState("CONNECTED"), 2000)
        syncParticipantsRef.current()
      })

      activeRoom.on(RoomEvent.Disconnected, () => {
        setConnectionState("ENDED")
      })

      // Data Channel Collaboration Listener
      activeRoom.on(RoomEvent.DataReceived, (payload: Uint8Array, participant?: RemoteParticipant) => {
        const msg = videoService.decodeDataPayload(payload)
        if (!msg) return

        if (msg.type === "PARTICIPANT_REMOVED") {
          const targetId = msg.data?.targetUserId
          if (targetId && activeRoom.localParticipant?.identity === targetId) {
            setConnectionState("REMOVED")
            videoService.disconnect()
            onKickedRef.current?.()
          }
        } else if (msg.type === "MUTE_REQUEST") {
          const targetId = msg.data?.targetUserId
          if (targetId && activeRoom.localParticipant?.identity === targetId) {
            videoService.setMicrophoneEnabled(false)
            setIsMicOn(false)
          }
        } else if (msg.type === "ROOM_LOCKED") {
          onLockedChangeRef.current?.(true)
        } else if (msg.type === "ROOM_UNLOCKED") {
          onLockedChangeRef.current?.(false)
        }
      })
    } catch (err: any) {
      console.warn("[useVideoRoom] Connection attempt failed:", err?.message || err)
      setConnectionState("DEGRADED")

      // Exponential backoff retry (up to 5 attempts)
      setReconnectAttempt((prev) => {
        const nextAttempt = prev + 1
        if (nextAttempt <= 5) {
          const delay = Math.min(1000 * Math.pow(2, nextAttempt) + Math.random() * 500, 10000)
          console.info(`[useVideoRoom] Scheduling reconnect attempt #${nextAttempt} in ${Math.round(delay)}ms`)
          retryTimerRef.current = setTimeout(() => {
            isConnectingRef.current = false
            connectToRoom()
          }, delay)
        } else {
          setConnectionState("FAILED")
        }
        return nextAttempt
      })
    } finally {
      isConnectingRef.current = false
    }
  }, [token, roomId, livekitUrl, initialMuted, initialCameraOff])

  // Mount/Unmount lifecycle - only connects once per room/token session
  useEffect(() => {
    connectToRoom()

    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
      videoService.disconnect()
    }
  }, [connectToRoom])

  // Media Controls
  const toggleMic = useCallback(async () => {
    const nextState = !isMicOn
    try {
      await videoService.setMicrophoneEnabled(nextState)
      setIsMicOn(nextState)
      syncParticipants()
    } catch (e) {
      console.error("Failed to toggle microphone", e)
    }
  }, [isMicOn, syncParticipants])

  const toggleCamera = useCallback(async () => {
    const nextState = !isCameraOn
    try {
      await videoService.setCameraEnabled(nextState)
      setIsCameraOn(nextState)
      syncParticipants()
    } catch (e) {
      console.error("Failed to toggle camera", e)
    }
  }, [isCameraOn, syncParticipants])

  const toggleScreenShare = useCallback(async () => {
    const nextState = !isScreenSharing
    try {
      const active = await videoService.setScreenShareEnabled(nextState)
      setIsScreenSharing(active)

      if (active) {
        const stream = videoService.getLocalScreenStream()
        if (stream) {
          stream.getVideoTracks().forEach((track) => {
            track.onended = () => {
              setIsScreenSharing(false)
              syncParticipants()
            }
          })
        }
      }

      syncParticipants()
    } catch (e) {
      console.warn("Screen share error:", e)
      setIsScreenSharing(false)
      syncParticipants()
    }
  }, [isScreenSharing, syncParticipants])

  const disconnect = useCallback(async () => {
    await videoService.disconnect()
    setConnectionState("ENDED")
  }, [])

  const reconnect = useCallback(async () => {
    setReconnectAttempt(0)
    isConnectingRef.current = false
    await connectToRoom()
  }, [connectToRoom])

  const localParticipant = participants.find((p) => p.isLocal) || null

  return {
    room,
    connectionState,
    participants,
    localParticipant,
    activeSpeakerId,
    isMicOn,
    isCameraOn,
    isScreenSharing,
    toggleMic,
    toggleCamera,
    toggleScreenShare,
    disconnect,
    reconnect,
    reconnectAttempt,
  }
}
