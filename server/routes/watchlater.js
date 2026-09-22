import express from "express"
import {
  watchLaterController,
  getAllWatchLater,
  deleteWatchLater,
  checkWatchLater,
} from "../controllers/watchlater.js"

const routes = express.Router()

// POST - Add to Watch Later
routes.post("/", watchLaterController)
routes.post("/watchlater", watchLaterController)
routes.post("/watchLater", watchLaterController)

// GET - Get Watch Later videos (Supports both /getallwatchlater, /:userId, /user/:userId, and /)
routes.get("/getallwatchlater", getAllWatchLater)
routes.get("/getAllWatchLater", getAllWatchLater)
routes.get("/user/:userId", getAllWatchLater)
routes.get("/check", checkWatchLater)
routes.get("/check/:videoId/:userId", checkWatchLater)
routes.get("/:userId", getAllWatchLater)
routes.get("/", getAllWatchLater)

// DELETE - Remove from Watch Later
routes.delete("/deletewatchlater/:videoid/:viewer", deleteWatchLater)
routes.delete("/deleteWatchLater/:videoid/:viewer", deleteWatchLater)
routes.delete("/delete/:id", deleteWatchLater)
routes.delete("/:id", deleteWatchLater)

export default routes
