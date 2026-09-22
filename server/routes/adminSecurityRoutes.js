import express from "express"
import {
  getSecurityEventsHandler,
  getSecurityEventByIdHandler,
  updateSecurityEventHandler,
  createRestrictionHandler,
  removeRestrictionHandler,
  getRestrictionsHandler,
  blockDeviceHandler,
  unblockDeviceHandler,
  getAdminDownloadsMonitoringHandler,
  getSecuritySummaryHandler,
} from "../controllers/adminSecurityController.js"
import { requireAuth } from "../middleware/authMiddleware.js"
import User from "../Modals/Auth.js"
import { ApiError } from "../utils/apiError.js"
import { sendError } from "../utils/apiResponse.js"

const router = express.Router()

/**
 * Strict admin role verification middleware.
 * Ensures the authenticated user has the 'admin' role in JWT or database.
 */
export const requireAdminRole = async (req, res, next) => {
  if (!req.user || !req.user.id) {
    return sendError(res, ApiError.unauthorized("UNAUTHORIZED", "Authentication required"))
  }

  let role = req.user.role

  // If role not encoded in JWT, look up from User record
  if (!role || role === "user") {
    try {
      const userDoc = await User.findById(req.user.id).select("role email").lean()
      role = userDoc?.role
    } catch {
      // Fallback
    }
  }

  if (role !== "admin") {
    return sendError(
      res,
      ApiError.forbidden("FORBIDDEN", "Admin privileges required to access this resource")
    )
  }

  next()
}

// All endpoints in this router require authentication and verified admin role
router.use(requireAuth, requireAdminRole)

// Security Events
router.get("/events", getSecurityEventsHandler)
router.get("/events/:eventId", getSecurityEventByIdHandler)
router.patch("/events/:eventId", updateSecurityEventHandler)

// Download Restrictions
router.post("/restrictions", createRestrictionHandler)
router.delete("/restrictions/:restrictionId", removeRestrictionHandler)
router.get("/restrictions", getRestrictionsHandler)

// Device Blocking Management
router.post("/devices/:deviceId/block", blockDeviceHandler)
router.post("/devices/:deviceId/unblock", unblockDeviceHandler)

// Download Monitoring & Summary
router.get("/downloads", getAdminDownloadsMonitoringHandler)
router.get("/summary", getSecuritySummaryHandler)

export default router
