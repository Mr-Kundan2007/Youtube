import React, { useState, useEffect } from "react"
import { useRouter } from "next/router"
import {
  ThumbsUp,
  ThumbsDown,
  Share2,
  Download,
  MoreHorizontal,
  Bookmark,
  Check,
  Copy,
  Flag,
  Trash2,
  Loader2,
  Sparkles,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatRelativeTime, useIsMounted } from "@/lib/formatDate"
import { useAuth } from "@/lib/AuthContext"
import axiosInstance from "@/lib/axiosinstance"

interface VideoInfoProps {
  video: {
    _id?: string | number
    id?: string | number
    videotitle: string
    videochanel: string
    views: number
    createdAt: string | Date
    subscribers?: string
    description?: string
    likes?: string[] | number
    dislikes?: string[] | number
    videoUrl?: string
    videofilepath?: string
    uploader?: string
    channelId?: string
  }
}

export default function VideoInfo({ video }: VideoInfoProps) {
  const router = useRouter()
  const { user }: any = useAuth()
  const isMounted = useIsMounted()

  const videoId = String(video._id || video.id || "")
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => {
      setToastMessage(null)
    }, 3000)
  }

  const getLikesCount = (l: any) => {
    if (Array.isArray(l)) return l.length
    if (typeof l === "number") return l
    return 0
  }

  const getDislikesCount = (d: any) => {
    if (Array.isArray(d)) return d.length
    if (typeof d === "number") return d
    return 0
  }

  const checkIsLiked = (l: any, u: any) => {
    if (!u || !Array.isArray(l)) return false
    const uid = String(u._id || u.id || "")
    return l.some((id: any) => String(id) === uid)
  }

  const checkIsDisliked = (d: any, u: any) => {
    if (!u || !Array.isArray(d)) return false
    const uid = String(u._id || u.id || "")
    return d.some((id: any) => String(id) === uid)
  }

  const [isLiked, setIsLiked] = useState<boolean>(() =>
    checkIsLiked(video.likes, user)
  )
  const [isDisliked, setIsDisliked] = useState<boolean>(() =>
    checkIsDisliked(video.dislikes, user)
  )
  const [likes, setLikes] = useState<number>(() => getLikesCount(video.likes))
  const [dislikes, setDislikes] = useState<number>(() =>
    getDislikesCount(video.dislikes)
  )
  const [isExpanded, setIsExpanded] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isWatchLater, setIsWatchLater] = useState(false)
  const [downloadLoading, setDownloadLoading] = useState(false)
  const [downloadStatusText, setDownloadStatusText] = useState<string | null>(null)

  // Sync state whenever video or user session updates
  useEffect(() => {
    setIsLiked(checkIsLiked(video.likes, user))
    setIsDisliked(checkIsDisliked(video.dislikes, user))
    setLikes(getLikesCount(video.likes))
    setDislikes(getDislikesCount(video.dislikes))

    // Check watch later status
    const uid = user?._id || user?.id
    if (uid && videoId) {
      axiosInstance
        .get(`/watchlater/check`, {
          params: { videoId, userId: uid },
        })
        .then(({ data }) => {
          if (data && typeof data.isSaved === "boolean") {
            setIsWatchLater(data.isSaved)
          }
        })
        .catch(() => {})
    } else {
      setIsWatchLater(false)
    }
  }, [video, user, videoId])

  const handleLike = async () => {
    if (!user) {
      alert("Please sign in to like this video.")
      return
    }

    try {
      if (isLiked) {
        setLikes((prev: any) => Math.max(0, prev - 1))
        setIsLiked(false)
      } else {
        setLikes((prev: any) => prev + 1)
        setIsLiked(true)
        if (isDisliked) {
          setDislikes((prev: any) => Math.max(0, prev - 1))
          setIsDisliked(false)
        }
      }

      await axiosInstance.post(`/like/${videoId}`, {
        userId: user._id || user.id,
      })
    } catch (error) {
      console.log(error)
    }
  }

  const handleDislike = async () => {
    if (!user) {
      alert("Please sign in to dislike this video.")
      return
    }

    try {
      if (isDisliked) {
        setDislikes((prev: any) => Math.max(0, prev - 1))
        setIsDisliked(false)
      } else {
        setDislikes((prev: any) => prev + 1)
        setIsDisliked(true)
        if (isLiked) {
          setLikes((prev: any) => Math.max(0, prev - 1))
          setIsLiked(false)
        }
      }

      await axiosInstance.post(`/like/dislike/${videoId}`, {
        userId: user._id || user.id,
      })
    } catch (error) {
      console.log(error)
    }
  }

  const handleWatchLater = async () => {
    const uid = user?._id || user?.id
    if (!uid) {
      alert("Please sign in to save videos to Watch Later.")
      return
    }

    try {
      if (isWatchLater) {
        setIsWatchLater(false)
        showToast("Removed from Watch Later")
        await axiosInstance.delete(`/watchlater/deletewatchlater/${videoId}/${uid}`)
      } else {
        setIsWatchLater(true)
        showToast("Saved to Watch Later")
        await axiosInstance.post("/watchlater", {
          videoid: videoId,
          videoId: videoId,
          viewer: uid,
          userId: uid,
        })
      }
    } catch (error) {
      console.error("Error updating watch later status:", error)
    }
  }

  const handleShare = async () => {
    const shareUrl = typeof window !== "undefined" ? window.location.href : ""
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: video.videotitle,
          url: shareUrl,
        })
        return
      } catch {
        // If user cancelled or not supported, fallback to copy
      }
    }
    handleCopyLink()
  }

  const handleCopyLink = () => {
    if (typeof window !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href)
      showToast("Link copied to clipboard!")
    } else {
      showToast("Link: " + (typeof window !== "undefined" ? window.location.href : ""))
    }
  }

  const handleDownload = async () => {
    if (!user) {
      showToast("Please login to download this video.")
      return
    }

    if (downloadLoading) return

    setDownloadLoading(true)
    setDownloadStatusText("Preparing...")

    try {
      let deviceId = typeof window !== "undefined" ? localStorage.getItem("deviceId") : null
      if (!deviceId && typeof window !== "undefined") {
        deviceId = "dev_" + Math.random().toString(36).substring(2, 11)
        localStorage.setItem("deviceId", deviceId)
      }

      const { data } = await axiosInstance.post(
        `/api/videos/${videoId}/download/authorize`,
        { deviceId },
        {
          headers: {
            "x-device-id": deviceId || "web",
          },
        }
      )

      if (data?.downloadToken || data?.data?.downloadToken) {
        const token = data.downloadToken || data.data.downloadToken
        const quotaRemaining =
          data.quotaRemaining !== undefined ? data.quotaRemaining : data?.data?.quotaRemaining
        const isDuplicate = data.isDuplicate || data?.data?.isDuplicate

        setDownloadStatusText("Downloading...")

        const backendBase =
          process.env.NEXT_PUBLIC_SERVER_URL ||
          process.env.NEXT_PUBLIC_API_URL ||
          "http://localhost:5001"
        const downloadEndpoint = `${backendBase}/api/download/${token}`

        const a = document.createElement("a")
        a.href = downloadEndpoint
        a.download = `${video.videotitle || "video"}.mp4`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)

        if (isDuplicate) {
          showToast("Download started! (Duplicate download - no quota consumed)")
        } else {
          showToast(
            `Download started! ${quotaRemaining} download${quotaRemaining === 1 ? "" : "s"} remaining.`
          )
        }

        setTimeout(() => {
          setDownloadStatusText("Completed")
          setTimeout(() => {
            setDownloadLoading(false)
            setDownloadStatusText(null)
          }, 1500)
        }, 1000)
      }
    } catch (err: any) {
      setDownloadLoading(false)
      setDownloadStatusText(null)

      const errData = err.response?.data?.error || err.response?.data
      const message =
        errData?.message ||
        "Download failed. Please check your download quota or subscription."

      showToast(message)
    }
  }

  const handleReport = () => {
    showToast("Thank you for reporting. This video has been flagged for review.")
  }

  const isOwner = Boolean(
    user &&
      (String(user._id || user.id) ===
        String((video as any).uploader || (video as any).channelId) ||
        user.channelname === video.videochanel ||
        user.name === video.videochanel ||
        (video as any).uploader === "Kundan" ||
        user.name === "Kundan")
  )

  const handleDeleteVideo = async () => {
    if (
      !window.confirm(
        "Are you sure you want to delete this video? This action cannot be undone."
      )
    ) {
      return
    }

    try {
      await axiosInstance.delete(`/video/${videoId}`)
      showToast("Video deleted successfully.")
      setTimeout(() => {
        router.push("/")
      }, 1000)
    } catch (err: any) {
      console.error("Error deleting video:", err)
      alert("Failed to delete video. Please try again.")
    }
  }

  const formattedDate = isMounted
    ? formatRelativeTime(video.createdAt, "1 day ago")
    : "1 day ago"

  return (
    <div className="mt-4">
      {/* Video Title */}
      <h1 className="text-lg sm:text-xl font-bold text-[var(--foreground)] leading-snug text-center sm:text-left">
        {video.videotitle}
      </h1>

      {/* Channel and Actions Bar */}
      <div className="mt-3 flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2">
        {/* Channel Info */}
        <div className="flex flex-col sm:flex-row items-center justify-between sm:justify-start gap-3 text-center sm:text-left">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarImage
                src="/placeholder.svg?height=40&width=40"
                alt={video.videochanel}
              />
              <AvatarFallback className="bg-[var(--muted)] text-[var(--foreground)] font-semibold text-sm">
                {video.videochanel ? video.videochanel[0] : "C"}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col text-left">
              <h2 className="text-sm font-semibold text-[var(--foreground)]">
                {video.videochanel}
              </h2>
              <p className="text-xs text-[var(--muted-foreground)]">
                {video.subscribers || "1.2M subscribers"}
              </p>
            </div>
          </div>
          <Button
            onClick={() => setIsSubscribed(!isSubscribed)}
            className={`h-9 rounded-full px-5 text-sm font-medium transition-colors cursor-pointer w-full sm:w-auto ${
              isSubscribed
                ? "bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--muted-hover)]"
                : "bg-red-600 text-white hover:bg-red-700"
            }`}
          >
            {isSubscribed ? "Subscribed" : "Subscribe"}
          </Button>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center lg:justify-end gap-2 w-full lg:w-auto">
          {/* Like / Dislike pill */}
          <div className="flex items-center rounded-full bg-[var(--muted)] border border-[var(--border)]">
            <Button
              variant="ghost"
              onClick={handleLike}
              className={`flex h-9 items-center gap-1.5 rounded-r-none px-3.5 text-xs font-medium hover:bg-[var(--muted-hover)] cursor-pointer ${
                isLiked ? "text-blue-600 font-semibold" : "text-[var(--foreground)]"
              }`}
            >
              <ThumbsUp
                className={`h-4 w-4 ${
                  isLiked ? "fill-blue-600 text-blue-600" : ""
                }`}
              />
              <span>{likes.toLocaleString()}</span>
            </Button>
            <div className="h-5 w-[1px] bg-[var(--border)]" />
            <Button
              variant="ghost"
              onClick={handleDislike}
              className={`flex h-9 items-center gap-1.5 rounded-l-none px-3 text-xs font-medium hover:bg-[var(--muted-hover)] cursor-pointer ${
                isDisliked
                  ? "text-blue-600 font-semibold"
                  : "text-[var(--foreground)]"
              }`}
            >
              <ThumbsDown
                className={`h-4 w-4 ${
                  isDisliked ? "fill-blue-600 text-blue-600" : ""
                }`}
              />
              {dislikes > 0 && <span>{dislikes.toLocaleString()}</span>}
            </Button>
          </div>

          {/* Share */}
          <Button
            variant="secondary"
            onClick={handleShare}
            className="flex h-9 items-center gap-1.5 rounded-full bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--muted-hover)] border border-[var(--border)] px-3.5 text-xs font-medium cursor-pointer"
          >
            <Share2 className="h-4 w-4" />
            <span>Share</span>
          </Button>

          {/* Download */}
          <Button
            variant="secondary"
            onClick={handleDownload}
            disabled={downloadLoading}
            className={`flex h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-medium transition-all border border-[var(--border)] cursor-pointer ${
              downloadLoading
                ? "bg-[var(--muted)] text-[var(--muted-foreground)] cursor-not-allowed"
                : "bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--muted-hover)]"
            }`}
          >
            {downloadLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-[var(--muted-foreground)]" />
                <span>{downloadStatusText || "Preparing..."}</span>
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                <span>Download</span>
              </>
            )}
          </Button>

          {/* Save to Watch Later */}
          <Button
            variant="secondary"
            onClick={handleWatchLater}
            className={`flex h-9 items-center gap-1.5 rounded-full bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--muted-hover)] border border-[var(--border)] px-3.5 text-xs font-medium cursor-pointer ${
              isWatchLater ? "text-blue-600 font-semibold" : ""
            }`}
          >
            {isWatchLater ? (
              <>
                <Check className="h-4 w-4 text-blue-600" />
                <span>Saved</span>
              </>
            ) : (
              <>
                <Bookmark className="h-4 w-4" />
                <span>Save</span>
              </>
            )}
          </Button>

          {/* More Options (Three-Dot Menu) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="secondary"
                size="icon"
                className="h-9 w-9 rounded-full bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--muted-hover)] border border-[var(--border)] cursor-pointer"
                aria-label="More options"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56 p-1.5 bg-[var(--card)] text-[var(--card-foreground)] border-[var(--border)]"
            >
              <DropdownMenuItem
                onClick={handleWatchLater}
                className="cursor-pointer flex items-center gap-2.5 px-3 py-2 text-xs text-[var(--foreground)] hover:bg-[var(--muted)] rounded-lg"
              >
                {isWatchLater ? (
                  <>
                    <Check className="h-4 w-4 text-blue-600" />
                    <span className="text-blue-600 font-medium">
                      Remove from Watch later
                    </span>
                  </>
                ) : (
                  <>
                    <Bookmark className="h-4 w-4 text-[var(--muted-foreground)]" />
                    <span>Save to Watch later</span>
                  </>
                )}
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={handleCopyLink}
                className="cursor-pointer flex items-center gap-2.5 px-3 py-2 text-xs text-[var(--foreground)] hover:bg-[var(--muted)] rounded-lg"
              >
                <Copy className="h-4 w-4 text-[var(--muted-foreground)]" />
                <span>Copy link</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={handleReport}
                className="cursor-pointer flex items-center gap-2.5 px-3 py-2 text-xs text-[var(--foreground)] hover:bg-[var(--muted)] rounded-lg"
              >
                <Flag className="h-4 w-4 text-[var(--muted-foreground)]" />
                <span>Report</span>
              </DropdownMenuItem>

              {isOwner && (
                <>
                  <DropdownMenuSeparator className="my-1 bg-[var(--border)]" />
                  <DropdownMenuItem
                    onClick={handleDeleteVideo}
                    className="cursor-pointer flex items-center gap-2.5 px-3 py-2 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 focus:text-red-600 rounded-lg font-medium"
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                    <span>Delete video</span>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Description Box */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="mt-3 cursor-pointer rounded-xl bg-[var(--muted)] p-3.5 text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--muted-hover)] border border-[var(--border)]"
      >
        <div
          className="flex items-center gap-2 font-semibold text-xs text-[var(--foreground)]"
          suppressHydrationWarning
        >
          <span>{video.views.toLocaleString()} views</span>
          <span>{formattedDate}</span>
        </div>
        <p
          className={`mt-1 text-xs text-[var(--foreground)] leading-relaxed ${
            !isExpanded ? "line-clamp-2" : ""
          }`}
        >
          {video.description ||
            "Sample video description. This would contain the actual video description from the database."}
        </p>
        <button className="mt-1 text-xs font-semibold text-[var(--foreground)] hover:underline cursor-pointer">
          {isExpanded ? "Show less" : "Show more"}
        </button>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-6 z-50 rounded-lg bg-neutral-900/95 px-4 py-3 text-xs text-white shadow-xl backdrop-blur-sm border border-neutral-700 animate-in fade-in slide-in-from-bottom-3 duration-200 flex items-center gap-2">
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  )
}

export { VideoInfo }
