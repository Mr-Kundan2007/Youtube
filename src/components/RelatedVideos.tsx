import React from "react"
import Link from "next/link"
import { formatRelativeTime, useIsMounted } from "@/lib/formatDate"

export interface RelatedVideoItem {
  _id?: string | number
  id?: string | number
  videotitle: string
  videochanel: string
  views: number
  createdAt: string | Date
  thumbnailUrl?: string
  videoUrl?: string
}

interface RelatedVideosProps {
  videos?: RelatedVideoItem[]
  currentVideoId?: string | number
  onSelectVideo?: (video: RelatedVideoItem) => void
}

export const defaultRelatedVideos: RelatedVideoItem[] = [
  {
    _id: "662a1f8e9c1d2e3f4a5b6c7d",
    id: "662a1f8e9c1d2e3f4a5b6c7d",
    videotitle: "Welcome to StreamHub - Multilingual & Interactive Video Platform",
    videochanel: "StreamHub Official",
    views: 24500,
    createdAt: "2026-09-20T12:00:00.000Z",
    thumbnailUrl: "/video/snowglobe.jpg",
  },
  {
    _id: "1",
    id: "1",
    videotitle: "Amazing Nature Documentary",
    videochanel: "Nature Channel",
    views: 45000,
    createdAt: "2026-09-02T22:30:00.000Z",
    thumbnailUrl: "/video/snowglobe.jpg",
  },
  {
    _id: "2",
    id: "2",
    videotitle: "Cooking Tutorial: Perfect Pasta",
    videochanel: "Chef's Kitchen",
    views: 23000,
    createdAt: "2026-09-01T12:00:00.000Z",
    thumbnailUrl: "/video/snowglobe.jpg",
  },
  {
    _id: "3",
    id: "3",
    videotitle: "Building a Fullstack Web Application with Next.js & Tailwind",
    videochanel: "Code Craft",
    views: 128000,
    createdAt: "2026-08-30T12:00:00.000Z",
    thumbnailUrl: "/video/snowglobe.jpg",
  },
  {
    _id: "4",
    id: "4",
    videotitle: "Relaxing Lo-Fi Beats to Study & Code To",
    videochanel: "Chill Vibes",
    views: 950000,
    createdAt: "2026-08-25T12:00:00.000Z",
    thumbnailUrl: "/video/snowglobe.jpg",
  },
]

const RelatedVideos = ({
  videos = defaultRelatedVideos,
  currentVideoId,
  onSelectVideo,
}: RelatedVideosProps) => {
  const isMounted = useIsMounted()

  // Filter out the current active video
  const sourceList = Array.isArray(videos) && videos.length > 0 ? videos : defaultRelatedVideos
  const filtered = sourceList.filter((v) => {
    if (!currentVideoId) return true
    const vId = String(v._id || v.id)
    return vId !== String(currentVideoId)
  })

  // Ensure there are always recommendations available (fallback to default catalog if needed)
  const displayList =
    filtered.length > 0
      ? filtered
      : defaultRelatedVideos.filter((v) => String(v._id || v.id) !== String(currentVideoId))

  // Limit to 20 videos for smooth layout and performance
  const displayVideos = displayList.slice(0, 20)

  const handleVideoClick = (e: React.MouseEvent, targetVideo: RelatedVideoItem) => {
    if (onSelectVideo) {
      e.preventDefault()
      onSelectVideo(targetVideo)
    }
  }

  return (
    <div className="space-y-3">
      {displayVideos.map((video) => {
        const videoId = video._id || video.id
        const formattedDate = isMounted
          ? formatRelativeTime(video.createdAt, "1 day ago")
          : "1 day ago"

        return (
          <Link
            key={String(videoId)}
            href={`/watch/${videoId}`}
            onClick={(e) => handleVideoClick(e, video)}
            className="group flex flex-col xs:flex-row sm:flex-row gap-2.5 sm:gap-3 cursor-pointer p-1.5 rounded-xl hover:bg-neutral-100/60 dark:hover:bg-neutral-800/60 transition-colors"
          >
            <div className="relative w-full xs:w-36 sm:w-44 aspect-video rounded-lg overflow-hidden bg-neutral-200 dark:bg-neutral-800 shrink-0">
              <img
                src={video.thumbnailUrl || "/video/snowglobe.jpg"}
                alt={video.videotitle}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                onError={(e) => {
                  ;(e.target as HTMLImageElement).src = "/video/snowglobe.jpg"
                }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xs sm:text-sm font-medium text-[var(--foreground,#0f0f0f)] group-hover:text-red-600 dark:group-hover:text-red-400 line-clamp-2 leading-snug">
                {video.videotitle}
              </h3>
              <p className="text-[11px] sm:text-xs text-[var(--muted-foreground,#606060)] mt-1 truncate">
                {video.videochanel || "Channel"}
              </p>
              <p
                className="text-[11px] sm:text-xs text-[var(--muted-foreground,#606060)] truncate"
                suppressHydrationWarning
              >
                {(typeof video.views === "number" ? video.views : 0).toLocaleString()} views • {formattedDate}
              </p>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

export default RelatedVideos
export { RelatedVideos }
