import API from "@/lib/axiosinstance"
import {
  JoinMeetingPayload,
  MeetingChatMessageItem,
  MeetingCreatePayload,
  MeetingDetails,
  MeetingJoinResponse,
  MeetingParticipantInfo,
  MeetingRecordingInfo,
} from "../types/meeting"

const getMeetingAuthHeaders = (): Record<string, string> => {
  let token = typeof window !== "undefined" ? localStorage.getItem("token") : null
  if (!token && typeof window !== "undefined") {
    const profile = localStorage.getItem("Profile")
    if (profile) {
      try {
        const parsed = JSON.parse(profile)
        token = parsed?.token
      } catch {}
    }
  }
  // Provide guest/instant meeting demo token if unauthenticated
  if (!token && typeof window !== "undefined") {
    token = "demo-token"
    try {
      localStorage.setItem("token", "demo-token")
    } catch {}
  }
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export const meetingApi = {
  /**
   * Creates a new meeting room.
   */
  async createMeeting(payload: MeetingCreatePayload = {}): Promise<MeetingJoinResponse> {
    const headers = getMeetingAuthHeaders()
    const { data } = await API.post("/api/meetings", payload, { headers })
    return data.data
  },

  /**
   * Fetches meeting information and status.
   */
  async getMeeting(roomId: string): Promise<MeetingDetails> {
    const headers = getMeetingAuthHeaders()
    const { data } = await API.get(`/api/meetings/${roomId}`, { headers })
    return data.data.meeting || data.data
  },

  /**
   * Securely joins a meeting room and obtains a temporary LiveKit access token.
   */
  async joinMeeting(
    roomId: string,
    payload: JoinMeetingPayload = {}
  ): Promise<MeetingJoinResponse> {
    const headers = getMeetingAuthHeaders()
    const { data } = await API.post(`/api/meetings/${roomId}/join`, payload, { headers })
    return data.data
  },

  /**
   * Obtains a short-lived LiveKit access token to join the room.
   */
  async getMeetingToken(
    roomId: string,
    displayName?: string,
    guestId?: string
  ): Promise<MeetingJoinResponse> {
    const { data } = await API.post(`/api/meetings/${roomId}/join`, {
      displayName,
      guestId,
    })
    return data.data
  },

  /**
   * Notifies backend that a participant is leaving the room.
   */
  async leaveMeeting(roomId: string, participantId?: string): Promise<void> {
    await API.post(`/api/meetings/${roomId}/leave`, { participantId })
  },

  /**
   * Host ends meeting for all participants.
   */
  async endMeeting(roomId: string): Promise<void> {
    await API.post(`/api/meetings/${roomId}/end`)
  },

  /**
   * Lists currently active participants.
   */
  async getParticipants(roomId: string): Promise<MeetingParticipantInfo[]> {
    const { data } = await API.get(`/api/meetings/${roomId}/participants`)
    return data.data.participants
  },

  /**
   * Host/Co-host mutes a participant.
   */
  async muteParticipant(roomId: string, targetUserId: string): Promise<void> {
    await API.post(`/api/meetings/${roomId}/mute-participant`, { targetUserId })
  },

  /**
   * Host/Co-host removes a participant and bans them from the meeting.
   */
  async removeParticipant(roomId: string, targetUserId: string): Promise<void> {
    await API.post(`/api/meetings/${roomId}/remove-participant`, { targetUserId })
  },

  /**
   * Host promotes a participant to Co-Host.
   */
  async promoteCoHost(roomId: string, targetUserId: string): Promise<void> {
    await API.post(`/api/meetings/${roomId}/promote-cohost`, { targetUserId })
  },

  /**
   * Host demotes a Co-Host back to Participant.
   */
  async demoteCoHost(roomId: string, targetUserId: string): Promise<void> {
    await API.post(`/api/meetings/${roomId}/demote-cohost`, { targetUserId })
  },

  /**
   * Host/Co-host locks the meeting room.
   */
  async lockMeeting(roomId: string): Promise<{ isLocked: boolean }> {
    const { data } = await API.post(`/api/meetings/${roomId}/lock`)
    return data.data
  },

  /**
   * Host/Co-host unlocks the meeting room.
   */
  async unlockMeeting(roomId: string): Promise<{ isLocked: boolean }> {
    const { data } = await API.post(`/api/meetings/${roomId}/unlock`)
    return data.data
  },

  /**
   * Fetches recent chat history.
   */
  async getChatHistory(
    roomId: string,
    limit: number = 50,
    before?: string
  ): Promise<MeetingChatMessageItem[]> {
    const params: Record<string, string | number> = { limit }
    if (before) params.before = before
    const { data } = await API.get(`/api/meetings/${roomId}/chat`, { params })
    return data.data.messages || []
  },

  /**
   * Sends a text chat message.
   */
  async sendChatMessage(
    roomId: string,
    text: string,
    senderId?: string,
    senderName?: string,
    senderImage?: string
  ): Promise<MeetingChatMessageItem> {
    const { data } = await API.post(`/api/meetings/${roomId}/chat`, {
      text,
      senderId,
      senderName,
      senderImage,
    })
    return data.data.message
  },

  /**
   * Uploads a file attachment to the meeting chat.
   */
  async uploadChatAttachment(
    roomId: string,
    file: File,
    text?: string,
    senderId?: string,
    senderName?: string,
    senderImage?: string,
    onProgress?: (progressPercent: number) => void
  ): Promise<MeetingChatMessageItem> {
    const formData = new FormData()
    formData.append("file", file)
    if (text) formData.append("text", text)
    if (senderId) formData.append("senderId", senderId)
    if (senderName) formData.append("senderName", senderName)
    if (senderImage) formData.append("senderImage", senderImage)

    const { data } = await API.post(`/api/meetings/${roomId}/chat/attachment`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          onProgress(percent)
        }
      },
    })
    return data.data.message
  },

  /**
   * Returns download URL for an attachment.
   */
  getAttachmentDownloadUrl(roomId: string, messageId: string): string {
    const baseURL = API.defaults.baseURL || ""
    return `${baseURL}/api/meetings/${roomId}/chat/attachment/${messageId}`
  },

  /**
   * Toggles hand raise status for a participant.
   */
  async toggleHandRaise(
    roomId: string,
    identity?: string
  ): Promise<{ isHandRaised: boolean; handRaisedAt?: string; userId: string }> {
    const { data } = await API.post(`/api/meetings/${roomId}/hand-raise`, { identity })
    return data.data
  },

  /**
   * Host or co-host starts recording the meeting.
   */
  async startRecording(roomId: string): Promise<{
    recording: {
      activeRecordingId: string
      startedAt: string
      startedBy: string
      status: string
    }
  }> {
    const headers = getMeetingAuthHeaders()
    const { data } = await API.post(`/api/meetings/${roomId}/recordings/start`, {}, { headers })
    return data.data
  },

  /**
   * Host or co-host stops the active meeting recording.
   */
  async stopRecording(roomId: string): Promise<{
    message: string
    recordingId: string
    startedAt: string
    endedAt: string
    durationSeconds: number
  }> {
    const headers = getMeetingAuthHeaders()
    const { data } = await API.post(`/api/meetings/${roomId}/recordings/stop`, {}, { headers })
    return data.data
  },

  /**
   * Uploads the recorded video blob to private storage.
   */
  async uploadRecording(
    roomId: string,
    file: Blob,
    duration: number,
    title?: string,
    recordingId?: string,
    onProgress?: (progressPercent: number) => void
  ): Promise<MeetingRecordingInfo> {
    const recordingFile =
      typeof File !== "undefined" && file instanceof File
        ? file
        : new File([file], `meeting-${roomId}-${Date.now()}.webm`, {
            type: file.type || "video/webm",
          })

    const formData = new FormData()
    formData.append("recording", recordingFile)
    formData.append("duration", String(duration))
    if (title) formData.append("title", title)
    if (recordingId) formData.append("recordingId", recordingId)

    const headers = {
      ...getMeetingAuthHeaders(),
    }

    const { data } = await API.post(`/api/meetings/${roomId}/recordings/upload`, formData, {
      headers,
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          onProgress(percent)
        }
      },
    })
    return data.data.recording
  },

  /**
   * Fetches the list of recordings for a meeting room.
   */
  async getMeetingRecordings(roomId: string): Promise<MeetingRecordingInfo[]> {
    const { data } = await API.get(`/api/meetings/${roomId}/recordings`)
    return data.data.recordings || []
  },

  /**
   * Obtains a signed access token for streaming or downloading a recording.
   */
  async getRecordingAccess(
    recordingId: string,
    action: "stream" | "download" = "stream"
  ): Promise<{
    token: string
    expiresAt: string
    action: string
    streamUrl: string
    downloadUrl: string
  }> {
    const { data } = await API.get(`/api/recordings/${recordingId}/access`, {
      params: { action },
    })
    const access = data.data
    const serverBaseUrl =
      process.env.NEXT_PUBLIC_SERVER_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      API.defaults.baseURL ||
      "http://localhost:5001"

    if (access.streamUrl && !access.streamUrl.startsWith("http")) {
      access.streamUrl = `${serverBaseUrl}${access.streamUrl.startsWith("/") ? "" : "/"}${access.streamUrl}`
    }
    if (access.downloadUrl && !access.downloadUrl.startsWith("http")) {
      access.downloadUrl = `${serverBaseUrl}${access.downloadUrl.startsWith("/") ? "" : "/"}${access.downloadUrl}`
    }
    return access
  },

  /**
   * Deletes a recording (Host or recording owner only).
   */
  async deleteRecording(recordingId: string): Promise<void> {
    await API.delete(`/api/recordings/${recordingId}`)
  },

  /**
   * Host toggles End-to-End Encryption (E2EE) mode.
   */
  async toggleE2EE(
    roomId: string,
    enabled: boolean
  ): Promise<{ securityMode: "STANDARD" | "E2EE"; isE2EE: boolean; e2eeKeyVersion: number }> {
    const { data } = await API.post(`/api/meetings/${roomId}/e2ee/toggle`, { enabled })
    return data.data
  },

  /**
   * Host requests server to increment E2EE key version after a key ratchet/rotation.
   */
  async rotateE2EEKey(
    roomId: string
  ): Promise<{ securityMode: "STANDARD" | "E2EE"; isE2EE: boolean; e2eeKeyVersion: number }> {
    const { data } = await API.post(`/api/meetings/${roomId}/e2ee/rotate-key`)
    return data.data
  },

  /**
   * Gets current E2EE status and key version for the meeting.
   */
  async getE2EEStatus(
    roomId: string
  ): Promise<{ securityMode: "STANDARD" | "E2EE"; isE2EE: boolean; e2eeKeyVersion: number }> {
    const { data } = await API.get(`/api/meetings/${roomId}/e2ee/status`)
    return data.data
  },
}

