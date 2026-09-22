import express from "express"
import mongoose from "mongoose"
import { requireAuth } from "../../middleware/authMiddleware.js"
import { requireAdminSecurity } from "../middleware/adminSecurityMiddleware.js"
import {
  validateObjectId,
  validatePagination,
  validateDateRange,
} from "../middleware/requestValidationMiddleware.js"
import securityAuditService from "../services/securityAuditService.js"
import backgroundJobMonitorService from "../services/backgroundJobMonitorService.js"
import anomalyDetectionService from "../services/anomalyDetectionService.js"
import securityAlertService from "../services/securityAlertService.js"
import SubscriptionSecurityEvent from "../../Modals/SubscriptionSecurityEvent.js"
import PaymentTransaction from "../../Modals/PaymentTransaction.js"
import Subscription from "../../Modals/Subscription.js"
import User from "../../Modals/Auth.js"
import { sendSuccess, sendError } from "../../utils/response.js"
import { ApiError } from "../../utils/apiError.js"
import accountSecurityRoutes from "../../routes/accountSecurityRoutes.js"

const router = express.Router()

// ==========================================
// 1. PUBLIC MONITORING & HEALTH PROBES
// ==========================================

/**
 * GET /api/security/health
 * Safe health check endpoint for uptime and orchestrator probes. Zero secret leakage.
 */
router.get("/health", async (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1
  const mem = process.memoryUsage()

  const healthData = {
    status: isDbConnected ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: {
      status: isDbConnected ? "connected" : "disconnected",
    },
    memory: {
      rssMb: Math.round(mem.rss / 1024 / 1024),
      heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
    },
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || "development",
  }

  const statusCode = isDbConnected ? 200 : 503
  return res.status(statusCode).json(healthData)
})

/**
 * GET /api/security/ready
 * Container readiness probe (e.g. Kubernetes, Docker, Render).
 */
router.get("/ready", async (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1
  if (isDbConnected) {
    return res.status(200).json({ status: "ready", timestamp: new Date().toISOString() })
  }
  return res.status(503).json({ status: "not_ready", reason: "Database not connected" })
})

// ==========================================
// 1.5 USER ACCOUNT SECURITY & TRUSTED DEVICES (PHASE 8)
// ==========================================
// User-level endpoints for trusted devices, login history, and security activity
router.use("/", accountSecurityRoutes)

// ==========================================
// 2. GATED ADMIN SECURITY MANAGEMENT
// ==========================================
// All subsequent endpoints require authentication and administrator privileges
router.use(requireAuth, requireAdminSecurity)

/**
 * GET /api/security/summary
 * Aggregates high-level metrics, risk distributions, and operational health.
 */
router.get("/summary", async (req, res) => {
  try {
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)

    const [
      totalToday,
      severityCounts,
      openReviews,
      rateLimitCountToday,
      anomalyCountToday,
      jobHealth,
      activeAlerts,
    ] = await Promise.all([
      SubscriptionSecurityEvent.countDocuments({ createdAt: { $gte: startOfToday } }),
      SubscriptionSecurityEvent.aggregate([
        { $group: { _id: "$severity", count: { $sum: 1 } } },
      ]),
      SubscriptionSecurityEvent.countDocuments({ status: "OPEN", severity: { $in: ["HIGH", "CRITICAL"] } }),
      SubscriptionSecurityEvent.countDocuments({
        eventType: "RATE_LIMIT_TRIGGERED",
        createdAt: { $gte: startOfToday },
      }),
      SubscriptionSecurityEvent.countDocuments({
        eventType: { $in: ["PAYMENT_ANOMALY_DETECTED", "INVALID_SIGNATURE", "PAYMENT_REPLAY_ATTEMPT"] },
        createdAt: { $gte: startOfToday },
      }),
      backgroundJobMonitorService.getJobHealthReport(),
      securityAlertService.getActiveAlerts({ limit: 5 }),
    ])

    const severityMap = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 }
    severityCounts.forEach((item) => {
      if (item._id && severityMap[item._id] !== undefined) {
        severityMap[item._id] = item.count
      }
    })

    return sendSuccess(
      res,
      {
        totalEventsToday: totalToday,
        openCriticalReviews: openReviews,
        rateLimitTriggersToday: rateLimitCountToday,
        paymentAnomaliesToday: anomalyCountToday,
        severityDistribution: severityMap,
        jobs: jobHealth,
        recentAlerts: activeAlerts,
        generatedAt: new Date(),
      },
      200,
      "Security summary retrieved successfully"
    )
  } catch (err) {
    return sendError(res, err)
  }
})

/**
 * GET /api/security/events
 * Filterable, paginated audit event stream.
 */
router.get("/events", validatePagination, validateDateRange, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      severity,
      eventType,
      status,
      userId,
      orderId,
      startDate,
      endDate,
    } = req.query

    const result = await securityAuditService.listEvents({
      page: Number(page),
      limit: Number(limit),
      severity,
      eventType,
      status,
      userId,
      orderId,
      startDate,
      endDate,
    })

    return sendSuccess(res, result, 200, "Security events retrieved successfully")
  } catch (err) {
    return sendError(res, err)
  }
})

/**
 * GET /api/security/events/:id
 * Detailed event profile with related transaction, user, and subscription context.
 */
router.get("/events/:id", validateObjectId("id"), async (req, res) => {
  try {
    const event = await SubscriptionSecurityEvent.findById(req.params.id)
      .populate("reviewedBy", "name email role")
      .lean()

    if (!event) {
      throw ApiError.notFound("EVENT_NOT_FOUND", "Security event not found")
    }

    let userContext = null
    let transactionContext = null
    let subscriptionContext = null

    if (event.userId) {
      userContext = await User.findById(event.userId).select("name email role createdAt").lean()
      subscriptionContext = await Subscription.findOne({ userId: event.userId }).lean()
    }

    if (event.relatedTransactionId || event.orderId) {
      const txQuery = {}
      if (event.relatedTransactionId) txQuery._id = event.relatedTransactionId
      else if (event.orderId) txQuery.orderId = event.orderId

      transactionContext = await PaymentTransaction.findOne(txQuery)
        .select("internalTransactionId orderId paymentId amount currency status planKey billingCycle createdAt")
        .lean()
    }

    return sendSuccess(
      res,
      {
        event,
        userContext,
        transactionContext,
        subscriptionContext,
      },
      200,
      "Event details retrieved successfully"
    )
  } catch (err) {
    return sendError(res, err)
  }
})

/**
 * PATCH /api/security/events/:id/review
 * Updates event review state (REVIEWED, RESOLVED, IGNORED) with mandatory admin notes.
 */
router.patch("/events/:id/review", validateObjectId("id"), async (req, res) => {
  try {
    const { status, adminNotes } = req.body || {}

    if (!status || !["REVIEWED", "RESOLVED", "IGNORED"].includes(status)) {
      throw ApiError.badRequest(
        "INVALID_STATUS",
        "Status must be one of: REVIEWED, RESOLVED, IGNORED"
      )
    }

    if (!adminNotes || typeof adminNotes !== "string" || !adminNotes.trim()) {
      throw ApiError.badRequest(
        "ADMIN_NOTES_REQUIRED",
        "Admin notes are mandatory when reviewing or resolving a security event."
      )
    }

    const updated = await securityAuditService.updateEventStatus({
      eventId: req.params.id,
      status,
      adminNotes: adminNotes.trim(),
      reviewedBy: req.user.id || req.user._id,
    })

    return sendSuccess(res, updated, 200, "Security event status updated successfully")
  } catch (err) {
    return sendError(res, err)
  }
})

/**
 * GET /api/security/jobs
 * Background job execution telemetry and health indicators.
 */
router.get("/jobs", async (req, res) => {
  try {
    const report = await backgroundJobMonitorService.getJobHealthReport()
    return sendSuccess(res, report, 200, "Job telemetry retrieved successfully")
  } catch (err) {
    return sendError(res, err)
  }
})

/**
 * POST /api/security/jobs/clean-locks
 * Manually releases orphaned or expired background job locks.
 */
router.post("/jobs/clean-locks", async (req, res) => {
  try {
    const maxAge = req.body?.maxAgeMinutes || 30
    const result = await backgroundJobMonitorService.cleanStaleLocks(maxAge)
    return sendSuccess(res, result, 200, `Cleared ${result.clearedCount} stale job lock(s)`)
  } catch (err) {
    return sendError(res, err)
  }
})

/**
 * GET /api/security/anomalies/scan
 * Runs on-demand platform anomaly detection check.
 */
router.get("/anomalies/scan", async (req, res) => {
  try {
    const result = await anomalyDetectionService.runAnomalyScan()
    return sendSuccess(res, result, 200, "Anomaly scan executed successfully")
  } catch (err) {
    return sendError(res, err)
  }
})

export default router
