import { TestRunner } from "../helpers/testEnv.js"
import { connectTestDb, disconnectTestDb, cleanTestFixtures } from "../helpers/testDatabase.js"
import {
  createTestUser,
  createTestSubscription,
  createTestPayment,
  createTestSecurityEvent,
} from "../helpers/testDataFactories.js"
import Subscription from "../../Modals/Subscription.js"
import PaymentTransaction from "../../Modals/PaymentTransaction.js"
import SubscriptionSecurityEvent from "../../Modals/SubscriptionSecurityEvent.js"

export async function runDatabaseBenchmarkTest() {
  const runner = new TestRunner("Performance: Compound Indexing & Query Latency Benchmarks")
  runner.start()

  const testUserIds = []
  const testOrderIds = []

  try {
    await connectTestDb()

    // 1. Setup Test Fixture Data
    const users = []
    for (let i = 0; i < 10; i++) {
      const user = await createTestUser({ name: `Bench User ${i}` })
      testUserIds.push(user._id)
      users.push(user)

      await createTestSubscription({
        userId: user._id,
        plan: i % 2 === 0 ? "silver" : "gold",
        status: "active",
      })

      const payment = await createTestPayment({
        userId: user._id,
        amount: 49900,
        status: "success",
      })
      testOrderIds.push(payment.orderId)

      await createTestSecurityEvent({
        userId: user._id,
        eventType: "PAYMENT_ANOMALY_DETECTED",
      })
    }

    const sampleUserId = users[0]._id
    const sampleOrderId = testOrderIds[0]

    // Warm up database query pipeline
    await Subscription.findOne({}).lean()

    const maxLatencyMs = 200

    // 2. Benchmark: Subscription Lookup by userId (Compound index: userId, status)
    const subStart = performance.now()
    const subDoc = await Subscription.findOne({ userId: sampleUserId, status: "active" }).lean()
    const subDuration = performance.now() - subStart

    runner.assert(subDoc !== null, "Subscription query returned valid document")
    runner.assert(
      subDuration < maxLatencyMs,
      `Subscription lookup latency is within acceptable threshold (${subDuration.toFixed(2)}ms < ${maxLatencyMs}ms)`
    )

    // 3. Benchmark: Expiring Subscriptions Query (Compound index: status, expiresAt)
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const expStart = performance.now()
    const expiringSubs = await Subscription.find({
      status: "active",
      expiresAt: { $lte: nextWeek },
    })
      .limit(20)
      .lean()
    const expDuration = performance.now() - expStart

    runner.assert(Array.isArray(expiringSubs), "Expiring subscriptions query executed successfully")
    runner.assert(
      expDuration < maxLatencyMs,
      `Expiring subscriptions query latency is within threshold (${expDuration.toFixed(2)}ms < ${maxLatencyMs}ms)`
    )

    // 4. Benchmark: Payment Transaction Lookup by orderId (Index: orderId: 1)
    const txStart = performance.now()
    const txDoc = await PaymentTransaction.findOne({ orderId: sampleOrderId }).lean()
    const txDuration = performance.now() - txStart

    runner.assert(txDoc !== null, "Payment transaction query returned valid document")
    runner.assert(
      txDuration < maxLatencyMs,
      `Payment transaction lookup latency is within threshold (${txDuration.toFixed(2)}ms < ${maxLatencyMs}ms)`
    )

    // 5. Benchmark: Security Events by User and Timestamp (Compound index: userId, createdAt)
    const secStart = performance.now()
    const secEvents = await SubscriptionSecurityEvent.find({ userId: sampleUserId })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean()
    const secDuration = performance.now() - secStart

    runner.assert(Array.isArray(secEvents), "Security events query executed successfully")
    runner.assert(
      secDuration < maxLatencyMs,
      `Security events query latency is within threshold (${secDuration.toFixed(2)}ms < ${maxLatencyMs}ms)`
    )

    // 6. Verify MongoDB Index Definitions Exist
    const subIndexes = await Subscription.collection.indexes()
    const subIndexKeys = subIndexes.map((idx) => Object.keys(idx.key).join("_"))
    const hasUserIdStatusIdx =
      subIndexKeys.some((k) => k.includes("userId")) &&
      subIndexKeys.some((k) => k.includes("status"))
    runner.assert(hasUserIdStatusIdx === true, "Subscription collection has active userId and status indexes")

    const txIndexes = await PaymentTransaction.collection.indexes()
    const txIndexKeys = txIndexes.map((idx) => Object.keys(idx.key).join("_"))
    const hasOrderIdIdx = txIndexKeys.some((k) => k.includes("orderId"))
    runner.assert(hasOrderIdIdx === true, "PaymentTransaction collection has active orderId index")

    // Cleanup
    await cleanTestFixtures({ userIds: testUserIds, orderIds: testOrderIds })
  } catch (err) {
    runner.assert(false, `Unexpected error in database benchmark test: ${err.message}`)
    await cleanTestFixtures({ userIds: testUserIds, orderIds: testOrderIds })
  }

  return runner.summary()
}

if (process.argv[1]?.endsWith("databaseBenchmark.test.js")) {
  runDatabaseBenchmarkTest()
    .then((res) => {
      disconnectTestDb()
      process.exit(res.failed > 0 ? 1 : 0)
    })
    .catch(() => {
      disconnectTestDb()
      process.exit(1)
    })
}
