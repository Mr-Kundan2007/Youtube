import React, { useRef, useState, useCallback, useEffect } from "react"
import {
  useVideoPlayer,
  formatVideoTime,
  calculateProgress,
} from "./VideoPlayerContext"
import {
  calculatePointerPercentage,
  calculatePreviewTime,
  type PreviewThumbnailItem,
  type PreviewSpriteConfig,
} from "./timelinePreviewUtils"
import { TimelinePreview } from "./TimelinePreview"

export interface ProgressBarProps {
  className?: string
  trackHeight?: string
  showPreviewTooltip?: boolean
  previewThumbnails?: PreviewThumbnailItem[]
  previewSprites?: PreviewSpriteConfig
  fallbackPoster?: string
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  className = "",
  showPreviewTooltip = true,
  previewThumbnails,
  previewSprites,
  fallbackPoster,
}) => {
  const { state, actions } = useVideoPlayer()
  const trackRef = useRef<HTMLDivElement | null>(null)

  // Local state for hover preview
  const [isHovering, setIsHovering] = useState(false)
  const [hoverPosition, setHoverPosition] = useState<number | null>(null)
  const [hoverTime, setHoverTime] = useState<number>(0)
  const [trackWidth, setTrackWidth] = useState<number>(0)
  const isDraggingRef = useRef(false)
  const isTouchPointerRef = useRef(false)
  const rafIdRef = useRef<number | null>(null)

  // Cleanup requestAnimationFrame on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
    }
  }, [])

  // Calculate active progress metrics
  const actualPercentage = calculateProgress(state.currentTime, state.duration)
  const activePercentage = state.isSeeking
    ? state.seekPreviewPercentage
    : actualPercentage
  const activeTime = state.isSeeking ? state.seekPreviewTime : state.currentTime

  const getPositionFromEvent = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return { percentage: 0, time: 0, offsetX: 0, width: 0 }
      const rect = trackRef.current.getBoundingClientRect()
      if (rect.width <= 0) return { percentage: 0, time: 0, offsetX: 0, width: 0 }

      const pct = calculatePointerPercentage(clientX, rect)
      const time = calculatePreviewTime(pct, state.duration)
      const offsetX = pct * rect.width
      return { percentage: pct * 100, time, offsetX, width: rect.width }
    },
    [state.duration]
  )

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only respond to primary mouse button or touch
    if (e.button !== 0 && e.pointerType === "mouse") return
    e.preventDefault()
    e.stopPropagation()

    isTouchPointerRef.current = e.pointerType === "touch"
    isDraggingRef.current = true
    actions.setIsDragging(true)
    const { percentage, time, offsetX, width } = getPositionFromEvent(e.clientX)

    setTrackWidth(width)
    setHoverPosition(offsetX)
    setHoverTime(time)

    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // Ignore if pointer capture fails
    }

    actions.startSeeking(time, percentage)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    isTouchPointerRef.current = e.pointerType === "touch"
    const clientX = e.clientX

    // Throttled position updating via requestAnimationFrame
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current)
    }

    rafIdRef.current = requestAnimationFrame(() => {
      const { percentage, time, offsetX, width } = getPositionFromEvent(clientX)
      setTrackWidth(width)
      setHoverPosition(offsetX)
      setHoverTime(time)

      if (isDraggingRef.current) {
        actions.updateSeeking(time, percentage)
      }
    })
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return
    isDraggingRef.current = false
    actions.setIsDragging(false)


    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
    } catch {
      // Ignore
    }

    const { time } = getPositionFromEvent(e.clientX)
    actions.endSeeking(time)
  }


  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return
    isDraggingRef.current = false
    actions.setIsDragging(false)

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
    } catch {
      // Ignore
    }

    actions.endSeeking()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!state.duration || state.duration <= 0) return

    let targetTime: number | null = null
    const step = 5
    const bigStep = 10
    const jumpPct = state.duration * 0.1

    switch (e.key) {
      case "ArrowLeft":
        targetTime = Math.max(0, state.currentTime - step)
        break
      case "ArrowRight":
        targetTime = Math.min(state.duration, state.currentTime + step)
        break
      case "ArrowDown":
        targetTime = Math.max(0, state.currentTime - bigStep)
        break
      case "ArrowUp":
        targetTime = Math.min(state.duration, state.currentTime + bigStep)
        break
      case "Home":
        targetTime = 0
        break
      case "End":
        targetTime = state.duration
        break
      case "0":
      case "1":
      case "2":
      case "3":
      case "4":
      case "5":
      case "6":
      case "7":
      case "8":
      case "9":
        targetTime = (parseInt(e.key, 10) / 10) * state.duration
        break
      case "j":
      case "J":
        targetTime = Math.max(0, state.currentTime - jumpPct)
        break
      case "l":
      case "L":
        targetTime = Math.min(state.duration, state.currentTime + jumpPct)
        break
      default:
        return
    }

    e.preventDefault()
    e.stopPropagation()
    actions.seek(targetTime)
  }

  // Calculate tooltip style safely without reading ref during render
  const tooltipStyle: React.CSSProperties =
    hoverPosition !== null
      ? { left: `${hoverPosition}px` }
      : { left: `${activePercentage}%` }

  const previewTimeText = formatVideoTime(
    state.isSeeking ? state.seekPreviewTime : hoverTime
  )

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={0}
      aria-label="Video playback progress timeline"
      aria-valuemin={0}
      aria-valuemax={Math.round(state.duration || 0)}
      aria-valuenow={Math.round(activeTime)}
      aria-valuetext={`${formatVideoTime(activeTime)} of ${formatVideoTime(
        state.duration
      )}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => {
        setIsHovering(false)
        if (!state.isSeeking) setHoverPosition(null)
      }}
      onKeyDown={handleKeyDown}
      className={`relative flex items-center w-full h-6 sm:h-7 cursor-pointer select-none group touch-none focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded-sm ${className}`}
    >
      {/* Background Track */}
      <div className="relative w-full h-1 sm:h-1.5 group-hover:h-2 group-active:h-2 transition-all duration-150 bg-white/20 rounded-full overflow-hidden">
        {/* Layer 1: Multiple Buffered Progress Ranges (Phase 7) */}
        {state.bufferedRanges && state.bufferedRanges.length > 0 ? (
          state.bufferedRanges.map((range, idx) => {
            const duration = state.duration || 0
            if (duration <= 0) return null
            const leftPct = (range.start / duration) * 100
            const widthPct = ((range.end - range.start) / duration) * 100
            return (
              <div
                key={`buf-${idx}-${range.start}`}
                className="absolute top-0 bottom-0 bg-white/40 rounded-full transition-all duration-150 pointer-events-none"
                style={{
                  left: `${Math.max(0, Math.min(100, leftPct))}%`,
                  width: `${Math.max(0, Math.min(100 - Math.max(0, leftPct), widthPct))}%`,
                }}
              />
            )
          })
        ) : (
          <div
            className="absolute top-0 bottom-0 left-0 bg-white/40 rounded-full transition-all duration-200"
            style={{ width: `${Math.max(0, Math.min(100, state.bufferedPercent))}%` }}
          />
        )}

        {/* Layer 2: Played Progress Layer */}
        <div
          className="absolute top-0 bottom-0 left-0 bg-red-600 rounded-full"
          style={{ width: `${activePercentage}%` }}
        />
      </div>

      {/* Layer 3: Draggable Timeline Handle */}
      <div
        className={`absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 bg-red-600 rounded-full shadow-lg transform -translate-x-1/2 transition-transform duration-100 pointer-events-none ${
          state.isSeeking || isHovering
            ? "scale-100 ring-4 ring-red-600/30"
            : "scale-0 group-hover:scale-100"
        }`}
        style={{ left: `${activePercentage}%` }}
      />

      {/* Layer 4: Floating Seek Time & Thumbnail Hover Preview (Phase 10) */}
      {showPreviewTooltip &&
        (state.isSeeking || (isHovering && !isTouchPointerRef.current)) && (
          <TimelinePreview
            visible={true}
            previewTime={state.isSeeking ? state.seekPreviewTime : hoverTime}
            positionX={
              hoverPosition !== null
                ? hoverPosition
                : (activePercentage / 100) * (trackWidth || 1)
            }
            trackWidth={
              trackWidth || (trackRef.current?.getBoundingClientRect().width ?? 0)
            }
            previewThumbnails={previewThumbnails}
            previewSprites={previewSprites}
            fallbackPoster={fallbackPoster}
          />
        )}
    </div>

  )
}

export { ProgressBar as ProgressTimeline }
export default ProgressBar
