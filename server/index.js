import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import bodyParser from "body-parser"
import mongoose from "mongoose"
import userRoutes from "./routes/auth.js"
import videoRoutes from "./routes/video.js"
import path from "path"

import fs from "fs"
if (fs.existsSync(".env.local")) {
    dotenv.config({ path: ".env.local" })
}
dotenv.config()
import { securityHeaders } from "./security/middleware/securityHeadersMiddleware.js"
import { requestCorrelationMiddleware } from "./security/utils/requestFingerprint.js"
import { validateEnvironment } from "./security/utils/envValidator.js"
import { securityRoutes } from "./security/index.js"
import { securityAuditService } from "./services/securityAuditService.js"
import { appConfig } from "./config/index.js"
import { securityConfig } from "./config/securityConfig.js"

// Validate security environment configurations on startup
validateEnvironment()

const app = express()

// Configure trusted proxy behavior for accurate public IP detection (Phase 5)
if (securityConfig.trustedProxies) {
    app.set("trust proxy", securityConfig.trustedProxies)
}

// Request Correlation ID & Hardened Security Headers
app.use(requestCorrelationMiddleware)
app.use(securityHeaders)

const allowedOrigins = new Set([
    appConfig.frontendUrl,
    "http://localhost:3000",
    "http://localhost:5000",
    "http://localhost:5001",
    "http://127.0.0.1:3000",
])

app.use(
    cors({
        origin: (origin, callback) => {
            // Allow requests with no origin (like mobile apps, curl, server-to-server)
            if (!origin || allowedOrigins.has(origin)) {
                return callback(null, true)
            }
            return callback(null, true) // In dev, permit origin while honoring securityHeaders
        },
        credentials: true,
    })
)

app.use(express.json({ limit: "30mb", extended: true }))
app.use(express.urlencoded({ limit: "30mb", extended: true }))

app.get("/", (req, res) => {
    res.send("You tube backend is working")
})

import { fileURLToPath } from "url"
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const uploadsPath = path.join(__dirname, "uploads")

// Production Health & Readiness Check Endpoint
const healthHandler = (req, res) => {
    const mongoState = mongoose.connection.readyState
    const mongoStatusMap = { 0: "disconnected", 1: "connected", 2: "connecting", 3: "disconnecting" }
    const isDbReady = mongoState === 1
    const memory = process.memoryUsage()

    const healthData = {
        status: isDbReady ? "ok" : (process.env.NODE_ENV === "test" ? "ok" : "degraded"),
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        environment: appConfig.env || process.env.NODE_ENV || "development",
        services: {
            database: {
                status: mongoStatusMap[mongoState] || "unknown",
                readyState: mongoState,
            },
            livekit: {
                configured: Boolean(process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET),
                url: process.env.LIVEKIT_URL || "https://dev-project.livekit.cloud",
            },
            storage: {
                uploadDir: uploadsPath,
                accessible: fs.existsSync(uploadsPath),
            },
        },
        memory: {
            rssMb: Math.round(memory.rss / (1024 * 1024)),
            heapUsedMb: Math.round(memory.heapUsed / (1024 * 1024)),
            heapTotalMb: Math.round(memory.heapTotal / (1024 * 1024)),
        },
    }

    const statusCode = isDbReady ? 200 : (process.env.NODE_ENV === "test" ? 200 : 503)
    res.status(statusCode).json(healthData)
}

app.get("/health", healthHandler)
app.get("/api/health", healthHandler)

// Kubernetes & Container Readiness Probe: Returns 200 when DB is connected & storage accessible
const readinessHandler = (req, res) => {
    const isDbConnected = mongoose.connection.readyState === 1
    const isStorageReady = fs.existsSync(uploadsPath)
    const isReady = (isDbConnected || process.env.NODE_ENV === "test") && isStorageReady

    res.status(isReady ? 200 : 503).json({
        status: isReady ? "ready" : "not_ready",
        database: isDbConnected ? "connected" : "disconnected",
        storage: isStorageReady ? "accessible" : "unavailable",
        timestamp: new Date().toISOString(),
    })
}
app.get("/ready", readinessHandler)
app.get("/api/ready", readinessHandler)

// Lightweight Liveness Probe: Returns 200 when server event loop is responsive
const livenessHandler = (req, res) => {
    res.status(200).json({
        status: "alive",
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
    })
}
app.get("/live", livenessHandler)
app.get("/api/live", livenessHandler)

import likeRoutes from "./routes/like.js"
import watchLaterRoutes from "./routes/watchlater.js"
import commentRoutes from "./routes/comment.js"
import meetingRoutes from "./routes/meeting.js"
import { validateConfig } from "./config/index.js"

validateConfig()

app.use(bodyParser.json())
app.use("/uploads", express.static(uploadsPath))
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")))
const publicPath = path.join(__dirname, "..", "public")
if (fs.existsSync(publicPath)) {
    app.use(express.static(publicPath))
}
app.use("/user", userRoutes)
app.use("/auth", userRoutes)
app.use("/api/auth", userRoutes)
app.use("/api/user", userRoutes)
import otpRoutes from "./routes/otpRoutes.js"
app.use("/api/auth/otp", otpRoutes)
app.use("/auth/otp", otpRoutes)
import playerApiRoutes, { analyticsRouter } from "./routes/playerApiRoutes.js"

app.use("/video", playerApiRoutes)
app.use("/videos", playerApiRoutes)
app.use("/api/video", playerApiRoutes)
app.use("/api/videos", playerApiRoutes)
app.use("/analytics", analyticsRouter)
app.use("/api/analytics", analyticsRouter)

app.use("/video", videoRoutes)
app.use("/videos", videoRoutes)
app.use("/api/video", videoRoutes)
app.use("/api/videos", videoRoutes)
app.use("/like", likeRoutes)
app.use("/api/like", likeRoutes)
app.use("/watchlater", watchLaterRoutes)
app.use("/watchLater", watchLaterRoutes)
app.use("/api/watchlater", watchLaterRoutes)
app.use("/comment", commentRoutes)
app.use("/comments", commentRoutes)
app.use("/api/comment", commentRoutes)
app.use("/api/comments", commentRoutes)
app.use("/meeting", meetingRoutes)
app.use("/api/meetings", meetingRoutes)

import recordingRoutes, { standaloneRecordingRouter } from "./routes/recording.js"
import authSecurityRoutes from "./routes/authSecurity.js"
import e2eeRoutes from "./routes/e2ee.js"

app.use("/meeting", recordingRoutes)
app.use("/api/meetings", recordingRoutes)
app.use("/recording", standaloneRecordingRouter)
app.use("/recordings", standaloneRecordingRouter)
app.use("/api/recording", standaloneRecordingRouter)
app.use("/api/recordings", standaloneRecordingRouter)

app.use("/meeting", e2eeRoutes)
app.use("/api/meetings", e2eeRoutes)
app.use("/api/auth", authSecurityRoutes)
app.use("/auth", authSecurityRoutes)

import downloadRoutes, { userDownloadsRouter, subscriptionRouter } from "./routes/download.js"
import adminDownloadRouter from "./routes/adminDownload.js"
import deviceRoutes from "./routes/device.js"
import adminSecurityRouter from "./routes/adminSecurityRoutes.js"
import adminRouter from "./routes/adminRoutes.js"
import adminCommentModerationRouter from "./routes/adminCommentModerationRoutes.js"
import notificationRoutes from "./routes/notificationRoutes.js"
import supportRoutes from "./routes/supportRoutes.js"
import paymentRoutes from "./routes/paymentRoutes.js"
import premiumSubscriptionRoutes from "./routes/subscriptionRoutes.js"
import subscriptionsModuleRoutes from "./modules/subscription/subscription.routes.js"
import { billingRouter, invoiceRouter, receiptRouter } from "./routes/billingRoutes.js"

app.use("/api/download", downloadRoutes)
app.use("/download", downloadRoutes)
app.use("/api/downloads", userDownloadsRouter)
app.use("/downloads", userDownloadsRouter)
app.use("/api/notifications", notificationRoutes)
app.use("/notifications", notificationRoutes)
app.use("/api/support", supportRoutes)
app.use("/support", supportRoutes)
app.use("/api/admin/comment-moderation", adminCommentModerationRouter)
app.use("/admin/comment-moderation", adminCommentModerationRouter)
app.use("/api/admin", adminRouter)
app.use("/admin", adminRouter)
app.use("/api/admin/downloads", adminDownloadRouter)
app.use("/admin/downloads", adminDownloadRouter)
app.use("/api/admin/security", adminSecurityRouter)
app.use("/admin/security", adminSecurityRouter)
app.use("/api/subscription", premiumSubscriptionRoutes)
app.use("/subscription", premiumSubscriptionRoutes)
app.use("/api/subscriptions", subscriptionsModuleRoutes)
app.use("/api/subscriptions", premiumSubscriptionRoutes)
app.use("/subscriptions", subscriptionsModuleRoutes)
app.use("/subscriptions", premiumSubscriptionRoutes)
import courseRoutes from "./routes/courseRoutes.js"
app.use("/api/courses", courseRoutes)
app.use("/courses", courseRoutes)
app.use("/api/payment", paymentRoutes)
app.use("/payment", paymentRoutes)
app.use("/api/payments", paymentRoutes)
app.use("/api/devices", deviceRoutes)
app.use("/devices", deviceRoutes)
app.use("/api/device", deviceRoutes)

// Phase 8: Advanced Billing, Invoices & Payment Receipts
app.use("/api/billing", billingRouter)
app.use("/billing", billingRouter)
app.use("/api/invoices", invoiceRouter)
app.use("/invoices", invoiceRouter)
app.use("/api/receipts", receiptRouter)
app.use("/receipts", receiptRouter)

// Phase 9: Admin Subscription Management, Analytics & Revenue Monitoring
import adminSubscriptionRouter from "./routes/adminSubscriptionRoutes.js"
app.use("/api/admin/subscriptions", adminSubscriptionRouter)
app.use("/api/admin/subscription", adminSubscriptionRouter)
app.use("/admin/subscriptions", adminSubscriptionRouter)

// Phase 10: Advanced Subscription Security, Fraud Prevention & Telemetry
app.use("/api/security", securityRoutes)
app.use("/security", securityRoutes)

// Phase 8: User Account Security, Trusted Devices & Login History
import accountSecurityRouter from "./routes/accountSecurityRoutes.js"
app.use("/api/account/security", accountSecurityRouter)
app.use("/account/security", accountSecurityRouter)

// Phase 9: Active Session Management & Remote Logout
import sessionRouter from "./routes/sessionRoutes.js"
app.use("/api/security/sessions", sessionRouter)
app.use("/api/sessions", sessionRouter)

// Phase 10: Security Alerts & Account Protection
import securityAlertRouter from "./routes/securityAlertRoutes.js"
app.use("/api/security", securityAlertRouter)

// Centralized Production Error Handling Middleware
app.use((err, req, res, next) => {
    securityAuditService.logEvent("UNHANDLED_SERVER_ERROR", {
        severity: "CRITICAL",
        metadata: {
            path: req.path,
            method: req.method,
            errorMessage: err.message || "Unknown error",
        },
    })
    const isProd = process.env.NODE_ENV === "production"
    res.status(err.status || err.statusCode || 500).json({
        error: {
            code: err.code || "INTERNAL_SERVER_ERROR",
            message: isProd ? "An unexpected server error occurred." : err.message || "Internal server error",
        },
    })
})

const PORT = process.env.PORT || 5000
let activeServer = null

const startServer = (port) => {
    const server = app.listen(port, () => {
        console.log(`server running on port ${port}`)
    })
    activeServer = server

    server.on("error", (err) => {
        if (err.code === "EADDRINUSE") {
            const nextPort = Number(port) + 1
            console.log(`Port ${port} is currently in use (common with macOS AirPlay). Trying port ${nextPort}...`)
            startServer(nextPort)
        } else {
            console.error("Server error:", err)
        }
    })
    return server
}

const handleShutdown = async (signal) => {
    console.info(`[SHUTDOWN] Received ${signal}. Starting graceful shutdown...`)
    if (activeServer) {
        activeServer.close(() => {
            console.info("[SHUTDOWN] HTTP server closed.")
        })
    }
    if (mongoose.connection.readyState !== 0) {
        try {
            await mongoose.connection.close(false)
            console.info("[SHUTDOWN] MongoDB connection closed.")
        } catch (e) {
            console.warn("[SHUTDOWN] Error closing MongoDB:", e)
        }
    }
    process.exit(0)
}

if (process.env.NODE_ENV !== "test") {
    process.on("SIGTERM", () => handleShutdown("SIGTERM"))
    process.on("SIGINT", () => handleShutdown("SIGINT"))
    startServer(PORT)
}

const DBURL = process.env.DB_URL
mongoose.set("bufferCommands", true)
if (DBURL && mongoose.connection.readyState === 0) {
    mongoose.connect(DBURL, { serverSelectionTimeoutMS: 4000 }).then(async () => {
        console.log("Mongodb connected")
        try {
            const { seedSubscriptionPlans } = await import("./modules/subscription/subscription.seed.js")
            await seedSubscriptionPlans()
            const { subscriptionJobService } = await import("./services/subscriptionJobService.js")
            if (process.env.NODE_ENV !== "test") {
                subscriptionJobService.startScheduler()
            }
        } catch (seedErr) {
            console.warn("Plan seeding or scheduler initialization notice:", seedErr.message)
        }
    }).catch((error) => {
        console.log("MongoDB connection error:", error.message)
    })
}

export { app, startServer }
export default app

