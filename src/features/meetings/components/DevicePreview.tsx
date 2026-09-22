import React, { useEffect, useRef } from "react"
import { Video, VideoOff, Mic, MicOff, AlertCircle, RefreshCw, Settings } from "lucide-react"

interface DevicePreviewProps {
  stream: MediaStream | null
  isCameraEnabled: boolean
  isMicEnabled: boolean
  isPreparing: boolean
  hasPermissions: boolean
  audioLevel: number
  error: string | null
  displayName?: string
  onToggleCamera: () => void
  onToggleMic: () => void
  onRetryPermissions?: () => void
  onOpenSettings?: () => void
}

export const DevicePreview: React.FC<DevicePreviewProps> = ({
  stream,
  isCameraEnabled,
  isMicEnabled,
  isPreparing,
  hasPermissions,
  audioLevel,
  error,
  displayName = "You",
  onToggleCamera,
  onToggleMic,
  onRetryPermissions,
  onOpenSettings,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    if (videoRef.current) {
      if (stream && isCameraEnabled) {
        videoRef.current.srcObject = stream
      } else {
        videoRef.current.srcObject = null
      }
    }
  }, [stream, isCameraEnabled])

  const initial = displayName.trim().charAt(0).toUpperCase() || "U"

  return (
    <div className="relative w-full aspect-video bg-neutral-900 rounded-2xl overflow-hidden border border-neutral-800 flex flex-col justify-between shadow-inner">
      {/* Top Bar: Preview Indicators */}
      <div className="relative z-10 p-3 flex items-center justify-between text-neutral-300 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-medium tracking-wide text-neutral-200 text-[11px] uppercase">
            Camera & Mic Preview
          </span>
        </div>
        {hasPermissions && (
          <span className="bg-neutral-800/80 backdrop-blur-sm px-2 py-0.5 rounded text-[11px] text-neutral-400">
            Local Only
          </span>
        )}
      </div>

      {/* Main Preview Area */}
      <div className="absolute inset-0 flex items-center justify-center">
        {isPreparing ? (
          <div className="flex flex-col items-center gap-2 text-neutral-400 text-xs">
            <div className="w-8 h-8 border-2 border-neutral-600 border-t-blue-500 rounded-full animate-spin" />
            <p>Initializing camera preview...</p>
          </div>
        ) : isCameraEnabled && stream ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover transform -scale-x-100"
          />
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-20 h-20 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-200 text-2xl font-bold shadow-md">
              {initial}
            </div>
            <p className="text-xs text-neutral-400 font-medium">Camera is turned off</p>
          </div>
        )}
      </div>

      {/* Error / Permission Alert Overlay */}
      {error && !isPreparing && (
        <div className="relative z-10 m-3 p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between text-amber-300 text-xs backdrop-blur-sm">
          <div className="flex items-center gap-2 truncate pr-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{error}</span>
          </div>
          {onRetryPermissions && (
            <button
              onClick={onRetryPermissions}
              className="flex items-center gap-1 text-[11px] font-semibold text-white bg-amber-600/80 hover:bg-amber-600 px-2 py-1 rounded-md transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Retry
            </button>
          )}
        </div>
      )}

      {/* Bottom Bar: Interactive Controls & Audio Meter */}
      <div className="relative z-10 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex items-center justify-between">
        {/* Audio Level Visualizer */}
        <div className="flex items-center gap-1.5 bg-neutral-900/80 backdrop-blur-sm px-2.5 py-1.5 rounded-full border border-neutral-700/50">
          <div
            className={`w-2 h-2 rounded-full ${
              isMicEnabled ? "bg-emerald-400" : "bg-neutral-500"
            }`}
          />
          <div className="w-16 h-1.5 bg-neutral-800 rounded-full overflow-hidden flex">
            <div
              className="h-full bg-emerald-500 transition-all duration-75"
              style={{ width: `${isMicEnabled ? Math.min(audioLevel * 1.5, 100) : 0}%` }}
            />
          </div>
        </div>

        {/* Quick Toggles */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleMic}
            className={`p-2.5 rounded-full transition-all shadow-sm ${
              isMicEnabled
                ? "bg-neutral-800/90 hover:bg-neutral-700 text-white"
                : "bg-red-500 hover:bg-red-600 text-white"
            }`}
            title={isMicEnabled ? "Mute microphone" : "Unmute microphone"}
          >
            {isMicEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={onToggleCamera}
            className={`p-2.5 rounded-full transition-all shadow-sm ${
              isCameraEnabled
                ? "bg-neutral-800/90 hover:bg-neutral-700 text-white"
                : "bg-red-500 hover:bg-red-600 text-white"
            }`}
            title={isCameraEnabled ? "Turn off camera" : "Turn on camera"}
          >
            {isCameraEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
          </button>

          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="p-2.5 rounded-full bg-neutral-800/90 hover:bg-neutral-700 text-white transition-all shadow-sm"
              title="Device Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default DevicePreview
