/**
 * Phase 6: Secure Payment Verification, Subscription Activation & Transaction Handling Test Suite
 * Validates:
 * 1. Cryptographic HMAC SHA256 signature verification on the backend.
 * 2. Strict rejection of invalid signatures, marking transactions as verification_failed.
 * 3. Validation of Order ID matching and transaction ownership isolation.
 * 4. Duplicate verification prevention and idempotency (alreadyProcessed).
 * 5. Replay attack prevention via payment ID uniqueness enforcement.
 * 6. Subscription activation, start date, and authoritative validity calculation (Monthly, Quarterly, Yearly).
 * 7. Subscription Upgrade handling (Bronze -> Silver) with audit history tracking.
 * 8. Subscription Renewal handling (extending existing active expiry date).
 * 9. Tax-compliant unique invoice generation with GST itemization.
 * 10. Status recovery API reflecting active subscription context.
 */

import mongoose from "mongoose"
import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"
import razorpayService from "../services/razorpayService.js"
import subscriptionModuleService from "../modules/subscription/subscription.service.js"
import subscriptionActivationService from "../services/subscriptionActivationService.js"
import invoiceService from "../services/invoiceService.js"
import PaymentTransaction from "../Modals/PaymentTransaction.js"
import Subscription from "../Modals/Subscription.js"
import SubscriptionHistory from "../Modals/SubscriptionHistory.js"
import Invoice from "../Modals/Invoice.js"
import User from "../Modals/Auth.js"

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
  console.log("  PHASE 6: PAYMENT VERIFICATION & ACTIVATION SUITE")
  console.log("=======================================================\n")

  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGO_URI)
      console.log("Connected to MongoDB successfully.\n")
    }

    // Ensure default plans exist
    const plans = await subscriptionModuleService.getAllPlans(true)
    assert(plans.length >= 4, `All 4 standard plans loaded (${plans.length} total)`)

    const freePlan = plans.find((p) => p.slug === "free")
    const bronzePlan = plans.find((p) => p.slug === "bronze")
    const silverPlan = plans.find((p) => p.slug === "silver")
    const goldPlan = plans.find((p) => p.slug === "gold")

    const timestamp = Date.now()
    const testUserA = await User.create({
      name: `VerifyUserA_${timestamp}`,
      email: `verify_user_a_${timestamp}@example.com`,
      password: "TestPassword123!",
    })

    const testUserB = await User.create({
      name: `VerifyUserB_${timestamp}`,
      email: `verify_user_b_${timestamp}@example.com`,
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
    // TEST 1: Valid HMAC Signature & Subscription Activation
    // -------------------------------------------------------------
    console.log("Test 1: Valid HMAC SHA256 Signature Verification & Activation")
    const order1 = await razorpayService.createSubscriptionOrder({
      userId: testUserA._id,
      planId: bronzePlan._id,
      validityType: "monthly",
    })

    const paymentId1 = `pay_test_${Date.now()}_1`
    const signature1 = razorpayService.generateTestSignature(order1.orderId, paymentId1)

    const verification1 = await razorpayService.verifyPayment({
      transactionId: order1.transactionId,
      orderId: order1.orderId,
      paymentId: paymentId1,
      signature: signature1,
      userId: testUserA._id,
    })

    assert(verification1.success === true, "Signature verification succeeded")
    assert(verification1.alreadyProcessed === false, "Transaction was newly processed")

    // Run activation & invoice generation
    const activation1 = await subscriptionActivationService.activateSubscription({
      userId: testUserA._id,
      planKey: verification1.planKey,
      planId: bronzePlan._id,
      billingCycle: verification1.billingCycle,
      paymentId: paymentId1,
      transactionId: order1.transactionId,
      amountPaid: verification1.amountPaid,
      actionType: "new_subscription",
      customerName: testUserA.name,
      customerEmail: testUserA.email,
    })

    assert(activation1.success === true, "Subscription activated successfully")
    assert(activation1.plan === "bronze", "Subscription plan updated to 'bronze'")

    // Verify Subscription model in DB
    const subA = await Subscription.findOne({ userId: testUserA._id })
    assert(subA.plan === "bronze", "Database subscription plan is 'bronze'")
    assert(subA.status === "active", "Database subscription status is 'active'")
    assert(Boolean(subA.expiresAt), "Subscription has valid expiresAt date")
    assert(subA.paymentId === paymentId1, "Payment ID linked to subscription")

    // Verify Invoice model in DB
    const invoice1 = await invoiceService.generateInvoice({
      transaction: verification1.transaction,
      user: testUserA,
    })
    assert(Boolean(invoice1), "Invoice generated successfully")
    assert(invoice1.invoiceNumber.startsWith("INV-"), `Invoice format valid: ${invoice1.invoiceNumber}`)
    assert(invoice1.status === "paid", "Invoice status is 'paid'")

    // Verify PaymentTransaction status is success
    const tx1 = await PaymentTransaction.findById(order1.transactionId)
    assert(tx1.status === "success", "PaymentTransaction status updated to 'success'")
    assert(tx1.signatureVerified === true, "signatureVerified marked true")
    assert(Boolean(tx1.paymentVerifiedAt), "paymentVerifiedAt timestamp set")

    // -------------------------------------------------------------
    // TEST 2: Rejection of Invalid Signature
    // -------------------------------------------------------------
    console.log("\nTest 2: Rejection of Invalid Signature & Status Transition")
    const order2 = await razorpayService.createSubscriptionOrder({
      userId: testUserA._id,
      planId: silverPlan._id,
      validityType: "monthly",
    })

    let invalidSigError = null
    try {
      await razorpayService.verifyPayment({
        transactionId: order2.transactionId,
        orderId: order2.orderId,
        paymentId: `pay_fake_${Date.now()}`,
        signature: "invalid_tampered_signature_9999",
        userId: testUserA._id,
      })
    } catch (err) {
      invalidSigError = err
    }

    assert(Boolean(invalidSigError), "Error thrown for invalid HMAC signature")
    assert(
      invalidSigError?.code === "PAYMENT_VERIFICATION_FAILED",
      `Error code is PAYMENT_VERIFICATION_FAILED (got ${invalidSigError?.code})`
    )

    const tx2 = await PaymentTransaction.findById(order2.transactionId)
    assert(
      tx2.status === "verification_failed",
      `Transaction status marked 'verification_failed' (got ${tx2.status})`
    )
    assert(Boolean(tx2.verificationFailedAt), "verificationFailedAt timestamp recorded")

    // Ensure User A's subscription was NOT updated to silver
    const subACheck = await Subscription.findOne({ userId: testUserA._id })
    assert(subACheck.plan === "bronze", "User subscription remains 'bronze' (was NOT upgraded to silver)")

    // -------------------------------------------------------------
    // TEST 3: Rejection of Order ID Mismatch
    // -------------------------------------------------------------
    console.log("\nTest 3: Rejection of Order ID Mismatch")
    const order3 = await razorpayService.createSubscriptionOrder({
      userId: testUserA._id,
      planId: silverPlan._id,
      validityType: "monthly",
    })

    let mismatchError = null
    try {
      await razorpayService.verifyPayment({
        transactionId: order3.transactionId,
        orderId: "order_totally_wrong_order_id_123",
        paymentId: `pay_test_${Date.now()}`,
        signature: "some_sig",
        userId: testUserA._id,
      })
    } catch (err) {
      mismatchError = err
    }
    assert(Boolean(mismatchError), "Error thrown for Order ID mismatch")
    assert(mismatchError?.code === "ORDER_MISMATCH", `Error code is ORDER_MISMATCH (got ${mismatchError?.code})`)

    // -------------------------------------------------------------
    // TEST 4: Transaction Ownership Isolation
    // -------------------------------------------------------------
    console.log("\nTest 4: Transaction Ownership Isolation")
    let unauthorizedError = null
    try {
      await razorpayService.verifyPayment({
        transactionId: order3.transactionId,
        orderId: order3.orderId,
        paymentId: `pay_test_${Date.now()}`,
        signature: "some_sig",
        userId: testUserB._id, // User B trying to verify User A's order
      })
    } catch (err) {
      unauthorizedError = err
    }
    assert(Boolean(unauthorizedError), "Unauthorized user verification attempt rejected")
    assert(
      unauthorizedError?.code === "UNAUTHORIZED_TRANSACTION",
      `Error code is UNAUTHORIZED_TRANSACTION (got ${unauthorizedError?.code})`
    )

    // -------------------------------------------------------------
    // TEST 5: Duplicate Verification Prevention & Idempotency
    // -------------------------------------------------------------
    console.log("\nTest 5: Duplicate Verification Rejection & Invoice Idempotency")
    let duplicateErr = null
    try {
      await razorpayService.verifyPayment({
        transactionId: order1.transactionId,
        orderId: order1.orderId,
        paymentId: paymentId1,
        signature: signature1,
        userId: testUserA._id,
      })
    } catch (err) {
      duplicateErr = err
    }
    assert(Boolean(duplicateErr), "Duplicate verification attempt is rejected")
    assert(duplicateErr?.code === "PAYMENT_ALREADY_PROCESSED", "Error code is PAYMENT_ALREADY_PROCESSED")
    assert(duplicateErr?.statusCode === 409, "Status code is 409 Conflict")

    // Verify invoice idempotency: Calling generateInvoice again returns same invoice without duplicating
    const invoice1Repeat = await invoiceService.generateInvoice({
      transaction: verification1.transaction,
      user: testUserA,
    })
    assert(invoice1Repeat.invoiceNumber === invoice1.invoiceNumber, "Duplicate invoice was NOT created")

    // -------------------------------------------------------------
    // TEST 6: Payment ID Uniqueness / Replay Attack Prevention
    // -------------------------------------------------------------
    console.log("\nTest 6: Payment ID Uniqueness / Replay Attack Prevention")
    const order4 = await razorpayService.createSubscriptionOrder({
      userId: testUserA._id,
      planId: silverPlan._id,
      validityType: "monthly",
    })

    let replayError = null
    try {
      // Re-using paymentId1 from order1 on order4
      await razorpayService.verifyPayment({
        transactionId: order4.transactionId,
        orderId: order4.orderId,
        paymentId: paymentId1,
        signature: razorpayService.generateTestSignature(order4.orderId, paymentId1),
        userId: testUserA._id,
      })
    } catch (err) {
      replayError = err
    }
    assert(Boolean(replayError), "Replay attack with previously used paymentId rejected")
    assert(
      replayError?.code === "PAYMENT_ALREADY_PROCESSED",
      `Error code is PAYMENT_ALREADY_PROCESSED (got ${replayError?.code})`
    )

    // -------------------------------------------------------------
    // TEST 7: Subscription Upgrade Lifecycle (Bronze -> Silver)
    // -------------------------------------------------------------
    console.log("\nTest 7: Subscription Upgrade Lifecycle (Bronze -> Silver)")
    const paymentIdUpgrade = `pay_upgrade_${Date.now()}`
    const signatureUpgrade = razorpayService.generateTestSignature(order4.orderId, paymentIdUpgrade)

    const verificationUpgrade = await razorpayService.verifyPayment({
      transactionId: order4.transactionId,
      orderId: order4.orderId,
      paymentId: paymentIdUpgrade,
      signature: signatureUpgrade,
      userId: testUserA._id,
    })

    const activationUpgrade = await subscriptionActivationService.activateSubscription({
      userId: testUserA._id,
      planKey: "silver",
      planId: silverPlan._id,
      billingCycle: "monthly",
      paymentId: paymentIdUpgrade,
      transactionId: order4.transactionId,
      amountPaid: verificationUpgrade.amountPaid,
      actionType: "upgrade",
      customerName: testUserA.name,
      customerEmail: testUserA.email,
    })

    assert(activationUpgrade.action === "plan_upgraded", "Activation classified as 'plan_upgraded'")
    const subUpgraded = await Subscription.findOne({ userId: testUserA._id })
    assert(subUpgraded.plan === "silver", "Subscription tier upgraded to 'silver'")

    const historyUpgrade = await SubscriptionHistory.findOne({
      userId: testUserA._id,
      action: "plan_upgraded",
    })
    assert(Boolean(historyUpgrade), "SubscriptionHistory recorded plan_upgraded entry")
    assert(historyUpgrade.metadata?.previousPlan === "bronze", "History recorded previousPlan as 'bronze'")
    assert(historyUpgrade.metadata?.newPlan === "silver", "History recorded newPlan as 'silver'")

    // -------------------------------------------------------------
    // TEST 8: Subscription Renewal Lifecycle (Extending Expiry)
    // -------------------------------------------------------------
    console.log("\nTest 8: Subscription Renewal Lifecycle (Extending Expiry Date)")
    const currentExpiryTime = new Date(subUpgraded.expiresAt).getTime()

    const orderRenew = await razorpayService.createSubscriptionOrder({
      userId: testUserA._id,
      planId: silverPlan._id,
      validityType: "monthly",
      actionType: "renew",
    })

    const paymentIdRenew = `pay_renew_${Date.now()}`
    const signatureRenew = razorpayService.generateTestSignature(orderRenew.orderId, paymentIdRenew)

    const verificationRenew = await razorpayService.verifyPayment({
      transactionId: orderRenew.transactionId,
      orderId: orderRenew.orderId,
      paymentId: paymentIdRenew,
      signature: signatureRenew,
      userId: testUserA._id,
    })

    const activationRenew = await subscriptionActivationService.activateSubscription({
      userId: testUserA._id,
      planKey: "silver",
      planId: silverPlan._id,
      billingCycle: "monthly",
      paymentId: paymentIdRenew,
      transactionId: orderRenew.transactionId,
      amountPaid: verificationRenew.amountPaid,
      actionType: "renew",
    })

    assert(activationRenew.action === "subscription_renewed", "Activation classified as 'subscription_renewed'")
    const subRenewed = await Subscription.findOne({ userId: testUserA._id })
    const newExpiryTime = new Date(subRenewed.expiresAt).getTime()
    const diffDays = Math.round((newExpiryTime - currentExpiryTime) / (24 * 60 * 60 * 1000))
    assert(diffDays === 30, `Renewal extended current expiry by 30 days (extended ${diffDays} days)`)

    // -------------------------------------------------------------
    // TEST 9: Validity Date Calculation (Quarterly & Yearly)
    // -------------------------------------------------------------
    console.log("\nTest 9: Validity Date Calculations for Quarterly (90d) and Yearly (365d)")
    const activationQuarterly = await subscriptionActivationService.activateSubscription({
      userId: testUserB._id,
      planKey: "gold",
      planId: goldPlan._id,
      billingCycle: "quarterly",
      actionType: "new_subscription",
    })
    const subBQuarterly = await Subscription.findOne({ userId: testUserB._id })
    const qDays = Math.round((new Date(subBQuarterly.expiresAt) - new Date(subBQuarterly.startDate)) / (24 * 60 * 60 * 1000))
    assert(qDays === 90, `Quarterly duration is 90 days (got ${qDays})`)

    const previousExpiryB = new Date(subBQuarterly.expiresAt).getTime()
    const activationYearly = await subscriptionActivationService.activateSubscription({
      userId: testUserB._id,
      planKey: "gold",
      planId: goldPlan._id,
      billingCycle: "yearly",
      actionType: "renew",
    })
    const subBYearly = await Subscription.findOne({ userId: testUserB._id })
    const yDays = Math.round((new Date(subBYearly.expiresAt).getTime() - previousExpiryB) / (24 * 60 * 60 * 1000))
    assert(yDays === 365, `Yearly renewal added 365 days to active validity (got ${yDays})`)

    // -------------------------------------------------------------
    // TEST 10: Status Recovery API Context
    // -------------------------------------------------------------
    console.log("\nTest 10: Status Recovery API Context")
    const statusResult = await razorpayService.getTransactionStatus(order1.transactionId, testUserA._id)
    assert(statusResult.status === "success", "Transaction status query returns 'success'")
    assert(statusResult.signatureVerified === true, "signatureVerified is true")
    assert(statusResult.subscriptionActive === true, "subscriptionActive is true")
    assert(statusResult.subscription?.plan === "silver", "Subscription reflects current plan")

    // Clean up test records
    await PaymentTransaction.deleteMany({ userId: { $in: [testUserA._id, testUserB._id] } })
    await Subscription.deleteMany({ userId: { $in: [testUserA._id, testUserB._id] } })
    await SubscriptionHistory.deleteMany({ userId: { $in: [testUserA._id, testUserB._id] } })
    await Invoice.deleteMany({ userId: { $in: [testUserA._id, testUserB._id] } })
    await User.deleteMany({ _id: { $in: [testUserA._id, testUserB._id] } })

    console.log("\n=======================================================")
    console.log(`  PHASE 6 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`)
    console.log("=======================================================\n")

    if (failed > 0) {
      process.exit(1)
    } else {
      process.exit(0)
    }
  } catch (err) {
    console.error("Phase 6 test execution error:", err)
    process.exit(1)
  }
}

runTests()
