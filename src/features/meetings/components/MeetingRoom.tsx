"use client"

import React, { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/router"
import {
  MeetingDetails,
  MeetingRole,
  MeetingParticipantInfo,
  RoomConnectionState,
} from "../types/meeting"
import { useVideoRoom } from "../hooks/useVideoRoom"
import { useMediaDevices } from "../hooks/useMediaDevices"
import { useMeetingChat } from "../hooks/useMeetingChat"
import { useReactions } from "../hooks/useReactions"
import { useModeration } from "../hooks/useModeration"
import { useRecording } from "../hooks/useRecording"
import { meetingApi } from "../services/meetingApi"
import { videoService, DataChannelMessage } from "../services/videoService"

import { MeetingHeader } from "./MeetingHeader"
import { ParticipantGrid } from "./ParticipantGrid"
import { MeetingControls } from "./MeetingControls"
import { ParticipantList } from "./ParticipantList"
import { ChatPanel } from "./ChatPanel"
import { FloatingReactionOverlay } from "./FloatingReactionOverlay"
import { DeviceSettingsModal } from "./DeviceSettingsModal"
import { RemoveParticipantDialog } from "./RemoveParticipantDialog"
import { EndMeetingDialog } from "./EndMeetingDialog"
import { RecordingNotificationBanner } from "./RecordingNotificationBanner"
import { StopRecordingConfirmDialog } from "./StopRecordingConfirmDialog"
import { RecordingsModal } from "./RecordingsModal"
import { SecurityStatusModal } from "./SecurityStatusModal"
import { LiveAnnouncerProvider, useAnnouncer } from "./LiveAnnouncer"
import { useAccessibilityShortcuts } from "../hooks/useAccessibilityShortcuts"
import { e2eeService } from "../services/e2eeService"
import { RoomEvent, RemoteParticipant } from "livekit-client"
import {
  WifiOff,
  RefreshCw,
  AlertTriangle,
  LogOut,
  ShieldAlert,
} from "lucide-react"

interface MeetingRoomProps {
  meeting: MeetingDetails
  token: string
  identity: string
  livekitUrl?: string
  role: MeetingRole
  initialMuted?: boolean
  initialCameraOff?: boolean
  participantName?: string
  participantImage?: string
  onLeave?: () => void
}

const MeetingRoomContent: React.FC<MeetingRoomProps> = ({
  meeting,
  token,
  identity,
  livekitUrl,
  role,
  initialMuted = false,
  initialCameraOff = false,
  participantName,
  participantImage,
  onLeave,
}) => {
  const router = useRouter()

  // Panel States
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  // Dialog States
  const [targetRemovalUser, setTargetRemovalUser] = useState<MeetingParticipantInfo | null>(null)
  const [showEndDialog, setShowEndDialog] = useState(false)
  const [showStopRecordingDialog, setShowStopRecordingDialog] = useState(false)
  const [isRecordingsModalOpen, setIsRecordingsModalOpen] = useState(false)
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false)

  // Pin & Hand Raise States
  const [pinnedId, setPinnedId] = useState<string | null>(null)
  const [isHandRaised, setIsHandRaised] = useState<boolean>(false)
  const [isLocked, setIsLocked] = useState<boolean>(Boolean(meeting.isLocked))

  // Security & E2EE States (Phase 10)
  const [securityMode, setSecurityMode] = useState<"STANDARD" | "E2EE">(
    meeting.securityMode || "STANDARD"
  )
  const [e2eeKeyVersion, setE2EEKeyVersion] = useState<number>(
    meeting.e2eeKeyVersion || 1
  )
  const [isE2EESupported, setIsE2EESupported] = useState<boolean>(true)
  const [isE2EEActive, setIsE2EEActive] = useState<boolean>(false)

  // 1. Media & Devices
  const { isMobile, videoInputs, flipCamera } = useMediaDevices()

  // 2. Video Room & WebRTC
  const {
    room,
    connectionState,
    participants,
    localParticipant,
    isMicOn,
    isCameraOn,
    isScreenSharing,
    toggleMic,
    toggleCamera,
    toggleScreenShare,
    disconnect,
    reconnect,
    reconnectAttempt,
  } = useVideoRoom({
    roomId: meeting.roomId,
    token,
    livekitUrl,
    initialMuted,
    initialCameraOff,
    participantName: participantName || meeting.hostName || "You",
    participantRole: role,
    participantImage: participantImage || "",
    onKicked: () => {
      // Local participant was removed
    },
    onLockedChange: (locked) => {
      setIsLocked(locked)
    },
  })

  // Check E2EE browser support on mount
  useEffect(() => {
    const supported = e2eeService.checkBrowserSupport()
    setIsE2EESupported(supported)
  }, [])

  // E2EE Data Channel Listener & Auto-Negotiation
  useEffect(() => {
    if (!room) return

    // Host initialization if room was created in E2EE mode
    if (role === "HOST" && securityMode === "E2EE") {
      const initHostKey = async () => {
        try {
          if (!e2eeService.getRawKeyHex()) {
            await e2eeService.generateMasterKey()
          }
          e2eeService.setEnabled(true)
          setIsE2EEActive(true)

          const hex = e2eeService.getRawKeyHex()
          if (hex) {
            await videoService.publishData({
              type: "E2EE_KEY_DISTRIBUTE",
              data: { keyHex: hex, keyVersion: e2eeKeyVersion },
              senderId: identity,
              senderName: localParticipant?.name || "Host",
              timestamp: Date.now(),
            }, true)
          }
        } catch (err) {
          console.warn("[MeetingRoom] E2EE Host key generation failed:", err)
        }
      }
      initHostKey()
    }

    const handleRemoteParticipantConnected = async (p: RemoteParticipant) => {
      // If Host has active E2EE key, send key to newly joined peer
      if (role === "HOST" && securityMode === "E2EE") {
        const hex = e2eeService.getRawKeyHex()
        if (hex) {
          await videoService.publishData({
            type: "E2EE_KEY_DISTRIBUTE",
            data: { keyHex: hex, keyVersion: e2eeKeyVersion },
            senderId: identity,
            senderName: localParticipant?.name || "Host",
            timestamp: Date.now(),
          }, true, [p.identity])
        }
      }
    }

    const handleDataReceived = async (payload: Uint8Array) => {
      const msg = videoService.decodeDataPayload(payload)
      if (!msg) return

      if (msg.type === "E2EE_KEY_DISTRIBUTE") {
        if (msg.data?.keyHex) {
          try {
            await e2eeService.importKeyFromHex(msg.data.keyHex, msg.data.keyVersion || 1)
            e2eeService.setEnabled(true)
            setSecurityMode("E2EE")
            setE2EEKeyVersion(msg.data.keyVersion || 1)
            setIsE2EEActive(true)
          } catch (err) {
            console.error("[MeetingRoom] Failed to import distributed E2EE key:", err)
          }
        }
      } else if (msg.type === "E2EE_KEY_ROTATED") {
        if (msg.data?.keyHex) {
          try {
            await e2eeService.importKeyFromHex(msg.data.keyHex, msg.data.keyVersion || 1)
            setE2EEKeyVersion(msg.data.keyVersion || 1)
          } catch (err) {
            console.error("[MeetingRoom] Failed to import rotated E2EE key:", err)
          }
        }
      } else if (msg.type === "E2EE_MODE_TOGGLED") {
        const newMode = msg.data?.securityMode || "STANDARD"
        setSecurityMode(newMode)
        if (newMode === "E2EE" && msg.data?.keyHex) {
          try {
            await e2eeService.importKeyFromHex(msg.data.keyHex, msg.data.keyVersion || 1)
            e2eeService.setEnabled(true)
            setE2EEKeyVersion(msg.data.keyVersion || 1)
            setIsE2EEActive(true)
          } catch (err) {
            console.error("[MeetingRoom] Failed to import toggled E2EE key:", err)
          }
        } else if (newMode === "STANDARD") {
          e2eeService.setEnabled(false)
          setIsE2EEActive(false)
        }
      }
    }

    room.on(RoomEvent.ParticipantConnected, handleRemoteParticipantConnected)
    room.on(RoomEvent.DataReceived, handleDataReceived)

    return () => {
      room.off(RoomEvent.ParticipantConnected, handleRemoteParticipantConnected)
      room.off(RoomEvent.DataReceived, handleDataReceived)
    }
  }, [room, role, securityMode, e2eeKeyVersion, identity, localParticipant?.name])

  // 3. In-Call Chat
  const {
    messages,
    uploadProgress,
    unreadCount,
    sendMessage,
    uploadAttachment,
  } = useMeetingChat({
    roomId: meeting.roomId,
    room,
    senderId: identity,
    senderName: localParticipant?.name || "Participant",
    senderImage: localParticipant?.image,
    allowChat: meeting.permissions?.allowChat !== false,
    allowFileSharing: meeting.permissions?.allowFileSharing !== false,
  })

  // 4. Reactions
  const { reactions, sendReaction } = useReactions({
    room,
    senderId: identity,
    senderName: localParticipant?.name || "You",
  })

  // 5. Host Moderation
  const {
    isHost,
    canModerate,
    isProcessing: isModerationProcessing,
    muteParticipant,
    removeParticipant,
    promoteCoHost,
    demoteCoHost,
    toggleMeetingLock,
    endMeetingForAll,
  } = useModeration({
    roomId: meeting.roomId,
    userRole: role,
    room,
    currentUserId: identity,
    currentUserName: localParticipant?.name || "Host",
    onMeetingEnded: () => {
      disconnect()
      if (onLeave) onLeave()
      else router.push("/")
    },
    onMeetingLockedChange: (locked) => {
      setIsLocked(locked)
    },
  })

  // 6. Secure Meeting Recording (Phase 9)
  const {
    status: recordingStatus,
    isRecording,
    canRecord,
    durationSeconds: recordingDuration,
    uploadProgress: recordingUploadProgress,
    recordings,
    isRecordingsLoading,
    notification: recordingNotification,
    errorMessage: recordingError,
    startRecording,
    stopRecording,
    fetchRecordings,
    deleteRecording,
  } = useRecording({
    roomId: meeting.roomId,
    room,
    userRole: role,
    currentUserId: identity,
    currentUserName: localParticipant?.name || participantName || "Participant",
    allowRecording: meeting.permissions?.allowRecording !== false,
    initialRecording: meeting.recording,
  })

  // Host toggles E2EE
  const handleToggleE2EE = useCallback(async (enabled: boolean) => {
    const res = await meetingApi.toggleE2EE(meeting.roomId, enabled)
    setSecurityMode(res.securityMode)
    setE2EEKeyVersion(res.e2eeKeyVersion)

    if (enabled) {
      let keyHex = e2eeService.getRawKeyHex()
      if (!keyHex) {
        const gen = await e2eeService.generateMasterKey()
        keyHex = gen.hex
      }
      e2eeService.setEnabled(true)
      setIsE2EEActive(true)

      await videoService.publishData({
        type: "E2EE_MODE_TOGGLED",
        data: {
          securityMode: "E2EE",
          keyVersion: res.e2eeKeyVersion,
          keyHex,
        },
        senderId: identity,
        senderName: localParticipant?.name || "Host",
        timestamp: Date.now(),
      }, true)
    } else {
      e2eeService.setEnabled(false)
      setIsE2EEActive(false)

      await videoService.publishData({
        type: "E2EE_MODE_TOGGLED",
        data: {
          securityMode: "STANDARD",
          keyVersion: res.e2eeKeyVersion,
        },
        senderId: identity,
        senderName: localParticipant?.name || "Host",
        timestamp: Date.now(),
      }, true)
    }
  }, [meeting.roomId, identity, localParticipant?.name])

  // Host rotates E2EE Key
  const handleRotateKey = useCallback(async () => {
    const { hex: newKeyHex, version: newVersion } = await e2eeService.rotateKey()
    const res = await meetingApi.rotateE2EEKey(meeting.roomId)
    setE2EEKeyVersion(res.e2eeKeyVersion || newVersion)

    await videoService.publishData({
      type: "E2EE_KEY_ROTATED",
      data: {
        keyHex: newKeyHex,
        keyVersion: res.e2eeKeyVersion || newVersion,
      },
      senderId: identity,
      senderName: localParticipant?.name || "Host",
      timestamp: Date.now(),
    }, true)
  }, [meeting.roomId, identity, localParticipant?.name])

  const handleToggleRecord = useCallback(() => {
    if (isRecording) {
      setShowStopRecordingDialog(true)
    } else {
      startRecording()
    }
  }, [isRecording, startRecording])

  const handleOpenRecordings = useCallback(() => {
    fetchRecordings()
    setIsRecordingsModalOpen(true)
  }, [fetchRecordings])

  // Hand Raise Toggle
  const handleToggleHandRaise = useCallback(async () => {
    try {
      const res = await meetingApi.toggleHandRaise(meeting.roomId, identity)
      setIsHandRaised(res.isHandRaised)

      // Broadcast Hand Raise via Data Channel
      const packet: DataChannelMessage<{ isHandRaised: boolean }> = {
        type: "HAND_RAISE",
        data: { isHandRaised: res.isHandRaised },
        senderId: identity,
        senderName: localParticipant?.name || "Participant",
        timestamp: Date.now(),
      }
      await videoService.publishData(packet, true)
    } catch (err) {
      console.warn("Failed to toggle hand raise", err)
    }
  }, [meeting.roomId, identity, localParticipant?.name])

  // Leave Handlers
  const handleLeaveCall = useCallback(async () => {
    await meetingApi.leaveMeeting(meeting.roomId, identity).catch(console.warn)
    await disconnect()
    if (onLeave) onLeave()
    else router.push("/")
  }, [meeting.roomId, identity, disconnect, onLeave, router])

  const handleEndCallForAll = useCallback(async () => {
    await endMeetingForAll()
    await disconnect()
    if (onLeave) onLeave()
    else router.push("/")
  }, [endMeetingForAll, disconnect, onLeave, router])

  const { announce } = useAnnouncer()

  // Screen reader announcements for participants count
  const prevCountRef = React.useRef(participants.length)
  useEffect(() => {
    if (participants.length > prevCountRef.current) {
      const newlyJoined = participants[participants.length - 1]
      if (newlyJoined && !newlyJoined.isLocal) {
        announce(`${newlyJoined.name} joined the meeting`, "polite")
      }
    } else if (participants.length < prevCountRef.current) {
      announce("A participant left the meeting", "polite")
    }
    prevCountRef.current = participants.length
  }, [participants.length, announce])

  // Screen reader announcements for recording
  const prevRecordingRef = React.useRef(isRecording)
  useEffect(() => {
    if (isRecording !== prevRecordingRef.current) {
      if (isRecording) {
        announce("Meeting recording started", "assertive")
      } else {
        announce("Meeting recording stopped", "assertive")
      }
      prevRecordingRef.current = isRecording
    }
  }, [isRecording, announce])

  // Screen reader announcements for orientation
  useEffect(() => {
    const handleOrientationChange = () => {
      const isLandscape = window.innerWidth > window.innerHeight
      announce(isLandscape ? "View rotated to landscape mode" : "View rotated to portrait mode", "polite")
    }
    window.addEventListener("resize", handleOrientationChange)
    return () => window.removeEventListener("resize", handleOrientationChange)
  }, [announce])

  // Accessibility Keyboard Shortcuts (Phase 11)
  useAccessibilityShortcuts({
    isMicOn,
    isCameraOn,
    isChatOpen,
    isParticipantsOpen,
    isHandRaised,
    onToggleMic: toggleMic,
    onToggleCamera: toggleCamera,
    onToggleChat: () => {
      setIsChatOpen((prev) => {
        const next = !prev
        if (next) setIsParticipantsOpen(false)
        return next
      })
    },
    onToggleParticipants: () => {
      setIsParticipantsOpen((prev) => {
        const next = !prev
        if (next) setIsChatOpen(false)
        return next
      })
    },
    onToggleHandRaise: handleToggleHandRaise,
    onCloseModals: () => {
      setIsChatOpen(false)
      setIsParticipantsOpen(false)
      setIsSettingsOpen(false)
      setIsRecordingsModalOpen(false)
      setIsSecurityModalOpen(false)
      setShowEndDialog(false)
      setShowStopRecordingDialog(false)
      setTargetRemovalUser(null)
    },
  })

  // If participant was removed by host
  if (connectionState === "REMOVED") {
    return (
      <div className="min-h-screen w-full bg-zinc-950 flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="w-16 h-16 rounded-full bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-500 mb-4 animate-in zoom-in-95">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white">Removed from Meeting</h2>
        <p className="mt-2 text-sm text-zinc-400 max-w-sm">
          A meeting host or co-host has removed you from this call. You cannot rejoin this session.
        </p>
        <button
          onClick={() => (onLeave ? onLeave() : router.push("/"))}
          className="mt-6 px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-semibold text-white transition-colors"
        >
          Return Home
        </button>
      </div>
    )
  }

  // If meeting ended
  if (connectionState === "ENDED") {
    return (
      <div className="min-h-screen w-full bg-zinc-950 flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-zinc-300 mb-4">
          <LogOut className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white">Meeting Ended</h2>
        <p className="mt-2 text-sm text-zinc-400 max-w-sm">
          This meeting has ended or you have left the room.
        </p>
        <button
          onClick={() => (onLeave ? onLeave() : router.push("/"))}
          className="mt-6 px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-sm font-semibold text-white transition-all shadow-lg"
        >
          Return to YouTube
        </button>
      </div>
    )
  }

  return (
    <div className="relative w-full h-screen h-[100dvh] bg-zinc-950 flex flex-col overflow-hidden select-none">
      {/* Floating Reaction Overlay */}
      <FloatingReactionOverlay reactions={reactions} />

      {/* Recording Notification Banner */}
      <RecordingNotificationBanner
        notification={recordingNotification}
        onDismiss={() => {}}
      />

      {/* Reconnection Status Toast Banner */}
      {(connectionState === "RECONNECTING" || connectionState === "DEGRADED") && (
        <div className="absolute top-18 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-amber-500/90 text-amber-950 backdrop-blur-md shadow-2xl flex items-center gap-2 text-xs font-bold animate-pulse">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>
            {connectionState === "RECONNECTING"
              ? `Reconnecting to room (Attempt ${reconnectAttempt}/5)...`
              : "Unstable connection. Attempting to restore video..."}
          </span>
        </div>
      )}

      {/* Top Meeting Header */}
      <MeetingHeader
        title={meeting.title}
        roomId={meeting.roomId}
        isLocked={isLocked}
        participantCount={participants.length}
        startedAt={meeting.startedAt}
        isRecording={isRecording}
        recordingDurationSeconds={recordingDuration}
        isE2EEActive={isE2EEActive}
        securityMode={securityMode}
        keyVersion={e2eeKeyVersion}
        onOpenRecordings={handleOpenRecordings}
        onOpenSecurity={() => setIsSecurityModalOpen(true)}
      />

      {/* Main Grid Area */}
      <main className="flex-1 w-full h-full relative overflow-hidden flex">
        <ParticipantGrid
          participants={participants}
          room={room}
          pinnedId={pinnedId}
          onTogglePin={(id) => setPinnedId(pinnedId === id ? null : id)}
        />

        {/* Side Panels */}
        <ParticipantList
          participants={participants}
          currentUserRole={role}
          currentUserId={identity}
          isOpen={isParticipantsOpen}
          onClose={() => setIsParticipantsOpen(false)}
          onMuteParticipant={muteParticipant}
          onRemoveParticipant={(uId) => {
            const target = participants.find((p) => p.userId === uId)
            if (target) setTargetRemovalUser(target)
          }}
          onPromoteCoHost={promoteCoHost}
          onDemoteCoHost={demoteCoHost}
        />

        <ChatPanel
          roomId={meeting.roomId}
          messages={messages}
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          onSendMessage={sendMessage}
          onUploadAttachment={uploadAttachment}
          uploadProgress={uploadProgress}
          allowChat={meeting.permissions?.allowChat !== false}
          allowFileSharing={meeting.permissions?.allowFileSharing !== false}
          currentUserId={identity}
        />
      </main>

      {/* Bottom Floating Controls */}
      <MeetingControls
        isMicOn={isMicOn}
        isCameraOn={isCameraOn}
        isScreenSharing={isScreenSharing}
        isHandRaised={isHandRaised}
        isChatOpen={isChatOpen}
        isParticipantsOpen={isParticipantsOpen}
        isLocked={isLocked}
        userRole={role}
        unreadChatCount={unreadCount}
        participantCount={participants.length}
        isMobile={isMobile}
        canFlipCamera={videoInputs.length > 1 || isMobile}
        allowScreenShare={meeting.permissions?.allowScreenShare !== false}
        isRecording={isRecording}
        canRecord={canRecord}
        isRecordingLoading={recordingStatus === "starting" || recordingStatus === "stopping" || recordingStatus === "uploading"}
        onToggleRecord={handleToggleRecord}
        onToggleMic={toggleMic}
        onToggleCamera={toggleCamera}
        onToggleScreenShare={toggleScreenShare}
        onFlipCamera={flipCamera}
        onToggleHandRaise={handleToggleHandRaise}
        onSendReaction={sendReaction}
        onToggleChat={() => {
          setIsChatOpen(!isChatOpen)
          if (!isChatOpen) setIsParticipantsOpen(false)
        }}
        onToggleParticipants={() => {
          setIsParticipantsOpen(!isParticipantsOpen)
          if (!isParticipantsOpen) setIsChatOpen(false)
        }}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenSecurity={() => setIsSecurityModalOpen(true)}
        onToggleLock={(lock) => toggleMeetingLock(lock)}
        onLeaveCall={() => setShowEndDialog(true)}
      />

      {/* Device Settings Modal */}
      <DeviceSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Stop Recording Confirmation Dialog */}
      <StopRecordingConfirmDialog
        isOpen={showStopRecordingDialog}
        durationSeconds={recordingDuration}
        isStopping={recordingStatus === "stopping" || recordingStatus === "uploading"}
        onClose={() => setShowStopRecordingDialog(false)}
        onConfirm={async () => {
          try {
            await stopRecording()
          } catch (err) {
            console.error("Error stopping recording:", err)
          } finally {
            setShowStopRecordingDialog(false)
          }
        }}
      />

      {/* Recordings Modal */}
      <RecordingsModal
        isOpen={isRecordingsModalOpen}
        roomId={meeting.roomId}
        userRole={role}
        currentUserId={identity}
        recordings={recordings}
        isLoading={isRecordingsLoading}
        uploadProgress={recordingUploadProgress}
        onClose={() => setIsRecordingsModalOpen(false)}
        onDeleteRecording={deleteRecording}
      />

      {/* Security Status & Management Modal (Phase 10) */}
      <SecurityStatusModal
        isOpen={isSecurityModalOpen}
        isHost={isHost}
        securityMode={securityMode}
        isE2EEActive={isE2EEActive}
        isSupported={isE2EESupported}
        keyVersion={e2eeKeyVersion}
        isLocked={isLocked}
        permissions={meeting.permissions}
        onClose={() => setIsSecurityModalOpen(false)}
        onToggleE2EE={handleToggleE2EE}
        onRotateKey={handleRotateKey}
        onToggleLock={toggleMeetingLock}
      />

      {/* Remove Participant Dialog */}
      <RemoveParticipantDialog
        isOpen={Boolean(targetRemovalUser)}
        participantName={targetRemovalUser?.name || "Participant"}
        onClose={() => setTargetRemovalUser(null)}
        onConfirm={async () => {
          if (targetRemovalUser) {
            await removeParticipant(targetRemovalUser.userId)
            // Auto rotate E2EE key upon participant removal (Phase 10 Security)
            if (isHost && securityMode === "E2EE") {
              try {
                const { hex: newKeyHex, version: newVersion } = await e2eeService.rotateKey()
                await meetingApi.rotateE2EEKey(meeting.roomId)
                setE2EEKeyVersion(newVersion)
                await videoService.publishData({
                  type: "E2EE_KEY_ROTATED",
                  data: { keyHex: newKeyHex, keyVersion: newVersion },
                  senderId: identity,
                  senderName: localParticipant?.name || "Host",
                  timestamp: Date.now(),
                }, true)
              } catch (rotErr) {
                console.warn("Failed to rotate key on participant removal:", rotErr)
              }
            }
            setTargetRemovalUser(null)
          }
        }}
        isProcessing={isModerationProcessing}
      />

      {/* End Meeting / Leave Dialog */}
      <EndMeetingDialog
        isOpen={showEndDialog}
        isHost={isHost}
        onClose={() => setShowEndDialog(false)}
        onLeaveMeeting={handleLeaveCall}
        onEndMeetingForAll={isHost ? handleEndCallForAll : undefined}
      />
    </div>
  )
}

export const MeetingRoom: React.FC<MeetingRoomProps> = (props) => {
  return (
    <LiveAnnouncerProvider>
      <MeetingRoomContent {...props} />
    </LiveAnnouncerProvider>
  )
}

