import React, { useState } from "react"
import {
  type NextVideoItem,
  getNextVideoTitle,
  getNextVideoPoster,
} from "./nextVideoUtils"
import { formatVideoTime } from "./timelineUtils"

export interface NextVideoCardProps {
  video: NextVideoItem
  className?: string
  onClick?: () => void
}

export const NextVideoCard: React.FC<NextVideoCardProps> = ({
  video,
  className = "",
  onClick,
}) => {
  const [imgSrc, setImgSrc] = useState<string>(getNextVideoPoster(video))
  const title = getNextVideoTitle(video)
  const duration = typeof video.duration === "number" && video.duration > 0 ? formatVideoTime(video.duration) : null

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 p-2.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer group ${className}`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onClick?.()
        }
      }}
      aria-label={`Next video: ${title}`}
    >
      {/* Thumbnail */}
      <div className="relative w-28 h-16 rounded overflow-hidden flex-shrink-0 bg-neutral-900">
        <img
          src={imgSrc}
          alt={title}
          onError={() => setImgSrc("/placeholder.svg?height=480&width=854")}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
        {duration && (
          <span className="absolute bottom-1 right-1 bg-black/80 backdrop-blur-sm text-white text-[10px] font-medium px-1.5 py-0.5 rounded">
            {duration}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col min-w-0 flex-1">
        <h4 className="text-white text-sm font-medium line-clamp-2 group-hover:text-red-400 transition-colors">
          {title}
        </h4>
        {video.description && (
          <p className="text-white/60 text-xs line-clamp-1 mt-0.5">
            {video.description}
          </p>
        )}
      </div>
    </div>
  )
}
