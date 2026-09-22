import React, { useState, useEffect, useMemo, useCallback } from "react"
import { useRouter } from "next/router"
import type { GetServerSideProps } from "next"
import Head from "next/head"
import VideoPlayer from "@/components/Videoplayer"
import VideoInfo from "@/components/VideoInfo"
import Comments from "@/components/Comments"
import RelatedVideos from "@/components/RelatedVideos"
import axiosInstance from "@/lib/axiosinstance"
import { useHistory } from "@/context/HistoryContext"

export const sampleVideos = [
  {
    _id: "662a1f8e9c1d2e3f4a5b0001",
    id: "662a1f8e9c1d2e3f4a5b0001",
    videotitle: "Amazing Nature Documentary: Wildlife in 4K",
    videochanel: "Nature Channel",
    channelId: "nature-channel",
    uploader: "Nature Channel",
    subscribers: "850K subscribers",
    views: 45200,
    like: 1540,
    dislike: 14,
    likes: ["u1"],
    dislikes: [],
    duration: "10:24",
    category: "Science",
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    thumbnailUrl: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=80",
    filepath: "video/bunny.mp4",
    videoUrl: "/video/bunny.mp4",
    videofilepath: "/video/bunny.mp4",
    description:
      "Experience the beauty and wonder of nature in this breathtaking documentary. Discover wildlife and untamed landscapes in pristine 4K resolution.",
  },
  {
    _id: "662a1f8e9c1d2e3f4a5b0002",
    id: "662a1f8e9c1d2e3f4a5b0002",
    videotitle: "Cooking Tutorial: The Secret to Perfect Homemade Pasta",
    videochanel: "Chef's Table",
    channelId: "chefs-table",
    uploader: "Chef's Table",
    subscribers: "1.2M subscribers",
    views: 31800,
    like: 920,
    dislike: 18,
    likes: [],
    dislikes: [],
    duration: "08:30",
    category: "Food",
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    thumbnailUrl: "https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800&auto=format&fit=crop&q=80",
    filepath: "video/cooking.mp4",
    videoUrl: "/video/cooking.mp4",
    videofilepath: "/video/cooking.mp4",
    description:
      "Learn how to make authentic, restaurant-quality pasta dough from scratch with simple pantry ingredients and step-by-step guidance.",
  },
  {
    _id: "662a1f8e9c1d2e3f4a5b0003",
    id: "662a1f8e9c1d2e3f4a5b0003",
    videotitle: "Building Full-Stack Applications with Next.js 15 & React",
    videochanel: "Code Craft",
    channelId: "code-craft",
    uploader: "Code Craft",
    subscribers: "340K subscribers",
    views: 154000,
    like: 5400,
    dislike: 45,
    likes: [],
    dislikes: [],
    duration: "22:15",
    category: "Technology",
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    thumbnailUrl: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&auto=format&fit=crop&q=80",
    filepath: "video/tech.mp4",
    videoUrl: "/video/tech.mp4",
    videofilepath: "/video/tech.mp4",
    description:
      "A masterclass on modern full-stack development. Learn how to architect responsive apps using Next.js App Router, TypeScript, and Tailwind.",
  },
  {
    _id: "662a1f8e9c1d2e3f4a5b0004",
    id: "662a1f8e9c1d2e3f4a5b0004",
    videotitle: "Relaxing Lo-Fi Beats: 24/7 Deep Study & Chill Session",
    videochanel: "Chill Vibes",
    channelId: "chill-vibes",
    uploader: "Chill Vibes",
    subscribers: "2.1M subscribers",
    views: 890000,
    like: 42000,
    dislike: 120,
    likes: [],
    dislikes: [],
    duration: "45:00",
    category: "Music",
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    thumbnailUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&auto=format&fit=crop&q=80",
    filepath: "video/lofi.mp4",
    videoUrl: "/video/lofi.mp4",
    videofilepath: "/video/lofi.mp4",
    description:
      "Smooth, aesthetic lo-fi hip hop beats engineered for deep focus, studying, late-night coding, or winding down after work.",
  },
  {
    _id: "662a1f8e9c1d2e3f4a5b0005",
    id: "662a1f8e9c1d2e3f4a5b0005",
    videotitle: "Top 10 Epic Esports Clutch Plays & Tournament Highlights",
    videochanel: "Pixel Arena",
    channelId: "pixel-arena",
    uploader: "Pixel Arena",
    subscribers: "520K subscribers",
    views: 215000,
    like: 12400,
    dislike: 88,
    likes: [],
    dislikes: [],
    duration: "14:20",
    category: "Gaming",
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    thumbnailUrl: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&auto=format&fit=crop&q=80",
    filepath: "video/sintel.mp4",
    videoUrl: "/video/sintel.mp4",
    videofilepath: "/video/sintel.mp4",
    description:
      "Relive the greatest competitive clutch moments, insane reflexes, and game-winning strategies from championship esports tournaments.",
  },
  {
    _id: "662a1f8e9c1d2e3f4a5b0006",
    id: "662a1f8e9c1d2e3f4a5b0006",
    videotitle: "Journey to the Edge of the Known Universe: Cosmic Wonders",
    videochanel: "Cosmos Science",
    channelId: "cosmos-science",
    uploader: "Cosmos Science",
    subscribers: "980K subscribers",
    views: 340000,
    like: 18900,
    dislike: 95,
    likes: [],
    dislikes: [],
    duration: "19:50",
    category: "Science",
    createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    thumbnailUrl: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop&q=80",
    filepath: "video/jellyfish.mp4",
    videoUrl: "/video/jellyfish.mp4",
    videofilepath: "/video/jellyfish.mp4",
    description:
      "Take a visual journey through black holes, stellar nebulae, and distant galaxies captured by next-generation space telescopes.",
  },
  {
    _id: "662a1f8e9c1d2e3f4a5b0007",
    id: "662a1f8e9c1d2e3f4a5b0007",
    videotitle: "Tokyo Travel Guide: 7 Days Exploring Japan's Neon Capital",
    videochanel: "Nomad Journey",
    channelId: "nomad-journey",
    uploader: "Nomad Journey",
    subscribers: "410K subscribers",
    views: 98400,
    like: 4700,
    dislike: 32,
    likes: [],
    dislikes: [],
    duration: "16:40",
    category: "Travel",
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    thumbnailUrl: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=800&auto=format&fit=crop&q=80",
    filepath: "video/travel.mp4",
    videoUrl: "/video/travel.mp4",
    videofilepath: "/video/travel.mp4",
    description:
      "The ultimate 7-day Tokyo itinerary covering historic temples in Asakusa, vibrant Shibuya crossings, and local ramen street food alleys.",
  },
  {
    _id: "662a1f8e9c1d2e3f4a5b0008",
    id: "662a1f8e9c1d2e3f4a5b0008",
    videotitle: "Stand-Up Comedy Highlights: Laugh Out Loud Special",
    videochanel: "Comedy Spotlight",
    channelId: "comedy-spotlight",
    uploader: "Comedy Spotlight",
    subscribers: "670K subscribers",
    views: 76000,
    like: 3900,
    dislike: 41,
    likes: [],
    dislikes: [],
    duration: "11:15",
    category: "Comedy",
    createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    thumbnailUrl: "https://images.unsplash.com/photo-1514306191717-452ec28c7814?w=800&auto=format&fit=crop&q=80",
    filepath: "video/comedy.mp4",
    videoUrl: "/video/comedy.mp4",
    videofilepath: "/video/comedy.mp4",
    description:
      "A laugh-a-minute stand-up set poking fun at airport security, modern dating apps, and the challenges of remote working.",
  },
  {
    _id: "662a1f8e9c1d2e3f4a5b0009",
    id: "662a1f8e9c1d2e3f4a5b0009",
    videotitle: "Full Body HIIT Workout: 20-Minute High-Energy Routine",
    videochanel: "Pulse Fitness",
    channelId: "pulse-fitness",
    uploader: "Pulse Fitness",
    subscribers: "780K subscribers",
    views: 112000,
    like: 6800,
    dislike: 54,
    likes: [],
    dislikes: [],
    duration: "20:00",
    category: "Sports",
    createdAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
    thumbnailUrl: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800&auto=format&fit=crop&q=80",
    filepath: "video/fitness.mp4",
    videoUrl: "/video/fitness.mp4",
    videofilepath: "/video/fitness.mp4",
    description:
      "No equipment needed! Follow along with this high-intensity interval training routine designed to build stamina and burn calories fast.",
  },
  {
    _id: "662a1f8e9c1d2e3f4a5b0010",
    id: "662a1f8e9c1d2e3f4a5b0010",
    videotitle: "The Future of Artificial Intelligence & Humanoid Robotics",
    videochanel: "Future Tech Hub",
    channelId: "future-tech-hub",
    uploader: "Future Tech Hub",
    subscribers: "1.5M subscribers",
    views: 420000,
    like: 21000,
    dislike: 115,
    likes: [],
    dislikes: [],
    duration: "17:30",
    category: "Technology",
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    thumbnailUrl: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800&auto=format&fit=crop&q=80",
    filepath: "video/robotics.mp4",
    videoUrl: "/video/robotics.mp4",
    videofilepath: "/video/robotics.mp4",
    description:
      "Discover how next-generation multimodal neural networks and advanced humanoid robotics are changing industries worldwide.",
  },
]

interface WatchPageProps {
  initialId?: string
}

export const getServerSideProps: GetServerSideProps<WatchPageProps> = async (context) => {
  const { id } = context.params || {}
  const initialId = Array.isArray(id) ? id[0] : id || ""
  return {
    props: {
      initialId,
    },
  }
}

export default function WatchPage({ initialId }: WatchPageProps) {
  const router = useRouter()
  const routerQueryId = router.query.id
    ? Array.isArray(router.query.id)
      ? router.query.id[0]
      : router.query.id
    : null

  const resolvedInitialId =
    routerQueryId || initialId || (sampleVideos[0]?._id ? String(sampleVideos[0]._id) : "")
  const [activeId, setActiveId] = useState<string>(resolvedInitialId)
  const { addToHistory } = useHistory()

  const [videos, setVideos] = useState<any[]>(sampleVideos)
  const [loading, setLoading] = useState(false)

  // Keep activeId in sync if the URL changes through browser navigation (back/forward)
  useEffect(() => {
    if (routerQueryId && routerQueryId !== activeId) {
      setActiveId(routerQueryId)
    }
  }, [routerQueryId])

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const { data } = await axiosInstance.get("/video/getallvideos")
        if (Array.isArray(data) && data.length > 0) {
          const merged = [...data]
          sampleVideos.forEach((s) => {
            if (!merged.some((m) => String(m._id || m.id) === String(s._id || s.id))) {
              merged.push(s)
            }
          })
          setVideos(merged)
        } else {
          setVideos(sampleVideos)
        }
      } catch (err) {
        console.error("Error fetching videos:", err)
        setVideos(sampleVideos)
      } finally {
        setLoading(false)
      }
    }

    fetchVideos()
  }, [])

  // If a specific video isn't found in current list, fetch by ID directly
  useEffect(() => {
    if (!activeId) return
    const stringId = activeId
    const found = videos.some((v) => String(v._id || v.id) === String(stringId))

    if (!found && !loading) {
      axiosInstance
        .get(`/video/${stringId}`)
        .then(({ data }) => {
          if (data && data._id) {
            setVideos((prev) => [data, ...prev])
          }
        })
        .catch(() => {})
    }
  }, [activeId, videos, loading])

  const video = useMemo(() => {
    return videos.find((v: any) => String(v._id || v.id) === String(activeId)) || videos[0]
  }, [activeId, videos])

  const currentVideoId = String(video?._id || video?.id || activeId || "")

  const handleVideoSelect = useCallback(
    (targetVideo: any) => {
      const nextId = String(targetVideo?._id || targetVideo?.id || "")
      if (!nextId) return
      setActiveId(nextId)
      router.push(`/watch/${nextId}`, undefined, { shallow: true })
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" })
      }
    },
    [router]
  )

  // Record history & view count
  useEffect(() => {
    if (video) {
      addToHistory(video)
      if (video._id && String(video._id).length >= 12) {
        axiosInstance.patch(`/video/views/${video._id}`).catch(() => {})
      }
    }
  }, [video?._id])

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center text-[var(--muted-foreground)] font-medium text-sm">
        Loading...
      </div>
    )
  }

  if (!video) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center text-[var(--muted-foreground)] font-medium text-sm">
        Video not found
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>{`${video?.videotitle || "Watch"} - YouTube`}</title>
      </Head>
      <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        <div className="max-w-7xl mx-auto p-2 sm:p-4 md:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <VideoPlayer
                key={currentVideoId}
                video={video}
                playlist={videos}
                autoPlay={true}
                autoplayNext={true}
                autoplayCountdown={10}
                onVideoChange={handleVideoSelect}
              />
              <VideoInfo video={video} />

              <Comments videoId={currentVideoId} />
            </div>
            <div className="space-y-4">
              <RelatedVideos
                videos={videos}
                currentVideoId={currentVideoId}
                onSelectVideo={handleVideoSelect}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
