import mongoose from "mongoose"
import dotenv from "dotenv"
dotenv.config({ path: "../.env.local" })
if (!process.env.DB_URL) {
  dotenv.config({ path: ".env.local" })
}

import Video from "../Modals/video.js"

export const curated10Videos = [
  {
    _id: new mongoose.Types.ObjectId("662a1f8e9c1d2e3f4a5b0001"),
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
    is_downloadable: true,
    plan_tier: "free",
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  },
  {
    _id: new mongoose.Types.ObjectId("662a1f8e9c1d2e3f4a5b0002"),
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
    is_downloadable: true,
    plan_tier: "free",
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  },
  {
    _id: new mongoose.Types.ObjectId("662a1f8e9c1d2e3f4a5b0003"),
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
    is_downloadable: true,
    plan_tier: "free",
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
  },
  {
    _id: new mongoose.Types.ObjectId("662a1f8e9c1d2e3f4a5b0004"),
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
    is_downloadable: true,
    plan_tier: "free",
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
  },
  {
    _id: new mongoose.Types.ObjectId("662a1f8e9c1d2e3f4a5b0005"),
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
    is_downloadable: true,
    plan_tier: "free",
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
  },
  {
    _id: new mongoose.Types.ObjectId("662a1f8e9c1d2e3f4a5b0006"),
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
    is_downloadable: true,
    plan_tier: "free",
    createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
  },
  {
    _id: new mongoose.Types.ObjectId("662a1f8e9c1d2e3f4a5b0007"),
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
    is_downloadable: true,
    plan_tier: "free",
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  },
  {
    _id: new mongoose.Types.ObjectId("662a1f8e9c1d2e3f4a5b0008"),
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
    is_downloadable: true,
    plan_tier: "free",
    createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
  },
  {
    _id: new mongoose.Types.ObjectId("662a1f8e9c1d2e3f4a5b0009"),
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
    is_downloadable: true,
    plan_tier: "free",
    createdAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
  },
  {
    _id: new mongoose.Types.ObjectId("662a1f8e9c1d2e3f4a5b0010"),
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
    is_downloadable: true,
    plan_tier: "free",
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
  },
]

async function cleanAndSeed() {
  const dbUrl = process.env.DB_URL
  if (!dbUrl) {
    console.error("DB_URL not defined")
    process.exit(1)
  }
  await mongoose.connect(dbUrl)
  console.log("Connected to MongoDB for video cleanup and seeding...")

  // Delete all duplicate and test videos
  const deleteResult = await Video.deleteMany({})
  console.log(`Removed ${deleteResult.deletedCount} old/duplicate videos from database.`)

  // Insert exactly the 10 curated videos
  const inserted = await Video.insertMany(curated10Videos)
  console.log(`Successfully seeded ${inserted.length} distinct, working videos into MongoDB!`)

  const count = await Video.countDocuments()
  console.log(`Total videos now in DB: ${count}`)

  await mongoose.disconnect()
  console.log("Database connection closed cleanly.")
}

if (process.argv[1] && process.argv[1].endsWith("cleanAndSeedVideos.js")) {
  cleanAndSeed().catch((err) => {
    console.error("Clean and seed error:", err)
    process.exit(1)
  })
}
