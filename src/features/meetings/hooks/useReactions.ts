"use client"

import { useState, useEffect, useCallback } from "react"
import { Room, RoomEvent, RemoteParticipant } from "livekit-client"
import { videoService, DataChannelMessage } from "../services/videoService"
import { FloatingReaction } from "../types/meeting"

interface UseReactionsProps {
  room: Room | null
  senderId?: string
  senderName?: string
}

export function useReactions({ room, senderId, senderName = "You" }: UseReactionsProps) {
  const [reactions, setReactions] = useState<FloatingReaction[]>([])

  const addReaction = useCallback((emoji: string, sId: string, sName: string) => {
    const newReaction: FloatingReaction = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      emoji,
      senderId: sId,
      senderName: sName,
      x: Math.floor(Math.random() * 70) + 15, // between 15% and 85% width
      timestamp: Date.now(),
    }

    setReactions((prev) => [...prev, newReaction])

    // Auto-remove reaction after 3.5 seconds
    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== newReaction.id))
    }, 3500)
  }, [])

  // Listen to remote reactions over LiveKit Data Channel
  useEffect(() => {
    if (!room) return

    const handleData = (payload: Uint8Array, participant?: RemoteParticipant) => {
      const packet = videoService.decodeDataPayload<{ emoji: string }>(payload)
      if (packet && packet.type === "REACTION" && packet.data?.emoji) {
        addReaction(packet.data.emoji, packet.senderId, packet.senderName)
      }
    }

    room.on(RoomEvent.DataReceived, handleData)
    return () => {
      room.off(RoomEvent.DataReceived, handleData)
    }
  }, [room, addReaction])

  // Send local reaction and broadcast to peers
  const sendReaction = useCallback(
    async (emoji: string) => {
      const sId = senderId || "local"
      const sName = senderName || "You"

      addReaction(emoji, sId, sName)

      // Broadcast over Data Channel
      const packet: DataChannelMessage<{ emoji: string }> = {
        type: "REACTION",
        data: { emoji },
        senderId: sId,
        senderName: sName,
        timestamp: Date.now(),
      }

      await videoService.publishData(packet, false) // un-reliable is faster for animations
    },
    [senderId, senderName, addReaction]
  )

  return {
    reactions,
    sendReaction,
  }
}
