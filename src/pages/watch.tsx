import React, { useState } from "react"
import { useRouter } from "next/router"
import {
  ThumbsUp,
  ThumbsDown,
  Share2,
  Download,
  MoreHorizontal,
  Bookmark,
  Send,
  Copy,
  Flag,
  Check,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { defaultVideos } from "@/components/Videogrid"
import VideoCard from "@/components/videocard"
import { CustomVideoPlayer } from "@/components/player"

export default function WatchPage() {
  const router = useRouter()
  const { v } = router.query
  const queryV = typeof v === "string" ? v : Array.isArray(v) ? v[0] : ""
  const [activeV, setActiveV] = useState<string>(queryV || String(defaultVideos[0]?.id || ""))

  React.useEffect(() => {
    if (queryV && queryV !== activeV) {
      setActiveV(queryV)
    }
  }, [queryV])

  const video = defaultVideos.find((item) => String(item.id) === String(activeV)) || defaultVideos[0]

  const [commentText, setCommentText] = useState("")
  const [comments, setComments] = useState([
    {
      author: "Alex Rivera",
      avatar: "A",
      text: "The cinematography in this video is absolutely stunning! Great work.",
      time: "2 hours ago",
      likes: 142,
    },
    {
      author: "Sarah Chen",
      avatar: "S",
      text: "I loved the step-by-step breakdown. Really helped me understand the process.",
      time: "5 hours ago",
      likes: 89,
    },
  ])

  const [liked, setLiked] = useState(false)
  const [likesCount, setLikesCount] = useState(3400)
  const [saved, setSaved] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  const handleLike = () => {
    if (liked) {
      setLikesCount((prev) => prev - 1)
      setLiked(false)
    } else {
      setLikesCount((prev) => prev + 1)
      setLiked(true)
    }
  }

  const handleShare = () => {
    if (typeof window !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href)
      showToast("Link copied to clipboard!")
    }
  }

  const handleDownload = () => {
    showToast("Starting download...")
  }

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault()
    if (!commentText.trim()) return
    setComments([
      {
        author: "Kundan Kumar",
        avatar: "K",
        text: commentText,
        time: "Just now",
        likes: 0,
      },
      ...comments,
    ])
    setCommentText("")
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 p-6 max-w-[1700px] mx-auto bg-white">
      {/* Left Column: Video Player & Info */}
      <div className="flex-1 min-w-0">
        {/* Main Video Box with Custom HTML5 Player */}
        <CustomVideoPlayer
          key={String(video?.id || video?._id || activeV || "watch")}
          video={video}
          playlist={defaultVideos}
          autoPlay={true}
          autoplayNext={true}
          autoplayCountdown={10}
          onVideoChange={(next) => {
            const nextId = next._id || next.id
            if (nextId) {
              setActiveV(String(nextId))
              router.push(`/watch?v=${nextId}`, undefined, { shallow: true })
              if (typeof window !== "undefined") {
                window.scrollTo({ top: 0, behavior: "smooth" })
              }
            }
          }}
        />


        {/* Video Title */}
        <h1 className="text-xl font-bold text-neutral-900 mt-4 leading-tight">
          {video.videotitle}
        </h1>

        {/* Channel Info & Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4 mt-3 pb-4 border-b border-neutral-200">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src="/placeholder.svg?height=40&width=40" />
              <AvatarFallback className="bg-neutral-800 text-white font-bold">
                {video.videochanel ? video.videochanel[0] : "Y"}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="font-semibold text-neutral-900 text-sm">{video.videochanel}</h2>
              <p className="text-xs text-neutral-500">1.24M subscribers</p>
            </div>
            <Button className="rounded-full bg-neutral-900 text-white hover:bg-neutral-800 text-sm px-4 ml-2">
              Subscribe
            </Button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center rounded-full bg-neutral-100 overflow-hidden">
              <Button
                variant="ghost"
                onClick={handleLike}
                className={`flex items-center gap-2 px-4 py-2 h-9 rounded-r-none hover:bg-neutral-200 ${
                  liked ? "text-blue-600 font-semibold" : "text-neutral-800"
                }`}
              >
                <ThumbsUp className="w-4 h-4" />
                <span className="text-xs">{likesCount.toLocaleString()}</span>
              </Button>
              <div className="h-5 w-[1px] bg-neutral-300" />
              <Button
                variant="ghost"
                className="px-3 py-2 h-9 rounded-l-none hover:bg-neutral-200 text-neutral-800"
              >
                <ThumbsDown className="w-4 h-4" />
              </Button>
            </div>

            <Button
              variant="secondary"
              onClick={handleShare}
              className="rounded-full bg-neutral-100 hover:bg-neutral-200 text-xs h-9 px-4 flex items-center gap-2 text-neutral-800 cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              Share
            </Button>

            <Button
              variant="secondary"
              onClick={handleDownload}
              className="rounded-full bg-neutral-100 hover:bg-neutral-200 text-xs h-9 px-4 flex items-center gap-2 text-neutral-800 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Download
            </Button>

            <Button
              variant="secondary"
              onClick={() => {
                setSaved(!saved)
                showToast(saved ? "Removed from Watch Later" : "Saved to Watch Later")
              }}
              className={`rounded-full bg-neutral-100 hover:bg-neutral-200 text-xs h-9 px-4 flex items-center gap-2 cursor-pointer ${
                saved ? "text-blue-600 font-semibold" : "text-neutral-800"
              }`}
            >
              {saved ? <Check className="w-4 h-4 text-blue-600" /> : <Bookmark className="w-4 h-4" />}
              {saved ? "Saved" : "Save"}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-9 w-9 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-800 cursor-pointer"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 rounded-xl p-1.5 shadow-xl bg-white border border-neutral-200">
                <DropdownMenuItem onClick={handleShare} className="cursor-pointer flex items-center gap-2 px-3 py-2 text-xs">
                  <Share2 className="w-4 h-4" />
                  <span>Share</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDownload} className="cursor-pointer flex items-center gap-2 px-3 py-2 text-xs">
                  <Download className="w-4 h-4" />
                  <span>Download</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setSaved(!saved)
                    showToast(saved ? "Removed from Watch Later" : "Saved to Watch Later")
                  }}
                  className="cursor-pointer flex items-center gap-2 px-3 py-2 text-xs"
                >
                  {saved ? <Check className="w-4 h-4 text-blue-600" /> : <Bookmark className="w-4 h-4" />}
                  <span>{saved ? "Remove from Watch later" : "Save to Watch later"}</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleShare} className="cursor-pointer flex items-center gap-2 px-3 py-2 text-xs">
                  <Copy className="w-4 h-4" />
                  <span>Copy link</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => showToast("Thank you for reporting.")} className="cursor-pointer flex items-center gap-2 px-3 py-2 text-xs">
                  <Flag className="w-4 h-4" />
                  <span>Report</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {toastMessage && (
          <div className="fixed bottom-6 left-6 z-50 rounded-lg bg-neutral-900 px-4 py-2.5 text-xs text-white shadow-lg">
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Video Description Box */}
        <div className="bg-neutral-100 rounded-xl p-4 mt-4 text-sm text-neutral-800">
          <div className="flex items-center gap-2 font-medium mb-1">
            <span>{video.views.toLocaleString()} views</span>
            <span>•</span>
            <span>Premiered recently</span>
          </div>
          <p className="whitespace-pre-line text-neutral-700 leading-relaxed">
            Welcome to this featured video! In this session, we explore amazing landscapes and capture the beauty of the season.
            Don&apos;t forget to like, comment, and subscribe for weekly uploads.
          </p>
        </div>

        {/* Comments Section */}
        <div className="mt-6">
          <h3 className="text-lg font-bold mb-4">{comments.length} Comments</h3>

          {/* Add comment form */}
          <form onSubmit={handleAddComment} className="flex gap-3 mb-6">
            <Avatar className="w-10 h-10">
              <AvatarFallback className="bg-purple-600 text-white text-sm">K</AvatarFallback>
            </Avatar>
            <div className="flex-1 flex gap-2">
              <Input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 border-0 border-b border-neutral-300 rounded-none focus-visible:ring-0 focus-visible:border-neutral-900 px-0"
              />
              <Button type="submit" size="sm" className="rounded-full bg-neutral-900 text-white">
                <Send className="w-4 h-4 mr-1" /> Comment
              </Button>
            </div>
          </form>

          {/* Comments List */}
          <div className="space-y-4">
            {comments.map((comment, index) => (
              <div key={index} className="flex gap-3">
                <Avatar className="w-9 h-9">
                  <AvatarFallback className="bg-neutral-200 text-neutral-700 text-xs font-semibold">
                    {comment.avatar}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold">{comment.author}</span>
                    <span className="text-xs text-neutral-500">{comment.time}</span>
                  </div>
                  <p className="text-sm text-neutral-800 mt-1">{comment.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Column: Recommendations */}
      <div className="w-full lg:w-[380px] xl:w-[420px] shrink-0 space-y-4">
        <h3 className="font-bold text-base text-neutral-900 mb-2">Related Videos</h3>
        {defaultVideos
          .filter((item) => String(item.id || item._id) !== String(video.id || video._id))
          .map((item, idx) => (
            <VideoCard key={item.id || idx} video={item} />
          ))}
      </div>
    </div>
  )
}
