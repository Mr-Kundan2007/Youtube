import React, { useState, useEffect } from "react"
import Link from "next/link"
import { Play, MoreVertical, X, Clock, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatRelativeTime, useIsMounted } from "@/lib/formatDate"
import { useAuth } from "@/lib/AuthContext"
import axiosInstance from "@/lib/axiosinstance"

export interface WatchLaterRecord {
  _id: string
  videoId: string
  viewer?: string
  addedon: string | Date
  video: {
    _id: string
    videotitle: string
    videochanel: string
    views: number
    createdAt: string | Date
    thumbnailUrl?: string
    videoUrl?: string
  }
}

export default function WatchLaterContent() {
  const { user }: any = useAuth()
  const isMounted = useIsMounted()
  const [watchLaterVideos, setWatchLaterVideos] = useState<WatchLaterRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch Watch Later records from database (GET request)
  useEffect(() => {
    const fetchWatchLater = async () => {
      setLoading(true)
      const uid = user ? String(user._id || user.id || "") : ""
      try {
        const { data } = await axiosInstance.get("/watchlater/getallwatchlater", {
          params: uid ? { userId: uid } : {},
        })

        if (Array.isArray(data)) {
          const formatted: WatchLaterRecord[] = data.map((item: any) => ({
            _id: String(item._id),
            videoId: String(item.videoId || item.videoid || item.video?._id),
            viewer: item.viewer || item.userId || uid,
            addedon: item.addedon || item.savedon || item.createdAt || new Date(),
            video: {
              _id: String(item.video?._id || item.videoId || item.videoid),
              videotitle: item.video?.videotitle || "Video",
              videochanel: item.video?.videochanel || "Channel",
              views: Number(item.video?.views || 0),
              createdAt: item.video?.createdAt || item.createdAt || new Date(),
              thumbnailUrl: item.video?.thumbnailUrl || "/video/snowglobe.jpg",
              videoUrl:
                item.video?.videoUrl ||
                item.video?.videofilepath ||
                "/video/vdo.mp4",
            },
          }))
          setWatchLaterVideos(formatted)
        } else {
          setWatchLaterVideos([])
        }
      } catch (error) {
        console.error("Error fetching watch later videos:", error)
        setWatchLaterVideos([])
      } finally {
        setLoading(false)
      }
    }

    fetchWatchLater()
  }, [user])

  const handleRemoveWatchLater = async (recordId: string, videoId: string) => {
    const uid = user ? String(user._id || user.id || "") : ""
    // Optimistic UI update
    setWatchLaterVideos((prev) => prev.filter((item) => item._id !== recordId))

    try {
      if (recordId && !recordId.startsWith("wl")) {
        await axiosInstance.delete(`/watchlater/${recordId}`)
      } else if (videoId && uid) {
        await axiosInstance.delete(`/watchlater/deletewatchlater/${videoId}/${uid}`)
      }
    } catch (error) {
      console.error("Error removing from watch later:", error)
    }
  }

  return (
    <div className="max-w-5xl p-4 sm:p-8 mx-auto w-full">
      {/* Header with Title, Count and Play All button */}
      <div className="mb-6 flex flex-col sm:flex-row items-center justify-between text-center sm:text-left gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)] tracking-tight flex items-center justify-center sm:justify-start gap-2">
            <Clock className="h-6 w-6 text-red-600" />
            <span>Watch later</span>
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            {loading
              ? "Loading saved videos..."
              : `${watchLaterVideos.length} ${
                  watchLaterVideos.length === 1 ? "video" : "videos"
                }`}
          </p>
        </div>

        {!loading && watchLaterVideos.length > 0 && (
          <Button asChild className="flex items-center gap-2 rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 cursor-pointer shadow-sm mx-auto sm:mx-0">
            <Link href={`/watch/${watchLaterVideos[0].video._id}`}>
              <Play className="h-4 w-4 fill-white" />
              <span>Play all</span>
            </Link>
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-[var(--muted-foreground)]">
          <Loader2 className="h-8 w-8 animate-spin text-red-600 mb-3" />
          <p className="text-sm">Loading your watch later list...</p>
        </div>
      ) : watchLaterVideos.length === 0 ? (
        <div className="py-16 text-center text-[var(--muted-foreground)] border border-dashed border-[var(--border)] rounded-2xl p-8 bg-[var(--muted)]/40 max-w-md mx-auto">
          <Clock className="h-12 w-12 text-[var(--muted-foreground)] mx-auto mb-3 opacity-60" />
          <p className="text-base font-semibold text-[var(--foreground)]">
            No videos saved to watch later.
          </p>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Click the "Save" button on any video to add it to your Watch Later list.
          </p>
          <Button asChild className="rounded-full bg-red-600 text-white hover:bg-red-700 px-6 cursor-pointer mt-4">
            <Link href="/">
              Browse Videos
            </Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {watchLaterVideos.map((item) => {
            const videoId = item.video._id
            const createdAtText = isMounted
              ? formatRelativeTime(item.video.createdAt, "less than a minute ago")
              : "less than a minute ago"
            const addedOnText = isMounted
              ? `Added ${formatRelativeTime(item.addedon, "less than a minute ago")}`
              : "Added recently"

            return (
              <div
                key={item._id}
                className="group flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left justify-between gap-4 rounded-xl p-3 hover:bg-[var(--muted)] transition-colors border border-[var(--border)] sm:border-transparent max-w-[440px] sm:max-w-none mx-auto w-full"
              >
                {/* Thumbnail & Video Info */}
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 flex-1 min-w-0 w-full">
                  <Link
                    href={`/watch/${videoId}`}
                    className="relative w-full max-w-[380px] sm:w-60 aspect-video rounded-xl overflow-hidden bg-[var(--muted)] shrink-0 cursor-pointer shadow-sm"
                  >
                    <img
                      src={item.video.thumbnailUrl || "/video/snowglobe.jpg"}
                      alt={item.video.videotitle}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  </Link>

                  <div className="flex-1 min-w-0 py-1 w-full">
                    <Link href={`/watch/${videoId}`}>
                      <h3 className="text-base font-semibold text-[var(--foreground)] group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2 leading-snug cursor-pointer">
                        {item.video.videotitle}
                      </h3>
                    </Link>

                    <p className="text-xs text-[var(--muted-foreground)] mt-1.5 font-medium">
                      {item.video.videochanel}
                    </p>

                    <p
                      className="text-xs text-[var(--muted-foreground)] mt-0.5"
                      suppressHydrationWarning
                    >
                      {item.video.views.toLocaleString()} views • {createdAtText}
                    </p>

                    <p
                      className="text-[11px] text-[var(--muted-foreground)]/80 mt-1 font-mono"
                      suppressHydrationWarning
                    >
                      {addedOnText}
                    </p>
                  </div>
                </div>

                {/* Dropdown Menu */}
                <div className="self-center sm:self-start shrink-0">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted-hover)]"
                        aria-label="Options"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 bg-[var(--card)] text-[var(--card-foreground)] border-[var(--border)]">
                      <DropdownMenuItem
                        onClick={() => handleRemoveWatchLater(item._id, videoId)}
                        className="cursor-pointer text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2"
                      >
                        <X className="h-4 w-4" />
                        <span>Remove from Watch later</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export { WatchLaterContent }
