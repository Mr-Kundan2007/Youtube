import React, { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { formatRelativeTime, useIsMounted } from "@/lib/formatDate"
import axiosInstance from "@/lib/axiosinstance"

export interface SearchVideoItem {
  _id: string | number
  id?: string | number
  videotitle: string
  videochanel: string
  views: number
  createdAt: string | Date
  duration?: string
  thumbnailUrl?: string
  videoUrl?: string
  videofilepath?: string
  description?: string
}

export const allSampleVideos: SearchVideoItem[] = [
  {
    _id: "1",
    id: "1",
    videotitle: "Amazing Nature Documentary",
    videochanel: "Nature Channel",
    views: 45000,
    createdAt: "2026-09-02T22:30:00.000Z",
    duration: "10:24",
    thumbnailUrl: "/video/snowglobe.jpg",
    videoUrl: "/video/vdo.mp4",
    description:
      "Experience the beauty and wonder of nature in this breathtaking documentary. Discover wildlife and scenery in pristine 4K resolution.",
  },
  {
    _id: "2",
    id: "2",
    videotitle: "Cooking Tutorial: Perfect Pasta",
    videochanel: "Chef's Kitchen",
    views: 23000,
    createdAt: "2026-09-01T12:00:00.000Z",
    duration: "10:24",
    thumbnailUrl: "/video/snowglobe.jpg",
    videoUrl: "/video/vdo.mp4",
    description:
      "Learn the authentic Italian way to prepare homemade pasta with easy-to-follow instructions and tips from a professional chef.",
  },
  {
    _id: "3",
    id: "3",
    videotitle: "Building a Fullstack Web Application with Next.js & Tailwind",
    videochanel: "Code Craft",
    views: 128000,
    createdAt: "2026-08-30T12:00:00.000Z",
    duration: "18:45",
    thumbnailUrl: "/video/snowglobe.jpg",
    videoUrl: "/video/vdo.mp4",
    description:
      "A complete walkthrough tutorial on building modern, performant web applications using Next.js, React, Tailwind CSS, and shadcn UI.",
  },
  {
    _id: "4",
    id: "4",
    videotitle: "Relaxing Lo-Fi Beats to Study & Code To",
    videochanel: "Chill Vibes",
    views: 950000,
    createdAt: "2026-08-25T12:00:00.000Z",
    duration: "45:12",
    thumbnailUrl: "/video/snowglobe.jpg",
    videoUrl: "/video/vdo.mp4",
    description:
      "Calm and relaxing lo-fi hip hop music beats for studying, relaxing, sleeping, or coding session.",
  },
]

interface SearchResultProps {
  query?: string
  videos?: SearchVideoItem[]
}

export default function SearchResult({
  query = "",
  videos: propVideos,
}: SearchResultProps) {
  const isMounted = useIsMounted()
  const cleanQuery = (query || "").trim()
  const searchQuery = cleanQuery.toLowerCase()

  const [dbVideos, setDbVideos] = useState<SearchVideoItem[]>([])
  const [hoveredVideoId, setHoveredVideoId] = useState<string | null>(null)

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const { data } = await axiosInstance.get("/video/getallvideos")
        if (Array.isArray(data)) {
          const formatted: SearchVideoItem[] = data.map((v: any) => ({
            _id: v._id,
            id: v._id,
            videotitle: v.videotitle,
            videochanel: v.videochanel || "Channel",
            views: v.views || 0,
            createdAt: v.createdAt || new Date().toISOString(),
            duration: v.duration || "0:30",
            thumbnailUrl: v.thumbnailUrl || "/video/snowglobe.jpg",
            videoUrl: v.videoUrl || v.videofilepath || "/video/vdo.mp4",
            videofilepath: v.videofilepath || v.videoUrl || "/video/vdo.mp4",
            description: v.description || "",
          }))
          setDbVideos(formatted)
        }
      } catch (err) {
        console.error("Failed to fetch videos from database for search:", err)
      }
    }
    fetchVideos()
  }, [])

  // Combine database videos (priority) with sample videos
  const allAvailableVideos = propVideos || [...dbVideos, ...allSampleVideos]

  // Remove duplicates if same ID exists
  const uniqueVideos: SearchVideoItem[] = []
  const seenIds = new Set<string>()
  for (const v of allAvailableVideos) {
    const key = String(v._id || v.id)
    if (!seenIds.has(key)) {
      seenIds.add(key)
      uniqueVideos.push(v)
    }
  }

  const filteredVideos = searchQuery
    ? uniqueVideos.filter((v) => {
        const titleMatch = (v.videotitle || "").toLowerCase().includes(searchQuery)
        const channelMatch = (v.videochanel || "").toLowerCase().includes(searchQuery)
        const descMatch = (v.description || "").toLowerCase().includes(searchQuery)
        return titleMatch || channelMatch || descMatch
      })
    : uniqueVideos

  const hasResults = filteredVideos && filteredVideos.length > 0

  return (
    <div className="max-w-6xl p-4 sm:p-8 space-y-6 mx-auto w-full">
      {/* Search Header */}
      {cleanQuery ? (
        <h1 className="text-xl font-bold text-[var(--foreground)] text-center sm:text-left">
          Search results for &quot;{cleanQuery}&quot;
        </h1>
      ) : (
        <h1 className="text-xl font-bold text-[var(--foreground)] text-center sm:text-left">
          All Videos
        </h1>
      )}

      {!hasResults ? (
        <div className="text-center py-16 text-[var(--muted-foreground)]">
          <h2 className="text-xl font-semibold mb-2 text-[var(--foreground)]">
            No results found
          </h2>
          <p className="text-sm">
            Try different keywords or check spelling
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-6">
            {filteredVideos.map((video) => {
              const videoId = String(video._id || video.id)
              const createdAtText = isMounted
                ? formatRelativeTime(video.createdAt, "less than a minute ago")
                : "less than a minute ago"
              const videoSrc = video.videoUrl || video.videofilepath

              return (
                <Link
                  key={videoId}
                  href={`/watch/${videoId}`}
                  className="group flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-4 cursor-pointer max-w-[440px] sm:max-w-none mx-auto w-full p-2.5 rounded-2xl hover:bg-[var(--muted)] transition-colors border border-[var(--border)] sm:border-transparent"
                  onMouseEnter={() => setHoveredVideoId(videoId)}
                  onMouseLeave={() => setHoveredVideoId(null)}
                >
                  {/* Thumbnail */}
                  <div className="relative w-full max-w-[380px] sm:w-80 md:w-96 aspect-video bg-[var(--muted)] rounded-xl sm:rounded-2xl overflow-hidden shrink-0 shadow-sm">
                    {hoveredVideoId === videoId && videoSrc ? (
                      <video
                        src={videoSrc}
                        poster={video.thumbnailUrl || "/video/snowglobe.jpg"}
                        autoPlay
                        muted
                        loop
                        playsInline
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                    ) : (
                      <img
                        src={video.thumbnailUrl || "/video/snowglobe.jpg"}
                        alt={video.videotitle}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                    )}
                    <div className="absolute bottom-2 right-2 bg-black/80 text-white text-[11px] px-1.5 py-0.5 rounded-md font-semibold">
                      {video.duration || "10:24"}
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="flex-1 min-w-0 py-1 w-full">
                    <h2 className="text-base sm:text-lg font-semibold text-[var(--foreground)] group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2 leading-snug">
                      {video.videotitle}
                    </h2>

                    <p
                      className="text-xs text-[var(--muted-foreground)] mt-1 font-medium"
                      suppressHydrationWarning
                    >
                      {video.views.toLocaleString()} views • {createdAtText}
                    </p>

                    <div className="flex items-center justify-center sm:justify-start gap-2 mt-2 mb-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage
                          src="/placeholder.svg?height=24&width=24"
                          alt={video.videochanel}
                        />
                        <AvatarFallback className="bg-[var(--muted)] text-[var(--foreground)] text-[10px] font-bold">
                          {video.videochanel ? video.videochanel[0] : "Y"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors font-medium">
                        {video.videochanel}
                      </span>
                    </div>

                    <p className="text-xs text-[var(--muted-foreground)] line-clamp-2 leading-relaxed">
                      {video.description ||
                        `Watch ${video.videotitle} on ${video.videochanel}.`}
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>

          <div className="pt-8 text-center text-xs text-neutral-500">
            Showing {filteredVideos.length}{" "}
            {filteredVideos.length === 1 ? "result" : "results"}
            {cleanQuery ? ` for "${cleanQuery}"` : ""}
          </div>
        </>
      )}
    </div>
  )
}

export { SearchResult }
