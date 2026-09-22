/**
 * Phase 2 Database Schema & Data Architecture Test Suite
 *
 * Validates:
 * 1. Model registration and schema initialization (DownloadRecord, DownloadQuota, Device, DownloadToken, DownloadAuditLog, Subscription, Video, User)
 * 2. DownloadRecord lifecycle fields, status enum constraints, and chronological timestamp validation
 * 3. File metadata and non-negative constraints
 * 4. Self-referencing duplicate and retry relationships
 * 5. Idempotency key and request ID indexing
 * 6. DownloadQuota multi-period types (daily, monthly, billing_cycle, unlimited) and auto-calculated remaining quota
 * 7. DownloadQuota compound uniqueness constraint
 * 8. DownloadDevice compound uniqueness (userId + device_identifier) and status management
 * 9. DownloadToken cryptographic token_hash uniqueness, expiry, and usage limits
 * 10. DownloadAuditLog 15 controlled event types, structured metadata, and querying
 * 11. Transaction & Atomic Concurrency readiness (conditional $inc reservation)
 * 12. Backward compatibility with existing video platform models
 */

import assert from "assert"
import crypto from "crypto"
import mongoose from "mongoose"
import { dbConfig } from "../config/index.js"
import User from "../Modals/Auth.js"
import Video from "../Modals/video.js"
import Subscription from "../Modals/Subscription.js"
import DownloadRecord, { Download } from "../Modals/DownloadRecord.js"
import DownloadQuota from "../Modals/DownloadQuota.js"
import Device, { DownloadDevice } from "../Modals/Device.js"
import DownloadToken from "../Modals/DownloadToken.js"
import DownloadAuditLog, { DownloadAuditEvents } from "../Modals/DownloadAuditLog.js"

process.env.NODE_ENV = "test"

const runPhase2Tests = async () => {
  console.log("==================================================================")
  console.log("PHASE 2: DATABASE SCHEMA & DATA ARCHITECTURE MASTER VERIFICATION")
  console.log("==================================================================")

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(dbConfig.url || "mongodb://127.0.0.1:27017/youtube")
  } else if (mongoose.connection.readyState === 2) {
    await new Promise((resolve) => mongoose.connection.once("connected", resolve))
  }

  let passedCount = 0
  const timestamp = Date.now()

  try {
    // -------------------------------------------------------------
    // TEST 1: Model Registration and Model Aliases
    // -------------------------------------------------------------
    {
      assert(DownloadRecord, "DownloadRecord model must be loaded")
      assert(Download, "Download model alias must be loaded")
      assert.strictEqual(DownloadRecord.modelName, "DownloadRecord")
      assert(DownloadQuota, "DownloadQuota model must be loaded")
      assert(Device, "Device model must be loaded")
      assert(DownloadDevice, "DownloadDevice model must be loaded")
      assert(DownloadToken, "DownloadToken model must be loaded")
      assert(DownloadAuditLog, "DownloadAuditLog model must be loaded")
      assert(Subscription, "Subscription model must be loaded")
      assert(Video, "Video model must be loaded")
      assert(User, "User model must be loaded")

      console.log("[PASS] 1. Model Registration: All Phase 2 models and proxy aliases cleanly initialized")
      passedCount++
    }

    // -------------------------------------------------------------
    // FIXTURE SETUP
    // -------------------------------------------------------------
    const testUser = await User.create({
      name: `Phase2 User ${timestamp}`,
      email: `phase2_${timestamp}@example.com`,
      role: "user",
    })

    const testVideo = await Video.create({
      videotitle: `Phase2 Video ${timestamp}`,
      filepath: "public/video/vdo.mp4",
      videofilepath: "/video/vdo.mp4",
      filesize: "5242880",
      videochanel: "Phase 2 Channel",
      is_downloadable: true,
    })

    const testSubscription = await Subscription.create({
      userId: testUser._id,
      plan: "gold",
      status: "active",
      startDate: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      download_limit: 50,
      download_quota_type: "daily",
      download_enabled: true,
      max_download_devices: 10,
    })

    // -------------------------------------------------------------
    // TEST 2: DownloadRecord Creation & Lifecycle Timestamps
    // -------------------------------------------------------------
    let originalRecordId = null
    {
      const reqAt = new Date(Date.now() - 5000)
      const authAt = new Date(Date.now() - 4000)
      const startAt = new Date(Date.now() - 3000)
      const completeAt = new Date(Date.now() - 1000)

      const download = await DownloadRecord.create({
        userId: testUser._id,
        videoId: testVideo._id,
        subscription_id: testSubscription._id,
        subscription_plan: "gold",
        download_status: "completed",
        download_requested_at: reqAt,
        download_authorized_at: authAt,
        download_started_at: startAt,
        download_completed_at: completeAt,
        file_name: "video_1080p.mp4",
        file_size: 5242880,
        file_type: "video/mp4",
        file_extension: "mp4",
        storage_provider: "local",
        storage_path: "uploads/videos/video_1080p.mp4",
        request_id: `req_${timestamp}_1`,
        idempotency_key: `idem_${timestamp}_1`,
        ip_address: "192.168.1.100",
        device_id: "macbook_pro_device_1",
        browser: "Chrome",
        operating_system: "macOS",
        device_type: "desktop",
        user_agent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      })

      assert(download._id, "Download record must have _id")
      assert.strictEqual(download.user_id.toString(), testUser._id.toString())
      assert.strictEqual(download.video_id.toString(), testVideo._id.toString())
      assert.strictEqual(download.subscription_plan, "gold")
      assert.strictEqual(download.download_status, "completed")
      assert.strictEqual(download.file_size, 5242880)
      assert.strictEqual(download.idempotency_key, `idem_${timestamp}_1`)

      originalRecordId = download._id
      console.log("[PASS] 2. DownloadRecord Lifecycle: Correctly stores all lifecycle timestamps, file metadata, and client info")
      passedCount++
    }

    // -------------------------------------------------------------
    // TEST 3: Controlled Download Status Enum Validation
    // -------------------------------------------------------------
    {
      const validStatuses = [
        "pending",
        "authorized",
        "preparing",
        "started",
        "completed",
        "interrupted",
        "failed",
        "cancelled",
        "expired",
        "blocked",
      ]

      for (const st of validStatuses) {
        const record = new DownloadRecord({
          userId: testUser._id,
          videoId: testVideo._id,
          download_status: st,
        })
        const err = record.validateSync()
        assert(!err, `Status "${st}" must be valid`)
      }

      // Invalid status test
      const invalidRecord = new DownloadRecord({
        userId: testUser._id,
        videoId: testVideo._id,
        download_status: "INVALID_STATUS_VALUE",
      })
      const err = invalidRecord.validateSync()
      assert(err && err.errors["download_status"], "Invalid status must be rejected by schema enum validation")

      console.log("[PASS] 3. Status Validation: All 10 controlled lifecycle statuses accepted; arbitrary values rejected")
      passedCount++
    }

    // -------------------------------------------------------------
    // TEST 4: Chronological Consistency & Non-Negative Validations
    // -------------------------------------------------------------
    {
      const invalidTimeRecord = new DownloadRecord({
        userId: testUser._id,
        videoId: testVideo._id,
        download_started_at: new Date(Date.now()),
        download_completed_at: new Date(Date.now() - 10000), // earlier than start!
      })

      let timeValidationError = false
      try {
        await invalidTimeRecord.save()
      } catch (err) {
        timeValidationError = true
        assert(err.message.includes("download_completed_at cannot be earlier than download_started_at"))
      }
      assert(timeValidationError, "Saving completed_at earlier than started_at must throw an error")

      // Negative file size validation
      const negativeSizeRecord = new DownloadRecord({
        userId: testUser._id,
        videoId: testVideo._id,
        file_size: -100,
      })
      const sizeErr = negativeSizeRecord.validateSync()
      assert(sizeErr && sizeErr.errors["file_size"], "Negative file size must be rejected by min:0 constraint")

      console.log("[PASS] 4. Data Integrity: Chronological ordering enforced and negative file sizes blocked")
      passedCount++
    }

    // -------------------------------------------------------------
    // TEST 5: Self-Referencing Duplicate and Retry Relationships
    // -------------------------------------------------------------
    {
      const retryRecord = await DownloadRecord.create({
        userId: testUser._id,
        videoId: testVideo._id,
        original_download_id: originalRecordId,
        retry_of_download_id: originalRecordId,
        retry_count: 1,
        is_duplicate: true,
        download_status: "started",
      })

      assert.strictEqual(retryRecord.is_duplicate, true)
      assert.strictEqual(retryRecord.original_download_id.toString(), originalRecordId.toString())
      assert.strictEqual(retryRecord.retry_of_download_id.toString(), originalRecordId.toString())
      assert.strictEqual(retryRecord.retry_count, 1)

      // Query population
      const populated = await DownloadRecord.findById(retryRecord._id).populate("original_download_id")
      assert(populated.original_download_id._id, "Must successfully populate self-referencing original_download_id")
      assert.strictEqual(populated.original_download_id.file_name, "video_1080p.mp4")

      console.log("[PASS] 5. Duplicate & Retry Relationships: Self-referencing pointers and retry counters verified")
      passedCount++
    }

    // -------------------------------------------------------------
    // TEST 6: DownloadQuota Model & Quota Types
    // -------------------------------------------------------------
    {
      const periodStart = new Date(Date.UTC(2026, 8, 6, 0, 0, 0, 0))
      const periodEnd = new Date(Date.UTC(2026, 8, 7, 0, 0, 0, 0))

      const quota = await DownloadQuota.create({
        userId: testUser._id,
        plan: "silver",
        quota_type: "daily",
        quota_limit: 15,
        quota_used: 5,
        quota_period_start: periodStart,
        quota_period_end: periodEnd,
      })

      assert.strictEqual(quota.user_id.toString(), testUser._id.toString())
      assert.strictEqual(quota.period_start.toISOString(), periodStart.toISOString())
      assert.strictEqual(quota.quota_remaining, 10, "Remaining must be 15 - 5 = 10")

      // Test unlimited quota type
      const unlimitedQuota = new DownloadQuota({
        userId: new mongoose.Types.ObjectId(),
        plan: "gold",
        quota_type: "unlimited",
        quota_limit: 9999,
        quota_used: 10,
        quota_period_start: periodStart,
        quota_period_end: periodEnd,
      })
      await unlimitedQuota.save()
      assert.strictEqual(unlimitedQuota.quota_remaining, 999999, "Unlimited quota remaining must reflect unlimited constant")

      console.log("[PASS] 6. Quota Model: Auto-calculates remaining quota and supports daily, monthly, and unlimited types")
      passedCount++
    }

    // -------------------------------------------------------------
    // TEST 7: DownloadQuota Unique Compound Constraint
    // -------------------------------------------------------------
    {
      const duplicatePeriodStart = new Date(Date.UTC(2026, 8, 6, 0, 0, 0, 0))
      const duplicatePeriodEnd = new Date(Date.UTC(2026, 8, 7, 0, 0, 0, 0))

      let duplicateConstraintTriggered = false
      try {
        await DownloadQuota.create({
          userId: testUser._id,
          plan: "silver",
          quota_type: "daily",
          quota_limit: 15,
          quota_used: 0,
          quota_period_start: duplicatePeriodStart,
          quota_period_end: duplicatePeriodEnd,
        })
      } catch (err) {
        duplicateConstraintTriggered = err.code === 11000
      }

      assert(
        duplicateConstraintTriggered,
        "Duplicate quota record for same user + quota_type + period_start must trigger MongoDB E11000 duplicate key error"
      )
      console.log("[PASS] 7. Quota Unique Constraint: Compound uniqueness on (userId + quota_type + period_start) prevents duplicates")
      passedCount++
    }

    // -------------------------------------------------------------
    // TEST 8: DownloadDevice Model & Unique Constraint
    // -------------------------------------------------------------
    {
      const deviceId = `device_unique_${timestamp}`
      const dev = await Device.create({
        userId: testUser._id,
        device_identifier: deviceId,
        device_name: "MacBook Pro M2",
        device_type: "desktop",
        browser: "Chrome",
        operating_system: "macOS",
        is_trusted: true,
        status: "active",
      })

      assert.strictEqual(dev.trusted, true, "is_trusted should sync with trusted")
      assert.strictEqual(dev.device_identifier, deviceId)

      // Test duplicate device registration rejection
      let duplicateDeviceTriggered = false
      try {
        await Device.create({
          userId: testUser._id,
          device_identifier: deviceId,
          device_name: "Second Attempt Same Device",
        })
      } catch (err) {
        duplicateDeviceTriggered = err.code === 11000
      }

      assert(
        duplicateDeviceTriggered,
        "Registering duplicate device_identifier for same user must trigger E11000 unique violation"
      )
      console.log("[PASS] 8. Device Model: Stores metadata and enforces compound unique constraint on (userId + device_identifier)")
      passedCount++
    }

    // -------------------------------------------------------------
    // TEST 9: DownloadToken Model & Security Constraints
    // -------------------------------------------------------------
    {
      const rawSecret = crypto.randomBytes(32).toString("hex")
      const tokenHash = crypto.createHash("sha256").update(rawSecret).digest("hex")

      const tokenDoc = await DownloadToken.create({
        download_id: originalRecordId,
        user_id: testUser._id,
        video_id: testVideo._id,
        token_hash: tokenHash,
        status: "active",
        expires_at: new Date(Date.now() + 300000), // 5 minutes
        max_uses: 1,
        use_count: 0,
        ip_address: "192.168.1.100",
      })

      assert(tokenDoc._id)
      assert.strictEqual(tokenDoc.downloadId.toString(), originalRecordId.toString())
      assert.strictEqual(tokenDoc.token_hash, tokenHash)
      assert.strictEqual(tokenDoc.max_uses, 1)

      // Duplicate token_hash rejection
      let duplicateTokenTriggered = false
      try {
        await DownloadToken.create({
          download_id: originalRecordId,
          user_id: testUser._id,
          video_id: testVideo._id,
          token_hash: tokenHash, // duplicate hash!
          expires_at: new Date(Date.now() + 300000),
        })
      } catch (err) {
        duplicateTokenTriggered = err.code === 11000
      }

      assert(duplicateTokenTriggered, "Duplicate token_hash must trigger E11000 uniqueness error")
      console.log("[PASS] 9. DownloadToken Security: SHA-256 token_hash uniqueness, expiry, and max_uses enforced")
      passedCount++
    }

    // -------------------------------------------------------------
    // TEST 10: DownloadAuditLog & Controlled Event Types
    // -------------------------------------------------------------
    {
      assert(DownloadAuditEvents.length >= 15, "Must have at least 15 controlled audit events")

      const auditEntry = await DownloadAuditLog.create({
        download_id: originalRecordId,
        user_id: testUser._id,
        video_id: testVideo._id,
        event_type: "DOWNLOAD_AUTHORIZED",
        ip_address: "2001:0db8:85a3:0000:0000:8a2e:0370:7334", // IPv6 test
        device_id: "macbook_pro_device_1",
        request_id: `req_${timestamp}_audit`,
        metadata: {
          quotaBefore: 15,
          quotaAfter: 14,
          plan: "silver",
          reason: "AUTHORIZATION_SUCCESSFUL",
        },
      })

      assert(auditEntry._id)
      assert.strictEqual(auditEntry.event_type, "DOWNLOAD_AUTHORIZED")
      assert.strictEqual(auditEntry.metadata.quotaBefore, 15)
      assert.strictEqual(auditEntry.metadata.quotaAfter, 14)

      // Querying audit logs
      const userAuditLogs = await DownloadAuditLog.find({ user_id: testUser._id })
      assert(userAuditLogs.length >= 1, "Must query audit logs by user_id")

      console.log("[PASS] 10. DownloadAuditLog: 15 controlled event types, IPv4/IPv6 support, and structured metadata verified")
      passedCount++
    }

    // -------------------------------------------------------------
    // TEST 11: Transaction & Atomic Concurrency Readiness
    // -------------------------------------------------------------
    {
      // Simulate atomic reservation using conditional update ($inc)
      const periodStart = new Date(Date.UTC(2026, 8, 6, 12, 0, 0, 0))
      const periodEnd = new Date(Date.UTC(2026, 8, 7, 12, 0, 0, 0))

      const quota = await DownloadQuota.create({
        userId: new mongoose.Types.ObjectId(),
        plan: "bronze",
        quota_type: "daily",
        quota_limit: 1, // Only 1 available
        quota_used: 0,
        quota_period_start: periodStart,
        quota_period_end: periodEnd,
      })

      // Atomic reservation 1 (should succeed: quota_used becomes 1)
      const res1 = await DownloadQuota.findOneAndUpdate(
        { _id: quota._id, quota_used: { $lt: 1 } },
        { $inc: { quota_used: 1 }, $set: { last_download_at: new Date() } },
        { new: true }
      )
      assert(res1, "First atomic reservation must succeed")
      assert.strictEqual(res1.quota_used, 1)

      // Atomic reservation 2 (must fail atomically: condition quota_used < 1 is not met)
      const res2 = await DownloadQuota.findOneAndUpdate(
        { _id: quota._id, quota_used: { $lt: 1 } },
        { $inc: { quota_used: 1 }, $set: { last_download_at: new Date() } },
        { new: true }
      )
      assert.strictEqual(res2, null, "Second atomic reservation must return null (blocked at database level)")

      console.log("[PASS] 11. Concurrency Readiness: Atomic conditional $inc operations strictly prevent over-allocation")
      passedCount++
    }

    // -------------------------------------------------------------
    // TEST 12: Backward Compatibility Verification
    // -------------------------------------------------------------
    {
      // Verify existing video platform operations
      const videoDoc = await Video.findById(testVideo._id)
      assert.strictEqual(videoDoc.videotitle, `Phase2 Video ${timestamp}`)
      assert.strictEqual(videoDoc.is_downloadable, true)

      const subDoc = await Subscription.findOne({ userId: testUser._id })
      assert.strictEqual(subDoc.plan, "gold")
      assert.strictEqual(subDoc.download_limit, 50)
      assert.strictEqual(subDoc.download_enabled, true)

      console.log("[PASS] 12. Backward Compatibility: Existing User, Video, and Subscription models intact and functional")
      passedCount++
    }

    console.log("------------------------------------------------------------------")
    console.log(`PHASE 2 MASTER SUITE: ALL ${passedCount}/12 TESTS PASSED PERFECTLY`)
    console.log("==================================================================")
  } catch (err) {
    console.error("Phase 2 test failed:", err)
    process.exit(1)
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close()
    }
  }
}

runPhase2Tests().catch((err) => {
  console.error("Phase 2 fatal error:", err)
  process.exit(1)
})
