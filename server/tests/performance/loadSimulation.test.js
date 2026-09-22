import { TestRunner } from "../helpers/testEnv.js"
import { connectTestDb, disconnectTestDb, cleanTestFixtures } from "../helpers/testDatabase.js"
import { createTestUser } from "../helpers/testDataFactories.js"
import { RazorpayService } from "../../services/razorpayService.js"
import idempotencyService from "../../security/services/idempotencyService.js"
import PaymentTransaction from "../../Modals/PaymentTransaction.js"

const razorpayService = new RazorpayService()

export async function runLoadSimulationTest() {
  const runner = new TestRunner("Performance: Concurrent Checkout & Idempotency Load Simulation")
  runner.start()

  const testUserIds = []
  const testOrderIds = []

  try {
    await connectTestDb()

    // 1. Create a pool of 50 unique test users
    const userPool = []
    for (let i = 0; i < 50; i++) {
      const u = await createTestUser({ name: `Load User ${i}` })
      testUserIds.push(u._id)
      userPool.push(u)
    }

    // 2. Load Simulation 1: 50 Concurrent Checkout Requests (One per unique user)
    const concurrent50Start = performance.now()
    const promises50 = []

    for (let i = 0; i < 50; i++) {
      const user = userPool[i]
      promises50.push(
        razorpayService
          .createSubscriptionOrder({
            userId: user._id,
            planId: i % 2 === 0 ? "silver" : "gold",
            billingCycle: "monthly",
            userDetails: { name: user.name, email: user.email },
          })
          .then((res) => {
            testOrderIds.push(res.orderId)
            return { success: true, orderId: res.orderId, amount: res.amount }
          })
          .catch((err) => ({ success: false, error: err.message }))
      )
    }

    const results50 = await Promise.all(promises50)
    const concurrent50Duration = performance.now() - concurrent50Start

    const successful50 = results50.filter((r) => r.success).length
    runner.assert(
      successful50 === 50,
      `All 50 concurrent checkout order requests completed successfully (${successful50}/50 in ${concurrent50Duration.toFixed(0)}ms)`
    )

    // Check unique order IDs
    const uniqueOrderIds = new Set(results50.map((r) => r.orderId))
    runner.assert(
      uniqueOrderIds.size === 50,
      "Every concurrent checkout request produced a unique, collision-free order ID"
    )

    // 3. Load Simulation 2: 50 Simultaneous Idempotency Lock Acquisitions
    // Same idempotency key requested by 50 concurrent threads simultaneously
    const sharedKey = `stress_lock_${Date.now()}`
    const lockStart = performance.now()

    const lockPromises = []
    for (let i = 0; i < 50; i++) {
      lockPromises.push(
        idempotencyService.checkOrAcquire(sharedKey, "stress_test").catch((err) => ({
          error: err.message,
        }))
      )
    }

    const lockResults = await Promise.all(lockPromises)
    const lockDuration = performance.now() - lockStart

    const acquiredLocks = lockResults.filter((l) => !l.isDuplicate && !l.error).length
    const deduplicatedLocks = lockResults.filter((l) => l.isDuplicate === true).length

    runner.assert(
      acquiredLocks === 1,
      `Exactly 1 lock acquired among 50 simultaneous threads (Acquired: ${acquiredLocks})`
    )
    runner.assert(
      deduplicatedLocks === 49,
      `49 threads safely detected duplicate in-flight lock without race crashes (${deduplicatedLocks}/49 in ${lockDuration.toFixed(0)}ms)`
    )

    // Release stress lock
    await idempotencyService.release(sharedKey).catch(() => {})

    // 4. Database Consistency Check: Zero duplicate or orphaned records
    const storedOrdersCount = await PaymentTransaction.countDocuments({
      orderId: { $in: Array.from(uniqueOrderIds) },
    })
    runner.assert(
      storedOrdersCount === 50,
      `Database records match exact concurrent order count (50 records found)`
    )

    // Cleanup
    await cleanTestFixtures({ userIds: testUserIds, orderIds: testOrderIds })
  } catch (err) {
    runner.assert(false, `Unexpected error in load simulation test: ${err.message}`)
    await cleanTestFixtures({ userIds: testUserIds, orderIds: testOrderIds })
  }

  return runner.summary()
}

if (process.argv[1]?.endsWith("loadSimulation.test.js")) {
  runLoadSimulationTest()
    .then((res) => {
      disconnectTestDb()
      process.exit(res.failed > 0 ? 1 : 0)
    })
    .catch(() => {
      disconnectTestDb()
      process.exit(1)
    })
}
