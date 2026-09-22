import mongoose from "mongoose"
import { TestRunner } from "../../helpers/testEnv.js"
import { connectTestDb, disconnectTestDb, cleanTestFixtures } from "../../helpers/testDatabase.js"
import { createTestUser, createTestPayment } from "../../helpers/testDataFactories.js"
import paymentSecurityService from "../../../security/services/paymentSecurityService.js"

export async function runPaymentValidationUnitTest() {
  const runner = new TestRunner("Unit: Payment Validation & Ownership Protection")
  runner.start()

  const testUserIds = []
  const testOrderIds = []

  try {
    await connectTestDb()

    // 1. Authoritative Amount Validation
    // Silver monthly: ₹499 -> 49900 paise
    const validMonthly = await paymentSecurityService.validatePaymentAmount("silver", "monthly", 49900)
    runner.assert(validMonthly.isValid === true, "Validates genuine Silver monthly price (49900 paise)")
    runner.assert(validMonthly.expectedAmountPaise === 49900, "Computes expected amount in paise")

    // Client price tampering attempt
    const tampered = await paymentSecurityService.validatePaymentAmount("silver", "monthly", 9900)
    runner.assert(tampered.isValid === false, "Rejects manipulated payment amount (9900 paise)")
    runner.assert(tampered.difference !== 0, "Calculates price discrepancy")

    // Invalid Plan
    const invalidPlan = await paymentSecurityService.validatePaymentAmount("super_platinum", "monthly", 50000)
    runner.assert(invalidPlan.isValid === false, "Rejects non-existent plan identifier")

    // Invalid Validity Cycle
    const invalidCycle = await paymentSecurityService.validatePaymentAmount("silver", "decade", 50000)
    runner.assert(invalidCycle.isValid === false, "Rejects unsupported billing cycle")

    // 2. Ownership Verification
    const userA = await createTestUser({ name: "User A" })
    const userB = await createTestUser({ name: "User B" })
    testUserIds.push(userA._id, userB._id)

    const paymentTx = await createTestPayment({
      userId: userA._id,
      amount: 49900,
      status: "pending",
    })
    testOrderIds.push(paymentTx.orderId)

    // User A accessing own payment
    const ownerCheck = paymentSecurityService.validatePaymentOwnership(paymentTx, userA._id)
    runner.assert(ownerCheck === true, "Permits transaction access to verified owner (User A)")

    // User B attempting cross-user access
    let crossUserBlocked = false
    try {
      paymentSecurityService.validatePaymentOwnership(paymentTx, userB._id)
    } catch (err) {
      crossUserBlocked = err.statusCode === 403 || err.message.includes("not authorized")
    }
    runner.assert(crossUserBlocked === true, "Strictly blocks cross-user transaction modification with Forbidden")

    // 3. Replay Attack Detection
    const paymentTxSuccess = await createTestPayment({
      userId: userA._id,
      amount: 49900,
      status: "success",
    })
    testOrderIds.push(paymentTxSuccess.orderId)

    const replayCheck = await paymentSecurityService.detectReplayAttempt(
      `fresh_order_${Date.now()}`,
      paymentTxSuccess.paymentId
    )
    runner.assert(replayCheck.isReplay === true, "Flags reuse of already-succeeded paymentId as REPLAY")

    // Cleanup
    await cleanTestFixtures({ userIds: testUserIds, orderIds: testOrderIds })
  } catch (err) {
    runner.assert(false, `Unexpected error in payment validation unit test: ${err.message}`)
  }

  return runner.summary()
}

if (process.argv[1]?.endsWith("paymentValidation.test.js")) {
  runPaymentValidationUnitTest()
    .then(async (res) => {
      await disconnectTestDb()
      process.exit(res.failed > 0 ? 1 : 0)
    })
    .catch(async () => {
      await disconnectTestDb()
      process.exit(1)
    })
}

export default runPaymentValidationUnitTest
