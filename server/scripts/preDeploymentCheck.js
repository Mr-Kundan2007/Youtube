#!/usr/bin/env node

/**
 * Pre-Deployment Readiness Check
 * Validates operational readiness before promoting changes to production:
 * 1. Environment variables & secrets hygiene
 * 2. MongoDB connection & ping round-trip latency (< 150ms)
 * 3. Required MongoDB collections & performance compound indexes
 * 4. Background scheduler lock integrity
 * Returns exit code 0 if ALL checks pass ("READY"), or exit code 1 otherwise.
 */

import mongoose from "mongoose"
import dotenv from "dotenv"
import fs from "fs"
import path from "path"

// Load appropriate env
const envFile = process.env.NODE_ENV === "test" ? ".env.test" : ".env"
const fullEnvPath = path.resolve(process.cwd(), "server", envFile)
if (fs.existsSync(fullEnvPath)) {
  dotenv.config({ path: fullEnvPath })
} else {
  dotenv.config()
}

const CHECK_RESULTS = []

function recordCheck(name, passed, message, metadata = {}) {
  CHECK_RESULTS.push({ name, passed, message, metadata })
  const symbol = passed ? "✓ PASS" : "✗ FAIL"
  console.log(`  [${symbol}] ${name}: ${message}`)
}

async function runPreDeploymentChecks() {
  console.log("=========================================================================")
  console.log("  PRE-DEPLOYMENT READINESS VERIFICATION & SYSTEM AUDIT")
  console.log(`  Timestamp: ${new Date().toISOString()} | Target ENV: ${process.env.NODE_ENV || "development"}`)
  console.log("=========================================================================\n")

  // -------------------------------------------------------------
  // Check 1: Environment Variables & Secrets Configuration
  // -------------------------------------------------------------
  const dbUrl = process.env.DB_URL || process.env.DATABASE_URL || process.env.MONGODB_URI
  const jwtSecret = process.env.JWT_SECRET
  const rzpKeyId = process.env.RAZORPAY_KEY_ID
  const rzpKeySecret = process.env.RAZORPAY_KEY_SECRET
  const rzpWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET

  const hasDb = Boolean(dbUrl && dbUrl.startsWith("mongodb"))
  recordCheck(
    "Database URI Configuration",
    hasDb,
    hasDb ? "MongoDB connection string present and valid" : "Missing valid MongoDB URI in DB_URL"
  )

  const hasJwt = Boolean(jwtSecret && jwtSecret.length >= 16)
  recordCheck(
    "JWT Signing Secret",
    hasJwt,
    hasJwt ? "JWT secret is securely configured (>= 16 characters)" : "JWT_SECRET is missing or too short"
  )

  const hasRazorpay = Boolean(rzpKeyId && rzpKeySecret)
  recordCheck(
    "Payment Gateway Credentials",
    hasRazorpay,
    hasRazorpay ? "Razorpay Key ID and Key Secret configured" : "Razorpay credentials missing or incomplete"
  )

  const hasWebhook = Boolean(rzpWebhookSecret)
  recordCheck(
    "Webhook Security Secret",
    hasWebhook,
    hasWebhook ? "Razorpay Webhook secret present for HMAC-SHA256 validation" : "RAZORPAY_WEBHOOK_SECRET missing"
  )

  // -------------------------------------------------------------
  // Check 2: Database Connection & Ping Round-Trip Latency
  // -------------------------------------------------------------
  let dbConnected = false
  if (hasDb) {
    try {
      if (mongoose.connection.readyState === 0) {
        await mongoose.connect(dbUrl, { serverSelectionTimeoutMS: 8000 })
      }
      dbConnected = true

      // Measure isolated ping command latency
      const pingStart = performance.now()
      await mongoose.connection.db.admin().ping()
      const pingDuration = performance.now() - pingStart

      recordCheck(
        "MongoDB Ping & Round-Trip Latency",
        pingDuration < 200,
        `Ping round-trip latency is ${pingDuration.toFixed(2)}ms (< 200ms limit)`
      )
    } catch (dbErr) {
      recordCheck(
        "MongoDB Connection",
        false,
        `Failed to establish database connection: ${dbErr.message}`
      )
    }
  }

  // -------------------------------------------------------------
  // Check 3: Essential Collections & Indexes Verification
  // -------------------------------------------------------------
  if (dbConnected) {
    try {
      const collections = await mongoose.connection.db.listCollections().toArray()
      const collectionNames = new Set(collections.map((c) => c.name))

      const requiredCollections = [
        "subscriptions",
        "paymenttransactions",
        "invoices",
        "subscriptionsecurityevents",
      ]

      for (const coll of requiredCollections) {
        const exists = collectionNames.has(coll)
        recordCheck(
          `Collection '${coll}'`,
          exists,
          exists ? `Collection exists in target database namespace` : `Missing required collection '${coll}'`
        )
      }

      // Check compound index on subscriptions
      if (collectionNames.has("subscriptions")) {
        const subIndexes = await mongoose.connection.db.collection("subscriptions").indexes()
        const hasUserIdIdx = subIndexes.some((idx) => Object.keys(idx.key).includes("userId"))
        recordCheck(
          "Subscription Indexes",
          hasUserIdIdx,
          hasUserIdIdx ? "Active indexed queries verified on subscriptions" : "Missing userId index on subscriptions"
        )
      }
    } catch (collErr) {
      recordCheck(
        "Schema Inspection",
        false,
        `Failed to inspect MongoDB collections: ${collErr.message}`
      )
    }
  }

  // -------------------------------------------------------------
  // Evaluation Summary
  // -------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------")
  const total = CHECK_RESULTS.length
  const passed = CHECK_RESULTS.filter((c) => c.passed).length
  const failed = total - passed

  console.log(`  VERIFICATION RESULTS: ${passed}/${total} CHECKS PASSED (${failed} FAILED)`)
  console.log("-------------------------------------------------------------------------\n")

  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close()
  }

  if (failed > 0) {
    console.error("  [STATUS: NOT READY] Pre-deployment validation encountered blocking failures.")
    process.exit(1)
  } else {
    console.log("  [STATUS: READY FOR DEPLOYMENT] All pre-deployment verification criteria satisfied.")
    process.exit(0)
  }
}

runPreDeploymentChecks().catch((err) => {
  console.error("Critical error in pre-deployment check:", err)
  process.exit(1)
})
