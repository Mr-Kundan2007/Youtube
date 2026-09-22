import React, { useState, useRef, useEffect } from "react"
import { Check, Gauge } from "lucide-react"
import {
  useVideoPlayer,
  SUPPORTED_PLAYBACK_RATES,
  formatPlaybackRate,
  type SupportedPlaybackRate,
} from "./VideoPlayerContext"

export interface PlaybackSpeedProps {
  className?: string
}

export const PlaybackSpeed: React.FC<PlaybackSpeedProps> = ({ className = "" }) => {
  const { state, actions } = useVideoPlayer()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)

  const currentRate = state.playbackRate || 1
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

  const handleSelectRate = (rate: SupportedPlaybackRate) => {
    actions.setPlaybackRate(rate)
    setIsOpen(false)
    buttonRef.current?.focus()
  }

  return (
    <div className={`relative flex items-center ${className}`}>
      {/* Speed Trigger Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setIsOpen((prev) => !prev)
        }}
        className="flex items-center gap-1 px-2 py-1 sm:px-2.5 sm:py-1 hover:bg-white/15 rounded-md text-white transition-all active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 cursor-pointer"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`Playback speed: ${formatPlaybackRate(currentRate)}`}
        title="Playback speed"
      >
        <Gauge size={16} className="stroke-white/80 shrink-0 hidden xs:inline-block" />
        <span className="text-xs font-semibold tracking-wide text-white/95">
          {formatPlaybackRate(currentRate)}
        </span>
      </button>

      {/* Speed Popover Selection Menu */}
      {isOpen && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Playback speed options"
          className="absolute bottom-full mb-2 right-0 bg-neutral-900/95 backdrop-blur-md text-white rounded-lg shadow-2xl border border-white/10 py-1.5 min-w-[130px] sm:min-w-[145px] z-30 animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 text-[11px] font-semibold text-white/50 uppercase tracking-wider border-b border-white/10 mb-1">
            Playback Speed
          </div>

          <div className="flex flex-col">
            {SUPPORTED_PLAYBACK_RATES.map((rate) => {
              const isSelected = Math.abs(currentRate - rate) < 0.01
              const label = rate === 1 ? "1× (Normal)" : `${rate}×`

              return (
                <button
                  key={rate}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isSelected}
                  onClick={() => handleSelectRate(rate)}
                  className={`flex items-center justify-between px-3 py-1.5 text-xs text-left transition-colors cursor-pointer focus:outline-none focus-visible:bg-white/20 ${
                    isSelected
                      ? "text-red-500 font-semibold bg-white/10"
                      : "text-white/90 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <span>{label}</span>
                  {isSelected && <Check size={14} className="stroke-red-500 ml-2 shrink-0" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default PlaybackSpeed
