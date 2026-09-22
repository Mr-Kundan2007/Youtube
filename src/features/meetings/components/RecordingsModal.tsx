"use client"

import React, { useState, useEffect } from "react"
import {
  X,
  Play,
  Download,
  Trash2,
  Clock,
  HardDrive,
  User,
  Film,
  Loader2,
  AlertCircle,
  ExternalLink,
} from "lucide-react"
import { MeetingRecordingInfo, MeetingRole } from "../types/meeting"
import { meetingApi } from "../services/meetingApi"

interface RecordingsModalProps {
  isOpen: boolean
  roomId: string
  userRole: MeetingRole
  currentUserId: string
  recordings: MeetingRecordingInfo[]
  isLoading: boolean
  uploadProgress?: number
  onClose: () => void
  onDeleteRecording: (recordingId: string) => Promise<void>
}

export const RecordingsModal: React.FC<RecordingsModalProps> = ({
  isOpen,
  roomId,
  userRole,
  currentUserId,
  recordings,
  isLoading,
  uploadProgress = 0,
  onClose,
  onDeleteRecording,
}) => {
  const [selectedRecording, setSelectedRecording] = useState<MeetingRecordingInfo | null>(null)
  const [streamUrl, setStreamUrl] = useState<string | null>(null)
  const [isGettingAccess, setIsGettingAccess] = useState<boolean>(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) {
      setSelectedRecording(null)
      setStreamUrl(null)
      setErrorMessage(null)
    }
  }, [isOpen])

  if (!isOpen) return null

  const formatDuration = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}m ${seconds.toString().padStart(2, "0")}s`
  }

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return "0 MB"
    const mb = bytes / (1024 * 1024)
    return `${mb.toFixed(1)} MB`
  }

  const handlePlayRecording = async (recording: MeetingRecordingInfo) => {
    const recId = recording.recordingId || recording._id || recording.id
    if (!recId) return

    setIsGettingAccess(true)
    setErrorMessage(null)
    setSelectedRecording(recording)

    try {
      const access = await meetingApi.getRecordingAccess(recId, "stream")
      setStreamUrl(access.streamUrl)
    } catch (err: any) {
      console.error("Failed to load recording stream", err)
      setErrorMessage(err.response?.data?.message || "Failed to load recording stream")
    } finally {
      setIsGettingAccess(false)
    }
  }

  const handleDownloadRecording = async (recording: MeetingRecordingInfo) => {
    const recId = recording.recordingId || recording._id || recording.id
    if (!recId) return

    try {
      const access = await meetingApi.getRecordingAccess(recId, "download")
      const anchor = document.createElement("a")
      anchor.href = access.downloadUrl
      anchor.download = recording.filename || `meeting-recording-${recId}.webm`
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
    } catch (err: any) {
      console.error("Failed to download recording", err)
      setErrorMessage(err.response?.data?.message || "Failed to generate download link")
    }
  }

  const handleDelete = async (recording: MeetingRecordingInfo) => {
    const recId = recording.recordingId || recording._id || recording.id
    if (!recId) return

    if (!confirm("Are you sure you want to permanently delete this recording?")) {
      return
    }

    setDeletingId(recId)
    try {
      await onDeleteRecording(recId)
      if (selectedRecording && (selectedRecording.recordingId === recId || selectedRecording._id === recId)) {
        setSelectedRecording(null)
        setStreamUrl(null)
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || "Failed to delete recording")
    } finally {
      setDeletingId(null)
    }
  }

  const canDelete = (rec: MeetingRecordingInfo) => {
    if (userRole === "HOST") return true
    const creatorId = typeof rec.createdBy === "object" ? rec.createdBy._id || rec.createdBy.id : rec.createdBy
    return creatorId === currentUserId
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl flex flex-col max-h-[88vh] overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-600/10 border border-red-500/20 flex items-center justify-center text-red-500">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Meeting Recordings</h2>
              <p className="text-xs text-zinc-400">
                Securely encrypted audio/video recordings for this session
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Upload Progress Banner */}
        {uploadProgress > 0 && (
          <div className="px-6 py-3 bg-red-950/40 border-b border-red-500/20 flex flex-col gap-1.5 shrink-0">
            <div className="flex items-center justify-between text-xs font-semibold text-red-300">
              <span className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Encrypting & saving recording to private storage...
              </span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-red-600 transition-all duration-300 rounded-full"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Error Banner */}
        {errorMessage && (
          <div className="px-6 py-2.5 bg-red-900/30 border-b border-red-500/30 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Active Player Preview */}
          {selectedRecording && (
            <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                  Playback Preview (HTTP 206 Seeking Enabled)
                </span>
                <button
                  onClick={() => {
                    setSelectedRecording(null)
                    setStreamUrl(null)
                  }}
                  className="text-xs text-zinc-400 hover:text-white"
                >
                  Close Player
                </button>
              </div>

              {isGettingAccess ? (
                <div className="w-full aspect-video bg-zinc-900 rounded-xl flex items-center justify-center text-zinc-400 gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-xs">Authenticating stream...</span>
                </div>
              ) : streamUrl ? (
                <video
                  key={streamUrl}
                  src={streamUrl}
                  controls
                  playsInline
                  autoPlay
                  preload="auto"
                  className="w-full aspect-video bg-black rounded-xl border border-zinc-800 shadow-inner"
                  onError={(e) => {
                    console.error("Video player error:", e)
                    setErrorMessage("Playback failed to start. Click play or download the recording.")
                  }}
                />
              ) : null}
            </div>
          )}

          {/* Recordings List */}
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-zinc-400 gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-red-500" />
              <span className="text-xs">Loading recordings...</span>
            </div>
          ) : recordings.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center px-4">
              <div className="w-12 h-12 rounded-2xl bg-zinc-800/80 flex items-center justify-center text-zinc-400 mb-3">
                <Film className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-zinc-200">No recordings yet</h3>
              <p className="text-xs text-zinc-400 mt-1 max-w-sm">
                Meeting hosts or co-hosts can start recording at any time using the Record button in the bottom controls dock.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recordings.map((rec) => {
                const recId = rec.recordingId || rec._id || rec.id || ""
                const isSelected = selectedRecording && (selectedRecording.recordingId === recId || selectedRecording._id === recId)
                const isDeleting = deletingId === recId

                return (
                  <div
                    key={recId}
                    className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      isSelected
                        ? "bg-zinc-800/60 border-red-500/40 shadow-lg"
                        : "bg-zinc-950/60 border-zinc-800 hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-red-600/10 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0 mt-0.5">
                        <Film className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <h4 className="text-sm font-semibold text-white">
                          {rec.title || `Call Recording - ${new Date(rec.startedAt || rec.createdAt || Date.now()).toLocaleTimeString()}`}
                        </h4>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-zinc-400" />
                            {formatDuration(rec.duration || 0)}
                          </span>
                          <span className="flex items-center gap-1">
                            <HardDrive className="w-3.5 h-3.5 text-zinc-400" />
                            {formatFileSize(rec.fileSize || 0)}
                          </span>
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-zinc-400" />
                            {rec.creatorName || "Host"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        onClick={() => handlePlayRecording(rec)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 transition-colors"
                        title="Stream recording"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Play</span>
                      </button>

                      <button
                        onClick={() => handleDownloadRecording(rec)}
                        className="p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                        title="Download recording securely"
                      >
                        <Download className="w-4 h-4" />
                      </button>

                      {canDelete(rec) && (
                        <button
                          onClick={() => handleDelete(rec)}
                          disabled={isDeleting}
                          className="p-1.5 rounded-xl hover:bg-red-950/40 text-zinc-400 hover:text-red-400 transition-colors disabled:opacity-50"
                          title="Delete recording"
                        >
                          {isDeleting ? (
                            <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400 bg-zinc-950/40">
          <span>
            Storage: <span className="font-semibold text-zinc-300">Zero public access</span> · Range Seeking Enabled
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
