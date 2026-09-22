/**
 * OTP Routes (Phase 7)
 *
 * Defines API endpoints for available methods retrieval, OTP dispatch,
 * and OTP verification with rate limiting protection.
 */

import express from "express"
import {
  getAvailableMethods,
  sendOTP,
  verifyOTP,
} from "../controllers/otpController.js"
import { MemoryRateLimiter } from "../middleware/rateLimiter.js"

const router = express.Router()

// Dedicated in-memory rate limiters for OTP operations
const otpSendRateLimiter = new MemoryRateLimiter(60 * 1000, 5, "OTP_SEND")
const otpVerifyRateLimiter = new MemoryRateLimiter(60 * 1000, 10, "OTP_VERIFY")

// GET /api/auth/otp/methods/:pendingLoginId
router.get("/methods/:pendingLoginId", getAvailableMethods)

// POST /api/auth/otp/send
router.post("/send", otpSendRateLimiter.middleware(), sendOTP)

// POST /api/auth/otp/verify
router.post("/verify", otpVerifyRateLimiter.middleware(), verifyOTP)

export default router
