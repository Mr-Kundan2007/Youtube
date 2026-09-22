import express from "express"
import { requireAuth } from "../middleware/authMiddleware.js"
import {
  getUserDevicesHandler,
  renameUserDeviceHandler,
  revokeUserDeviceHandler,
  getDeviceDownloadsHandler,
} from "../controllers/userDeviceController.js"

const router = express.Router()

router.use(requireAuth)

router.get("/", getUserDevicesHandler)
router.patch("/:deviceId", renameUserDeviceHandler)
router.delete("/:deviceId", revokeUserDeviceHandler)
router.get("/:deviceId/downloads", getDeviceDownloadsHandler)

export default router
