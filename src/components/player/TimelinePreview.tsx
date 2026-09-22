import React, { useState } from "react"
import { formatVideoTime } from "./timelineUtils"
import {
  type PreviewThumbnailItem,
  type PreviewSpriteConfig,
  calculateClampedPreviewLeft,
  findClosestThumbnail,
  calculateSpritePosition,
} from "./timelinePreviewUtils"

export interface TimelinePreviewProps {
  visible: boolean
  previewTime: number
  positionX: number
  trackWidth: number
  previewThumbnails?: PreviewThumbnailItem[]
  previewSprites?: PreviewSpriteConfig
  fallbackPoster?: string
}

export const TimelinePreview: React.FC<TimelinePreviewProps> = ({
  visible,
  previewTime,
  positionX,
  trackWidth,
  previewThumbnails,
  previewSprites,
  fallbackPoster,
}) => {
  const [imageError, setImageError] = useState(false)
  const [isImageLoaded, setIsImageLoaded] = useState(false)

  if (!visible || trackWidth <= 0) {
    return null
  }

  const PREVIEW_WIDTH = 156
  const PREVIEW_HEIGHT = 88

  // Clamp preview left coordinate within track boundaries
  const clampedCenter = calculateClampedPreviewLeft(
    positionX,
    trackWidth,
    PREVIEW_WIDTH + 8,
    8
  )

  const formattedTime = formatVideoTime(previewTime)

  // 1. Check for sprite sheet configuration
  const spriteStyle = calculateSpritePosition(previewSprites, previewTime)

  // 2. Check for discrete thumbnail items
  const closestThumbnail = findClosestThumbnail(previewThumbnails, previewTime)
  const thumbnailSrc = closestThumbnail?.src || fallbackPoster

  const hasVisualPreview = (Boolean(spriteStyle) || Boolean(thumbnailSrc)) && !imageError

  return (
    <div
      className="absolute bottom-8 sm:bottom-9 pointer-events-none transform -translate-x-1/2 z-40 flex flex-col items-center animate-fadeIn select-none"
      style={{ left: `${clampedCenter}px` }}
      aria-hidden="true"
    >
      <div className="bg-neutral-900/95 border border-white/20 rounded-xl overflow-hidden shadow-2xl backdrop-blur-xl p-1 flex flex-col items-center">
        {/* Visual Frame / Thumbnail Display */}
        {hasVisualPreview && (
          <div
            className="relative rounded-lg overflow-hidden bg-neutral-950 flex items-center justify-center mb-1"
            style={{ width: `${PREVIEW_WIDTH}px`, height: `${PREVIEW_HEIGHT}px` }}
          >
            {spriteStyle ? (
              <div
                className="w-full h-full bg-no-repeat"
                style={{
                  ...spriteStyle,
                  width: `${PREVIEW_WIDTH}px`,
                  height: `${PREVIEW_HEIGHT}px`,
                }}
              />
            ) : thumbnailSrc ? (
              <>
                {!isImageLoaded && (
                  <div className="absolute inset-0 bg-neutral-800/80 animate-pulse flex items-center justify-center text-[10px] text-white/40">
                    Loading frame...
                  </div>
                )}
                <img
                  src={thumbnailSrc}
                  alt={`Preview at ${formattedTime}`}
                  onLoad={() => setIsImageLoaded(true)}
                  onError={() => {
                    setImageError(true)
                    setIsImageLoaded(false)
                  }}
                  className={`w-full h-full object-cover transition-opacity duration-200 ${
                    isImageLoaded ? "opacity-100" : "opacity-0"
                  }`}
                  loading="eager"
                />
              </>
            ) : null}
          </div>
        )}

        {/* Timestamp Badge */}
        <div className="px-2 py-0.5 rounded bg-neutral-800/80 text-white font-mono text-[11px] font-semibold tracking-wider">
          {formattedTime}
        </div>
      </div>

      {/* Downward indicator pointer caret */}
      <div className="w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-neutral-900/95 -mt-px drop-shadow" />
    </div>
  )
}
