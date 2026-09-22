import React, { useRef, useState, useCallback } from "react"
import { useVideoPlayer, DEFAULT_VOLUME_STEP } from "./VideoPlayerContext"

export interface VolumeSliderProps {
  className?: string
  trackWidthClass?: string
  onAdjustChange?: (isAdjusting: boolean) => void
}

export const VolumeSlider: React.FC<VolumeSliderProps> = ({
  className = "",
  trackWidthClass = "w-14 sm:w-16 md:w-20",
  onAdjustChange,
}) => {
  const { state, actions } = useVideoPlayer()
  const trackRef = useRef<HTMLDivElement | null>(null)
  const isDraggingRef = useRef(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  const effectiveVolume = state.isMuted ? 0 : state.volume
  const volumePercentage = Math.round(effectiveVolume * 100)

  const getVolumeFromPointerEvent = useCallback(
    (e: React.PointerEvent<HTMLDivElement> | PointerEvent) => {
      if (!trackRef.current) return effectiveVolume
      const rect = trackRef.current.getBoundingClientRect()
      if (rect.width <= 0) return 0
      const offsetX = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
      return Number((offsetX / rect.width).toFixed(4))
    },
    [effectiveVolume]
  )

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return
    e.preventDefault()
    e.stopPropagation()

    isDraggingRef.current = true
    setIsDragging(true)
    if (onAdjustChange) onAdjustChange(true)

    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // Ignore
    }

    const newVolume = getVolumeFromPointerEvent(e)
    actions.setVolume(newVolume)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return
    e.preventDefault()
    e.stopPropagation()

    const newVolume = getVolumeFromPointerEvent(e)
    actions.setVolume(newVolume)
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return
    isDraggingRef.current = false
    setIsDragging(false)
    if (onAdjustChange) onAdjustChange(false)

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
    } catch {
      // Ignore
    }

    const newVolume = getVolumeFromPointerEvent(e)
    actions.setVolume(newVolume)
  }

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return
    isDraggingRef.current = false
    setIsDragging(false)
    if (onAdjustChange) onAdjustChange(false)

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
    } catch {
      // Ignore
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    let targetVolume: number | null = null
    const step = DEFAULT_VOLUME_STEP
    const bigStep = step * 2

    switch (e.key) {
      case "ArrowUp":
      case "ArrowRight":
        targetVolume = Math.min(1, effectiveVolume + step)
        break
      case "ArrowDown":
      case "ArrowLeft":
        targetVolume = Math.max(0, effectiveVolume - step)
        break
      case "PageUp":
        targetVolume = Math.min(1, effectiveVolume + bigStep)
        break
      case "PageDown":
        targetVolume = Math.max(0, effectiveVolume - bigStep)
        break
      case "Home":
        targetVolume = 0
        break
      case "End":
        targetVolume = 1
        break
      default:
        return
    }

    e.preventDefault()
    e.stopPropagation()
    actions.setVolume(targetVolume)
  }

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={0}
      aria-label="Volume"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={volumePercentage}
      aria-valuetext={`${volumePercentage}% volume`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onKeyDown={handleKeyDown}
      className={`relative flex items-center h-6 sm:h-7 cursor-pointer select-none touch-none focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded-sm py-2 group ${trackWidthClass} ${className}`}
    >
      {/* Background Track */}
      <div className="relative w-full h-1 sm:h-1.5 bg-white/30 rounded-full overflow-hidden transition-all duration-150 group-hover:h-1.5">
        {/* Active Volume Progress Bar */}
        <div
          className="absolute top-0 bottom-0 left-0 bg-white rounded-full transition-all duration-75"
          style={{ width: `${volumePercentage}%` }}
        />
      </div>

      {/* Draggable Scrubber Handle */}
      <div
        className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 sm:w-3.5 sm:h-3.5 bg-white rounded-full shadow-md pointer-events-none transform -translate-x-1/2 transition-transform duration-100 ${
          isDragging || isHovered
            ? "scale-100"
            : "scale-0 group-hover:scale-100 focus-visible:scale-100"
        }`}
        style={{ left: `${volumePercentage}%` }}
      />
    </div>
  )
}

export default VolumeSlider
