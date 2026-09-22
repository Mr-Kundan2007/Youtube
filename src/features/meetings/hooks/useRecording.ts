"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Room } from "livekit-client"
import {
  MeetingRole,
  MeetingRecordingInfo,
  RecordingStatus,
} from "../types/meeting"
import { meetingApi } from "../services/meetingApi"
import { recordingManager } from "../services/recordingManager"
import { videoService, DataChannelMessage } from "../services/videoService"

interface UseRecordingProps {
  roomId: string
  room: Room | null
  userRole: MeetingRole
  currentUserId: string
  currentUserName: string
  allowRecording?: boolean
  initialRecording?: {
    isRecording: boolean
    activeRecordingId?: string
    startedAt?: string
  }
}

export interface RecordingNotification {
  message: string
  type: "started" | "stopped"
  actorName: string
  timestamp: number
}

export function useRecording({
  roomId,
  room,
  userRole,
  currentUserId,
  currentUserName,
  allowRecording = true,
  initialRecording,
}: UseRecordingProps) {
  const [status, setStatus] = useState<RecordingStatus>("idle")
  const [isRecording, setIsRecording] = useState<boolean>(
    Boolean(initialRecording?.isRecording)
  )
  const [activeRecordingId, setActiveRecordingId] = useState<string | null>(
    initialRecording?.activeRecordingId || null
  )
  const [durationSeconds, setDurationSeconds] = useState<number>(0)
  const [uploadProgress, setUploadProgress] = useState<number>(0)
  const [recordings, setRecordings] = useState<MeetingRecordingInfo[]>([])
  const [isRecordingsLoading, setIsRecordingsLoading] = useState<boolean>(false)
  const [notification, setNotification] = useState<RecordingNotification | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const notificationTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const remoteTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Host always has permission to record. Co-host can record if allowRecording is not disabled.
  const isHost =
    userRole === "HOST" ||
    (typeof window !== "undefined" &&
      Boolean(
        sessionStorage.getItem(`instant_host_${roomId}`) ||
        localStorage.getItem(`instant_host_${roomId}`)
      ))
  const isCoHost = userRole === "CO_HOST"
  const canRecord = isHost || (isCoHost && allowRecording !== false)

  // Helper to show temporary notification banner
  const triggerNotification = useCallback(
    (notif: RecordingNotification) => {
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current)
      }
      setNotification(notif)
      notificationTimeoutRef.current = setTimeout(() => {
        setNotification(null)
      }, 5000)
    },
    []
  )

  // Fetch recordings list
  const fetchRecordings = useCallback(async () => {
    if (!roomId) return
    setIsRecordingsLoading(true)
    try {
      const list = await meetingApi.getMeetingRecordings(roomId)
      setRecordings(list)
    } catch (err: any) {
      console.warn("Failed to fetch meeting recordings", err)
    } finally {
      setIsRecordingsLoading(false)
    }
  }, [roomId])

  // Listen to DataChannel messages for real-time recording sync across all participants
  useEffect(() => {
    const handleDataChannel = (event: CustomEvent<DataChannelMessage>) => {
      const msg = event.detail
      if (!msg) return

      if (msg.type === "RECORDING_STARTED") {
        setIsRecording(true)
        triggerNotification({
          message: `${msg.senderName || "Host"} started recording this meeting.`,
          type: "started",
          actorName: msg.senderName || "Host",
          timestamp: msg.timestamp || Date.now(),
        })

        // If not the recorder, run passive timer based on started timestamp
        if (!recordingManager.getIsRecording()) {
          const startTime = msg.data?.startedAt ? new Date(msg.data.startedAt).getTime() : Date.now()
          const initialElapsed = Math.max(0, Math.floor((Date.now() - startTime) / 1000))
          setDurationSeconds(initialElapsed)

          if (remoteTimerRef.current) clearInterval(remoteTimerRef.current)
          remoteTimerRef.current = setInterval(() => {
            setDurationSeconds((prev) => prev + 1)
          }, 1000)
        }
      } else if (msg.type === "RECORDING_STOPPED") {
        setIsRecording(false)
        if (remoteTimerRef.current) {
          clearInterval(remoteTimerRef.current)
          remoteTimerRef.current = null
        }
        triggerNotification({
          message: `Meeting recording has ended.`,
          type: "stopped",
          actorName: msg.senderName || "Host",
          timestamp: msg.timestamp || Date.now(),
        })
        fetchRecordings()
      }
    }

    window.addEventListener("livekit-datachannel" as any, handleDataChannel as any)
    return () => {
      window.removeEventListener("livekit-datachannel" as any, handleDataChannel as any)
      if (remoteTimerRef.current) clearInterval(remoteTimerRef.current)
    }
  }, [triggerNotification, fetchRecordings])

  // Start Meeting Recording
  const startRecording = useCallback(async () => {
    if (!canRecord) {
      setErrorMessage("You do not have permission to record this meeting.")
      return
    }

    if (!room) {
      setErrorMessage("Live meeting room connection is not ready.")
      return
    }

    setStatus("starting")
    setErrorMessage(null)

    try {
      // 1. Backend start handshake & audit log
      const startRes = await meetingApi.startRecording(roomId)
      const recId = startRes.recording?.activeRecordingId
      setActiveRecordingId(recId)

      // 2. Start client-side recorder (Web Audio mixer + Canvas compositor)
      await recordingManager.start({
        room,
        onDurationTick: (secs) => {
          setDurationSeconds(secs)
        },
        onError: (err) => {
          console.error("Recording error:", err)
          setErrorMessage("Recording encountered an issue.")
          setStatus("failed")
        },
      })

      // 3. Broadcast to all participants via WebRTC Data Channel
      const packet: DataChannelMessage = {
        type: "RECORDING_STARTED",
        data: {
          recordingId: recId,
          startedAt: startRes.recording?.startedAt || new Date().toISOString(),
        },
        senderId: currentUserId,
        senderName: currentUserName,
        timestamp: Date.now(),
      }
      await videoService.publishData(packet, true)

      setIsRecording(true)
      setStatus("recording")

      triggerNotification({
        message: "Recording started. All participants have been notified.",
        type: "started",
        actorName: currentUserName,
        timestamp: Date.now(),
      })
    } catch (err: any) {
      console.error("Failed to start recording:", err)
      setErrorMessage(err.response?.data?.message || err.message || "Failed to start recording")
      setStatus("idle")
    }
  }, [canRecord, room, roomId, currentUserId, currentUserName, triggerNotification])

  // Stop and Upload Meeting Recording
  const stopRecording = useCallback(async () => {
    if (!recordingManager.getIsRecording()) {
      setIsRecording(false)
      setStatus("idle")
      return
    }

    setStatus("stopping")
    setErrorMessage(null)

    try {
      // 1. Stop client-side MediaRecorder and get video Blob
      const result = await recordingManager.stop()

      // 2. Backend stop handshake
      await meetingApi.stopRecording(roomId)

      // 3. Broadcast stop event over Data Channel
      const packet: DataChannelMessage = {
        type: "RECORDING_STOPPED",
        data: {
          recordingId: activeRecordingId,
          duration: result.durationSeconds,
        },
        senderId: currentUserId,
        senderName: currentUserName,
        timestamp: Date.now(),
      }
      await videoService.publishData(packet, true)

      setIsRecording(false)
      setStatus("uploading")
      setUploadProgress(0)

      // 4. Secure upload to private storage
      await meetingApi.uploadRecording(
        roomId,
        result.blob,
        result.durationSeconds,
        `Meeting Recording - ${new Date().toLocaleDateString()}`,
        activeRecordingId || undefined,
        (progress) => {
          setUploadProgress(progress)
        }
      )

      setStatus("idle")
      setUploadProgress(0)
      setActiveRecordingId(null)
      setDurationSeconds(0)

      triggerNotification({
        message: "Recording successfully saved to private storage.",
        type: "stopped",
        actorName: currentUserName,
        timestamp: Date.now(),
      })

      fetchRecordings()
    } catch (err: any) {
      console.error("Failed to stop and upload recording:", err)
      setErrorMessage(
        err.response?.data?.message || err.message || "Failed to save recording to storage"
      )
      setStatus("failed")
    }
  }, [roomId, activeRecordingId, currentUserId, currentUserName, triggerNotification, fetchRecordings])

  // Delete Recording
  const deleteRecording = useCallback(
    async (recId: string) => {
      try {
        await meetingApi.deleteRecording(recId)
        setRecordings((prev) => prev.filter((r) => (r._id || r.id || r.recordingId) !== recId))
      } catch (err: any) {
        console.error("Failed to delete recording:", err)
        throw err
      }
    },
    []
  )

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (recordingManager.getIsRecording()) {
        recordingManager.cleanup()
      }
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current)
      }
      if (remoteTimerRef.current) {
        clearInterval(remoteTimerRef.current)
      }
    }
  }, [])

  return {
    status,
    isRecording,
    canRecord,
    durationSeconds,
    uploadProgress,
    recordings,
    isRecordingsLoading,
    notification,
    errorMessage,
    startRecording,
    stopRecording,
    fetchRecordings,
    deleteRecording,
    clearError: () => setErrorMessage(null),
  }
}
