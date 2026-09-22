import React, { useState } from "react"
import { Shield, Users, Lock, Copy, Check, ArrowLeft, LogIn } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MeetingDetails } from "../types/meeting"
import { useDevicePreview } from "../hooks/useDevicePreview"
import DevicePreview from "./DevicePreview"
import { DeviceSettingsModal } from "./DeviceSettingsModal"

interface MeetingLobbyProps {
  meeting: MeetingDetails
  initialName?: string
  isAuthenticated: boolean
  isHost: boolean
  isJoining: boolean
  onJoin: (params: {
    displayName: string
    isMuted: boolean
    cameraEnabled: boolean
  }) => void
  onLeave: () => void
}

export const MeetingLobby: React.FC<MeetingLobbyProps> = ({
  meeting,
  initialName = "",
  isAuthenticated,
  isHost,
  isJoining,
  onJoin,
  onLeave,
}) => {
  const [displayName, setDisplayName] = useState(initialName)
  const [nameError, setNameError] = useState<string | null>(null)
  const [isCopied, setIsCopied] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  const {
    stream,
    isCameraEnabled,
    isMicEnabled,
    isPreparing,
    error: deviceError,
    hasPermissions,
    audioLevel,
    toggleCamera,
    toggleMic,
    retryPermissions,
  } = useDevicePreview(true, true)

  const handleCopyLink = async () => {
    const link =
      meeting.meetingLink ||
      `${typeof window !== "undefined" ? window.location.origin : ""}/meet/${meeting.roomId}`
    try {
      await navigator.clipboard.writeText(link)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch (e) {
      console.warn("Failed to copy link:", e)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = displayName.trim()
    if (!trimmed) {
      setNameError("Please enter your name to join.")
      return
    }
    setNameError(null)
    onJoin({
      displayName: trimmed,
      isMuted: !isMicEnabled,
      cameraEnabled: isCameraEnabled,
    })
  }

  const hostDisplayName =
    meeting.host?.displayName || meeting.hostName || "Host"
  const participantCount =
    meeting.currentParticipantCount ?? meeting.participantCount ?? 0
  const maxParticipants = meeting.maxParticipants ?? 25

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-neutral-950">
      <div className="w-full max-w-4xl bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl grid grid-cols-1 lg:grid-cols-12">
        {/* Left Side: Device Preview (Camera / Mic) */}
        <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-neutral-800/80 bg-neutral-900/40">
          <div>
            {/* Top Meeting Metadata Badges */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Shield className="w-3.5 h-3.5" />
                  Room: {meeting.roomId}
                </span>

                {meeting.isLocked && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                    <Lock className="w-3 h-3" />
                    Locked
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-xs text-neutral-400 font-mono">
                <Users className="w-3.5 h-3.5 text-neutral-500" />
                <span>
                  {participantCount} / {maxParticipants} in room
                </span>
              </div>
            </div>

            {/* Real-time Camera & Mic Preview */}
            <DevicePreview
              stream={stream}
              isCameraEnabled={isCameraEnabled}
              isMicEnabled={isMicEnabled}
              isPreparing={isPreparing}
              hasPermissions={hasPermissions}
              audioLevel={audioLevel}
              error={deviceError}
              displayName={displayName || "Guest"}
              onToggleCamera={toggleCamera}
              onToggleMic={toggleMic}
              onRetryPermissions={retryPermissions}
              onOpenSettings={() => setIsSettingsOpen(true)}
            />
          </div>

          {/* Quick Helper Tips */}
          <div className="mt-4 pt-3 border-t border-neutral-800/60 flex items-center justify-between text-[11px] text-neutral-500">
            <span>Choose your audio and video settings before joining</span>
            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1 text-neutral-400 hover:text-white transition-colors"
            >
              {isCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Link Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Meeting Link</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Side: Meeting Information & Join Form */}
        <div className="lg:col-span-5 p-6 sm:p-8 flex flex-col justify-between bg-neutral-900">
          <div>
            <div className="mb-6">
              <span className="text-xs uppercase tracking-wider font-semibold text-neutral-400">
                Ready to Join?
              </span>
              <h1 className="text-2xl font-bold text-neutral-100 mt-1 mb-2 leading-tight">
                {meeting.title || "Video Meeting"}
              </h1>
              <p className="text-xs text-neutral-400 flex items-center gap-1.5">
                <span>Hosted by</span>
                <span className="font-semibold text-neutral-200">
                  {hostDisplayName}
                </span>
                {isHost && (
                  <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                    YOU
                  </span>
                )}
              </p>
            </div>

            {/* Access Policy Note */}
            {meeting.accessPolicy === "AUTHENTICATED_ONLY" && (
              <div className="mb-5 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs flex items-center gap-2">
                <LogIn className="w-4 h-4 flex-shrink-0" />
                <span>
                  This meeting requires sign-in. You are joining as{" "}
                  <strong>{displayName}</strong>.
                </span>
              </div>
            )}

            {/* Join Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="lobby-display-name" className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  Your Display Name
                </label>
                <input
                  id="lobby-display-name"
                  type="text"
                  value={displayName}
                  onChange={(e) => {
                    setDisplayName(e.target.value)
                    if (nameError) setNameError(null)
                  }}
                  placeholder="Enter your name"
                  maxLength={50}
                  aria-invalid={!!nameError}
                  aria-describedby={nameError ? "lobby-name-error" : undefined}
                  className="w-full min-h-[44px] px-3.5 py-2.5 text-sm bg-neutral-950 border border-neutral-800 text-neutral-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-neutral-600"
                />
                {nameError && (
                  <p id="lobby-name-error" role="alert" className="text-red-400 text-xs mt-1.5">{nameError}</p>
                )}
              </div>

              {/* Status indicator badges */}
              <div className="p-3 bg-neutral-950/60 rounded-xl border border-neutral-800/80 text-xs text-neutral-400 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span>Microphone on entry:</span>
                  <span
                    className={
                      isMicEnabled ? "text-emerald-400 font-medium" : "text-neutral-500"
                    }
                  >
                    {isMicEnabled ? "Active" : "Muted"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Camera on entry:</span>
                  <span
                    className={
                      isCameraEnabled
                        ? "text-emerald-400 font-medium"
                        : "text-neutral-500"
                    }
                  >
                    {isCameraEnabled ? "Enabled" : "Turned Off"}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col gap-2.5">
                <Button
                  type="submit"
                  disabled={isJoining}
                  aria-label={isJoining ? "Connecting to Room" : "Join Meeting"}
                  className="w-full min-h-[44px] bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 text-sm rounded-xl transition-all shadow-lg shadow-blue-600/20 touch-target-44"
                >
                  {isJoining ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Connecting to Room...
                    </span>
                  ) : (
                    "Join Meeting"
                  )}
                </Button>

                <Button
                  type="button"
                  onClick={onLeave}
                  variant="outline"
                  aria-label="Leave Lobby"
                  className="w-full min-h-[44px] border-neutral-800 hover:bg-neutral-800/80 text-neutral-400 hover:text-neutral-200 text-xs py-2 rounded-xl transition-colors touch-target-44"
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                  Leave Lobby
                </Button>
              </div>
            </form>
          </div>

          <div className="mt-6 text-center">
            <p className="text-[11px] text-neutral-600">
              Meeting ID: <span className="font-mono text-neutral-400">{meeting.roomId}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Reusable Device Settings Modal from Lobby */}
      <DeviceSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  )
}

export default MeetingLobby
