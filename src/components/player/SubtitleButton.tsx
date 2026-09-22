import React, { useState, useRef, useEffect } from "react"
import { Captions, Check } from "lucide-react"
import { useVideoPlayer } from "./VideoPlayerContext"

export interface SubtitleButtonProps {
  className?: string
}

/**
 * SubtitleButton
 * Dedicated accessible CC button and custom popover selection menu for subtitles and closed captions.
 */
export const SubtitleButton: React.FC<SubtitleButtonProps> = ({ className = "" }) => {
  const { state, actions } = useVideoPlayer()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)

  const isEnabled = state.areSubtitlesEnabled
  const tracks = state.availableSubtitleTracks || []
  const activeTrack = state.activeSubtitleTrack

  const subtitleTracks = tracks.filter((t) => t.kind !== "captions")
  const captionTracks = tracks.filter((t) => t.kind === "captions")

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

  const handleSelectOff = () => {
    actions.disableSubtitles()
    setIsOpen(false)
    buttonRef.current?.focus()
  }

  const handleSelectTrack = (trackId: string) => {
    actions.enableSubtitleTrack(trackId)
    setIsOpen(false)
    buttonRef.current?.focus()
  }

  return (
    <div className={`relative flex items-center ${className}`}>
      {/* CC Trigger Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setIsOpen((prev) => !prev)
        }}
        className={`relative p-2 rounded-full text-white/90 hover:text-white hover:bg-white/15 transition-all duration-200 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 cursor-pointer inline-flex items-center justify-center ${
          isEnabled ? "text-red-500 hover:text-red-400" : ""
        }`}
        aria-label="Subtitles and captions"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title={isEnabled ? "Subtitles on (c)" : "Subtitles off (c)"}
      >
        <Captions
          size={19}
          className={isEnabled ? "stroke-red-500 fill-red-500/20" : "stroke-white"}
        />
        {isEnabled && (
          <span
            className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-3 h-0.5 bg-red-500 rounded-full"
            aria-hidden="true"
          />
        )}
      </button>

      {/* Subtitles Popover Menu */}
      {isOpen && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Subtitle and caption options"
          className="absolute bottom-full mb-2 right-0 bg-neutral-900/95 backdrop-blur-md text-white rounded-lg shadow-2xl border border-white/10 py-1.5 min-w-[170px] sm:min-w-[190px] z-30 animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 text-[11px] font-semibold text-white/50 uppercase tracking-wider border-b border-white/10 mb-1">
            Subtitles / CC
          </div>

          <div className="flex flex-col">
            {/* 1. Off Option */}
            <button
              type="button"
              role="menuitemradio"
              aria-checked={!isEnabled}
              onClick={handleSelectOff}
              className={`flex items-center justify-between px-3 py-1.5 text-xs text-left transition-colors cursor-pointer focus:outline-none focus-visible:bg-white/20 ${
                !isEnabled
                  ? "text-red-500 font-semibold bg-white/10"
                  : "text-white/90 hover:bg-white/15"
              }`}
            >
              <span>Off</span>
              {!isEnabled && <Check size={14} className="stroke-red-500 ml-2" />}
            </button>

            {/* 2. Subtitle Tracks */}
            {subtitleTracks.length > 0 && (
              <>
                <div className="px-3 pt-2 pb-1 text-[10px] font-medium text-white/40 uppercase tracking-wider">
                  Subtitles
                </div>
                {subtitleTracks.map((t) => {
                  const isSelected = isEnabled && activeTrack?.id === t.id
                  return (
                    <button
                      key={t.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={isSelected}
                      onClick={() => handleSelectTrack(t.id)}
                      className={`flex items-center justify-between px-3 py-1.5 text-xs text-left transition-colors cursor-pointer focus:outline-none focus-visible:bg-white/20 ${
                        isSelected
                          ? "text-red-500 font-semibold bg-white/10"
                          : "text-white/90 hover:bg-white/15"
                      }`}
                    >
                      <span className="truncate pr-2">{t.label}</span>
                      {isSelected && (
                        <Check size={14} className="stroke-red-500 shrink-0 ml-2" />
                      )}
                    </button>
                  )
                })}
              </>
            )}

            {/* 3. Caption Tracks */}
            {captionTracks.length > 0 && (
              <>
                <div className="px-3 pt-2 pb-1 text-[10px] font-medium text-white/40 uppercase tracking-wider">
                  Captions (CC)
                </div>
                {captionTracks.map((t) => {
                  const isSelected = isEnabled && activeTrack?.id === t.id
                  return (
                    <button
                      key={t.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={isSelected}
                      onClick={() => handleSelectTrack(t.id)}
                      className={`flex items-center justify-between px-3 py-1.5 text-xs text-left transition-colors cursor-pointer focus:outline-none focus-visible:bg-white/20 ${
                        isSelected
                          ? "text-red-500 font-semibold bg-white/10"
                          : "text-white/90 hover:bg-white/15"
                      }`}
                    >
                      <span className="truncate pr-2">{t.label}</span>
                      {isSelected && (
                        <Check size={14} className="stroke-red-500 shrink-0 ml-2" />
                      )}
                    </button>
                  )
                })}
              </>
            )}

            {/* Empty tracks notice */}
            {tracks.length === 0 && (
              <div className="px-3 py-2 text-[11px] text-white/40 italic">
                No tracks available
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default SubtitleButton
