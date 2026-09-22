import React, { useState } from "react"
import { Video, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useDevicePreview } from "../hooks/useDevicePreview"
import DevicePreview from "./DevicePreview"
import { DeviceSettingsModal } from "./DeviceSettingsModal"

interface MeetingLobbyStubProps {
  roomId?: string
  initialName?: string
  onCreateMeeting?: (customName?: string) => void
  onJoinMeeting?: (roomId: string, name: string) => void
  isLoading?: boolean
}

export const MeetingLobbyStub: React.FC<MeetingLobbyStubProps> = ({
  roomId: initialRoomId = "",
  initialName = "",
  onCreateMeeting,
  onJoinMeeting,
  isLoading = false,
}) => {
  const [roomId, setRoomId] = useState(initialRoomId)
  const [displayName, setDisplayName] = useState(initialName)
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

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault()
    if (roomId.trim() && onJoinMeeting) {
      onJoinMeeting(roomId.trim().toLowerCase(), displayName.trim())
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-3 sm:p-6">
      <div className="w-full max-w-4xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xl overflow-hidden grid grid-cols-1 md:grid-cols-2 mx-auto">
        {/* Left: Real Live Device Preview (Camera / Mic) */}
        <div className="bg-neutral-950 p-4 sm:p-6 flex flex-col justify-between relative min-h-[300px] sm:min-h-[340px]">
          <DevicePreview
            stream={stream}
            isCameraEnabled={isCameraEnabled}
            isMicEnabled={isMicEnabled}
            isPreparing={isPreparing}
            hasPermissions={hasPermissions}
            audioLevel={audioLevel}
            error={deviceError}
            displayName={displayName || "You"}
            onToggleCamera={toggleCamera}
            onToggleMic={toggleMic}
            onRetryPermissions={retryPermissions}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        </div>

        {/* Right: Meeting Actions */}
        <div className="p-5 sm:p-8 flex flex-col justify-center bg-white dark:bg-neutral-900 text-center sm:text-left">
          <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white mb-1">Video Meetings</h1>
          <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mb-5 sm:mb-6">
            Secure, low-latency group meetings and one-to-one video calls.
          </p>

          <form onSubmit={handleJoin} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">Your Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter your display name"
                className="w-full px-3.5 py-2.5 text-sm border border-neutral-300 dark:border-neutral-700 rounded-lg bg-neutral-50 dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-red-600 text-neutral-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">Meeting Code / Room ID</label>
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="e.g. abc-defg-hij"
                className="w-full px-3.5 py-2.5 text-sm border border-neutral-300 dark:border-neutral-700 rounded-lg bg-neutral-50 dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-red-600 text-neutral-900 dark:text-white"
              />
            </div>

            <div className="pt-2 flex flex-col gap-2.5">
              <Button
                type="submit"
                disabled={!roomId.trim() || isLoading}
                className="w-full h-11 sm:h-10 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg"
              >
                {isLoading ? "Connecting..." : "Join Meeting"}
              </Button>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-neutral-200 dark:border-neutral-800"></div>
                <span className="flex-shrink mx-3 text-xs text-neutral-400">or</span>
                <div className="flex-grow border-t border-neutral-200 dark:border-neutral-800"></div>
              </div>

              <Button
                type="button"
                onClick={() => onCreateMeeting && onCreateMeeting(displayName.trim())}
                disabled={isLoading}
                variant="outline"
                className="w-full h-11 sm:h-10 border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-900 dark:text-white font-medium rounded-lg"
              >
                <Video className="w-4 h-4 mr-2 text-red-600" />
                Start Instant Meeting
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Device Settings Modal */}
      <DeviceSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  )
}

export default MeetingLobbyStub
