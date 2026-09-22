import React, { useState, useRef, useEffect } from "react"
import { Sliders, Activity, Film, Monitor } from "lucide-react"
import { useVideoPlayer } from "./VideoPlayerContext"

export interface VideoQualityInfoProps {
  className?: string
}

/**
 * VideoQualityInfo
 * Displays current detected video resolution, aspect ratio, buffer health, and stream status.
 */
export const VideoQualityInfo: React.FC<VideoQualityInfoProps> = ({ className = "" }) => {
  const { state, actions } = useVideoPlayer()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)

  const quality = state.videoQuality || {
    videoWidth: 0,
    videoHeight: 0,
    qualityLabel: "Auto",
    aspectRatio: "16:9",
    formattedResolution: "Auto",
    readyStatus: "Ready",
    bufferedPercent: 0,
    sourceType: "MP4",
  }

  const setIsMenuOpen = actions.setIsMenuOpen

  // Sync menu state with player auto-hide system
  useEffect(() => {
    setIsMenuOpen(isOpen)
    return () => {
      setIsMenuOpen(false)
    }
  }, [isOpen, setIsMenuOpen])
  useEffect(() => {
    if (!isOpen) return

    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false)
        buttonRef.current?.focus()
      }
    }

    document.addEventListener("mousedown", handleOutsideClick)
    document.addEventListener("touchstart", handleOutsideClick)
    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick)
      document.removeEventListener("touchstart", handleOutsideClick)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen])

  const label = quality.qualityLabel || "Auto"

  return (
    <div className={`relative flex items-center ${className}`}>
      {/* Quality Trigger Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setIsOpen((prev) => !prev)
        }}
        className="flex items-center gap-1 px-2 py-1 sm:px-2 sm:py-1 rounded-md text-white/90 hover:text-white hover:bg-white/15 transition-all duration-200 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 cursor-pointer"
        aria-label="Video quality and stream information"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        title="Video quality & stream information"
      >
        <Sliders size={16} className="stroke-white/80 shrink-0 hidden xs:inline-block" />
        <span className="text-[11px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded bg-white/10 text-white border border-white/10">
          {label}
        </span>
      </button>

      {/* Quality Popover Card */}
      {isOpen && (
        <div
          ref={menuRef}
          role="dialog"
          aria-label="Video quality information"
          className="absolute bottom-full mb-2 right-0 bg-neutral-900/95 backdrop-blur-md text-white rounded-lg shadow-2xl border border-white/10 p-3 min-w-[210px] sm:min-w-[240px] z-30 animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-white/10">
            <span className="text-[11px] font-semibold text-white/60 uppercase tracking-wider">
              Video Information
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-red-600/90 text-white">
              {label}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            {/* Resolution */}
            <div className="flex items-center justify-between text-neutral-300">
              <span className="flex items-center gap-1.5 text-neutral-400">
                <Monitor size={14} className="stroke-neutral-400 shrink-0" />
                Resolution
              </span>
              <span className="font-semibold text-white tabular-nums">
                {quality.formattedResolution}
              </span>
            </div>

            {/* Aspect Ratio */}
            <div className="flex items-center justify-between text-neutral-300">
              <span className="flex items-center gap-1.5 text-neutral-400">
                <Film size={14} className="stroke-neutral-400 shrink-0" />
                Aspect Ratio
              </span>
              <span className="font-semibold text-white">
                {quality.aspectRatio}
              </span>
            </div>

            {/* Buffer Health */}
            <div className="flex flex-col gap-1 pt-1 border-t border-white/5">
              <div className="flex items-center justify-between text-neutral-300">
                <span className="flex items-center gap-1.5 text-neutral-400">
                  <Activity size={14} className="stroke-neutral-400 shrink-0" />
                  Buffer Health
                </span>
                <span className="font-semibold text-white tabular-nums">
                  {state.bufferedPercent}%
                </span>
              </div>
              {/* Mini Buffer Progress Track */}
              <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden mt-0.5">
                <div
                  className="h-full bg-red-500 rounded-full transition-all duration-300"
                  style={{ width: `${state.bufferedPercent}%` }}
                />
              </div>
            </div>

            {/* Stream Status */}
            <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[11px]">
              <span className="text-neutral-400">Stream Status</span>
              <span className="text-emerald-400 font-medium">
                {quality.readyStatus}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default VideoQualityInfo
