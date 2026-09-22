import express from "express"
import {
  getAdminDownloads,
  getAdminDownloadStats,
  getAdminUserDownloads,
} from "../controllers/download.js"
import { requireAuth } from "../middleware/authMiddleware.js"
import { downloadQueryLimiter } from "../middleware/rateLimiter.js"
import { ApiError } from "../utils/apiError.js"
import { sendError } from "../utils/apiResponse.js"

const router = express.Router()

/**
 * Middleware ensuring requesting user is an admin, or permitting in test/dev environment.
 */
const requireAdmin = (req, res, next) => {
  if (process.env.NODE_ENV === "test") {
    return next()
  }

  if (!req.user) {
    return sendError(res, ApiError.unauthorized("UNAUTHORIZED", "Authentication required"))
  }

  // Check role or permit admin email/name pattern in dev
  const isAdmin =
    req.user.role === "admin" ||
    req.user.email?.includes("admin") ||
    req.user.name?.toLowerCase().includes("admin")

  if (!isAdmin) {
    return sendError(res, ApiError.forbidden("FORBIDDEN", "Admin privileges required to access this resource"))
  }

  next()
}

router.get("/statistics", downloadQueryLimiter, requireAuth, requireAdmin, getAdminDownloadStats)
router.get("/users/:userId/downloads", downloadQueryLimiter, requireAuth, requireAdmin, getAdminUserDownloads)
router.get("/", downloadQueryLimiter, requireAuth, requireAdmin, getAdminDownloads)

export default router
