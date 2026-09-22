/**
 * Session Routes (Phase 9)
 *
 * Exposes multi-device session management and remote logout endpoints.
 */

import express from "express"
import { requireAuth } from "../middleware/authMiddleware.js"
import {
  getActiveSessions,
  terminateSession,
  logoutOthers,
  logoutAll,
  refreshSession,
} from "../controllers/sessionController.js"

const router = express.Router()

// Refresh Token Rotation (Public/Bearer optional, validates refresh token directly)
router.post("/refresh", refreshSession)

// All subsequent session management endpoints strictly require user authentication
router.use(requireAuth)

// List all active sessions for authenticated user
router.get("/", getActiveSessions)

// Terminate individual session (remote logout)
router.delete("/:sessionId", terminateSession)

// Logout all other sessions
router.post("/logout-others", logoutOthers)

// Logout all sessions (including current)
router.post("/logout-all", logoutAll)

export default router
