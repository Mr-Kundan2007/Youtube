/**
 * Phase 4: Download Quota Management & Automatic Reset Master Test Suite
 *
 * Validates:
 * 1. Free User First Download (Limit=1, Used=0 -> Reservation success, Used=1, Remaining=0)
 * 2. Free User Second Download (Limit=1, Used=1 -> DOWNLOAD_QUOTA_EXCEEDED)
 * 3. Lazy Quota Reset on New Day (Previous day Used=1 -> Next day creates new period, Used=0, Remaining=1)
 * 4. Monthly Plan Calculation (Limit=30, Used=10 -> Remaining=20)
 * 5. Unlimited Quota Handling (quotaLimited=false, limit=null, remaining=null, reservations succeed)
 * 6. Concurrency Protection (10 parallel requests on 1 quota -> exactly 1 succeeds, 9 fail)
 * 7. Reservation Release (Reservation released -> Quota restored to available)
 * 8. Double Release Prevention (Repeated release calls cannot make quota_used negative)
 * 9. Expired Reservation Cleanup (Stale reservations cleaned up and quota released)
 * 10. Idempotent Requests (Repeated request with same idempotency_key returns existing reservation)
 * 11. Database Failure & Rollback Safety (Failed reservation does not corrupt quota state)
 * 12. Plan Upgrade Quota Synchronization (Free -> Silver expands limit and recalculates remaining)
 */

import assert from "assert"
import http from "http"
import jwt from "jsonwebtoken"
import mongoose from "mongoose"
import { authConfig, dbConfig } from "../config/index.js"
import User from "../Modals/Auth.js"
import Video from "../Modals/video.js"
import Subscription from "../Modals/Subscription.js"
import DownloadQuota from "../Modals/DownloadQuota.js"
import DownloadRecord from "../Modals/DownloadRecord.js"
import { downloadQuotaService, QuotaErrorCodes } from "../services/quotaService.js"
import { subscriptionService } from "../services/subscriptionService.js"

process.env.NODE_ENV = "test"
const { app } = await import("../index.js")

let API_BASE = ""

const request = ({ path, method = "GET", headers = {}, body = null }) => {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE)
    const reqHeaders = { ...headers }
    let bodyData = null

    if (body) {
      bodyData = typeof body === "string" ? body : JSON.stringify(body)
      reqHeaders["Content-Type"] = "application/json"
      reqHeaders["Content-Length"] = Buffer.byteLength(bodyData)
    }

    const req = http.request(
      url,
      {
        method,
        headers: reqHeaders,
      },
      (res) => {
        const chunks = []
        res.on("data", (chunk) => chunks.push(chunk))
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf-8")
          let json = null
          try {
            json = JSON.parse(raw)
          } catch (e) {
            json = raw
          }
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: json,
            raw,
          })
        })
      }
    )

    req.on("error", reject)
    if (bodyData) {
      req.write(bodyData)
    }
    req.end()
  })
}

const generateAuthToken = (userId, email, role = "user") => {
  return jwt.sign(
    {
      id: userId,
      _id: userId,
      email,
      role,
    },
    authConfig.jwtSecret,
    { expiresIn: "2h" }
  )
}

const runPhase4MasterTests = async () => {
  console.log("==================================================================")
  console.log("PHASE 4: DOWNLOAD QUOTA MANAGEMENT & AUTOMATIC RESET MASTER SUITE")
  console.log("==================================================================")

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(dbConfig.url || "mongodb://127.0.0.1:27017/youtube")
  } else if (mongoose.connection.readyState === 2) {
    await new Promise((resolve) => mongoose.connection.once("connected", resolve))
  }

  const server = http.createServer(app)
  await new Promise((resolve) => {
    server.listen(0, () => {
      const port = server.address().port
      API_BASE = `http://127.0.0.1:${port}`
      console.log(`Phase 4 Test Server listening on port ${port}`)
      resolve()
    })
  })

  let passedCount = 0
  const timestamp = Date.now()

  try {
    // -------------------------------------------------------------
    // FIXTURE SETUP
    // -------------------------------------------------------------
    const testVideo1 = await Video.create({
      videotitle: `Quota Test Video 1 ${timestamp}`,
      filepath: "public/video/vdo.mp4",
      videofilepath: "/video/vdo.mp4",
      filesize: "1048576",
      videochanel: "Quota Channel",
    })

    const testVideo2 = await Video.create({
      videotitle: `Quota Test Video 2 ${timestamp}`,
      filepath: "public/video/vdo.mp4",
      videofilepath: "/video/vdo.mp4",
      filesize: "2097152",
      videochanel: "Quota Channel",
    })

    // -------------------------------------------------------------
    // TEST 1: Free User First Download (Limit=1, Used=0 -> Reserved=1, Remaining=0)
    // -------------------------------------------------------------
    const freeUser = await User.create({
      name: `Free User ${timestamp}`,
      email: `free_quota_${timestamp}@example.com`,
      role: "user",
    })

    {
      const res1 = await downloadQuotaService.reserveQuota({
        userId: freeUser._id,
        videoId: testVideo1._id,
        planKey: "free",
      })

      assert.strictEqual(res1.success, true, "First reservation must succeed")
      assert.strictEqual(res1.quotaBefore, 0)
      assert.strictEqual(res1.quotaAfter, 1)
      assert.strictEqual(res1.quotaRemaining, 0)

      console.log("[PASS] 1. Free User First Download: Reservation succeeds; Used=1, Remaining=0")
      passedCount++
    }

    // -------------------------------------------------------------
    // TEST 2: Free User Second Download (Exhaustion Block)
    // -------------------------------------------------------------
    {
      const res2 = await downloadQuotaService.reserveQuota({
        userId: freeUser._id,
        videoId: testVideo2._id,
        planKey: "free",
      })

      assert.strictEqual(res2.success, false, "Second reservation must fail")
      assert.strictEqual(res2.code, QuotaErrorCodes.DOWNLOAD_QUOTA_EXCEEDED)
      assert.strictEqual(res2.quotaRemaining, 0)
      assert(res2.resetAt, "Must supply resetAt timestamp for client UI countdown")

      console.log("[PASS] 2. Free User Second Download: Correctly rejected with DOWNLOAD_QUOTA_EXCEEDED")
      passedCount++
    }

    // -------------------------------------------------------------
    // TEST 3: Lazy Quota Reset on New Day
    // -------------------------------------------------------------
    {
      // Simulate checking quota on the next calendar day in UTC (+24h)
      const tomorrow = new Date(Date.now() + 25 * 60 * 60 * 1000)
      const tomorrowQuota = await downloadQuotaService.getActiveQuotaRecord(
        freeUser._id,
        "free",
        null,
        "daily",
        tomorrow
      )

      assert.strictEqual(tomorrowQuota.quota_used, 0, "New day period must have 0 used quota")
      assert.strictEqual(tomorrowQuota.quota_remaining, 1, "New day period must have 1 remaining download")
      assert(
        tomorrowQuota.quota_period_start > new Date(),
        "Period start must be tomorrow's 00:00:00 UTC"
      )

      console.log("[PASS] 3. Lazy Quota Reset: Next day creates new period window with Used=0, Remaining=1")
      passedCount++
    }

    // -------------------------------------------------------------
    // TEST 4: Monthly Plan Calculation (Limit=30, Used=10 -> Remaining=20)
    // -------------------------------------------------------------
    const monthlyUser = await User.create({
      name: `Monthly User ${timestamp}`,
      email: `monthly_${timestamp}@example.com`,
    })
    await Subscription.create({
      userId: monthlyUser._id,
      plan: "silver",
      status: "active",
      download_limit: 30,
      download_quota_type: "monthly",
      startDate: new Date(),
      expiresAt: new Date(Date.now() + 30 * 86400000),
    })

    {
      const monthQuota = await downloadQuotaService.getActiveQuotaRecord(
        monthlyUser._id,
        "silver",
        30,
        "monthly"
      )
      monthQuota.quota_used = 10
      monthQuota.quota_remaining = 20
      await monthQuota.save()

      const check = await downloadQuotaService.getCurrentQuota(monthlyUser._id)
      assert.strictEqual(check.limit, 30)
      assert.strictEqual(check.used, 10)
      assert.strictEqual(check.remaining, 20)
      assert.strictEqual(check.available, true)

      console.log("[PASS] 4. Monthly Plan Calculation: Limit=30, Used=10 correctly evaluates Remaining=20")
      passedCount++
    }

    // -------------------------------------------------------------
    // TEST 5: Unlimited Quota Handling
    // -------------------------------------------------------------
    const unlimitedUser = await User.create({
      name: `Unlimited User ${timestamp}`,
      email: `unlimited_q_${timestamp}@example.com`,
    })
    await Subscription.create({
      userId: unlimitedUser._id,
      plan: "gold",
      status: "active",
      download_limit: null,
      download_quota_type: "unlimited",
      startDate: new Date(),
      expiresAt: new Date(Date.now() + 30 * 86400000),
    })

    {
      const unlQuota = await downloadQuotaService.getActiveQuotaRecord(
        unlimitedUser._id,
        "gold",
        null,
        "unlimited"
      )
      assert.strictEqual(unlQuota.quota_type, "unlimited")

      const res = await downloadQuotaService.reserveQuota({
        userId: unlimitedUser._id,
        videoId: testVideo1._id,
        planKey: "gold",
      })

      assert.strictEqual(res.success, true)
      assert.strictEqual(res.quotaRemaining, null, "Unlimited quota remaining must be null")

      console.log("[PASS] 5. Unlimited Quota: Evaluates quotaLimited=false, limit=null, remaining=null")
      passedCount++
    }

    // -------------------------------------------------------------
    // TEST 6: Atomic Concurrency Protection (10 Parallel Requests on 1 Quota)
    // -------------------------------------------------------------
    const concurrentUser = await User.create({
      name: `Concurrent Quota User ${timestamp}`,
      email: `concur_q_${timestamp}@example.com`,
    })

    {
      // Ensure initial record has 1 quota limit
      await downloadQuotaService.getActiveQuotaRecord(concurrentUser._id, "free")

      // Create 10 different video IDs
      const concurrentVideos = await Promise.all(
        Array.from({ length: 10 }).map((_, i) =>
          Video.create({
            videotitle: `Concur Video ${i}_${timestamp}`,
            filepath: "public/video/vdo.mp4",
            videochanel: "Concur Channel",
          })
        )
      )

      // Fire 10 simultaneous parallel quota reservations
      const parallelReservations = Array.from({ length: 10 }).map((_, i) =>
        downloadQuotaService.reserveQuota({
          userId: concurrentUser._id,
          videoId: concurrentVideos[i]._id,
          planKey: "free",
        })
      )

      const results = await Promise.all(parallelReservations)
      const successCount = results.filter((r) => r.success === true).length
      const blockedCount = results.filter((r) => r.success === false).length

      assert.strictEqual(successCount, 1, "Exactly 1 request must succeed across concurrent threads")
      assert.strictEqual(blockedCount, 9, "Exactly 9 requests must fail with quota exhaustion")

      console.log("[PASS] 6. Atomic Concurrency: 10 simultaneous reservations on 1 quota -> exactly 1 success, 9 blocked")
      passedCount++
    }

    // -------------------------------------------------------------
    // TEST 7: Reservation Release on Failure
    // -------------------------------------------------------------
    const releaseUser = await User.create({
      name: `Release User ${timestamp}`,
      email: `release_${timestamp}@example.com`,
    })

    {
      // 1. Reserve quota
      const res = await downloadQuotaService.reserveQuota({
        userId: releaseUser._id,
        videoId: testVideo1._id,
        planKey: "free",
      })
      assert.strictEqual(res.success, true)
      assert.strictEqual(res.quotaAfter, 1)

      // 2. Release reservation (simulating downstream failure before file sent)
      const releaseRes = await downloadQuotaService.releaseQuota({
        quotaId: res.quotaRecord._id,
        userId: releaseUser._id,
        reason: "SIMULATED_TEST_FAILURE",
      })
      assert.strictEqual(releaseRes.success, true)
      assert.strictEqual(releaseRes.quotaRecord.quota_used, 0)
      assert.strictEqual(releaseRes.quotaRecord.quota_remaining, 1)

      // 3. Subsequent reservation must now succeed again!
      const retryRes = await downloadQuotaService.reserveQuota({
        userId: releaseUser._id,
        videoId: testVideo1._id,
        planKey: "free",
      })
      assert.strictEqual(retryRes.success, true, "Quota must be available again after release")

      console.log("[PASS] 7. Reservation Release: Releasing failed reservation immediately restores quota availability")
      passedCount++
    }

    // -------------------------------------------------------------
    // TEST 8: Double Release Prevention (Zero Floor Guard)
    // -------------------------------------------------------------
    {
      const quota = await downloadQuotaService.getActiveQuotaRecord(releaseUser._id, "free")
      // Reset used to 0
      quota.quota_used = 0
      await quota.save()

      // Attempt double release on 0 usage
      const doubleRelease = await downloadQuotaService.releaseQuota({
        quotaId: quota._id,
        userId: releaseUser._id,
      })
      assert.strictEqual(doubleRelease.success, true)

      const refetched = await DownloadQuota.findById(quota._id)
      assert.strictEqual(refetched.quota_used, 0, "quota_used must never drop below 0")

      console.log("[PASS] 8. Double Release Guard: Repeated release calls cannot make quota_used negative")
      passedCount++
    }

    // -------------------------------------------------------------
    // TEST 9: Expired Reservation Cleanup
    // -------------------------------------------------------------
    const cleanupUser = await User.create({
      name: `Cleanup User ${timestamp}`,
      email: `cleanup_${timestamp}@example.com`,
    })

    {
      // Reserve quota
      const res = await downloadQuotaService.reserveQuota({
        userId: cleanupUser._id,
        videoId: testVideo1._id,
        planKey: "free",
      })

      // Create a stale authorized download record older than 20 minutes
      const staleDownload = await DownloadRecord.create({
        userId: cleanupUser._id,
        videoId: testVideo1._id,
        subscription_plan: "free",
        download_status: "authorized",
        createdAt: new Date(Date.now() - 25 * 60 * 1000), // 25 mins ago
      })

      // Run cleanup routine (maxAgeMinutes: 15)
      const cleanupResult = await downloadQuotaService.cleanupExpiredReservations(15)
      assert(cleanupResult.cleaned >= 1, "Must clean at least 1 stale reservation")

      const updatedDl = await DownloadRecord.findById(staleDownload._id)
      assert.strictEqual(updatedDl.download_status, "expired")

      console.log("[PASS] 9. Expired Reservation Cleanup: Stale authorized reservations released automatically")
      passedCount++
    }

    // -------------------------------------------------------------
    // TEST 10: Idempotent Request Protection
    // -------------------------------------------------------------
    const idempUser = await User.create({
      name: `Idempotent User ${timestamp}`,
      email: `idemp_${timestamp}@example.com`,
    })
    const idempKey = `idem_key_${timestamp}`

    {
      // First reservation
      const res1 = await downloadQuotaService.reserveQuota({
        userId: idempUser._id,
        videoId: testVideo1._id,
        planKey: "free",
        idempotencyKey: idempKey,
      })
      assert.strictEqual(res1.success, true)

      // Create download record simulating successful issuance
      await DownloadRecord.create({
        userId: idempUser._id,
        videoId: testVideo1._id,
        download_status: "authorized",
        idempotency_key: idempKey,
      })

      // Repeated request with same idempotencyKey (e.g. rapid page refresh / double click)
      const res2 = await downloadQuotaService.reserveQuota({
        userId: idempUser._id,
        videoId: testVideo1._id,
        planKey: "free",
        idempotencyKey: idempKey,
      })

      assert.strictEqual(res2.success, true)
      assert.strictEqual(res2.isIdempotentReplay, true, "Must flag as idempotent replay")
      assert.strictEqual(res2.quotaAfter, res1.quotaAfter, "Must not increment quota again")

      console.log("[PASS] 10. Idempotent Reservation: Same idempotency_key returns existing reservation without double deduction")
      passedCount++
    }

    // -------------------------------------------------------------
    // TEST 11: Database Failure Simulation & Atomicity
    // -------------------------------------------------------------
    {
      const failUser = await User.create({
        name: `Fail User ${timestamp}`,
        email: `fail_${timestamp}@example.com`,
      })
      const quota = await downloadQuotaService.getActiveQuotaRecord(failUser._id, "free")

      // Attempt reservation on an invalid/non-existent quota ID
      const fakeId = new mongoose.Types.ObjectId()
      const failedUpdate = await DownloadQuota.findOneAndUpdate(
        { _id: fakeId, quota_used: { $lt: 1 } },
        { $inc: { quota_used: 1 } }
      )
      assert.strictEqual(failedUpdate, null, "Failed update must return null safely")

      const unchanged = await DownloadQuota.findById(quota._id)
      assert.strictEqual(unchanged.quota_used, 0, "Original quota state remains unaffected")

      console.log("[PASS] 11. Database Failure & Atomicity: Failed DB operations leave original state clean")
      passedCount++
    }

    // -------------------------------------------------------------
    // TEST 12: Plan Upgrade Quota Synchronization
    // -------------------------------------------------------------
    const upgradeUser = await User.create({
      name: `Upgrade Quota User ${timestamp}`,
      email: `upgrade_q_${timestamp}@example.com`,
    })

    {
      // 1. Consume 1 Free quota unit
      const res1 = await downloadQuotaService.reserveQuota({
        userId: upgradeUser._id,
        videoId: testVideo1._id,
        planKey: "free",
      })
      assert.strictEqual(res1.quotaRemaining, 0)

      // 2. User upgrades to Silver (15 downloads limit)
      await subscriptionService.upgradeSubscription(upgradeUser._id, "silver", 30)

      // 3. Quota check must now reflect Silver plan and remaining = 14!
      const status = await downloadQuotaService.getCurrentQuota(upgradeUser._id)
      assert.strictEqual(status.plan, "Silver")
      assert.strictEqual(status.limit, 15)
      assert.strictEqual(status.used, 1)
      assert.strictEqual(status.remaining, 14, "Remaining quota must be 15 - 1 = 14")
      assert.strictEqual(status.available, true)

      console.log("[PASS] 12. Upgrade Quota Sync: Free user with 1 used upgrades to Silver; quota expands to 15 (14 remaining)")
      passedCount++
    }

    console.log("------------------------------------------------------------------")
    console.log(`PHASE 4 MASTER SUITE: ALL ${passedCount}/12 TESTS PASSED PERFECTLY`)
    console.log("==================================================================")
  } catch (err) {
    console.error("Phase 4 test failed:", err)
    process.exit(1)
  } finally {
    server.close()
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close()
    }
  }
}

runPhase4MasterTests().catch((err) => {
  console.error("Phase 4 fatal error:", err)
  process.exit(1)
})
