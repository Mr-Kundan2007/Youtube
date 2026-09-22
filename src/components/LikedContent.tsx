import React, { useState, useEffect } from "react"
import Link from "next/link"
import { Play, MoreVertical, X } from "lucide-react"
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

export interface LikedVideoRecord {
  _id: string
  videoId: string
  videoid?: string
  viewer?: string
  likedon: string | Date
  video: {
    _id: string
    videotitle: string
    videochanel: string
    views: number
    createdAt: string | Date
    thumbnailUrl?: string
    videoUrl?: string
    filepath?: string
  }
}

export type LikedVideoItem = LikedVideoRecord

export const initialLikedData: LikedVideoRecord[] = [
  {
    _id: "lv1",
    videoId: "1",
    likedon: "2026-08-31T12:00:00.000Z",
    video: {
      _id: "1",
      videotitle: "Cooking Tutorial: Perfect Pasta",
      videochanel: "Chef's Kitchen",
      views: 23000,
      createdAt: "2026-09-01T12:00:00.000Z",
      thumbnailUrl: "/video/snowglobe.jpg",
      videoUrl: "/video/vdo.mp4",
    },
  },
  {
    _id: "lv2",
    videoId: "2",
    likedon: "2026-08-31T12:00:00.000Z",
    video: {
      _id: "2",
      videotitle: "Amazing Nature Documentary",
      videochanel: "Nature Channel",
      views: 23000,
      createdAt: "2026-09-01T12:00:00.000Z",
      thumbnailUrl: "/video/snowglobe.jpg",
      videoUrl: "/video/vdo.mp4",
    },
  },
]

export default function LikedContent() {
  const { user }: any = useAuth()
  const isMounted = useIsMounted()
  const [likedVideos, setLikedVideos] = useState<LikedVideoRecord[]>(initialLikedData)

  useEffect(() => {
    const fetchLiked = async () => {
      if (!user) return
      const uid = String(user._id || user.id || "")
      try {
        const { data } = await axiosInstance.get(`/like/user/${uid}`)
        if (Array.isArray(data) && data.length > 0) {
          const formatted: LikedVideoRecord[] = data.map((v: any) => ({
            _id: `liked_${v._id}`,
            videoId: String(v._id),
            viewer: uid,
            likedon: v.updatedAt || v.createdAt || new Date().toISOString(),
            video: {
              _id: String(v._id),
              videotitle: v.videotitle,
              videochanel: v.videochanel || "Channel",
              views: v.views || 0,
              createdAt: v.createdAt || new Date().toISOString(),
              thumbnailUrl: v.thumbnailUrl || "/video/snowglobe.jpg",
              videoUrl: v.videoUrl || v.videofilepath || "/video/vdo.mp4",
            },
          }))
          setLikedVideos(formatted)
        } else {
          // If no videos liked yet in database, show empty or initial list
          const allRes = await axiosInstance.get("/video/getallvideos")
          if (Array.isArray(allRes.data)) {
            const userLiked = allRes.data.filter(
              (v: any) =>
                Array.isArray(v.likes) && v.likes.some((id: any) => String(id) === uid)
            )
            if (userLiked.length > 0) {
              const formatted: LikedVideoRecord[] = userLiked.map((v: any) => ({
                _id: `liked_${v._id}`,
                videoId: String(v._id),
                viewer: uid,
                likedon: v.updatedAt || v.createdAt || new Date().toISOString(),
                video: {
                  _id: String(v._id),
                  videotitle: v.videotitle,
                  videochanel: v.videochanel || "Channel",
                  views: v.views || 0,
                  createdAt: v.createdAt || new Date().toISOString(),
                  thumbnailUrl: v.thumbnailUrl || "/video/snowglobe.jpg",
                  videoUrl: v.videoUrl || v.videofilepath || "/video/vdo.mp4",
                },
              }))
              setLikedVideos(formatted)
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch liked videos:", err)
      }
    }
    fetchLiked()
  }, [user])

  const handleUnlikeVideo = async (videoId: string, likedVideoId: string) => {
    setLikedVideos((prev) => prev.filter((item) => item._id !== likedVideoId))
    if (user && videoId) {
      try {
        await axiosInstance.post(`/like/${videoId}`, {
          userId: user._id || user.id,
        })
      } catch (err) {
        console.error("Failed to unlike video:", err)
      }
    }
  }

  return (
    <div className="max-w-5xl p-4 sm:p-8 mx-auto w-full">
      {/* Header and Play All Button */}
      <div className="mb-6 flex flex-col sm:flex-row items-center justify-between text-center sm:text-left gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)] tracking-tight">
            Liked videos
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            {likedVideos.length} {likedVideos.length === 1 ? "video" : "videos"}
          </p>
        </div>

        {likedVideos.length > 0 && (
          <Button asChild className="flex items-center gap-2 rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 cursor-pointer shadow-sm mx-auto sm:mx-0">
            <Link href={`/watch/${likedVideos[0].video._id}`}>
              <Play className="h-4 w-4 fill-white" />
              <span>Play all</span>
            </Link>
          </Button>
        )}
      </div>

      {likedVideos.length === 0 ? (
        <div className="py-16 text-center text-[var(--muted-foreground)]">
          <p className="text-base font-medium text-[var(--foreground)]">No liked videos yet.</p>
          <p className="text-sm mt-1">Videos you like will be added here.</p>
          <Button asChild className="rounded-full bg-red-600 text-white hover:bg-red-700 px-6 cursor-pointer mt-4">
            <Link href="/">
              Discover Videos
            </Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {likedVideos.map((item) => {
            const videoId = item.video._id
            const createdAtText = isMounted
              ? formatRelativeTime(item.video.createdAt, "1 day ago")
              : "1 day ago"
            const likedOnText = isMounted
              ? `Liked ${formatRelativeTime(item.likedon, "2 days ago")}`
              : "Liked 2 days ago"

            return (
              <div
                key={item._id}
                className="group flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left justify-between gap-4 rounded-xl p-3 hover:bg-[var(--muted)] transition-colors max-w-[440px] sm:max-w-none mx-auto w-full border border-[var(--border)] sm:border-transparent"
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
                      {likedOnText}
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
                        onClick={() => handleUnlikeVideo(videoId, item._id)}
                        className="cursor-pointer text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2"
                      >
                        <X className="h-4 w-4" />
                        <span>Remove from Liked videos</span>
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

export { LikedContent }
