/**
 * Meeting Domain Types and Interfaces for Real-Time Video Calling & Collaboration.
 */

export type MeetingRole = "HOST" | "CO_HOST" | "PARTICIPANT"

export type MeetingStatus =
  | "SCHEDULED"
  | "WAITING"
  | "LIVE"
  | "ENDED"
  | "CANCELLED"
  | "scheduled"
  | "active"
  | "ended"

export type MeetingAccessPolicy =
  | "LINK_ACCESS"
  | "AUTHENTICATED_ONLY"
  | "INVITE_ONLY"
  | "HOST_APPROVAL"

export type LobbyState =
  | "IDLE"
  | "LOADING"
  | "ACCESS_GRANTED"
  | "WAITING_FOR_APPROVAL"
  | "DENIED"
  | "FULL"
  | "LOCKED"
  | "ENDED"
  | "NOT_FOUND"
  | "AUTH_REQUIRED"
  | "ERROR"

export type RoomConnectionState =
  | "IDLE"
  | "CONNECTING"
  | "CONNECTED"
  | "DEGRADED"
  | "RECONNECTING"
  | "RECOVERED"
  | "FAILED"
  | "ENDED"
  | "REMOVED"

export type ConnectionQualityState = "excellent" | "good" | "fair" | "poor" | "reconnecting"

export interface MeetingPermissions {
  allowChat: boolean
  allowScreenShare: boolean
  allowFileSharing: boolean
  allowCamera: boolean
  allowMicrophone: boolean
  allowRecording?: boolean
}

export type RecordingStatus = "idle" | "starting" | "recording" | "stopping" | "uploading" | "failed"

export interface MeetingRecordingInfo {
  id?: string
  _id?: string
  recordingId: string
  meetingId?: string
  roomId: string
  title?: string
  createdBy: {
    _id?: string
    id?: string
    name: string
    email?: string
  } | string
  creatorName: string
  filename: string
  mimeType: string
  fileSize: number
  duration: number
  status: "active" | "completed" | "failed"
  startedAt: string
  endedAt?: string
  createdAt?: string
  accessPolicy?: string
  playbackCount?: number
  downloadCount?: number
}

export interface MeetingDetails {
  id?: string
  meetingId?: string
  roomId: string
  publicRoomId?: string
  title: string
  hostId?: string
  hostName?: string
  host?: {
    displayName: string
  }
  accessPolicy?: MeetingAccessPolicy
  status: MeetingStatus
  isLocked: boolean
  maxParticipants?: number
  currentParticipantCount?: number
  participantCount?: number
  meetingLink?: string
  permissions: MeetingPermissions
  startedAt?: string
  scheduledStartAt?: string
  scheduledEndAt?: string
  recording?: {
    isRecording: boolean
    activeRecordingId?: string
    startedAt?: string
    endedAt?: string
    startedBy?: string
  }
  securityMode?: "STANDARD" | "E2EE"
  e2eeKeyVersion?: number
}

export interface MeetingParticipantInfo {
  userId: string
  participantId?: string
  displayName?: string
  name: string
  image?: string
  role: MeetingRole
  status?: string
  joinedAt: string
  isSpeaking?: boolean
  isMuted?: boolean
  isCameraOff?: boolean
  cameraEnabled?: boolean
  isScreenSharing?: boolean
  isHandRaised?: boolean
  handRaisedAt?: string
  isLocal?: boolean
  connectionQuality?: ConnectionQualityState
}

export interface MeetingJoinResponse {
  token: string
  identity: string
  expiresAt: string
  livekitUrl?: string
  role: MeetingRole
  roomId: string
  publicRoomId?: string
  title: string
  status?: MeetingStatus
  meetingLink?: string
  permissions: MeetingPermissions
  isLocked: boolean
}

export interface MeetingCreatePayload {
  title?: string
  maxParticipants?: number
  accessPolicy?: MeetingAccessPolicy
  permissions?: Partial<MeetingPermissions>
  scheduledStartAt?: string
  scheduledEndAt?: string
}

export interface JoinMeetingPayload {
  displayName?: string
  guestId?: string
  isMuted?: boolean
  cameraEnabled?: boolean
}

export interface MeetingChatMessageItem {
  id?: string
  messageId?: string
  roomId: string
  messageType?: "TEXT" | "FILE" | "SYSTEM"
  senderId: string
  senderName: string
  senderImage?: string
  text: string
  attachment?: {
    filename: string
    originalName: string
    fileUrl: string
    filesize: number
    filetype: string
  }
  timestamp: string
}

export interface FloatingReaction {
  id: string
  emoji: string
  senderName: string
  senderId: string
  x: number // Horizontal percentage position 10% - 90%
  timestamp: number
}

export interface MediaDeviceSettings {
  selectedAudioInputId: string
  selectedVideoInputId: string
  selectedAudioOutputId: string
}

export type ModerationAction =
  | "MUTE"
  | "REMOVE"
  | "PROMOTE_CO_HOST"
  | "DEMOTE_CO_HOST"
  | "LOCK"
  | "UNLOCK"
