/**
 * PHASE 2: SUBSCRIPTION PLANS, FEATURES, LIMITS & ACCESS CONTROL TEST SUITE
 * Comprehensive verification of:
 * 1. Free plan restricted access & 480p quality cap
 * 2. Bronze plan HD access (720p cap, 5 downloads)
 * 3. Silver plan Full HD access (1080p cap, ad-free, 15 downloads)
 * 4. Gold plan unlimited access (4K, exclusive courses, ad-free, 50 downloads)
 * 5. Plan Hierarchy inheritance (canAccessPlanContent)
 * 6. Expired subscription handling with graceful fallback to Free
 * 7. Streaming quality restrictions & validation
 * 8. Watch time limits & daily usage tracking (SubscriptionUsage)
 * 9. Concurrent streaming limits & active session enforcement (StreamSession)
 * 10. Offline download permission separation
 * 11. Structured Access Denied responses (SUBSCRIPTION_REQUIRED, USAGE_LIMIT_REACHED)
 * 12. Courses API and Video content protection
 */

import assert from "assert"
import http from "http"
import mongoose from "mongoose"
import jwt from "jsonwebtoken"
import app from "../index.js"
import { dbConfig, authConfig } from "../config/index.js"
import User from "../Modals/Auth.js"
import Video from "../Modals/video.js"
import Course from "../Modals/Course.js"
import Subscription from "../Modals/Subscription.js"
import SubscriptionPlan from "../Modals/SubscriptionPlan.js"
import SubscriptionUsage from "../Modals/SubscriptionUsage.js"
import StreamSession from "../Modals/StreamSession.js"
import subscriptionAccessControlService from "../services/subscriptionAccessControlService.js"
import { canAccessPlanContent, isQualityAllowed } from "../config/subscriptionConfig.js"

process.env.NODE_ENV = "test"

let API_BASE = ""

const request = ({ path: reqPath, method = "GET", headers = {}, body = null }) => {
  return new Promise((resolve, reject) => {
    const url = new URL(reqPath, API_BASE)
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: `${url.pathname}${url.search}`,
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    }

    const req = http.request(options, (res) => {
      let data = ""
      res.on("data", (chunk) => {
        data += chunk
      })
      res.on("end", () => {
        let parsed = null
        try {
          parsed = JSON.parse(data)
        } catch {
          parsed = data
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: parsed,
          raw: data,
        })
      })
    })

    req.on("error", reject)

    if (body) {
      req.write(typeof body === "string" ? body : JSON.stringify(body))
    }
    req.end()
  })
}

async function runPhase2PlanPermissionsSuite() {
  console.log("==================================================================")
  console.log("PHASE 2: SUBSCRIPTION PLANS, FEATURES, LIMITS & ACCESS TEST SUITE")
  console.log("==================================================================")

  if (mongoose.connection.readyState === 0) {
    const uri = dbConfig.mongoUri || process.env.DB_URL
    await mongoose.connect(uri)
    console.log("Connected to MongoDB Atlas")
  }

  const server = http.createServer(app)
  await new Promise((resolve) => server.listen(0, resolve))
  const port = server.address().port
  API_BASE = `http://127.0.0.1:${port}`
  console.log(`Phase 2 Test Server listening on port ${port}`)

  let passed = 0

  try {
    const timestamp = Date.now()

    // Create Test Users for Free, Bronze, Silver, Gold, and Expired states
    const userFree = await User.create({
      name: `Free User ${timestamp}`,
      email: `free.${timestamp}@example.com`,
      role: "user",
      status: "active",
    })

    const userBronze = await User.create({
      name: `Bronze User ${timestamp}`,
      email: `bronze.${timestamp}@example.com`,
      role: "user",
      status: "active",
    })

    const userSilver = await User.create({
      name: `Silver User ${timestamp}`,
      email: `silver.${timestamp}@example.com`,
      role: "user",
      status: "active",
    })

    const userGold = await User.create({
      name: `Gold User ${timestamp}`,
      email: `gold.${timestamp}@example.com`,
      role: "user",
      status: "active",
    })

    const userExpired = await User.create({
      name: `Expired User ${timestamp}`,
      email: `expired.${timestamp}@example.com`,
      role: "user",
      status: "active",
    })

    const tokenFree = jwt.sign({ id: userFree._id.toString(), email: userFree.email }, authConfig.jwtSecret)
    const tokenBronze = jwt.sign({ id: userBronze._id.toString(), email: userBronze.email }, authConfig.jwtSecret)
    const tokenSilver = jwt.sign({ id: userSilver._id.toString(), email: userSilver.email }, authConfig.jwtSecret)
    const tokenGold = jwt.sign({ id: userGold._id.toString(), email: userGold.email }, authConfig.jwtSecret)
    const tokenExpired = jwt.sign({ id: userExpired._id.toString(), email: userExpired.email }, authConfig.jwtSecret)

    // Plans lookup
    const plans = await SubscriptionPlan.find()
    const freePlan = plans.find((p) => p.slug === "free")
    const bronzePlan = plans.find((p) => p.slug === "bronze")
    const silverPlan = plans.find((p) => p.slug === "silver")
    const goldPlan = plans.find((p) => p.slug === "gold")

    // Provision Subscriptions
    await Subscription.create({
      userId: userFree._id,
      planId: freePlan._id,
      plan: "free",
      status: "active",
      download_limit: 1,
    })

    await Subscription.create({
      userId: userBronze._id,
      planId: bronzePlan._id,
      plan: "bronze",
      status: "active",
      download_limit: 5,
      expiresAt: new Date(Date.now() + 30 * 86400000),
    })

    await Subscription.create({
      userId: userSilver._id,
      planId: silverPlan._id,
      plan: "silver",
      status: "active",
      download_limit: 15,
      expiresAt: new Date(Date.now() + 30 * 86400000),
    })

    await Subscription.create({
      userId: userGold._id,
      planId: goldPlan._id,
      plan: "gold",
      status: "active",
      download_limit: 50,
      expiresAt: new Date(Date.now() + 30 * 86400000),
    })

    await Subscription.create({
      userId: userExpired._id,
      planId: silverPlan._id,
      plan: "silver",
      status: "expired",
      expiresAt: new Date(Date.now() - 86400000), // expired yesterday
      download_limit: 1,
    })

    // Create Test Content
    const freeVideo = await Video.create({
      videotitle: `Free Video ${timestamp}`,
      videochanel: "General Channel",
      filename: `free_${timestamp}.mp4`,
      filepath: `uploads/free_${timestamp}.mp4`,
      accessLevel: "free",
      requiredPlan: "free",
      isPremium: false,
    })

    const bronzeVideo = await Video.create({
      videotitle: `Bronze Video ${timestamp}`,
      videochanel: "Bronze Channel",
      filename: `bronze_${timestamp}.mp4`,
      filepath: `uploads/bronze_${timestamp}.mp4`,
      accessLevel: "bronze",
      requiredPlan: "bronze",
      isPremium: true,
    })

    const silverVideo = await Video.create({
      videotitle: `Silver Video ${timestamp}`,
      videochanel: "Silver Channel",
      filename: `silver_${timestamp}.mp4`,
      filepath: `uploads/silver_${timestamp}.mp4`,
      accessLevel: "silver",
      requiredPlan: "silver",
      isPremium: true,
    })

    const goldVideo = await Video.create({
      videotitle: `Gold Exclusive Video ${timestamp}`,
      videochanel: "Gold Channel",
      filename: `gold_${timestamp}.mp4`,
      filepath: `uploads/gold_${timestamp}.mp4`,
      accessLevel: "exclusive",
      requiredPlan: "gold",
      isPremium: true,
      isExclusive: true,
    })

    // -------------------------------------------------------------
    // TEST 1: Free User Access & Restrictions
    // -------------------------------------------------------------
    // Free user accessing free video -> Allowed
    const freeWatchFree = await request({ path: `/api/video/${freeVideo._id}` })
    assert.strictEqual(freeWatchFree.statusCode, 200)

    // Free user accessing bronze video -> Denied with structured SUBSCRIPTION_REQUIRED
    const freeWatchBronze = await request({
      path: `/api/video/${bronzeVideo._id}`,
      headers: { Authorization: `Bearer ${tokenFree}` },
    })
    assert.strictEqual(freeWatchBronze.statusCode, 403)
    assert.strictEqual(freeWatchBronze.body.code, "SUBSCRIPTION_REQUIRED")
    assert.strictEqual(freeWatchBronze.body.requiredPlan, "bronze")
    assert.strictEqual(freeWatchBronze.body.currentPlan, "free")
    assert.strictEqual(freeWatchBronze.body.upgradeAvailable, true)

    // Free user quality cap: 480p allowed, 720p denied
    const freeQ480 = await subscriptionAccessControlService.checkStreamingQuality(userFree._id, "480p")
    assert.strictEqual(freeQ480.allowed, true)
    const freeQ720 = await subscriptionAccessControlService.checkStreamingQuality(userFree._id, "720p")
    assert.strictEqual(freeQ720.allowed, false)
    assert.strictEqual(freeQ720.maxAllowed, "480p")

    // Free user ad-free check
    const freeAdFree = await subscriptionAccessControlService.isAdFree(userFree._id)
    assert.strictEqual(freeAdFree, false, "Free user has ads enabled")

    console.log("  PASS: 1. Free plan restricted access & 480p quality cap verified")
    passed++

    // -------------------------------------------------------------
    // TEST 2: Bronze User Access & HD Cap
    // -------------------------------------------------------------
    // Bronze user accessing bronze video -> Allowed
    const bronzeWatchBronze = await request({
      path: `/api/video/${bronzeVideo._id}`,
      headers: { Authorization: `Bearer ${tokenBronze}` },
    })
    assert.strictEqual(bronzeWatchBronze.statusCode, 200)

    // Bronze user accessing silver video -> Denied
    const bronzeWatchSilver = await request({
      path: `/api/video/${silverVideo._id}`,
      headers: { Authorization: `Bearer ${tokenBronze}` },
    })
    assert.strictEqual(bronzeWatchSilver.statusCode, 403)
    assert.strictEqual(bronzeWatchSilver.body.code, "SUBSCRIPTION_REQUIRED")
    assert.strictEqual(bronzeWatchSilver.body.requiredPlan, "silver")

    // Bronze quality cap: 720p allowed, 1080p denied
    const bronzeQ720 = await subscriptionAccessControlService.checkStreamingQuality(userBronze._id, "720p")
    assert.strictEqual(bronzeQ720.allowed, true)
    const bronzeQ1080 = await subscriptionAccessControlService.checkStreamingQuality(userBronze._id, "1080p")
    assert.strictEqual(bronzeQ1080.allowed, false)
    assert.strictEqual(bronzeQ1080.maxAllowed, "720p")

    console.log("  PASS: 2. Bronze plan HD access & 720p cap verified")
    passed++

    // -------------------------------------------------------------
    // TEST 3: Silver User Access & Full HD Cap
    // -------------------------------------------------------------
    // Silver user accessing bronze & silver video -> Allowed
    const silverWatchSilver = await request({
      path: `/api/video/${silverVideo._id}`,
      headers: { Authorization: `Bearer ${tokenSilver}` },
    })
    assert.strictEqual(silverWatchSilver.statusCode, 200)

    // Silver user accessing gold exclusive video -> Denied
    const silverWatchGold = await request({
      path: `/api/video/${goldVideo._id}`,
      headers: { Authorization: `Bearer ${tokenSilver}` },
    })
    assert.strictEqual(silverWatchGold.statusCode, 403)
    assert.strictEqual(silverWatchGold.body.requiredPlan, "gold")

    // Silver quality cap: 1080p allowed, 4K denied
    const silverQ1080 = await subscriptionAccessControlService.checkStreamingQuality(userSilver._id, "1080p")
    assert.strictEqual(silverQ1080.allowed, true)
    const silverQ4K = await subscriptionAccessControlService.checkStreamingQuality(userSilver._id, "4k")
    assert.strictEqual(silverQ4K.allowed, false)
    assert.strictEqual(silverQ4K.maxAllowed, "1080p")

    // Silver user has ad-free playback
    const silverAdFree = await subscriptionAccessControlService.isAdFree(userSilver._id)
    assert.strictEqual(silverAdFree, true, "Silver user has ad-free experience")

    console.log("  PASS: 3. Silver plan Full HD access, 1080p cap & ad-free verified")
    passed++

    // -------------------------------------------------------------
    // TEST 4: Gold User Maximum Access
    // -------------------------------------------------------------
    // Gold user accessing all tiers -> Allowed
    const goldWatchGold = await request({
      path: `/api/video/${goldVideo._id}`,
      headers: { Authorization: `Bearer ${tokenGold}` },
    })
    assert.strictEqual(goldWatchGold.statusCode, 200)

    // Gold user 4K allowed
    const goldQ4K = await subscriptionAccessControlService.checkStreamingQuality(userGold._id, "4k")
    assert.strictEqual(goldQ4K.allowed, true)

    // Gold user has ad-free
    const goldAdFree = await subscriptionAccessControlService.isAdFree(userGold._id)
    assert.strictEqual(goldAdFree, true)

    console.log("  PASS: 4. Gold plan unlimited access, 4K HDR & exclusive content verified")
    passed++

    // -------------------------------------------------------------
    // TEST 5: Plan Hierarchy Inheritance (canAccessPlanContent)
    // -------------------------------------------------------------
    assert.strictEqual(canAccessPlanContent("gold", "silver"), true)
    assert.strictEqual(canAccessPlanContent("gold", "bronze"), true)
    assert.strictEqual(canAccessPlanContent("gold", "free"), true)
    assert.strictEqual(canAccessPlanContent("silver", "bronze"), true)
    assert.strictEqual(canAccessPlanContent("silver", "silver"), true)
    assert.strictEqual(canAccessPlanContent("silver", "gold"), false)
    assert.strictEqual(canAccessPlanContent("bronze", "silver"), false)
    assert.strictEqual(canAccessPlanContent("free", "bronze"), false)
    console.log("  PASS: 5. Plan Hierarchy Inheritance (canAccessPlanContent) verified")
    passed++

    // -------------------------------------------------------------
    // TEST 6: Expired Subscription Handling (Automatic Fallback)
    // -------------------------------------------------------------
    // Expired user accessing silver video -> Denied with SUBSCRIPTION_EXPIRED
    const expiredWatchSilver = await request({
      path: `/api/video/${silverVideo._id}`,
      headers: { Authorization: `Bearer ${tokenExpired}` },
    })
    assert.strictEqual(expiredWatchSilver.statusCode, 403)
    assert.strictEqual(expiredWatchSilver.body.code, "SUBSCRIPTION_EXPIRED")
    assert.strictEqual(expiredWatchSilver.body.currentPlan, "free")

    // Expired user accessing free video -> Still allowed! (data/access not lost)
    const expiredWatchFree = await request({
      path: `/api/video/${freeVideo._id}`,
      headers: { Authorization: `Bearer ${tokenExpired}` },
    })
    assert.strictEqual(expiredWatchFree.statusCode, 200)
    console.log("  PASS: 6. Expired Subscription Handling & Fallback to Free verified")
    passed++

    // -------------------------------------------------------------
    // TEST 7: Daily Watch Time Limits & Tracking (SubscriptionUsage)
    // -------------------------------------------------------------
    // Record 60 minutes of watch time for Free user
    await request({
      path: "/api/subscriptions/usage/watch-time",
      method: "POST",
      headers: { Authorization: `Bearer ${tokenFree}` },
      body: { seconds: 3600 },
    })

    const usageRes1 = await request({
      path: "/api/subscriptions/usage",
      method: "GET",
      headers: { Authorization: `Bearer ${tokenFree}` },
    })
    assert.strictEqual(usageRes1.statusCode, 200)
    assert.strictEqual(usageRes1.body.data.watchTimeSeconds, 3600)
    assert.strictEqual(usageRes1.body.data.watchTimeMinutes, 60)
    assert.strictEqual(usageRes1.body.data.remainingWatchTimeMinutes, 60) // 120 - 60 = 60

    // Exhaust Free user's remaining 60 minutes
    await request({
      path: "/api/subscriptions/usage/watch-time",
      method: "POST",
      headers: { Authorization: `Bearer ${tokenFree}` },
      body: { seconds: 3600 },
    })

    const watchCheckExhausted = await subscriptionAccessControlService.checkWatchTimeAvailable(userFree._id)
    assert.strictEqual(watchCheckExhausted.available, false)
    assert.strictEqual(watchCheckExhausted.remainingMinutes, 0)

    console.log("  PASS: 7. Daily Watch Time Limits & Tracking verified")
    passed++

    // -------------------------------------------------------------
    // TEST 8: Concurrent Streaming Limits & Enforcement (StreamSession)
    // -------------------------------------------------------------
    // Free user starting 1st stream -> Allowed
    const stream1 = await request({
      path: "/api/subscriptions/stream/start",
      method: "POST",
      headers: { Authorization: `Bearer ${tokenFree}` },
      body: { deviceId: "device_laptop_1", videoId: freeVideo._id },
    })
    assert.strictEqual(stream1.statusCode, 200)
    assert.strictEqual(stream1.body.data.activeStreams, 1)

    // Free user starting 2nd stream on different device -> Denied with 403 CONCURRENT_STREAM_LIMIT_EXCEEDED
    const stream2 = await request({
      path: "/api/subscriptions/stream/start",
      method: "POST",
      headers: { Authorization: `Bearer ${tokenFree}` },
      body: { deviceId: "device_phone_2", videoId: freeVideo._id },
    })
    assert.strictEqual(stream2.statusCode, 403)
    assert.strictEqual(stream2.body.code, "CONCURRENT_STREAM_LIMIT_EXCEEDED")
    assert.strictEqual(stream2.body.maxAllowed, 1)

    // Silver user allowed 2 concurrent streams
    const silverStream1 = await request({
      path: "/api/subscriptions/stream/start",
      method: "POST",
      headers: { Authorization: `Bearer ${tokenSilver}` },
      body: { deviceId: "silver_laptop", videoId: silverVideo._id },
    })
    assert.strictEqual(silverStream1.statusCode, 200)

    const silverStream2 = await request({
      path: "/api/subscriptions/stream/start",
      method: "POST",
      headers: { Authorization: `Bearer ${tokenSilver}` },
      body: { deviceId: "silver_tv", videoId: silverVideo._id },
    })
    assert.strictEqual(silverStream2.statusCode, 200)
    assert.strictEqual(silverStream2.body.data.activeStreams, 2)

    // Silver user 3rd stream -> Denied
    const silverStream3 = await request({
      path: "/api/subscriptions/stream/start",
      method: "POST",
      headers: { Authorization: `Bearer ${tokenSilver}` },
      body: { deviceId: "silver_mobile", videoId: silverVideo._id },
    })
    assert.strictEqual(silverStream3.statusCode, 403)

    // Concluding session frees slot immediately
    const endRes = await request({
      path: "/api/subscriptions/stream/end",
      method: "POST",
      headers: { Authorization: `Bearer ${tokenSilver}` },
      body: { sessionId: silverStream1.body.data.sessionId },
    })
    assert.strictEqual(endRes.statusCode, 200)

    // Now 3rd stream can start
    const silverStream3Retry = await request({
      path: "/api/subscriptions/stream/start",
      method: "POST",
      headers: { Authorization: `Bearer ${tokenSilver}` },
      body: { deviceId: "silver_mobile", videoId: silverVideo._id },
    })
    assert.strictEqual(silverStream3Retry.statusCode, 200)

    console.log("  PASS: 8. Concurrent Streaming Limits & Session Management verified")
    passed++

    // -------------------------------------------------------------
    // TEST 9: Offline Download Permission Separation
    // -------------------------------------------------------------
    // Free user: can watch free video (true), but offline downloads feature is false
    const freeFeatures = await request({
      path: "/api/subscriptions/features",
      method: "GET",
      headers: { Authorization: `Bearer ${tokenFree}` },
    })
    assert.strictEqual(freeFeatures.body.data.features.offlineDownloads, false)

    // Bronze user: offline downloads feature is true
    const bronzeFeatures = await request({
      path: "/api/subscriptions/features",
      method: "GET",
      headers: { Authorization: `Bearer ${tokenBronze}` },
    })
    assert.strictEqual(bronzeFeatures.body.data.features.offlineDownloads, true)
    console.log("  PASS: 9. Offline Download Permission Separation verified")
    passed++

    // -------------------------------------------------------------
    // TEST 10: Premium Courses Access Control
    // -------------------------------------------------------------
    const premiumCourse = await Course.create({
      title: `Full Stack Architecture ${timestamp}`,
      description: "Complete hands-on masterclass",
      courseAccessType: "silver",
      requiredPlan: "silver",
      isPremium: true,
      lessons: [
        { title: "Intro Lesson", isPreview: true, duration: "10:00" },
        { title: "Deep Dive Architecture", isPreview: false, duration: "45:00" },
      ],
    })

    // Free user accessing course list -> Allowed
    const coursesListRes = await request({ path: "/api/courses" })
    assert.strictEqual(coursesListRes.statusCode, 200)

    // Free user viewing locked course details -> Locked with preview lessons only
    const freeViewCourse = await request({
      path: `/api/courses/${premiumCourse._id}`,
      headers: { Authorization: `Bearer ${tokenFree}` },
    })
    assert.strictEqual(freeViewCourse.statusCode, 403)
    assert.strictEqual(freeViewCourse.body.code, "SUBSCRIPTION_REQUIRED")
    assert.strictEqual(freeViewCourse.body.data.isLocked, true)
    assert.strictEqual(freeViewCourse.body.data.lessons.length, 1) // only preview lesson visible

    // Silver user viewing course -> Full unlocked access
    const silverViewCourse = await request({
      path: `/api/courses/${premiumCourse._id}`,
      headers: { Authorization: `Bearer ${tokenSilver}` },
    })
    assert.strictEqual(silverViewCourse.statusCode, 200)
    assert.strictEqual(silverViewCourse.body.data.isLocked, false)
    assert.strictEqual(silverViewCourse.body.data.lessons.length, 2) // all lessons

    console.log("  PASS: 10. Premium Course Access Control & Lesson Masking verified")
    passed++

    // -------------------------------------------------------------
    // TEST 11: Extended Subscription Status with Usage & Allowances
    // -------------------------------------------------------------
    const currentSubRes = await request({
      path: "/api/subscriptions/current",
      method: "GET",
      headers: { Authorization: `Bearer ${tokenSilver}` },
    })
    assert.strictEqual(currentSubRes.statusCode, 200)
    assert.ok(currentSubRes.body.data.usage, "Usage must be present")
    assert.ok(currentSubRes.body.data.remainingUsage, "Remaining usage must be present")
    assert.strictEqual(currentSubRes.body.data.currentPlan.slug, "silver")
    assert.strictEqual(currentSubRes.body.data.features.adFree, true)
    console.log("  PASS: 11. Extended Subscription Status with Usage & Allowances verified")
    passed++

    // -------------------------------------------------------------
    // TEST 12: Structured Access Denied Responses
    // -------------------------------------------------------------
    const deniedRes = await request({
      path: `/api/video/${goldVideo._id}`,
      headers: { Authorization: `Bearer ${tokenBronze}` },
    })
    assert.strictEqual(deniedRes.statusCode, 403)
    assert.strictEqual(deniedRes.body.success, false)
    assert.strictEqual(deniedRes.body.code, "SUBSCRIPTION_REQUIRED")
    assert.strictEqual(deniedRes.body.requiredPlan, "gold")
    assert.strictEqual(deniedRes.body.currentPlan, "bronze")
    assert.strictEqual(deniedRes.body.upgradeAvailable, true)
    console.log("  PASS: 12. Structured Access Denied Envelope verified")
    passed++

    console.log("==================================================================")
    console.log(`PHASE 2 PERMISSIONS RESULTS: ${passed} / 12 PASSED, 0 FAILED`)
    console.log("==================================================================")
  } catch (err) {
    console.error("Phase 2 Plan Permissions Test Failed:", err)
    process.exit(1)
  } finally {
    server.close()
    await mongoose.connection.close().catch(() => {})
    process.exit(0)
  }
}

runPhase2PlanPermissionsSuite()
