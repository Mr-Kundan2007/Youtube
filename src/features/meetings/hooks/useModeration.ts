"use client"

import { useState, useCallback } from "react"
import { Room } from "livekit-client"
import { meetingApi } from "../services/meetingApi"
import { videoService, DataChannelMessage } from "../services/videoService"
import { MeetingRole } from "../types/meeting"

interface UseModerationProps {
  roomId: string
  userRole: MeetingRole
  room: Room | null
  currentUserId?: string
  currentUserName?: string
  onMeetingEnded?: () => void
  onMeetingLockedChange?: (locked: boolean) => void
}

export function useModeration({
  roomId,
  userRole,
  room,
  currentUserId,
  currentUserName = "Host",
  onMeetingEnded,
  onMeetingLockedChange,
}: UseModerationProps) {
  const [isProcessing, setIsProcessing] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const isHost = userRole === "HOST"
  const isCoHost = userRole === "CO_HOST"
  const canModerate = isHost || isCoHost

  // Mute a participant remotely
  const muteParticipant = useCallback(
    async (targetUserId: string) => {
      if (!canModerate) return
      setIsProcessing(true)
      setError(null)

      try {
        await meetingApi.muteParticipant(roomId, targetUserId)

        // Broadcast mute request over Data Channel so target mutes their mic immediately
        const packet: DataChannelMessage<{ targetUserId: string }> = {
          type: "MUTE_REQUEST",
          data: { targetUserId },
          senderId: currentUserId || "host",
          senderName: currentUserName,
          timestamp: Date.now(),
        }
        await videoService.publishData(packet, true)
      } catch (err: any) {
        console.error("[useModeration] Failed to mute participant", err)
        setError(err?.response?.data?.message || err.message || "Failed to mute participant")
      } finally {
        setIsProcessing(false)
      }
    },
    [canModerate, roomId, currentUserId, currentUserName]
  )

  // Remove participant from meeting (and ban from rejoining)
  const removeParticipant = useCallback(
    async (targetUserId: string) => {
      if (!canModerate) return
      setIsProcessing(true)
      setError(null)

      try {
        await meetingApi.removeParticipant(roomId, targetUserId)

        // Broadcast remove notification over Data Channel
        const packet: DataChannelMessage<{ targetUserId: string }> = {
          type: "PARTICIPANT_REMOVED",
          data: { targetUserId },
          senderId: currentUserId || "host",
          senderName: currentUserName,
          timestamp: Date.now(),
        }
        await videoService.publishData(packet, true)
      } catch (err: any) {
        console.error("[useModeration] Failed to remove participant", err)
        setError(err?.response?.data?.message || err.message || "Failed to remove participant")
      } finally {
        setIsProcessing(false)
      }
    },
    [canModerate, roomId, currentUserId, currentUserName]
  )

  // Promote participant to Co-Host (Host only)
  const promoteCoHost = useCallback(
    async (targetUserId: string) => {
      if (!isHost) return
      setIsProcessing(true)
      setError(null)

      try {
        await meetingApi.promoteCoHost(roomId, targetUserId)
      } catch (err: any) {
        console.error("[useModeration] Failed to promote co-host", err)
        setError(err?.response?.data?.message || err.message || "Failed to promote co-host")
      } finally {
        setIsProcessing(false)
      }
    },
    [isHost, roomId]
  )

  // Demote Co-Host back to participant (Host only)
  const demoteCoHost = useCallback(
    async (targetUserId: string) => {
      if (!isHost) return
      setIsProcessing(true)
      setError(null)

      try {
        await meetingApi.demoteCoHost(roomId, targetUserId)
      } catch (err: any) {
        console.error("[useModeration] Failed to demote co-host", err)
        setError(err?.response?.data?.message || err.message || "Failed to demote co-host")
      } finally {
        setIsProcessing(false)
      }
    },
    [isHost, roomId]
  )

  // Toggle meeting lock
  const toggleMeetingLock = useCallback(
    async (shouldLock: boolean) => {
      if (!canModerate) return
      setIsProcessing(true)
      setError(null)

      try {
        if (shouldLock) {
          await meetingApi.lockMeeting(roomId)
        } else {
          await meetingApi.unlockMeeting(roomId)
        }

        onMeetingLockedChange?.(shouldLock)

        // Broadcast lock status
        const packet: DataChannelMessage<{ isLocked: boolean }> = {
          type: shouldLock ? "ROOM_LOCKED" : "ROOM_UNLOCKED",
          data: { isLocked: shouldLock },
          senderId: currentUserId || "host",
          senderName: currentUserName,
          timestamp: Date.now(),
        }
        await videoService.publishData(packet, true)
      } catch (err: any) {
        console.error("[useModeration] Failed to toggle lock", err)
        setError(err?.response?.data?.message || err.message || "Failed to toggle lock")
      } finally {
        setIsProcessing(false)
      }
    },
    [canModerate, roomId, onMeetingLockedChange, currentUserId, currentUserName]
  )

  // End meeting for everyone (Host only)
  const endMeetingForAll = useCallback(async () => {
    if (!isHost) return
    setIsProcessing(true)
    setError(null)

    try {
      await meetingApi.endMeeting(roomId)
      onMeetingEnded?.()
    } catch (err: any) {
      console.error("[useModeration] Failed to end meeting", err)
      setError(err?.response?.data?.message || err.message || "Failed to end meeting")
    } finally {
      setIsProcessing(false)
    }
  }, [isHost, roomId, onMeetingEnded])

  return {
    isHost,
    isCoHost,
    canModerate,
    isProcessing,
    error,
    muteParticipant,
    removeParticipant,
    promoteCoHost,
    demoteCoHost,
    toggleMeetingLock,
    endMeetingForAll,
  }
}
