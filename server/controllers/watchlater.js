import WatchLater from "../Modals/watchlater.js"
import Video from "../Modals/video.js"
import mongoose from "mongoose"

// Add to Watch Later
export const watchLaterController = async (req, res) => {
  const watchLaterData = req.body
  const videoid = watchLaterData.videoid || watchLaterData.videoId
  const viewer = watchLaterData.viewer || watchLaterData.userId

  if (!videoid || !viewer) {
    return res.status(400).json({ message: "Video ID and Viewer ID are required" })
  }

  try {
    // Check if already in Watch Later
    const existing = await WatchLater.findOne({
      $and: [
        { $or: [{ videoid }, { videoId: videoid }] },
        { $or: [{ viewer }, { userId: viewer }] },
      ],
    })

    if (existing) {
      return res.status(200).json({
        message: "Already in Watch Later",
        saved: true,
        data: existing,
      })
    }

    const newWatchLater = new WatchLater({
      videoid,
      videoId: videoid,
      viewer,
      userId: viewer,
      savedon: new Date(),
    })

    await newWatchLater.save()
    res.status(200).json({
      message: "Added to Watch Later",
      saved: true,
      data: newWatchLater,
    })
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
}

// Alias to support different naming conventions
export const watchLater = watchLaterController

// Get All Watch Later videos (GET request)
export const getAllWatchLater = async (req, res) => {
  try {
    const uid =
      req.params.userId ||
      req.params.viewer ||
      req.query.userId ||
      req.query.viewer ||
      ""

    let query = {}
    if (uid) {
      query = {
        $or: [{ viewer: uid }, { userId: uid }],
      }
    }

    const files = await WatchLater.find(query).sort({ createdAt: -1 })

    // Populate video details for each watch later entry
    const videoIds = files
      .map((item) => item.videoid || item.videoId)
      .filter((id) => mongoose.Types.ObjectId.isValid(id))

    const videos = await Video.find({ _id: { $in: videoIds } })
    const videoMap = new Map(videos.map((v) => [String(v._id), v]))

    const formatted = files.map((item) => {
      const vid = item.videoid || item.videoId
      const videoDoc = videoMap.get(String(vid))
      return {
        _id: item._id,
        videoId: vid,
        videoid: vid,
        viewer: item.viewer || item.userId,
        userId: item.viewer || item.userId,
        addedon: item.savedon || item.createdAt || new Date(),
        createdAt: item.createdAt || new Date(),
        video: videoDoc
          ? {
              _id: videoDoc._id,
              videotitle: videoDoc.videotitle,
              videochanel: videoDoc.videochanel,
              views: videoDoc.views || 0,
              createdAt: videoDoc.createdAt,
              thumbnailUrl: videoDoc.thumbnailUrl || "/video/snowglobe.jpg",
              videoUrl:
                videoDoc.videoUrl ||
                videoDoc.videofilepath ||
                "/video/vdo.mp4",
              description: videoDoc.description || "",
              duration: videoDoc.duration || "0:30",
            }
          : {
              _id: vid,
              videotitle: "Video",
              videochanel: "Channel",
              views: 0,
              createdAt: item.createdAt || new Date(),
              thumbnailUrl: "/video/snowglobe.jpg",
              videoUrl: "/video/vdo.mp4",
            },
      }
    })

    res.status(200).json(formatted)
  } catch (error) {
    res.status(404).json({ message: error.message })
  }
}

// Alias for get request
export const getAllWatchLaterController = getAllWatchLater

// Delete from Watch Later
export const deleteWatchLater = async (req, res) => {
  const { id, videoid, videoId, viewer, userId } = {
    ...req.query,
    ...req.body,
    ...req.params,
  }

  try {
    if (id && mongoose.Types.ObjectId.isValid(id)) {
      await WatchLater.findByIdAndDelete(id)
      return res.status(200).json({ message: "Removed from Watch Later" })
    }

    const vid = videoid || videoId
    const uid = viewer || userId

    if (vid && uid) {
      await WatchLater.deleteMany({
        $and: [
          { $or: [{ videoid: vid }, { videoId: vid }] },
          { $or: [{ viewer: uid }, { userId: uid }] },
        ],
      })
      return res.status(200).json({ message: "Removed from Watch Later" })
    }

    if (id) {
      await WatchLater.deleteOne({ _id: id })
      return res.status(200).json({ message: "Removed from Watch Later" })
    }

    res.status(400).json({ message: "Identifier required to remove from Watch Later" })
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
}

export const deleteWatchLaterController = deleteWatchLater

// Check if video is in Watch Later for user
export const checkWatchLater = async (req, res) => {
  const { videoid, videoId, viewer, userId } = {
    ...req.query,
    ...req.params,
  }
  const vid = videoid || videoId
  const uid = viewer || userId

  if (!vid || !uid) {
    return res.status(200).json({ isSaved: false })
  }

  try {
    const existing = await WatchLater.findOne({
      $and: [
        { $or: [{ videoid: vid }, { videoId: vid }] },
        { $or: [{ viewer: uid }, { userId: uid }] },
      ],
    })

    res.status(200).json({ isSaved: !!existing, data: existing })
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
}
