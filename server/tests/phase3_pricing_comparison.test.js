/**
 * Phase 3: Subscription Plans Comparison & Pricing Test Suite
 * Validates dynamic plan retrieval, multi-cycle billing calculations,
 * comparison matrix data, dynamic plan specifications, and security guarantees.
 */

import mongoose from "mongoose"
import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"
import subscriptionModuleService from "../modules/subscription/subscription.service.js"
import {
  BILLING_CYCLES,
  calculatePlanPricing,
  PLAN_HIERARCHY,
} from "../config/subscriptionConfig.js"
import SubscriptionPlan from "../Modals/SubscriptionPlan.js"
import User from "../Modals/Auth.js"
import Subscription from "../Modals/Subscription.js"

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
  console.log("  PHASE 3: SUBSCRIPTION PLANS & PRICING VERIFICATION")
  console.log("=======================================================\n")

  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGO_URI)
      console.log("Connected to MongoDB successfully.\n")
    }

    // 1. Backend Billing Cycle Configuration
    console.log("Test 1: Billing Cycles Configuration")
    assert(BILLING_CYCLES.monthly !== undefined, "Monthly cycle configured")
    assert(BILLING_CYCLES.quarterly !== undefined && BILLING_CYCLES.quarterly.discountPercent === 10, "Quarterly cycle has 10% discount")
    assert(BILLING_CYCLES.yearly !== undefined && BILLING_CYCLES.yearly.discountPercent === 20, "Yearly cycle has 20% discount")

    // 2. Authoritative Price Calculation Helpers
    console.log("\nTest 2: Authoritative calculatePlanPricing Calculations")
    const silverMonthly = calculatePlanPricing(499, "monthly")
    assert(silverMonthly.price === 499, "Silver monthly price is 499")
    assert(silverMonthly.savings === 0, "Silver monthly savings is 0")
    assert(silverMonthly.durationDays === 30, "Silver monthly duration is 30 days")

    const silverQuarterly = calculatePlanPricing(499, "quarterly")
    // 499 * 3 = 1497; 10% off => 1347; savings = 150
    assert(silverQuarterly.price === 1347, `Silver quarterly price is 1347 (got ${silverQuarterly.price})`)
    assert(silverQuarterly.savings === 150, `Silver quarterly savings is 150 (got ${silverQuarterly.savings})`)
    assert(silverQuarterly.durationDays === 90, "Silver quarterly duration is 90 days")

    const silverYearly = calculatePlanPricing(499, "yearly")
    // 499 * 12 = 5988; 20% off => 4790; savings = 1198
    assert(silverYearly.price === 4790, `Silver yearly price is 4790 (got ${silverYearly.price})`)
    assert(silverYearly.savings === 1198, `Silver yearly savings is 1198 (got ${silverYearly.savings})`)
    assert(silverYearly.durationDays === 365, "Silver yearly duration is 365 days")

    const freePricing = calculatePlanPricing(0, "yearly")
    assert(freePricing.price === 0 && freePricing.savings === 0, "Free plan price remains 0 on yearly cycle")

    // 3. Dynamic Plan Fetching & Sorting
    console.log("\nTest 3: Dynamic Plan Retrieval & Sorting")
    const plans = await subscriptionModuleService.getAllPlans(true)
    assert(plans.length >= 4, `Retrieved all active plans (${plans.length} found)`)

    const slugs = plans.map((p) => p.slug)
    assert(slugs[0] === "free", "First plan is Free")
    assert(slugs[1] === "bronze", "Second plan is Bronze")
    assert(slugs[2] === "silver", "Third plan is Silver")
    assert(slugs[3] === "gold", "Fourth plan is Gold")

    // 4. Enriched Multi-Cycle Pricing in Plan Output
    console.log("\nTest 4: Enriched Billing Cycles in Plans Output")
    const silverPlan = plans.find((p) => p.slug === "silver")
    assert(silverPlan.billingCycles !== undefined, "Silver plan contains billingCycles object")
    assert(silverPlan.billingCycles.monthly.price === 499, "Silver monthly price in plan matches")
    assert(silverPlan.billingCycles.quarterly.price === 1347, "Silver quarterly price in plan matches")
    assert(silverPlan.billingCycles.yearly.price === 4790, "Silver yearly price in plan matches")
    assert(silverPlan.rank === 3, "Silver plan rank is 3 in hierarchy")
    assert(Array.isArray(silverPlan.summaryBenefits) && silverPlan.summaryBenefits.length > 0, "Silver plan includes summary benefits")

    // 5. Dynamic Single Plan Lookup by Slug
    console.log("\nTest 5: Dynamic Plan Lookup by Slug")
    const goldPlan = await subscriptionModuleService.getPlanByIdOrSlug("gold")
    assert(goldPlan !== null, "Gold plan retrieved by slug")
    assert(goldPlan.limits.streamingQuality === "4k", "Gold plan max quality is 4k")
    assert(goldPlan.limits.dailyDownloadLimit === 50, "Gold plan daily download limit is 50")
    assert(goldPlan.limits.maxConcurrentStreams === 5, "Gold plan concurrent streams is 5")

    // 6. Current Subscription Details for User
    console.log("\nTest 6: Authenticated Current Subscription Details")
    // Create test user and assign Silver subscription
    const testUser = await User.findOneAndUpdate(
      { email: "phase3_test_user@example.com" },
      { name: "Phase 3 Tester", email: "phase3_test_user@example.com" },
      { upsert: true, new: true }
    )

    const expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    await Subscription.findOneAndUpdate(
      { userId: testUser._id },
      {
        userId: testUser._id,
        user_id: testUser._id,
        planId: silverPlan._id,
        plan: "silver",
        status: "active",
        startDate: new Date(),
        expiryDate: expiry,
        expiresAt: expiry,
        billingCycle: "monthly",
        amountPaid: 499,
        currency: "INR",
        download_limit: 15,
        download_quota_type: "daily",
        download_enabled: true,
      },
      { upsert: true, new: true }
    )

    const currentDetails = await subscriptionModuleService.getCurrentSubscriptionDetails(testUser._id)
    assert(currentDetails.currentPlan.slug === "silver", "Current subscription reflects Silver plan")
    assert(currentDetails.remainingDays > 0, `Remaining days is positive (${currentDetails.remainingDays} days)`)
    assert(currentDetails.enabledFeatures.adFree === true, "Silver plan enables adFree feature")
    assert(currentDetails.usageLimits.streamingQuality === "1440p", "Silver plan usage limit is 1440p")

    // Clean up test user
    await Subscription.deleteMany({ userId: testUser._id })
    await User.deleteOne({ _id: testUser._id })

    console.log("\n=======================================================")
    console.log(`  PHASE 3 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`)
    console.log("=======================================================\n")

    if (failed > 0) {
      process.exit(1)
    } else {
      process.exit(0)
    }
  } catch (err) {
    console.error("Test execution failed:", err)
    process.exit(1)
  }
}

runTests()
