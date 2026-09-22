import express from "express"
import {
  getUserDevicesHandler,
  registerDeviceHandler,
  getDeviceByIdHandler,
  updateDeviceHandler,
  revokeDeviceHandler,
} from "../controllers/device.js"
import { requireAuth } from "../middleware/authMiddleware.js"

const router = express.Router()

// All device management routes require authenticated user
router.use(requireAuth)

// GET /api/devices - List all devices registered to the user with plan limits
router.get("/", getUserDevicesHandler)

// POST /api/devices/register - Register a new device
router.post("/register", registerDeviceHandler)

// GET /api/devices/:deviceId - Get details of a registered device
router.get("/:deviceId", getDeviceByIdHandler)

// PATCH /api/devices/:deviceId - Update safe device metadata (e.g. rename)
router.patch("/:deviceId", updateDeviceHandler)

// DELETE /api/devices/:deviceId - Revoke a device
router.delete("/:deviceId", revokeDeviceHandler)

// POST /api/devices/:deviceId/revoke - Alternative revocation endpoint
router.post("/:deviceId/revoke", revokeDeviceHandler)

export default router
