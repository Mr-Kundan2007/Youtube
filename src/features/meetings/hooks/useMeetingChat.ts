"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Room, RoomEvent, RemoteParticipant } from "livekit-client"
import { meetingApi } from "../services/meetingApi"
import { videoService, DataChannelMessage } from "../services/videoService"
import { MeetingChatMessageItem } from "../types/meeting"

interface UseMeetingChatProps {
  roomId: string
  room: Room | null
  senderId?: string
  senderName?: string
  senderImage?: string
  allowChat?: boolean
  allowFileSharing?: boolean
}

export function useMeetingChat({
  roomId,
  room,
  senderId,
  senderName = "Participant",
  senderImage,
  allowChat = true,
  allowFileSharing = true,
}: UseMeetingChatProps) {
  const [messages, setMessages] = useState<MeetingChatMessageItem[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [unreadCount, setUnreadCount] = useState<number>(0)
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false)

  const isChatOpenRef = useRef<boolean>(isChatOpen)
  isChatOpenRef.current = isChatOpen

  // Fetch chat history on mount
  useEffect(() => {
    if (!roomId) return
    let isMounted = true

    const fetchHistory = async () => {
      try {
        setIsLoading(true)
        const history = await meetingApi.getChatHistory(roomId)
        if (isMounted) {
          setMessages(history)
        }
      } catch (err) {
        console.warn("[useMeetingChat] Failed to load chat history", err)
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    fetchHistory()

    return () => {
      isMounted = false
    }
  }, [roomId])

  // Real-time chat via Data Channel
  useEffect(() => {
    if (!room) return

    const handleData = (payload: Uint8Array, participant?: RemoteParticipant) => {
      const packet = videoService.decodeDataPayload<MeetingChatMessageItem>(payload)
      if (packet && packet.type === "CHAT" && packet.data) {
        const incomingMsg = packet.data

        setMessages((prev) => {
          // Deduplicate
          const exists = prev.some(
            (m) =>
              (m.id && m.id === incomingMsg.id) ||
              (m.messageId && m.messageId === incomingMsg.messageId) ||
              (m.timestamp === incomingMsg.timestamp && m.senderId === incomingMsg.senderId)
          )
          if (exists) return prev
          return [...prev, incomingMsg]
        })

        if (!isChatOpenRef.current) {
          setUnreadCount((c) => c + 1)
        }
      }
    }

    room.on(RoomEvent.DataReceived, handleData)
    return () => {
      room.off(RoomEvent.DataReceived, handleData)
    }
  }, [room])

  // Open chat resets unread count
  const toggleChat = useCallback((open?: boolean) => {
    setIsChatOpen((prev) => {
      const next = open !== undefined ? open : !prev
      if (next) {
        setUnreadCount(0)
      }
      return next
    })
  }, [])

  // Send text chat message
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || !allowChat) return

      try {
        // Persist to database
        const savedMessage = await meetingApi.sendChatMessage(
          roomId,
          text.trim(),
          senderId,
          senderName,
          senderImage
        )

        // Add to local state
        setMessages((prev) => [...prev, savedMessage])

        // Broadcast over LiveKit Data Channel for zero-latency peer sync
        const packet: DataChannelMessage<MeetingChatMessageItem> = {
          type: "CHAT",
          data: savedMessage,
          senderId: senderId || "anonymous",
          senderName,
          timestamp: Date.now(),
        }
        await videoService.publishData(packet, true)
      } catch (err) {
        console.error("[useMeetingChat] Failed to send chat message", err)
        throw err
      }
    },
    [roomId, senderId, senderName, senderImage, allowChat]
  )

  // Upload file attachment
  const uploadAttachment = useCallback(
    async (file: File, text?: string) => {
      if (!allowFileSharing) return

      try {
        setUploadProgress(0)
        const savedMessage = await meetingApi.uploadChatAttachment(
          roomId,
          file,
          text,
          senderId,
          senderName,
          senderImage,
          (percent) => {
            setUploadProgress(percent)
          }
        )

        setMessages((prev) => [...prev, savedMessage])

        // Broadcast attachment card to peers via Data Channel
        const packet: DataChannelMessage<MeetingChatMessageItem> = {
          type: "CHAT",
          data: savedMessage,
          senderId: senderId || "anonymous",
          senderName,
          timestamp: Date.now(),
        }
        await videoService.publishData(packet, true)
      } catch (err) {
        console.error("[useMeetingChat] Failed to upload attachment", err)
        throw err
      } finally {
        setUploadProgress(null)
      }
    },
    [roomId, senderId, senderName, senderImage, allowFileSharing]
  )

  return {
    messages,
    isLoading,
    uploadProgress,
    unreadCount,
    isChatOpen,
    toggleChat,
    sendMessage,
    uploadAttachment,
  }
}
