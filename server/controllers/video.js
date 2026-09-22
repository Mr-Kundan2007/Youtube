import Video from "../Modals/video.js"
import mongoose from "mongoose"
import jwt from "jsonwebtoken"
import { authConfig } from "../config/index.js"
import subscriptionAccessControlService from "../services/subscriptionAccessControlService.js"

// Helper to format video documents consistently for API responses
const defaultSampleVideos = [
  {
    _id: "662a1f8e9c1d2e3f4a5b0001",
    id: "662a1f8e9c1d2e3f4a5b0001",
    videotitle: "Amazing Nature Documentary: Wildlife in 4K",
    videochanel: "Nature Channel",
    channelId: "nature-channel",
    uploader: "Nature Channel",
    description: "Experience the beauty and wonder of nature in this breathtaking documentary. Discover wildlife and untamed landscapes in pristine 4K resolution.",
    views: 45200,
    likes: ["user1", "user2", "user3"],
    dislikes: [],
    like: 1540,
    dislike: 14,
    duration: "10:24",
    category: "Science",
    thumbnailUrl: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=80",
    filepath: "video/bunny.mp4",
    videofilepath: "/video/bunny.mp4",
    videoUrl: "/video/bunny.mp4",
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    _id: "662a1f8e9c1d2e3f4a5b0002",
    id: "662a1f8e9c1d2e3f4a5b0002",
    videotitle: "Cooking Tutorial: The Secret to Perfect Homemade Pasta",
    videochanel: "Chef's Table",
    channelId: "chefs-table",
    uploader: "Chef's Table",
    description: "Learn how to make authentic, restaurant-quality pasta dough from scratch with simple pantry ingredients and step-by-step guidance.",
    views: 31800,
    likes: ["user1"],
    dislikes: [],
    like: 920,
    dislike: 18,
    duration: "08:30",
    category: "Food",
    thumbnailUrl: "https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800&auto=format&fit=crop&q=80",
    filepath: "video/cooking.mp4",
    videofilepath: "/video/cooking.mp4",
    videoUrl: "/video/cooking.mp4",
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    _id: "662a1f8e9c1d2e3f4a5b0003",
    id: "662a1f8e9c1d2e3f4a5b0003",
    videotitle: "Building Full-Stack Applications with Next.js 15 & React",
    videochanel: "Code Craft",
    channelId: "code-craft",
    uploader: "Code Craft",
    description: "A masterclass on modern full-stack development. Learn how to architect responsive apps using Next.js App Router, TypeScript, and Tailwind.",
    views: 154000,
    likes: ["user1", "user2"],
    dislikes: [],
    like: 5400,
    dislike: 45,
    duration: "22:15",
    category: "Technology",
    thumbnailUrl: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&auto=format&fit=crop&q=80",
    filepath: "video/tech.mp4",
    videofilepath: "/video/tech.mp4",
    videoUrl: "/video/tech.mp4",
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    _id: "662a1f8e9c1d2e3f4a5b0004",
    id: "662a1f8e9c1d2e3f4a5b0004",
    videotitle: "Relaxing Lo-Fi Beats: 24/7 Deep Study & Chill Session",
    videochanel: "Chill Vibes",
    channelId: "chill-vibes",
    uploader: "Chill Vibes",
    description: "Smooth, aesthetic lo-fi hip hop beats engineered for deep focus, studying, late-night coding, or winding down after work.",
    views: 890000,
    likes: ["user1", "user2", "user3"],
    dislikes: [],
    like: 42000,
    dislike: 120,
    duration: "45:00",
    category: "Music",
    thumbnailUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&auto=format&fit=crop&q=80",
    filepath: "video/lofi.mp4",
    videofilepath: "/video/lofi.mp4",
    videoUrl: "/video/lofi.mp4",
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    _id: "662a1f8e9c1d2e3f4a5b0005",
    id: "662a1f8e9c1d2e3f4a5b0005",
    videotitle: "Top 10 Epic Esports Clutch Plays & Tournament Highlights",
    videochanel: "Pixel Arena",
    channelId: "pixel-arena",
    uploader: "Pixel Arena",
    description: "Relive the greatest competitive clutch moments, insane reflexes, and game-winning strategies from championship esports tournaments.",
    views: 215000,
    likes: ["user1", "user2"],
    dislikes: [],
    like: 12400,
    dislike: 88,
    duration: "14:20",
    category: "Gaming",
    thumbnailUrl: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&auto=format&fit=crop&q=80",
    filepath: "video/sintel.mp4",
    videofilepath: "/video/sintel.mp4",
    videoUrl: "/video/sintel.mp4",
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    _id: "662a1f8e9c1d2e3f4a5b0006",
    id: "662a1f8e9c1d2e3f4a5b0006",
    videotitle: "Journey to the Edge of the Known Universe: Cosmic Wonders",
    videochanel: "Cosmos Science",
    channelId: "cosmos-science",
    uploader: "Cosmos Science",
    description: "Take a visual journey through black holes, stellar nebulae, and distant galaxies captured by next-generation space telescopes.",
    views: 340000,
    likes: ["user1"],
    dislikes: [],
    like: 18900,
    dislike: 95,
    duration: "19:50",
    category: "Science",
    thumbnailUrl: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop&q=80",
    filepath: "video/jellyfish.mp4",
    videofilepath: "/video/jellyfish.mp4",
    videoUrl: "/video/jellyfish.mp4",
    createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    _id: "662a1f8e9c1d2e3f4a5b0007",
    id: "662a1f8e9c1d2e3f4a5b0007",
    videotitle: "Tokyo Travel Guide: 7 Days Exploring Japan's Neon Capital",
    videochanel: "Nomad Journey",
    channelId: "nomad-journey",
    uploader: "Nomad Journey",
    description: "The ultimate 7-day Tokyo itinerary covering historic temples in Asakusa, vibrant Shibuya crossings, and local ramen street food alleys.",
    views: 98400,
    likes: ["user1"],
    dislikes: [],
    like: 4700,
    dislike: 32,
    duration: "16:40",
    category: "Travel",
    thumbnailUrl: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=800&auto=format&fit=crop&q=80",
    filepath: "video/travel.mp4",
    videofilepath: "/video/travel.mp4",
    videoUrl: "/video/travel.mp4",
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    _id: "662a1f8e9c1d2e3f4a5b0008",
    id: "662a1f8e9c1d2e3f4a5b0008",
    videotitle: "Stand-Up Comedy Highlights: Laugh Out Loud Special",
    videochanel: "Comedy Spotlight",
    channelId: "comedy-spotlight",
    uploader: "Comedy Spotlight",
    description: "A laugh-a-minute stand-up set poking fun at airport security, modern dating apps, and the challenges of remote working.",
    views: 76000,
    likes: ["user1"],
    dislikes: [],
    like: 3900,
    dislike: 41,
    duration: "11:15",
    category: "Comedy",
    thumbnailUrl: "https://images.unsplash.com/photo-1514306191717-452ec28c7814?w=800&auto=format&fit=crop&q=80",
    filepath: "video/comedy.mp4",
    videofilepath: "/video/comedy.mp4",
    videoUrl: "/video/comedy.mp4",
    createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    _id: "662a1f8e9c1d2e3f4a5b0009",
    id: "662a1f8e9c1d2e3f4a5b0009",
    videotitle: "Full Body HIIT Workout: 20-Minute High-Energy Routine",
    videochanel: "Pulse Fitness",
    channelId: "pulse-fitness",
    uploader: "Pulse Fitness",
    description: "No equipment needed! Follow along with this high-intensity interval training routine designed to build stamina and burn calories fast.",
    views: 112000,
    likes: ["user1"],
    dislikes: [],
    like: 6800,
    dislike: 54,
    duration: "20:00",
    category: "Sports",
    thumbnailUrl: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800&auto=format&fit=crop&q=80",
    filepath: "video/fitness.mp4",
    videofilepath: "/video/fitness.mp4",
    videoUrl: "/video/fitness.mp4",
    createdAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    _id: "662a1f8e9c1d2e3f4a5b0010",
    id: "662a1f8e9c1d2e3f4a5b0010",
    videotitle: "The Future of Artificial Intelligence & Humanoid Robotics",
    videochanel: "Future Tech Hub",
    channelId: "future-tech-hub",
    uploader: "Future Tech Hub",
    description: "Discover how next-generation multimodal neural networks and advanced humanoid robotics are changing industries worldwide.",
    views: 420000,
    likes: ["user1", "user2"],
    dislikes: [],
    like: 21000,
    dislike: 115,
    duration: "17:30",
    category: "Technology",
    thumbnailUrl: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800&auto=format&fit=crop&q=80",
    filepath: "video/robotics.mp4",
    videofilepath: "/video/robotics.mp4",
    videoUrl: "/video/robotics.mp4",
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
  }
]

const formatVideoDoc = (doc) => {
  if (!doc) return null
  const obj = typeof doc.toObject === "function" ? doc.toObject() : { ...doc }

  // Clean relative filepath (e.g. "uploads/filename.mp4" or "video/vdo.mp4")
  let cleanFilepath = obj.filepath || obj.videofilepath || obj.videoUrl || "video/vdo.mp4"
  if (cleanFilepath.startsWith("/")) {
    cleanFilepath = cleanFilepath.slice(1)
  }
  obj.filepath = cleanFilepath

  // Normalized leading-slash path (e.g. "/uploads/filename.mp4")
  const slashPath = `/${cleanFilepath}`
  if (!obj.videofilepath) obj.videofilepath = slashPath
  if (!obj.videoUrl) obj.videoUrl = slashPath

  if (!obj.likes) obj.likes = []
  if (!obj.dislikes) obj.dislikes = []
  if (typeof obj.like !== "number") {
    obj.like = Array.isArray(obj.likes) ? obj.likes.length : 0
  }
  if (typeof obj.dislike !== "number") {
    obj.dislike = Array.isArray(obj.dislikes) ? obj.dislikes.length : 0
  }

  return obj
}

// Upload a video
export const uploadVideo = async (req, res) => {
  if (req.file === undefined && !req.body.videotitle && !req.body.title) {
    return res.status(404).json({ message: "Please upload an MP4 video file or provide video details" })
  }

  try {
    const file = req.file
    const {
      videotitle,
      title,
      videochanel,
      chanel,
      channelId,
      uploader,
      description,
      duration,
      thumbnailUrl,
      videoUrl,
      filepath,
    } = req.body

    const cleanFilepath = file
      ? `uploads/${file.filename}`
      : filepath
      ? (filepath.startsWith("/") ? filepath.slice(1) : filepath)
      : videoUrl
      ? (videoUrl.startsWith("/") ? videoUrl.slice(1) : videoUrl)
      : "video/vdo.mp4"

    const slashPath = `/${cleanFilepath}`

    const newVideo = new Video({
      videotitle: videotitle || title || file?.originalname || "Untitled Video",
      filename: file?.filename || file?.originalname || "video.mp4",
      filepath: cleanFilepath,
      videofilepath: slashPath,
      videoUrl: slashPath,
      filetype: file?.mimetype || "video/mp4",
      filesize: file ? String(file.size) : "0",
      videochanel: videochanel || chanel || "Channel",
      channelId: channelId || uploader || "",
      uploader: uploader || channelId || videochanel || "",
      thumbnailUrl: thumbnailUrl || "/video/snowglobe.jpg",
      description: description || "",
      duration: duration || "10:24",
    })

    await newVideo.save()
    res.status(200).json(formatVideoDoc(newVideo))
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
}

// Get all videos (with optional channelId / uploader / search filter)
export const getAllVideos = async (req, res) => {
  try {
    const { channelId, uploader, q, search } = req.query
    let query = {}
    const searchTerm = (q || search || "").trim()

    if (searchTerm) {
      const regex = new RegExp(searchTerm, "i")
      query = {
        $or: [
          { videotitle: regex },
          { videochanel: regex },
          { description: regex },
        ],
      }
    } else if (channelId) {
      query = {
        $or: [
          { channelId },
          { uploader: channelId },
          { videochanel: new RegExp(`^${channelId}$`, "i") },
        ],
      }
    } else if (uploader) {
      query = { uploader }
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(200).json(defaultSampleVideos)
    }

    const files = await Video.find(query).sort({ createdAt: -1 }).limit(10)
    const formatted = files.length > 0 ? files.map(formatVideoDoc) : []
    const merged = [...formatted]
    if (merged.length < 10) {
      defaultSampleVideos.forEach((sample) => {
        if (merged.length < 10 && !merged.some((m) => String(m._id || m.id) === String(sample._id || sample.id))) {
          merged.push(sample)
        }
      })
    }
    res.status(200).json(merged.slice(0, 10))
  } catch (error) {
    res.status(200).json(defaultSampleVideos.slice(0, 10))
  }
}

// Get videos by Channel ID
export const getVideosByChannel = async (req, res) => {
  const { channelId } = req.params
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(200).json(defaultSampleVideos)
    }
    const videos = await Video.find({
      $or: [
        { channelId },
        { uploader: channelId },
        { videochanel: new RegExp(`^${channelId}$`, "i") },
      ],
    }).sort({ createdAt: -1 })

    const formatted = videos.length > 0 ? videos.map(formatVideoDoc) : defaultSampleVideos
    res.status(200).json(formatted)
  } catch (error) {
    res.status(200).json(defaultSampleVideos)
  }
}

// Get video by ID
export const getVideoById = async (req, res) => {
  const { id: _id } = req.params
  const sampleMatch = defaultSampleVideos.find(
    (s) => String(s._id || s.id) === String(_id)
  )

  if (!mongoose.Types.ObjectId.isValid(_id)) {
    return res.status(200).json(sampleMatch || defaultSampleVideos[0])
  }
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(200).json(sampleMatch || defaultSampleVideos[0])
    }
    const video = await Video.findById(_id)
    if (!video) return res.status(200).json(sampleMatch || defaultSampleVideos[0])

    // Check subscription access permissions if content is restricted/premium
    let userId = req.user?.id || req.user?._id || null
    if (!userId && req.headers.authorization?.startsWith("Bearer ")) {
      try {
        const token = req.headers.authorization.split(" ")[1]
        const decoded = jwt.verify(token, authConfig.jwtSecret)
        userId = decoded.id || decoded._id
      } catch (e) {}
    }

    const check = await subscriptionAccessControlService.canWatchVideo(userId, video)
    if (!check.allowed) {
      return res.status(check.code === "AUTHENTICATION_REQUIRED" ? 401 : 403).json({
        success: false,
        code: check.code || "SUBSCRIPTION_REQUIRED",
        message: check.message || "Subscription required to view this content",
        requiredPlan: check.requiredPlan,
        currentPlan: check.currentPlan,
        upgradeAvailable: true,
      })
    }

    res.status(200).json(formatVideoDoc(video))
  } catch (error) {
    res.status(200).json(defaultSampleVideos[0])
  }
}

// Like video
export const likeVideo = async (req, res) => {
  const { id: _id } = req.params
  const { userId } = req.body

  if (!mongoose.Types.ObjectId.isValid(_id)) {
    return res.status(404).json({ message: "Video unavailable..." })
  }

  try {
    const video = await Video.findById(_id)
    if (!video) return res.status(404).json({ message: "Video not found" })

    const likeIndex = video.likes.findIndex((id) => id === String(userId))
    if (likeIndex === -1) {
      video.likes.push(String(userId))
      video.dislikes = video.dislikes.filter((id) => id !== String(userId))
    } else {
      video.likes = video.likes.filter((id) => id !== String(userId))
    }

    const updatedVideo = await Video.findByIdAndUpdate(_id, video, { new: true })
    res.status(200).json(updatedVideo)
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
}

// Dislike video
export const dislikeVideo = async (req, res) => {
  const { id: _id } = req.params
  const { userId } = req.body

  if (!mongoose.Types.ObjectId.isValid(_id)) {
    return res.status(404).json({ message: "Video unavailable..." })
  }

  try {
    const video = await Video.findById(_id)
    if (!video) return res.status(404).json({ message: "Video not found" })

    const uid = String(userId)
    const dislikeIndex = video.dislikes.findIndex((id) => id === uid)
    if (dislikeIndex === -1) {
      video.dislikes.push(uid)
      video.likes = video.likes.filter((id) => id !== uid)
    } else {
      video.dislikes = video.dislikes.filter((id) => id !== uid)
    }

    const updatedVideo = await Video.findByIdAndUpdate(_id, video, { new: true })
    res.status(200).json(updatedVideo)
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
}

// Increment view count
export const viewVideo = async (req, res) => {
  const { id: _id } = req.params
  if (!mongoose.Types.ObjectId.isValid(_id)) {
    return res.status(404).json({ message: "Video unavailable..." })
  }
  try {
    const video = await Video.findByIdAndUpdate(
      _id,
      { $inc: { views: 1 } },
      { new: true }
    )
    res.status(200).json(video)
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
}

// Delete video
export const deleteVideo = async (req, res) => {
  const { id: _id } = req.params
  if (!mongoose.Types.ObjectId.isValid(_id)) {
    return res.status(404).json({ message: "Invalid video ID" })
  }
  try {
    const video = await Video.findByIdAndDelete(_id)
    if (!video) return res.status(404).json({ message: "Video not found" })
    res.status(200).json({ message: "Video deleted successfully", id: _id })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}
