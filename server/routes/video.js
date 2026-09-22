import express from "express"
import upload from "../filehelper.js"
import {
  uploadVideo,
  getAllVideos,
  getVideosByChannel,
  getVideoById,
  likeVideo,
  dislikeVideo,
  viewVideo,
  deleteVideo,
} from "../controllers/video.js"

const routes = express.Router()

import { authorizeVideoDownload } from "../controllers/download.js"
import { requireAuth } from "../middleware/authMiddleware.js"
import { downloadAuthLimiter } from "../middleware/rateLimiter.js"

routes.post("/upload", upload.single("file"), uploadVideo)
routes.post("/uploadvideo", upload.single("file"), uploadVideo)
routes.get("/getallvideos", getAllVideos)
routes.get("/getvideos", getAllVideos)
routes.get("/channel/:channelId", getVideosByChannel)
routes.get("/", getAllVideos)
routes.get("/:id", getVideoById)
routes.delete("/:id", deleteVideo)
routes.delete("/delete/:id", deleteVideo)
routes.post("/like/:id", likeVideo)
routes.patch("/like/:id", likeVideo)
routes.post("/dislike/:id", dislikeVideo)
routes.patch("/dislike/:id", dislikeVideo)
routes.patch("/views/:id", viewVideo)

// Video download authorization
routes.post("/:videoId/download/authorize", downloadAuthLimiter, requireAuth, authorizeVideoDownload)

export default routes
