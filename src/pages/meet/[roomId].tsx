import React, { useEffect, useState, useCallback } from "react"
import Head from "next/head"
import { useRouter } from "next/router"
import { useAuth } from "@/lib/AuthContext"
import MeetingLobby from "@/features/meetings/components/MeetingLobby"
import { MeetingRoom } from "@/features/meetings/components/MeetingRoom"
import MeetingStateMessage from "@/features/meetings/components/MeetingStateMessage"
import { meetingApi } from "@/features/meetings/services/meetingApi"
import {
  MeetingDetails,
  MeetingRole,
  LobbyState,
} from "@/features/meetings/types/meeting"

export default function MeetingRoomPage() {
  const router = useRouter()
  const { roomId, name } = router.query
  const { user }: any = useAuth()

  const cleanRoomId = Array.isArray(roomId) ? roomId[0] : roomId
  const queryName = Array.isArray(name) ? name[0] : name

  const [meeting, setMeeting] = useState<MeetingDetails | null>(null)
  const [lobbyState, setLobbyState] = useState<LobbyState>("LOADING")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Join session state
  const [isJoined, setIsJoined] = useState<boolean>(false)
  const [isJoining, setIsJoining] = useState<boolean>(false)
  const [token, setToken] = useState<string | null>(null)
  const [identity, setIdentity] = useState<string | null>(null)
  const [livekitUrl, setLivekitUrl] = useState<string | undefined>()
  const [role, setRole] = useState<MeetingRole>("PARTICIPANT")
  const [initialMuted, setInitialMuted] = useState<boolean>(false)
  const [initialCameraOff, setInitialCameraOff] = useState<boolean>(false)
  const [joinedDisplayName, setJoinedDisplayName] = useState<string>("")

  const loadMeeting = useCallback(async () => {
    if (!cleanRoomId) return

    try {
      setLobbyState("LOADING")
      setErrorMessage(null)

      const details = await meetingApi.getMeeting(cleanRoomId)
      setMeeting(details)

      // 1. Status checks
      const statusUpper = details.status?.toUpperCase()
      if (statusUpper === "ENDED" || statusUpper === "CANCELLED") {
        setLobbyState("ENDED")
        return
      }

      // 2. Auth policy checks
      const isHost = user && String(details.hostId) === String(user.id)
      if (details.accessPolicy === "AUTHENTICATED_ONLY" && !user) {
        setLobbyState("AUTH_REQUIRED")
        return
      }

      // 3. Lock check (Host bypasses lock)
      if (details.isLocked && !isHost) {
        setLobbyState("LOCKED")
        return
      }

      // 4. Capacity check (Host bypasses capacity)
      const count = details.currentParticipantCount ?? details.participantCount ?? 0
      const max = details.maxParticipants ?? 25
      if (!isHost && count >= max) {
        setLobbyState("FULL")
        return
      }

      setLobbyState("IDLE")
    } catch (err: any) {
      console.warn("Meeting inspect error:", err)
      const errCode = err?.response?.data?.error?.code
      const errMsg =
        err?.response?.data?.error?.message ||
        err?.message ||
        "Unable to access this meeting room."

      setErrorMessage(errMsg)

      if (err?.response?.status === 404 || errCode === "MEETING_NOT_FOUND") {
        setLobbyState("NOT_FOUND")
      } else if (errCode === "MEETING_ENDED") {
        setLobbyState("ENDED")
      } else if (errCode === "MEETING_LOCKED") {
        setLobbyState("LOCKED")
      } else if (errCode === "MEETING_FULL") {
        setLobbyState("FULL")
      } else if (errCode === "AUTHENTICATION_REQUIRED" || err?.response?.status === 401) {
        setLobbyState("AUTH_REQUIRED")
      } else if (errCode === "FORBIDDEN" || err?.response?.status === 403) {
        setLobbyState("DENIED")
      } else {
        setLobbyState("ERROR")
      }
    }
  }, [cleanRoomId, user])

  useEffect(() => {
    loadMeeting()
  }, [loadMeeting])

  const handleJoin = async (params: {
    displayName: string
    isMuted: boolean
    cameraEnabled: boolean
  }) => {
    if (!cleanRoomId) return

    try {
      setIsJoining(true)
      setErrorMessage(null)
      setInitialMuted(params.isMuted)
      setInitialCameraOff(!params.cameraEnabled)
      setJoinedDisplayName(params.displayName)

      const res = await meetingApi.joinMeeting(cleanRoomId, {
        displayName: params.displayName,
        isMuted: params.isMuted,
        cameraEnabled: params.cameraEnabled,
      })

      setToken(res.token)
      setIdentity(res.identity)
      setLivekitUrl(res.livekitUrl)
      setRole(res.role)
      setIsJoined(true)
      setLobbyState("ACCESS_GRANTED")
    } catch (err: any) {
      console.error("Join meeting error:", err)
      const errCode = err?.response?.data?.error?.code
      const errMsg =
        err?.response?.data?.error?.message ||
        err?.message ||
        "Unable to join the meeting room."

      setErrorMessage(errMsg)

      if (errCode === "MEETING_FULL") {
        setLobbyState("FULL")
      } else if (errCode === "MEETING_LOCKED") {
        setLobbyState("LOCKED")
      } else if (errCode === "MEETING_ENDED") {
        setLobbyState("ENDED")
      } else if (errCode === "AUTHENTICATION_REQUIRED") {
        setLobbyState("AUTH_REQUIRED")
      } else if (errCode === "FORBIDDEN") {
        setLobbyState("DENIED")
      } else {
        alert(errMsg)
      }
    } finally {
      setIsJoining(false)
    }
  }

  const handleLeave = async () => {
    if (cleanRoomId) {
      try {
        await meetingApi.leaveMeeting(cleanRoomId, identity || undefined)
      } catch (e) {}
    }
    setIsJoined(false)
    router.push("/meet")
  }

  // Determine initial display name
  const initialDisplayName =
    queryName || user?.channelname || user?.name || ""
  const isHost = Boolean(user && meeting && String(meeting.hostId) === String(user.id))

  // 1. Loading State
  if (lobbyState === "LOADING") {
    return (
      <div className="min-h-[85vh] flex flex-col items-center justify-center bg-neutral-950 text-white p-4">
        <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4 shadow-lg shadow-blue-500/20" />
        <p className="text-sm font-medium text-neutral-300">
          Verifying room security & access policies...
        </p>
        <p className="text-xs text-neutral-500 mt-1 font-mono">{cleanRoomId}</p>
      </div>
    )
  }

  // 2. Specific Non-Joinable States
  if (
    lobbyState === "NOT_FOUND" ||
    lobbyState === "ENDED" ||
    lobbyState === "LOCKED" ||
    lobbyState === "FULL" ||
    lobbyState === "AUTH_REQUIRED" ||
    lobbyState === "DENIED" ||
    lobbyState === "ERROR"
  ) {
    return (
      <>
        <Head>
          <title>{`Video Meeting (${cleanRoomId || "Room"}) - YouTube Clone`}</title>
        </Head>
        <div className="bg-neutral-950 min-h-[calc(100vh-64px)]">
          <MeetingStateMessage
            state={lobbyState}
            customMessage={errorMessage || undefined}
            roomId={cleanRoomId}
            onRetry={loadMeeting}
            onSignIn={() => router.push(`/login?redirect=/meet/${cleanRoomId}`)}
          />
        </div>
      </>
    )
  }

  // 3. Active In-Room State
  if (isJoined && meeting && token && identity) {
    return (
      <>
        <Head>
          <title>{`${meeting.title} (${cleanRoomId}) - Live Meeting`}</title>
        </Head>

        <MeetingRoom
          meeting={meeting}
          token={token}
          identity={identity}
          livekitUrl={livekitUrl}
          role={role}
          initialMuted={initialMuted}
          initialCameraOff={initialCameraOff}
          participantName={joinedDisplayName || initialDisplayName || "You"}
          participantImage={user?.image || user?.avatar || ""}
          onLeave={handleLeave}
        />
      </>
    )
  }

  // 4. Pre-Join Lobby Screen
  if (meeting) {
    return (
      <>
        <Head>
          <title>{`${meeting.title} - Lobby - Video Meetings`}</title>
        </Head>

        <MeetingLobby
          meeting={meeting}
          initialName={initialDisplayName}
          isAuthenticated={Boolean(user)}
          isHost={isHost}
          isJoining={isJoining}
          onJoin={handleJoin}
          onLeave={() => router.push("/meet")}
        />
      </>
    )
  }

  return null
}
