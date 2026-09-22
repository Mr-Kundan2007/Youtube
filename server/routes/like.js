import express from "express"
import {
  likeVideo,
  dislikeVideo,
  getAllLikedVideos,
} from "../controllers/like.js"

const routes = express.Router()

// Like endpoints
routes.post("/:id", likeVideo)
routes.patch("/:id", likeVideo)
routes.post("/like/:id", likeVideo)
routes.patch("/like/:id", likeVideo)

// Dislike endpoints
routes.post("/dislike/:id", dislikeVideo)
routes.patch("/dislike/:id", dislikeVideo)

// Liked videos by user
routes.get("/user/:userId", getAllLikedVideos)
routes.get("/:userId", getAllLikedVideos)

export default routes
