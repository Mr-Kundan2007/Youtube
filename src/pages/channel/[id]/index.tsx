import React, { useState, useEffect } from "react"
import { useRouter } from "next/router"
import Head from "next/head"
import ChannelHeader, { ChannelInfo } from "@/components/ChannelHeader"
import Channeltabs from "@/components/Channeltabs"
import VideoUploader from "@/components/VideoUploader"
import ChannelVideos, { defaultChannelVideos } from "@/components/ChannelVideos"
import DownloadsContent from "@/components/DownloadsContent"

import { useAuth } from "@/lib/AuthContext"
import axiosInstance from "@/lib/axiosinstance"

export default function ChannelPage() {
  const router = useRouter()
  const { id } = router.query
  const { user }: any = useAuth()

  const [videos, setVideos] = useState(defaultChannelVideos)
  const channelId = Array.isArray(id) ? id[0] : id || "1"
  const [channelData, setChannelData] = useState<any>(null)
  const [activeTab, setActiveTab] = useState("Videos")

  useEffect(() => {
    if (!channelId) return

    // If channel is the currently logged in user
    if (user && (user._id === channelId || user.id === channelId)) {
      setChannelData(user)
      return
    }

    // If channel is default "1" and user is logged in
    if (channelId === "1" && user) {
      setChannelData(user)
      return
    }

    // Otherwise fetch from backend API
    const fetchChannel = async () => {
      try {
        const { data } = await axiosInstance.get(`/user/channel/${channelId}`)
        if (data) setChannelData(data)
      } catch (err) {
        if (user) setChannelData(user)
      }
    }
    fetchChannel()
  }, [channelId, user])

  const channel: ChannelInfo = {
    id: channelId,
    name:
      channelData?.channelname ||
      channelData?.name ||
      user?.channelname ||
      user?.name ||
      "Tech Channel",
    handle: `@${(
      channelData?.channelname ||
      channelData?.name ||
      user?.channelname ||
      user?.name ||
      "techchannel"
    )
      .toLowerCase()
      .replace(/\s+/g, "")}`,
    description:
      channelData?.desc ||
      channelData?.description ||
      user?.desc ||
      user?.description ||
      "Welcome to our tech channel! We cover the latest in technology, reviews, and tutorials.",
  }

  // Fetch videos from database for this channel
  useEffect(() => {
    const fetchChannelVideos = async () => {
      try {
        const { data } = await axiosInstance.get(`/video/getallvideos`)
        if (Array.isArray(data) && data.length > 0) {
          const matching = data.filter((v: any) => {
            if (v.channelId === channelId || v.uploader === channelId) return true
            if (user && (v.channelId === user._id || v.uploader === user._id)) return true
            if (
              channel.name &&
              v.videochanel &&
              v.videochanel.toLowerCase() === channel.name.toLowerCase()
            )
              return true
            return false
          })

          if (matching.length > 0) {
            setVideos(matching)
          } else {
            // Include uploaded database videos or fall back to defaults
            setVideos(data.length > 0 ? data : defaultChannelVideos)
          }
        }
      } catch (err) {
        console.error("Error fetching channel videos:", err)
      }
    }
    fetchChannelVideos()
  }, [channelId, user, channel.name])

  const handleUploadSuccess = (newVideo: any) => {
    setVideos((prev) => [
      newVideo,
      ...prev.filter(
        (v) => (v._id || v.id) !== (newVideo._id || newVideo.id)
      ),
    ])
  }

  return (
    <>
      <Head>
        <title>{`${channel.name} - YouTube`}</title>
      </Head>
      <div className="flex-1 min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        <div className="max-w-full mx-auto">
          <ChannelHeader channel={channel} />
          <Channeltabs activeTab={activeTab} onTabChange={setActiveTab} />

          {activeTab === "Downloads" ? (
            <div className="py-4">
              <DownloadsContent />
            </div>
          ) : (
            <>
              <div className="px-3 sm:px-8 py-4 sm:py-6 max-w-4xl mx-auto">
                <VideoUploader
                  channelId={channelId}
                  channelName={channel.name}
                  onUploadSuccess={handleUploadSuccess}
                />
              </div>
              <div className="px-3 sm:px-8 pb-12">
                <ChannelVideos videos={videos} />
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
