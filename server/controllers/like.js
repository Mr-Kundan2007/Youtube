import Video from "../Modals/video.js"
import mongoose from "mongoose"

// Like / Unlike video
export const likeVideo = async (req, res) => {
  const { id: _id } = req.params
  const { userId } = req.body

  if (!mongoose.Types.ObjectId.isValid(_id)) {
    return res.status(404).json({ message: "Video unavailable..." })
  }

  if (!userId) {
    return res.status(400).json({ message: "User ID is required to like video" })
  }

  try {
    const video = await Video.findById(_id)
    if (!video) return res.status(404).json({ message: "Video not found" })

    const uid = String(userId)
    const likeIndex = video.likes.findIndex((id) => String(id) === uid)

    if (likeIndex === -1) {
      video.likes.push(uid)
      video.dislikes = video.dislikes.filter((id) => String(id) !== uid)
    } else {
      video.likes = video.likes.filter((id) => String(id) !== uid)
    }

    const updatedVideo = await Video.findByIdAndUpdate(_id, video, { new: true })
    res.status(200).json(updatedVideo)
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
}

// Dislike / Un-dislike video
export const dislikeVideo = async (req, res) => {
  const { id: _id } = req.params
  const { userId } = req.body

  if (!mongoose.Types.ObjectId.isValid(_id)) {
    return res.status(404).json({ message: "Video unavailable..." })
  }

  if (!userId) {
    return res.status(400).json({ message: "User ID is required to dislike video" })
  }

  try {
    const video = await Video.findById(_id)
    if (!video) return res.status(404).json({ message: "Video not found" })

    const uid = String(userId)
    const dislikeIndex = video.dislikes.findIndex((id) => String(id) === uid)

    if (dislikeIndex === -1) {
      video.dislikes.push(uid)
      video.likes = video.likes.filter((id) => String(id) !== uid)
    } else {
      video.dislikes = video.dislikes.filter((id) => String(id) !== uid)
    }

    const updatedVideo = await Video.findByIdAndUpdate(_id, video, { new: true })
    res.status(200).json(updatedVideo)
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
}

// Get all liked videos for a specific user
export const getAllLikedVideos = async (req, res) => {
  const { userId } = req.params
  try {
    const uid = String(userId)
    const videos = await Video.find({ likes: uid }).sort({ updatedAt: -1 })
    const formatted = videos.map((doc) => {
      const obj = doc.toObject()
      if (!obj.videoUrl && obj.videofilepath) obj.videoUrl = obj.videofilepath
      if (!obj.videofilepath && obj.videoUrl) obj.videofilepath = obj.videoUrl
      return obj
    })
    res.status(200).json(formatted)
  } catch (error) {
    res.status(404).json({ message: error.message })
  }
}
