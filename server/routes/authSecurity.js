import express from "express"
import { logout, getActiveSessions, revokeSession } from "../controllers/authSecurity.js"
import { requireAuth } from "../middleware/authMiddleware.js"

const router = express.Router()

router.post("/logout", requireAuth, logout)
router.get("/sessions", requireAuth, getActiveSessions)
router.post("/sessions/revoke", requireAuth, revokeSession)

export default router
