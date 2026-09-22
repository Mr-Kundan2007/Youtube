import express from "express"
import {
  getVideoAccess,
  saveWatchProgress,
  getWatchProgress,
  intakeVideoAnalytics,
} from "../controllers/playerApiController.js"
import { MemoryRateLimiter } from "../middleware/rateLimiter.js"

const router = express.Router()

// Rate limiters for watch progress and analytics
const progressLimiter = new MemoryRateLimiter(60 * 1000, 60, "player-progress").middleware()
const analyticsLimiter = new MemoryRateLimiter(60 * 1000, 120, "player-analytics").middleware()
const accessLimiter = new MemoryRateLimiter(60 * 1000, 120, "player-access").middleware()

// Video Access & Subscription Check Endpoints
router.get("/:videoId/access", accessLimiter, getVideoAccess)
router.post("/:videoId/access", accessLimiter, getVideoAccess)

// Watch Progress Persistence Endpoints
router.post("/:videoId/progress", progressLimiter, saveWatchProgress)
router.get("/:videoId/progress", progressLimiter, getWatchProgress)

// Standalone Analytics Intake Endpoints (also exposed under /api/analytics)
export const analyticsRouter = express.Router()
analyticsRouter.post("/video", analyticsLimiter, intakeVideoAnalytics)
analyticsRouter.post("/events", analyticsLimiter, intakeVideoAnalytics)
analyticsRouter.post("/", analyticsLimiter, intakeVideoAnalytics)

export default router
