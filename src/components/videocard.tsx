"use client"

import React, { useRef } from "react"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export interface VideoItem {
  _id?: string
  id?: string
  videotitle: string
  videochanel?: string
  videochannel?: string
  views: number
  createdAt: string | Date
  duration?: string
  thumbnailUrl?: string
  videoUrl?: string
  videofilepath?: string
  filepath?: string
  description?: string
}

const videos = "/video/vdo.mp4"

export default function VideoCard({ video }: any) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const videoId = video?._id || video?.id || "1"

  const backendUrl =
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_SERVER_URL ||
    "http://localhost:5001"

  const rawPath = video?.filepath || video?.videofilepath || video?.videoUrl || ""
  const cleanPath = rawPath
    ? rawPath.startsWith("/")
      ? rawPath.slice(1)
      : rawPath
    : "video/vdo.mp4"

  const videoSrc = rawPath.startsWith("http")
    ? rawPath
    : `${backendUrl}/${cleanPath}`

  const sameOriginSrc = rawPath.startsWith("http")
    ? rawPath
    : `/${cleanPath}`

  const channelName = video?.videochanel || video?.videochannel || "Channel"
  const channelInitial = channelName ? channelName[0].toUpperCase() : "Y"

  const formattedTime = (() => {
    try {
      if (video?.createdAt) {
        return formatDistanceToNow(new Date(video.createdAt))
      }
    } catch (e) {}
    return "1 day"
  })()

  const handleMouseEnter = () => {
    if (videoRef.current) {
      videoRef.current.play().catch(() => {})
    }
  }

  const handleMouseLeave = () => {
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.currentTime = 0
    }
  }

  return (
    <Link href={`/watch/${videoId}`} className="group cursor-pointer w-full max-w-[420px] sm:max-w-none mx-auto block">
      <div className="space-y-3">
        <div
          className="relative aspect-video rounded-xl sm:rounded-2xl overflow-hidden bg-neutral-900/10 dark:bg-neutral-800 shadow-sm"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <video
            ref={videoRef}
            src={sameOriginSrc}
            poster={video?.thumbnailUrl || "/video/snowglobe.jpg"}
            muted
            loop
            playsInline
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            onError={(e) => {
              if (e.currentTarget.src !== videoSrc) {
                e.currentTarget.src = videoSrc
              } else if (!e.currentTarget.src.endsWith("/video/vdo.mp4")) {
                e.currentTarget.src = "/video/vdo.mp4"
              }
            }}
          />
          <div className="absolute bottom-2 right-2 bg-black/80 text-white text-[11px] font-semibold px-1.5 py-0.5 rounded-md">
            {video?.duration || "10:24"}
          </div>
        </div>

        <div className="flex gap-3 px-1">
          <Avatar className="w-9 h-9 flex-shrink-0">
            <AvatarFallback className="bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 text-xs font-bold">
              {channelInitial}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm line-clamp-2 text-[var(--foreground)] group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-snug">
              {video?.videotitle}
            </h3>
            <p className="text-xs text-[var(--muted-foreground)] mt-1 truncate">{channelName}</p>
            <p className="text-xs text-[var(--muted-foreground)]" suppressHydrationWarning>
              {(video?.views || 0).toLocaleString()} views • {formattedTime} ago
            </p>
          </div>
        </div>
      </div>
    </Link>
  )
}

export { VideoCard }
