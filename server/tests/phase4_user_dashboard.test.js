/**
 * Phase 4: User Subscription Dashboard & Status Management Test Suite
 * Validates dashboard data resolution for Free, Bronze, Silver, and Gold tiers,
 * status transitions (Active, Expired, Cancelled), real-time usage metrics,
 * audit history logging, and hierarchy-aware plan management options.
 */

import mongoose from "mongoose"
import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"
import subscriptionModuleService from "../modules/subscription/subscription.service.js"
import subscriptionAccessControlService from "../services/subscriptionAccessControlService.js"
import {
  PLAN_HIERARCHY,
  PLAN_MAX_QUALITY,
  PLAN_MAX_CONCURRENT_STREAMS,
} from "../config/subscriptionConfig.js"
import SubscriptionPlan from "../Modals/SubscriptionPlan.js"
import User from "../Modals/Auth.js"
import Subscription from "../Modals/Subscription.js"
import SubscriptionHistory from "../Modals/SubscriptionHistory.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.resolve(__dirname, "../../.env") })

const MONGO_URI = process.env.DB_URL || process.env.MONGO_URI || "mongodb://localhost:27017/videodb_test"

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`)
    passed++
  } else {
    console.error(`  ✗ FAIL: ${message}`)
    failed++
  }
}

async function runTests() {
  console.log("\n=======================================================")
  console.log("  PHASE 4: USER SUBSCRIPTION DASHBOARD TEST SUITE")
  console.log("=======================================================\n")

  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGO_URI)
      console.log("Connected to MongoDB successfully.\n")
    }

    // Ensure default plans exist
    const plans = await subscriptionModuleService.getAllPlans(true)
    assert(plans.length >= 4, `All 4 standard plans retrieved (${plans.length} total)`)

    const freePlan = plans.find((p) => p.slug === "free")
    const bronzePlan = plans.find((p) => p.slug === "bronze")
    const silverPlan = plans.find((p) => p.slug === "silver")
    const goldPlan = plans.find((p) => p.slug === "gold")

    const timestamp = Date.now()
    const testUser = await User.create({
      name: `Dashboard User ${timestamp}`,
      email: `dash.${timestamp}@example.com`,
    })

    // Test 1: Free User Dashboard Data
    console.log("Test 1: Free User Dashboard Data Resolution")
    const freeSub = await subscriptionModuleService.getOrCreateUserSubscription(testUser._id)
    assert(freeSub.status === "active", "Free subscription is active")

    const freeDetails = await subscriptionModuleService.getCurrentSubscriptionDetails(testUser._id)
    assert(freeDetails.currentPlan.slug === "free", "Free plan slug matches")
    assert(freeDetails.currentPlan.price === 0, "Free plan rate is 0")
    assert(freeDetails.usageLimits.streamingQuality === "720p", "Free quality cap is 720p")
    assert(freeDetails.usageLimits.dailyDownloadLimit === 1, "Free daily download limit is 1")
    assert(freeDetails.enabledFeatures.adFree === false, "Free plan has advertisements")

    // Test 2: Bronze User Dashboard Data
    console.log("\nTest 2: Bronze User Dashboard Data Resolution")
    const expiry30d = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    await Subscription.findOneAndUpdate(
      { userId: testUser._id },
      {
        planId: bronzePlan._id,
        plan: "bronze",
        status: "active",
        startDate: new Date(),
        expiryDate: expiry30d,
        expiresAt: expiry30d,
        billingCycle: "monthly",
        amountPaid: 199,
        currency: "INR",
        download_limit: 5,
        max_download_devices: 2,
      },
      { new: true }
    )

    const bronzeDetails = await subscriptionModuleService.getCurrentSubscriptionDetails(testUser._id)
    assert(bronzeDetails.currentPlan.slug === "bronze", "Bronze plan slug matches")
    assert(bronzeDetails.usageLimits.streamingQuality === "1080p", "Bronze quality is 1080p")
    assert(bronzeDetails.usageLimits.dailyDownloadLimit === 5, "Bronze download limit is 5")
    assert(bronzeDetails.remainingDays > 0, `Bronze remaining days is positive (${bronzeDetails.remainingDays} days)`)

    // Test 3: Silver User Dashboard Data & Ad-Free Status
    console.log("\nTest 3: Silver User Dashboard Data & Ad-Free Resolution")
    await Subscription.findOneAndUpdate(
      { userId: testUser._id },
      {
        planId: silverPlan._id,
        plan: "silver",
        status: "active",
        startDate: new Date(),
        expiryDate: expiry30d,
        expiresAt: expiry30d,
        billingCycle: "monthly",
        amountPaid: 499,
        currency: "INR",
        download_limit: 15,
        max_download_devices: 5,
      },
      { new: true }
    )

    const silverDetails = await subscriptionModuleService.getCurrentSubscriptionDetails(testUser._id)
    assert(silverDetails.currentPlan.slug === "silver", "Silver plan slug matches")
    assert(silverDetails.enabledFeatures.adFree === true, "Silver plan is 100% ad-free")
    assert(silverDetails.enabledFeatures.premiumCourses === true, "Silver plan unlocks premium courses")
    assert(silverDetails.usageLimits.dailyWatchTime === null, "Silver plan watch time is unlimited")

    // Test 4: Gold User Dashboard & Highest Tier Handling
    console.log("\nTest 4: Gold User Dashboard & VIP Privileges")
    await Subscription.findOneAndUpdate(
      { userId: testUser._id },
      {
        planId: goldPlan._id,
        plan: "gold",
        status: "active",
        startDate: new Date(),
        expiryDate: expiry30d,
        expiresAt: expiry30d,
        billingCycle: "monthly",
        amountPaid: 999,
        currency: "INR",
        download_limit: 50,
        max_download_devices: 10,
      },
      { new: true }
    )

    const goldDetails = await subscriptionModuleService.getCurrentSubscriptionDetails(testUser._id)
    assert(goldDetails.currentPlan.slug === "gold", "Gold plan slug matches")
    assert(goldDetails.usageLimits.streamingQuality === "4k", "Gold plan quality is 4k Ultra HD HDR")
    assert(goldDetails.usageLimits.dailyDownloadLimit === 50, "Gold plan allows 50 downloads/day")
    assert(goldDetails.usageLimits.maxConcurrentStreams === 5, "Gold plan allows 5 simultaneous screens")
    assert(goldDetails.enabledFeatures.exclusiveContent === true, "Gold plan unlocks exclusive VIP content")

    // Test 5: Plan Hierarchy & Upgrade/Downgrade Calculations
    console.log("\nTest 5: Plan Hierarchy & Upgrade/Downgrade Filtering")
    const getAvailableUpgrades = (currentSlug) => {
      const currentRank = PLAN_HIERARCHY[currentSlug.toLowerCase()] || 1
      return plans.filter((p) => {
        const rank = PLAN_HIERARCHY[p.slug.toLowerCase()] || 1
        return rank > currentRank
      })
    }

    const getAvailableDowngrades = (currentSlug) => {
      const currentRank = PLAN_HIERARCHY[currentSlug.toLowerCase()] || 1
      return plans.filter((p) => {
        const rank = PLAN_HIERARCHY[p.slug.toLowerCase()] || 1
        return rank < currentRank
      })
    }

    const freeUpgrades = getAvailableUpgrades("free")
    assert(freeUpgrades.length === 3, "Free user has 3 available upgrades (Bronze, Silver, Gold)")

    const silverUpgrades = getAvailableUpgrades("silver")
    assert(silverUpgrades.length === 1 && silverUpgrades[0].slug === "gold", "Silver user can only upgrade to Gold")

    const goldUpgrades = getAvailableUpgrades("gold")
    assert(goldUpgrades.length === 0, "Gold user has 0 higher upgrade options (Highest tier)")

    const goldDowngrades = getAvailableDowngrades("gold")
    assert(goldDowngrades.length === 3, "Gold user has 3 downgrade options (Silver, Bronze, Free)")

    // Test 6: Expired Subscription Handling & Fallback
    console.log("\nTest 6: Expired Subscription Status & Graceful Free Fallback")
    const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
    await Subscription.findOneAndUpdate(
      { userId: testUser._id },
      {
        planId: silverPlan._id,
        plan: "silver",
        status: "expired",
        startDate: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
        expiryDate: pastDate,
        expiresAt: pastDate,
      },
      { new: true }
    )

    const expiredDetails = await subscriptionModuleService.getCurrentSubscriptionDetails(testUser._id)
    assert(expiredDetails.isExpired === true, "Subscription correctly detected as isExpired = true")
    assert(expiredDetails.status === "expired", "Subscription status is 'expired'")
    assert(expiredDetails.remainingDays <= 0, "Remaining days is 0 or negative for expired subscription")

    // Verify access service falls back to Free
    const watchCheck = await subscriptionAccessControlService.canWatchVideo(testUser._id, {
      accessLevel: "premium",
      requiredPlan: "silver",
    })
    assert(watchCheck.allowed === false, "Expired user denied access to premium video")
    assert(watchCheck.currentPlan === "free", "Expired user gracefully treated as Free tier")

    // Test 7: Subscription History Audit Log
    console.log("\nTest 7: Subscription History Audit Logging")
    await subscriptionModuleService.logHistory({
      userId: testUser._id,
      subscriptionId: freeSub._id,
      previousPlanId: freePlan._id,
      newPlanId: silverPlan._id,
      action: "plan_upgraded",
      reason: "User upgraded to Silver tier",
    })

    const history = await subscriptionModuleService.getSubscriptionHistory(testUser._id)
    assert(history.length >= 1, `Subscription history entries found (${history.length})`)
    const upgradeEntry = history.find((h) => h.action === "plan_upgraded")
    assert(upgradeEntry !== undefined, "History includes 'plan_upgraded' entry")
    assert(upgradeEntry.newPlanId.name === "Silver", "History records transition to Silver")

    // Test 8: Real-Time Usage Tracking API
    console.log("\nTest 8: Real-Time Today Usage Metrics API")
    await subscriptionAccessControlService.recordWatchTime(testUser._id, 1800) // 30 minutes
    const usage = await subscriptionAccessControlService.getTodayUsage(testUser._id)
    assert(usage.watchTimeSeconds >= 1800, `Recorded watch time is at least 1800 seconds (${usage.watchTimeSeconds})`)

    // Clean up test records
    await Subscription.deleteMany({ userId: testUser._id })
    await SubscriptionHistory.deleteMany({ userId: testUser._id })
    await User.deleteOne({ _id: testUser._id })

    console.log("\n=======================================================")
    console.log(`  PHASE 4 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`)
    console.log("=======================================================\n")

    if (failed > 0) {
      process.exit(1)
    } else {
      process.exit(0)
    }
  } catch (err) {
    console.error("Phase 4 test execution error:", err)
    process.exit(1)
  }
}

runTests()
