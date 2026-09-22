import express from "express"
import { requireAuth } from "../middleware/authMiddleware.js"
import { requireModeratorOrAdminRole } from "../middleware/adminPermissionMiddleware.js"
import {
  getModerationSummaryHandler,
  getModerationReportsHandler,
  getReportDetailHandler,
  updateReportStatusHandler,
  executeModerationActionHandler,
} from "../controllers/commentReportingController.js"

const router = express.Router()

// All endpoints in this router strictly require authenticated Moderator or Admin privileges
router.use(requireAuth, requireModeratorOrAdminRole)

// 1. Dashboard summary stats
router.get("/summary", getModerationSummaryHandler)

// 2. Paginated reports list with filtering and search
router.get("/reports", getModerationReportsHandler)

// 3. Complete report detail context dossier
router.get("/reports/:reportId", getReportDetailHandler)

// 4. Update status (e.g. assign to under_review)
router.patch("/reports/:reportId/status", updateReportStatusHandler)

// 5. Execute authorized moderation actions (hide, restore, delete, dismiss, resolve)
router.post("/reports/:reportId/action", executeModerationActionHandler)
router.post("/comments/:commentId/action", executeModerationActionHandler)
router.post("/action", executeModerationActionHandler)

export default router
