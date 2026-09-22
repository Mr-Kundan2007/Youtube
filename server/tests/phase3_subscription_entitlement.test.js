/**
 * Phase 3: Subscription Plan & Download Entitlement System Master Test Suite
 *
 * Validates:
 * 1. Free User (No Paid Subscription -> Free Plan, downloadEnabled = true, quotaType = daily, limit = 1)
 * 2. Bronze User (Active Bronze -> Correct Bronze Entitlement: 5 downloads/day, 2 devices)
 * 3. Silver User (Active Silver -> Correct Silver Entitlement: 15 downloads/day, 5 devices)
 * 4. Gold User (Active Gold -> Correct Gold Entitlement: 50 downloads/day, 10 devices, 4k quality)
 * 5. Expired Subscription (Paid entitlement denied, fallback policy applied, SUBSCRIPTION_EXPIRED)
 * 6. Cancelled But Still Valid (Cancelled subscription remains active until expiresAt period end)
 * 7. Blocked Account (User account blocked -> Download access denied with ACCOUNT_BLOCKED)
 * 8. Invalid Plan Configuration (Validation error on malformed quota types or negative numbers)
 * 9. Plan Upgrade (Free -> Gold -> Next entitlement request returns Gold)
 * 10. Plan Downgrade (Gold -> Free -> New entitlement returns Free)
 * 11. Unlimited Plan Support (quota_type = unlimited -> downloadLimit: null)
 * 12. Read-Only Entitlement APIs (GET /api/downloads/entitlement & /api/subscription/entitlement)
 */

import assert from "assert"
import http from "http"
import jwt from "jsonwebtoken"
import mongoose from "mongoose"
import { authConfig, dbConfig, downloadConfig } from "../config/index.js"
import User from "../Modals/Auth.js"
import Subscription from "../Modals/Subscription.js"
import {
  downloadEntitlementService,
  EntitlementErrorCodes,
} from "../services/downloadEntitlementService.js"
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

const runPhase3MasterTests = async () => {
  console.log("==================================================================")
  console.log("PHASE 3: SUBSCRIPTION PLAN & DOWNLOAD ENTITLEMENT MASTER SUITE")
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
      console.log(`Phase 3 Test Server listening on port ${port}`)
      resolve()
    })
  })

  let passedCount = 0
  const timestamp = Date.now()

  try {
    // -------------------------------------------------------------
    // TEST 1: Free User (No Paid Subscription -> Free Plan)
    // -------------------------------------------------------------
    const freeUser = await User.create({
      name: `Free User ${timestamp}`,
      email: `free_user_${timestamp}@example.com`,
      role: "user",
      status: "active",
    })
    const freeToken = generateAuthToken(freeUser._id, freeUser.email)

    {
      const entResult = await downloadEntitlementService.getDownloadEntitlement(freeUser._id)
      assert.strictEqual(entResult.success, true)
      assert.strictEqual(entResult.data.plan, "Free")
      assert.strictEqual(entResult.data.downloadEnabled, true)
      assert.strictEqual(entResult.data.quotaType, "daily")
      assert.strictEqual(entResult.data.downloadLimit, 1)
      assert.strictEqual(entResult.data.deviceLimit, 1)
      assert.strictEqual(entResult.data.canDownload, true)

      console.log("[PASS] 1. Free User: Default plan returns downloadEnabled=true, quotaType=daily, limit=1")
      passedCount++
    }

    // -------------------------------------------------------------
    // TEST 2: Bronze User Entitlement
    // -------------------------------------------------------------
    const bronzeUser = await User.create({
      name: `Bronze User ${timestamp}`,
      email: `bronze_user_${timestamp}@example.com`,
      status: "active",
    })
    await Subscription.create({
      userId: bronzeUser._id,
      plan: "bronze",
      status: "active",
      startDate: new Date(),
      expiresAt: new Date(Date.now() + 30 * 86400000),
    })

    {
      const entResult = await downloadEntitlementService.getDownloadEntitlement(bronzeUser._id)
      assert.strictEqual(entResult.success, true)
      assert.strictEqual(entResult.data.plan, "Bronze")
      assert.strictEqual(entResult.data.downloadLimit, 5)
      assert.strictEqual(entResult.data.quotaType, "daily")
      assert.strictEqual(entResult.data.deviceLimit, 2)
      assert.strictEqual(entResult.data.canDownload, true)

      console.log("[PASS] 2. Bronze User: Resolves 5 downloads/day, 2 devices, downloadEnabled=true")
      passedCount++
    }

    // -------------------------------------------------------------
    // TEST 3: Silver User Entitlement
    // -------------------------------------------------------------
    const silverUser = await User.create({
      name: `Silver User ${timestamp}`,
      email: `silver_user_${timestamp}@example.com`,
      status: "active",
    })
    await Subscription.create({
      userId: silverUser._id,
      plan: "silver",
      status: "active",
      startDate: new Date(),
      expiresAt: new Date(Date.now() + 30 * 86400000),
    })

    {
      const entResult = await downloadEntitlementService.getDownloadEntitlement(silverUser._id)
      assert.strictEqual(entResult.success, true)
      assert.strictEqual(entResult.data.plan, "Silver")
      assert.strictEqual(entResult.data.downloadLimit, 15)
      assert.strictEqual(entResult.data.deviceLimit, 5)
      assert.strictEqual(entResult.data.canDownload, true)

      console.log("[PASS] 3. Silver User: Resolves 15 downloads/day, 5 devices, high-quality video tier")
      passedCount++
    }

    // -------------------------------------------------------------
    // TEST 4: Gold User Entitlement
    // -------------------------------------------------------------
    const goldUser = await User.create({
      name: `Gold User ${timestamp}`,
      email: `gold_user_${timestamp}@example.com`,
      status: "active",
    })
    await Subscription.create({
      userId: goldUser._id,
      plan: "gold",
      status: "active",
      startDate: new Date(),
      expiresAt: new Date(Date.now() + 30 * 86400000),
    })

    {
      const entResult = await downloadEntitlementService.getDownloadEntitlement(goldUser._id)
      assert.strictEqual(entResult.success, true)
      assert.strictEqual(entResult.data.plan, "Gold")
      assert.strictEqual(entResult.data.downloadLimit, 50)
      assert.strictEqual(entResult.data.deviceLimit, 10)
      assert.strictEqual(entResult.data.download.maxQuality, "4k")
      assert.strictEqual(entResult.data.canDownload, true)

      console.log("[PASS] 4. Gold User: Resolves 50 downloads/day, 10 devices, 4K quality cap")
      passedCount++
    }

    // -------------------------------------------------------------
    // TEST 5: Expired Subscription (Fallback Policy Applied)
    // -------------------------------------------------------------
    const expiredUser = await User.create({
      name: `Expired User ${timestamp}`,
      email: `expired_${timestamp}@example.com`,
      status: "active",
    })
    await Subscription.create({
      userId: expiredUser._id,
      plan: "silver",
      status: "active",
      startDate: new Date(Date.now() - 31 * 86400000),
      expiresAt: new Date(Date.now() - 3600000), // expired 1 hour ago
    })

    {
      const entResult = await downloadEntitlementService.getDownloadEntitlement(expiredUser._id)
      assert.strictEqual(entResult.success, false)
      assert.strictEqual(entResult.code, EntitlementErrorCodes.SUBSCRIPTION_EXPIRED)
      assert.strictEqual(entResult.data.isExpired, true)
      assert.strictEqual(entResult.data.canDownload, false)
      assert.strictEqual(entResult.data.plan, "Free", "Must fall back to Free plan tier upon expiration")

      console.log("[PASS] 5. Expired Subscription: Paid privileges removed; SUBSCRIPTION_EXPIRED emitted with Free fallback")
      passedCount++
    }

    // -------------------------------------------------------------
    // TEST 6: Cancelled But Still Valid Subscription
    // -------------------------------------------------------------
    const cancelledUser = await User.create({
      name: `Cancelled User ${timestamp}`,
      email: `cancelled_${timestamp}@example.com`,
      status: "active",
    })
    // Cancelled yesterday, but paid until 20 days in the future
    await Subscription.create({
      userId: cancelledUser._id,
      plan: "silver",
      status: "cancelled",
      startDate: new Date(Date.now() - 10 * 86400000),
      expiresAt: new Date(Date.now() + 20 * 86400000),
    })

    {
      const entResult = await downloadEntitlementService.getDownloadEntitlement(cancelledUser._id)
      assert.strictEqual(entResult.success, true, "Cancelled subscription before expiresAt must remain valid")
      assert.strictEqual(entResult.data.plan, "Silver")
      assert.strictEqual(entResult.data.subscriptionValid, true)
      assert.strictEqual(entResult.data.canDownload, true)

      console.log("[PASS] 6. Cancelled Subscription: Preserves active entitlement until period end (expiresAt)")
      passedCount++
    }

    // -------------------------------------------------------------
    // TEST 7: Blocked Account Access Denial
    // -------------------------------------------------------------
    const blockedUser = await User.create({
      name: `Blocked User ${timestamp}`,
      email: `blocked_${timestamp}@example.com`,
      status: "blocked",
    })

    {
      const entResult = await downloadEntitlementService.getDownloadEntitlement(blockedUser._id)
      assert.strictEqual(entResult.success, false)
      assert.strictEqual(entResult.code, EntitlementErrorCodes.ACCOUNT_BLOCKED)
      assert.strictEqual(entResult.data.canDownload, false)
      assert.strictEqual(entResult.data.downloadEnabled, false)

      console.log("[PASS] 7. Blocked Account: Access strictly denied with ACCOUNT_BLOCKED")
      passedCount++
    }

    // -------------------------------------------------------------
    // TEST 8: Invalid Plan Configuration Validation
    // -------------------------------------------------------------
    {
      assert.throws(() => {
        downloadEntitlementService.validatePlanConfiguration({
          quotaType: "INVALID_CYCLE",
        })
      }, /Invalid quota_type/)

      assert.throws(() => {
        downloadEntitlementService.validatePlanConfiguration({
          quotaType: "daily",
          quotaLimit: -5,
        })
      }, /quotaLimit must be a non-negative number/)

      assert.throws(() => {
        downloadEntitlementService.validatePlanConfiguration({
          quotaType: "unlimited",
          quotaLimit: 100, // Unlimited cannot have positive numeric limit
        })
      }, /Unlimited quotaType must specify quotaLimit as null/)

      console.log("[PASS] 8. Plan Config Validation: Malformed quota types, negative limits, and invalid unlimited values rejected")
      passedCount++
    }

    // -------------------------------------------------------------
    // TEST 9: Plan Upgrade Workflow (Free -> Gold)
    // -------------------------------------------------------------
    const upUser = await User.create({
      name: `Upgrader ${timestamp}`,
      email: `upgrader_${timestamp}@example.com`,
      status: "active",
    })

    {
      const initialEnt = await downloadEntitlementService.getDownloadEntitlement(upUser._id)
      assert.strictEqual(initialEnt.data.plan, "Free")
      assert.strictEqual(initialEnt.data.downloadLimit, 1)

      // Upgrade to Gold
      await subscriptionService.upgradeSubscription(upUser._id, "gold", 30)

      const upgradedEnt = await downloadEntitlementService.getDownloadEntitlement(upUser._id)
      assert.strictEqual(upgradedEnt.data.plan, "Gold")
      assert.strictEqual(upgradedEnt.data.downloadLimit, 50)
      assert.strictEqual(upgradedEnt.data.deviceLimit, 10)

      console.log("[PASS] 9. Upgrade Workflow: Instant transition from Free to Gold reflected on subsequent entitlement query")
      passedCount++
    }

    // -------------------------------------------------------------
    // TEST 10: Plan Downgrade Workflow (Gold -> Free)
    // -------------------------------------------------------------
    {
      await subscriptionService.upgradeSubscription(upUser._id, "free")

      const downgradedEnt = await downloadEntitlementService.getDownloadEntitlement(upUser._id)
      assert.strictEqual(downgradedEnt.data.plan, "Free")
      assert.strictEqual(downgradedEnt.data.downloadLimit, 1)
      assert.strictEqual(downgradedEnt.data.deviceLimit, 1)

      console.log("[PASS] 10. Downgrade Workflow: Downgrade to Free plan immediately reverts limits to 1 download/day")
      passedCount++
    }

    // -------------------------------------------------------------
    // TEST 11: Unlimited Plan Entitlement Representation
    // -------------------------------------------------------------
    const unlimitedUser = await User.create({
      name: `Unlimited User ${timestamp}`,
      email: `unlimited_${timestamp}@example.com`,
      status: "active",
    })
    await Subscription.create({
      userId: unlimitedUser._id,
      plan: "gold",
      status: "active",
      download_limit: null, // Unlimited
      download_quota_type: "unlimited",
      download_enabled: true,
      expiresAt: new Date(Date.now() + 30 * 86400000),
    })

    {
      const ent = await downloadEntitlementService.getDownloadEntitlement(unlimitedUser._id)
      assert.strictEqual(ent.data.quotaType, "unlimited")
      assert.strictEqual(ent.data.downloadLimit, null, "Unlimited plan limit must be null, not a fake number")
      assert.strictEqual(ent.data.canDownload, true)

      console.log("[PASS] 11. Unlimited Plan: Returned with quotaType=unlimited and downloadLimit=null (no fake numbers)")
      passedCount++
    }

    // -------------------------------------------------------------
    // TEST 12: Read-Only Entitlement API Endpoints
    // -------------------------------------------------------------
    {
      // 1. GET /api/downloads/entitlement
      const resDownloads = await request({
        path: "/api/downloads/entitlement",
        method: "GET",
        headers: { Authorization: `Bearer ${freeToken}` },
      })
      assert.strictEqual(resDownloads.statusCode, 200)
      assert.strictEqual(resDownloads.body.success, true)
      assert.strictEqual(resDownloads.body.data.plan, "Free")
      assert.strictEqual(resDownloads.body.data.download.limit, 1)

      // 2. GET /api/subscription/entitlement
      const resSubscription = await request({
        path: "/api/subscription/entitlement",
        method: "GET",
        headers: { Authorization: `Bearer ${freeToken}` },
      })
      assert.strictEqual(resSubscription.statusCode, 200)
      assert.strictEqual(resSubscription.body.data.plan, "Free")

      // 3. Unauthenticated request to /api/downloads/entitlement
      const resUnauth = await request({
        path: "/api/downloads/entitlement",
        method: "GET",
      })
      assert.strictEqual(resUnauth.statusCode, 401)

      console.log("[PASS] 12. Read-Only Entitlement API: GET /api/downloads/entitlement & /api/subscription/entitlement authenticated and verified")
      passedCount++
    }

    console.log("------------------------------------------------------------------")
    console.log(`PHASE 3 MASTER SUITE: ALL ${passedCount}/12 TESTS PASSED PERFECTLY`)
    console.log("==================================================================")
  } catch (err) {
    console.error("Phase 3 master test failed:", err)
    process.exit(1)
  } finally {
    server.close()
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close()
    }
  }
}

runPhase3MasterTests().catch((err) => {
  console.error("Phase 3 fatal error:", err)
  process.exit(1)
})
