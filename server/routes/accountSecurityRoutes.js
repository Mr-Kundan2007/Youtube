/**
 * Account Security & Trusted Device Routes (Phase 8)
 *
 * Provides authenticated routes for end-user trusted device management,
 * device renaming, device trust revocation, login audit history, and security activity.
 */

import express from "express"
import { requireAuth } from "../middleware/authMiddleware.js"
import {
  getTrustedDevices,
  renameTrustedDevice,
  revokeTrustedDevice,
  getLoginHistory,
  getSecurityActivity,
} from "../controllers/securityController.js"

const router = express.Router()

// All account security endpoints require standard user authentication
router.use(requireAuth)

// Trusted Device Management
router.get("/trusted-devices", getTrustedDevices)
router.patch("/trusted-devices/:deviceId", renameTrustedDevice)
router.delete("/trusted-devices/:deviceId", revokeTrustedDevice)

// Login History Audit Trail
router.get("/login-history", getLoginHistory)

// Security Activity Stream
router.get("/activity", getSecurityActivity)

// Phase 9: Active Sessions & Remote Logout
import sessionRoutes from "./sessionRoutes.js"
router.use("/sessions", sessionRoutes)

// Phase 10: Security Alerts, Suspicious Login Notifications & Account Protection
import securityAlertRoutes from "./securityAlertRoutes.js"
router.use("/", securityAlertRoutes)

export default router
