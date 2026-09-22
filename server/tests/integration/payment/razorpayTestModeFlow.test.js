import crypto from "crypto"
import { TestRunner } from "../../helpers/testEnv.js"
import { connectTestDb, disconnectTestDb, cleanTestFixtures } from "../../helpers/testDatabase.js"
import { createTestUser, createTestPayment } from "../../helpers/testDataFactories.js"
import { RazorpayService } from "../../../services/razorpayService.js"
import PaymentTransaction from "../../../Modals/PaymentTransaction.js"

const razorpayService = new RazorpayService()

export async function runRazorpayTestModeFlowIntegrationTest() {
  const runner = new TestRunner("Integration: Razorpay Test Mode Checkout & Verification")
  runner.start()

  const testUserIds = []
  const testOrderIds = []

  try {
    await connectTestDb()

    // 1. Create Test User
    const user = await createTestUser({ name: "Checkout Tester" })
    testUserIds.push(user._id)

    // 2. Create Checkout Order via RazorpayService
    const orderResult = await razorpayService.createOrder({
      userId: user._id,
      planId: "silver",
      billingCycle: "monthly",
      userDetails: { name: user.name, email: user.email },
    })

    runner.assert(typeof orderResult.orderId === "string", "Order creation returns a valid orderId string")
    runner.assert(orderResult.orderId.startsWith("order_"), "orderId conforms to standard order_ prefix")
    runner.assert(orderResult.amount === 49900, "Server-side price computation sets authoritative 49900 paise")
    runner.assert(orderResult.currency === "INR", "Order currency is INR")
    testOrderIds.push(orderResult.orderId)

    // Transaction is stored with 'pending' status
    const pendingTx = await PaymentTransaction.findOne({ orderId: orderResult.orderId })
    runner.assert(pendingTx !== null, "Transaction record is created in database")
    runner.assert(pendingTx.status === "pending", "Initial transaction status is 'pending'")

    // 3. Generate Valid HMAC-SHA256 Signature
    const paymentId = `pay_test_${crypto.randomBytes(8).toString("hex")}`
    const validSignature = crypto
      .createHmac("sha256", razorpayService.keySecret)
      .update(`${orderResult.orderId}|${paymentId}`)
      .digest("hex")

    // 4. Verify Payment with Valid Signature
    const verifyResult = await razorpayService.verifyPayment({
      transactionId: orderResult.transactionId,
      orderId: orderResult.orderId,
      paymentId,
      signature: validSignature,
      userId: user._id,
    })

    runner.assert(verifyResult.success === true, "Valid payment signature succeeds verification")
    runner.assert(verifyResult.transaction.status === "success", "Payment status moves to processing/success")

    const updatedTx = await PaymentTransaction.findOne({ orderId: orderResult.orderId })
    runner.assert(updatedTx.paymentId === paymentId, "Transaction records verified paymentId")

    // 5. Replay Attack Prevention on already-verified payment
    let replayBlocked = false
    try {
      await razorpayService.verifyPayment({
        transactionId: orderResult.transactionId,
        orderId: orderResult.orderId,
        paymentId,
        signature: validSignature,
        userId: user._id,
      })
    } catch (err) {
      replayBlocked = err.statusCode === 409 || err.code === "PAYMENT_ALREADY_PROCESSED"
    }
    runner.assert(replayBlocked === true, "Re-verifying same succeeded payment is strictly blocked with 409 Conflict")

    // 6. Cancellation of a Pending Attempt
    const cancelOrder = await razorpayService.createOrder({
      userId: user._id,
      planId: "bronze",
      billingCycle: "monthly",
    })
    testOrderIds.push(cancelOrder.orderId)

    const cancelResult = await razorpayService.cancelPaymentAttempt(cancelOrder.orderId, user._id, "User closed modal")
    runner.assert(cancelResult.success === true, "cancelPaymentAttempt returns success")
    runner.assert(cancelResult.status === "cancelled", "Cancelled payment status is updated to 'cancelled'")

    // 7. Record Payment Failure
    const failOrder = await razorpayService.createOrder({
      userId: user._id,
      planId: "gold",
      billingCycle: "yearly",
    })
    testOrderIds.push(failOrder.orderId)

    const failResult = await razorpayService.recordPaymentFailure(
      failOrder.orderId,
      user._id,
      "BAD_REQUEST_ERROR",
      "Card declined by issuing bank"
    )
    runner.assert(failResult.success === true, "recordPaymentFailure returns success")
    runner.assert(failResult.status === "failed", "Failed payment status is updated to 'failed'")

    // Cleanup
    await cleanTestFixtures({ userIds: testUserIds, orderIds: testOrderIds })
  } catch (err) {
    runner.assert(false, `Unexpected error in razorpay test mode integration test: ${err.message}`)
    await cleanTestFixtures({ userIds: testUserIds, orderIds: testOrderIds })
  }

  return runner.summary()
}

if (process.argv[1]?.endsWith("razorpayTestModeFlow.test.js")) {
  runRazorpayTestModeFlowIntegrationTest()
    .then((res) => {
      disconnectTestDb()
      process.exit(res.failed > 0 ? 1 : 0)
    })
    .catch(() => {
      disconnectTestDb()
      process.exit(1)
    })
}
