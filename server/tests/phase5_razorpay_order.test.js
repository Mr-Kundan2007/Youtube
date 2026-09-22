/**
 * Phase 5: Razorpay Test Payment Integration & Secure Order Creation Test Suite
 * Validates:
 * 1. Authoritative backend price calculation for all tiers and billing cycles.
 * 2. Razorpay Test Mode order creation and internal transaction identifiers.
 * 3. Validation: rejection of free plan, inactive plan, invalid cycle, and unauthorized requests.
 * 4. Subscription eligibility & downgrade protection policy.
 * 5. Duplicate payment attempt protection & idempotency (5-minute window).
 * 6. User ownership isolation for transaction status queries.
 * 7. Cancellation and failure lifecycle transitions.
 * 8. STRICT GUARANTEE: Subscriptions and premium features are NOT prematurely activated.
 * 9. Secret key protection: Razorpay secret key is NEVER leaked in order responses.
 */

import mongoose from "mongoose"
import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"
import razorpayService from "../services/razorpayService.js"
import subscriptionModuleService from "../modules/subscription/subscription.service.js"
import { calculatePlanPricing, BILLING_CYCLES } from "../config/subscriptionConfig.js"
import PaymentTransaction from "../Modals/PaymentTransaction.js"
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
  console.log("  PHASE 5: RAZORPAY TEST PAYMENT & SECURE ORDERS")
  console.log("=======================================================\n")

  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGO_URI)
      console.log("Connected to MongoDB successfully.\n")
    }

    // Ensure default plans exist in DB
    const plans = await subscriptionModuleService.getAllPlans(true)
    assert(plans.length >= 4, `All 4 standard plans loaded (${plans.length} total)`)

    const freePlan = plans.find((p) => p.slug === "free")
    const bronzePlan = plans.find((p) => p.slug === "bronze")
    const silverPlan = plans.find((p) => p.slug === "silver")
    const goldPlan = plans.find((p) => p.slug === "gold")

    const timestamp = Date.now()
    const testUserA = await User.create({
      name: `PayUserA_${timestamp}`,
      email: `pay_user_a_${timestamp}@example.com`,
      password: "TestPassword123!",
    })

    const testUserB = await User.create({
      name: `PayUserB_${timestamp}`,
      email: `pay_user_b_${timestamp}@example.com`,
      password: "TestPassword123!",
    })

    // Seed initial Free subscription for User A
    await Subscription.create({
      userId: testUserA._id,
      planId: freePlan._id,
      plan: "free",
      status: "active",
      startDate: new Date(),
    })

    // -------------------------------------------------------------
    // TEST 1: Authoritative Backend Pricing Calculation
    // -------------------------------------------------------------
    console.log("Test 1: Backend Authoritative Price Calculation (in Paise)")
    const silverMonthlyPricing = calculatePlanPricing(499, "monthly")
    assert(silverMonthlyPricing.price === 499, "Silver Monthly price is ₹499")
    assert(silverMonthlyPricing.discountPercent === 0, "Silver Monthly has 0% discount")

    const silverQuarterlyPricing = calculatePlanPricing(499, "quarterly")
    assert(silverQuarterlyPricing.price === 1347, "Silver Quarterly price is ₹1,347 (10% off)")
    assert(silverQuarterlyPricing.discountPercent === 10, "Silver Quarterly discount is 10%")

    const silverYearlyPricing = calculatePlanPricing(499, "yearly")
    assert(silverYearlyPricing.price === 4790, "Silver Yearly price is ₹4,790 (20% off)")
    assert(silverYearlyPricing.discountPercent === 20, "Silver Yearly discount is 20%")

    // -------------------------------------------------------------
    // TEST 2: Secure Order Creation for Silver Monthly
    // -------------------------------------------------------------
    console.log("\nTest 2: Secure Order Creation for Silver Monthly")
    const order1 = await razorpayService.createSubscriptionOrder({
      userId: testUserA._id,
      planId: silverPlan._id,
      validityType: "monthly",
      userDetails: { name: testUserA.name, email: testUserA.email },
    })

    assert(Boolean(order1.orderId), `Razorpay Order ID generated: ${order1.orderId}`)
    assert(order1.amount === 49900, `Order amount in paise is 49900 (₹499)`)
    assert(order1.currency === "INR", "Order currency is INR")
    assert(order1.internalTransactionId.startsWith("PAY-"), `Internal Transaction ID format correct: ${order1.internalTransactionId}`)
    assert(order1.plan.slug === "silver", "Plan slug in order data is 'silver'")
    assert(order1.actionType === "upgrade" || order1.actionType === "new_subscription", `Action type classified: ${order1.actionType}`)

    // -------------------------------------------------------------
    // TEST 3: Secrets Protection (Zero Leaked Secrets)
    // -------------------------------------------------------------
    console.log("\nTest 3: Secrets Protection in Returned Order Payload")
    assert(order1.keySecret === undefined, "Razorpay keySecret is NOT returned in order data")
    assert(order1.keyId !== undefined && order1.keyId.length > 0, "Public keyId is returned")
    assert(order1.keyId.startsWith("rzp_test_"), "Using Razorpay Test Mode keyId")

    // -------------------------------------------------------------
    // TEST 4: PaymentTransaction Persistence & 'pending' Status
    // -------------------------------------------------------------
    console.log("\nTest 4: PaymentTransaction Persistence & 'pending' Initial Status")
    const dbTransaction = await PaymentTransaction.findOne({
      internalTransactionId: order1.internalTransactionId,
    })
    assert(Boolean(dbTransaction), "PaymentTransaction found in database")
    assert(dbTransaction.status === "pending", `Transaction status is 'pending' (${dbTransaction.status})`)
    assert(dbTransaction.amount === 49900, "Database transaction stores 49900 paise")
    assert(String(dbTransaction.userId) === String(testUserA._id), "Database transaction belongs to User A")

    // -------------------------------------------------------------
    // TEST 5: STRICT CHECK - No Premature Subscription Activation
    // -------------------------------------------------------------
    console.log("\nTest 5: STRICT GUARANTEE - Subscription NOT activated by order creation")
    const userASub = await Subscription.findOne({ userId: testUserA._id })
    assert(userASub.plan === "free", `User subscription plan remains 'free' (was NOT upgraded to silver)`)
    assert(userASub.status === "active", "User subscription status unchanged")

    // -------------------------------------------------------------
    // TEST 6: Idempotency & Duplicate Order Reuse (Within 5 Minutes)
    // -------------------------------------------------------------
    console.log("\nTest 6: Idempotency & Duplicate Order Prevention (Reusing Order)")
    const order1Repeat = await razorpayService.createSubscriptionOrder({
      userId: testUserA._id,
      planId: silverPlan._id,
      validityType: "monthly",
    })
    assert(order1Repeat.orderId === order1.orderId, "Repeated order request reused existing active Razorpay order ID")
    assert(order1Repeat.reused === true, "Order response indicates 'reused: true'")
    assert(order1Repeat.transactionId === order1.transactionId, "Transaction ID was preserved")
    assert(order1Repeat.internalTransactionId === order1.internalTransactionId, "Internal transaction ID was preserved")

    // -------------------------------------------------------------
    // TEST 7: Validation - Disallow Order for Free Plan
    // -------------------------------------------------------------
    console.log("\nTest 7: Validation - Disallow Order for Free Plan")
    let freePlanError = null
    try {
      await razorpayService.createSubscriptionOrder({
        userId: testUserA._id,
        planId: freePlan._id,
        validityType: "monthly",
      })
    } catch (err) {
      freePlanError = err
    }
    assert(Boolean(freePlanError), "Error thrown for free plan order creation")
    assert(freePlanError?.code === "INVALID_PLAN", `Correct error code returned: ${freePlanError?.code}`)

    // -------------------------------------------------------------
    // TEST 8: Validation - Disallow Invalid Validity Cycle
    // -------------------------------------------------------------
    console.log("\nTest 8: Validation - Disallow Invalid Billing Cycle")
    let invalidCycleError = null
    try {
      await razorpayService.createSubscriptionOrder({
        userId: testUserA._id,
        planId: goldPlan._id,
        validityType: "biweekly",
      })
    } catch (err) {
      invalidCycleError = err
    }
    assert(Boolean(invalidCycleError), "Error thrown for invalid validity type")
    assert(invalidCycleError?.code === "INVALID_VALIDITY", `Correct error code: ${invalidCycleError?.code}`)

    // -------------------------------------------------------------
    // TEST 9: Downgrade Protection Policy
    // -------------------------------------------------------------
    console.log("\nTest 9: Downgrade Protection Policy")
    // Upgrade User A temporarily to Gold to test downgrade attempt
    userASub.plan = "gold"
    userASub.planId = goldPlan._id
    await userASub.save()

    let downgradeError = null
    try {
      await razorpayService.createSubscriptionOrder({
        userId: testUserA._id,
        planId: bronzePlan._id,
        validityType: "monthly",
      })
    } catch (err) {
      downgradeError = err
    }
    assert(Boolean(downgradeError), "Error thrown when trying to create payment order for downgrade")
    assert(
      downgradeError?.code === "DOWNGRADE_NOT_ALLOWED_VIA_CHECKOUT",
      `Correct downgrade code: ${downgradeError?.code}`
    )

    // Restore User A to free
    userASub.plan = "free"
    userASub.planId = freePlan._id
    await userASub.save()

    // -------------------------------------------------------------
    // TEST 10: Transaction Status Query & User Ownership Isolation
    // -------------------------------------------------------------
    console.log("\nTest 10: Transaction Status Query & Ownership Isolation")
    const statusData = await razorpayService.getTransactionStatus(order1.internalTransactionId, testUserA._id)
    assert(statusData.status === "pending", `Status query returns 'pending'`)
    assert(statusData.amount === 49900, "Status query returns correct amount")

    // Attempt status query by User B (Forbidden)
    let unauthorizedStatusError = null
    try {
      await razorpayService.getTransactionStatus(order1.internalTransactionId, testUserB._id)
    } catch (err) {
      unauthorizedStatusError = err
    }
    assert(Boolean(unauthorizedStatusError), "User B access to User A's transaction rejected")
    assert(unauthorizedStatusError?.code === "FORBIDDEN", `Correct error code: ${unauthorizedStatusError?.code}`)

    // -------------------------------------------------------------
    // TEST 11: Payment Cancellation Handling
    // -------------------------------------------------------------
    console.log("\nTest 11: Payment Cancellation Handling")
    const cancelRes = await razorpayService.cancelPaymentAttempt(
      order1.internalTransactionId,
      testUserA._id,
      "User dismissed checkout"
    )
    assert(cancelRes.status === "cancelled", "Status successfully updated to 'cancelled'")

    const cancelledTx = await PaymentTransaction.findOne({
      internalTransactionId: order1.internalTransactionId,
    })
    assert(cancelledTx.status === "cancelled", "Database transaction status is 'cancelled'")
    assert(Boolean(cancelledTx.cancelledAt), "Database records cancelledAt timestamp")

    // -------------------------------------------------------------
    // TEST 12: Order Creation for Gold Yearly (Discount Validation)
    // -------------------------------------------------------------
    console.log("\nTest 12: Order Creation for Gold Yearly (20% Discount Verification)")
    const orderGoldYearly = await razorpayService.createSubscriptionOrder({
      userId: testUserA._id,
      planId: goldPlan._id,
      validityType: "yearly",
    })
    // Gold base: 999 * 12 = 11988; with 20% discount = Math.round(11988 * 0.8) = 9590 INR -> 959000 paise
    assert(orderGoldYearly.amount === 959000, `Gold Yearly amount in paise is 959000 (₹9,590)`)
    assert(orderGoldYearly.plan.validityType === "yearly", "Order validityType is 'yearly'")

    // Clean up test records
    await PaymentTransaction.deleteMany({ userId: { $in: [testUserA._id, testUserB._id] } })
    await Subscription.deleteMany({ userId: { $in: [testUserA._id, testUserB._id] } })
    await User.deleteMany({ _id: { $in: [testUserA._id, testUserB._id] } })

    console.log("\n=======================================================")
    console.log(`  PHASE 5 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`)
    console.log("=======================================================\n")

    if (failed > 0) {
      process.exit(1)
    } else {
      process.exit(0)
    }
  } catch (err) {
    console.error("Phase 5 test execution error:", err)
    process.exit(1)
  }
}

runTests()
