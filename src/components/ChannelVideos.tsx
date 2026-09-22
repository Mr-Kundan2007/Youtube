import React from "react"
import VideoCard, { VideoItem } from "./videocard"

interface ChannelVideosProps {
  videos?: VideoItem[]
}

export const defaultChannelVideos: VideoItem[] = [
  {
    _id: "1",
    id: "1",
    videotitle: "Amazing Nature Documentary",
    videochanel: "Nature Channel",
    views: 45000,
    createdAt: "2026-09-02T22:30:00.000Z",
    duration: "10:24",
    thumbnailUrl: "/video/snowglobe.jpg",
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
  },
]

export default function ChannelVideos({
  videos = defaultChannelVideos,
}: ChannelVideosProps) {
  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-6">
      <h2 className="text-base sm:text-lg font-bold text-[var(--foreground)] mb-4 text-center sm:text-left">Videos</h2>

      {videos.length === 0 ? (
        <div className="py-12 text-center text-[var(--muted-foreground)]">
          <p className="text-sm">No videos uploaded to this channel yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 place-items-center sm:place-items-stretch justify-center">
          {videos.map((video, index) => (
            <VideoCard key={video._id || video.id || index} video={video} />
          ))}
        </div>
      )}
    </div>
  )
}

export { ChannelVideos }
