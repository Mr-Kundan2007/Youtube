import React, { useState, useEffect } from "react"
import VideoCard, { VideoItem } from "./videocard"
import axiosInstance from "@/lib/axiosinstance"

interface VideoGridProps {
  videos?: VideoItem[]
  category?: string
}

export const defaultVideos: any[] = [
  {
    id: "662a1f8e9c1d2e3f4a5b0001",
    _id: "662a1f8e9c1d2e3f4a5b0001",
    videotitle: "Amazing Nature Documentary: Wildlife in 4K",
    videochanel: "Nature Channel",
    channelId: "nature-channel",
    uploader: "Nature Channel",
    views: 45200,
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    duration: "10:24",
    category: "Science",
    thumbnailUrl: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=80",
    filepath: "video/bunny.mp4",
    videoUrl: "/video/bunny.mp4",
    videofilepath: "/video/bunny.mp4",
  },
  {
    id: "662a1f8e9c1d2e3f4a5b0002",
    _id: "662a1f8e9c1d2e3f4a5b0002",
    videotitle: "Cooking Tutorial: The Secret to Perfect Homemade Pasta",
    videochanel: "Chef's Table",
    channelId: "chefs-table",
    uploader: "Chef's Table",
    views: 31800,
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    duration: "08:30",
    category: "Food",
    thumbnailUrl: "https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800&auto=format&fit=crop&q=80",
    filepath: "video/cooking.mp4",
    videoUrl: "/video/cooking.mp4",
    videofilepath: "/video/cooking.mp4",
  },
  {
    id: "662a1f8e9c1d2e3f4a5b0003",
    _id: "662a1f8e9c1d2e3f4a5b0003",
    videotitle: "Building Full-Stack Applications with Next.js 15 & React",
    videochanel: "Code Craft",
    channelId: "code-craft",
    uploader: "Code Craft",
    views: 154000,
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    duration: "22:15",
    category: "Technology",
    thumbnailUrl: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&auto=format&fit=crop&q=80",
    filepath: "video/tech.mp4",
    videoUrl: "/video/tech.mp4",
    videofilepath: "/video/tech.mp4",
  },
  {
    id: "662a1f8e9c1d2e3f4a5b0004",
    _id: "662a1f8e9c1d2e3f4a5b0004",
    videotitle: "Relaxing Lo-Fi Beats: 24/7 Deep Study & Chill Session",
    videochanel: "Chill Vibes",
    channelId: "chill-vibes",
    uploader: "Chill Vibes",
    views: 890000,
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    duration: "45:00",
    category: "Music",
    thumbnailUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&auto=format&fit=crop&q=80",
    filepath: "video/lofi.mp4",
    videoUrl: "/video/lofi.mp4",
    videofilepath: "/video/lofi.mp4",
  },
  {
    id: "662a1f8e9c1d2e3f4a5b0005",
    _id: "662a1f8e9c1d2e3f4a5b0005",
    videotitle: "Top 10 Epic Esports Clutch Plays & Tournament Highlights",
    videochanel: "Pixel Arena",
    channelId: "pixel-arena",
    uploader: "Pixel Arena",
    views: 215000,
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    duration: "14:20",
    category: "Gaming",
    thumbnailUrl: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&auto=format&fit=crop&q=80",
    filepath: "video/sintel.mp4",
    videoUrl: "/video/sintel.mp4",
    videofilepath: "/video/sintel.mp4",
  },
  {
    id: "662a1f8e9c1d2e3f4a5b0006",
    _id: "662a1f8e9c1d2e3f4a5b0006",
    videotitle: "Journey to the Edge of the Known Universe: Cosmic Wonders",
    videochanel: "Cosmos Science",
    channelId: "cosmos-science",
    uploader: "Cosmos Science",
    views: 340000,
    createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    duration: "19:50",
    category: "Science",
    thumbnailUrl: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop&q=80",
    filepath: "video/jellyfish.mp4",
    videoUrl: "/video/jellyfish.mp4",
    videofilepath: "/video/jellyfish.mp4",
  },
  {
    id: "662a1f8e9c1d2e3f4a5b0007",
    _id: "662a1f8e9c1d2e3f4a5b0007",
    videotitle: "Tokyo Travel Guide: 7 Days Exploring Japan's Neon Capital",
    videochanel: "Nomad Journey",
    channelId: "nomad-journey",
    uploader: "Nomad Journey",
    views: 98400,
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    duration: "16:40",
    category: "Travel",
    thumbnailUrl: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=800&auto=format&fit=crop&q=80",
    filepath: "video/travel.mp4",
    videoUrl: "/video/travel.mp4",
    videofilepath: "/video/travel.mp4",
  },
  {
    id: "662a1f8e9c1d2e3f4a5b0008",
    _id: "662a1f8e9c1d2e3f4a5b0008",
    videotitle: "Stand-Up Comedy Highlights: Laugh Out Loud Special",
    videochanel: "Comedy Spotlight",
    channelId: "comedy-spotlight",
    uploader: "Comedy Spotlight",
    views: 76000,
    createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    duration: "11:15",
    category: "Comedy",
    thumbnailUrl: "https://images.unsplash.com/photo-1514306191717-452ec28c7814?w=800&auto=format&fit=crop&q=80",
    filepath: "video/comedy.mp4",
    videoUrl: "/video/comedy.mp4",
    videofilepath: "/video/comedy.mp4",
  },
  {
    id: "662a1f8e9c1d2e3f4a5b0009",
    _id: "662a1f8e9c1d2e3f4a5b0009",
    videotitle: "Full Body HIIT Workout: 20-Minute High-Energy Routine",
    videochanel: "Pulse Fitness",
    channelId: "pulse-fitness",
    uploader: "Pulse Fitness",
    views: 112000,
    createdAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
    duration: "20:00",
    category: "Sports",
    thumbnailUrl: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800&auto=format&fit=crop&q=80",
    filepath: "video/fitness.mp4",
    videoUrl: "/video/fitness.mp4",
    videofilepath: "/video/fitness.mp4",
  },
  {
    id: "662a1f8e9c1d2e3f4a5b0010",
    _id: "662a1f8e9c1d2e3f4a5b0010",
    videotitle: "The Future of Artificial Intelligence & Humanoid Robotics",
    videochanel: "Future Tech Hub",
    channelId: "future-tech-hub",
    uploader: "Future Tech Hub",
    views: 420000,
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    duration: "17:30",
    category: "Technology",
    thumbnailUrl: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800&auto=format&fit=crop&q=80",
    filepath: "video/robotics.mp4",
    videoUrl: "/video/robotics.mp4",
    videofilepath: "/video/robotics.mp4",
  },
]

export default function VideoGrid({ videos: propVideos, category }: VideoGridProps) {
  const [displayVideos, setDisplayVideos] = useState<any[]>(propVideos || defaultVideos)

  useEffect(() => {
    if (propVideos && propVideos.length > 0) {
      setDisplayVideos(propVideos)
      return
    }

    const fetchDatabaseVideos = async () => {
      try {
        const { data } = await axiosInstance.get("/video/getallvideos")
        if (Array.isArray(data) && data.length > 0) {
          const formattedDbVideos = data.map((v: any) => ({
            _id: v._id,
            id: v._id,
            videotitle: v.videotitle,
            videochanel: v.videochanel || "Channel",
            views: v.views || 0,
            createdAt: v.createdAt || new Date().toISOString(),
            duration: v.duration || "10:24",
            thumbnailUrl: v.thumbnailUrl || "/video/snowglobe.jpg",
            filepath: v.filepath || v.videofilepath || v.videoUrl || "video/vdo.mp4",
            videoUrl: v.videoUrl || v.videofilepath || "/video/vdo.mp4",
            videofilepath: v.videofilepath || v.videoUrl || "/video/vdo.mp4",
            description: v.description || "",
          }))

          // Merge: Put database videos at the top, then default sample videos
          const existingIds = new Set(formattedDbVideos.map((v) => String(v._id || v.id)))
          const filteredDefaults = defaultVideos.filter(
            (v) => !existingIds.has(String(v._id || v.id))
          )
          const all = [...formattedDbVideos, ...filteredDefaults]
          setDisplayVideos(all.slice(0, 10))
        }
      } catch (err) {
        console.error("Error fetching videos from database:", err)
      }
    }

    fetchDatabaseVideos()
  }, [propVideos])

  const filteredVideos = React.useMemo(() => {
    if (!category || category === "All" || category.toLowerCase() === "trending") {
      return displayVideos.slice(0, 10)
    }
    const catLower = category.toLowerCase()
    const matched = displayVideos.filter((v) => {
      const title = (v.videotitle || "").toLowerCase()
      const desc = (v.description || "").toLowerCase()
      const channel = (v.videochanel || v.videochannel || "").toLowerCase()
      const vidCategory = (v.category || "").toLowerCase()
      return (
        vidCategory === catLower ||
        title.includes(catLower) ||
        desc.includes(catLower) ||
        channel.includes(catLower)
      )
    })
    return matched.length > 0 ? matched.slice(0, 10) : displayVideos.slice(0, 10)
  }, [displayVideos, category])

  return (
    <div className="p-3 sm:p-6 w-full max-w-7xl mx-auto">
      <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 place-items-center sm:place-items-stretch justify-center">
        {filteredVideos.map((video, index) => (
          <VideoCard key={video._id || video.id || index} video={video} />
        ))}
      </div>
    </div>
  )
}

export { VideoGrid }
