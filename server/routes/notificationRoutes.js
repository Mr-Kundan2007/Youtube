import express from "express"
import { requireAuth } from "../middleware/authMiddleware.js"
import {
  getUserNotificationsHandler,
  markNotificationReadHandler,
  markAllNotificationsReadHandler,
  deleteNotificationHandler,
} from "../controllers/userNotificationController.js"

const router = express.Router()

router.use(requireAuth)

router.get("/", getUserNotificationsHandler)
router.patch("/read-all", markAllNotificationsReadHandler)
router.patch("/:id/read", markNotificationReadHandler)
router.delete("/:id", deleteNotificationHandler)

export default router
