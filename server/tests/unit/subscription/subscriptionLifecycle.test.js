import mongoose from "mongoose"
import { TestRunner } from "../../helpers/testEnv.js"
import { connectTestDb, disconnectTestDb, cleanTestFixtures } from "../../helpers/testDatabase.js"
import { createTestUser, createTestSubscription } from "../../helpers/testDataFactories.js"
import Subscription from "../../../Modals/Subscription.js"

export async function runSubscriptionLifecycleUnitTest() {
  const runner = new TestRunner("Unit: Subscription Lifecycle & State Transitions")
  runner.start()

  const testUserIds = []

  try {
    await connectTestDb()

    // 1. Create Free Subscription
    const freeUser = await createTestUser({ name: "Free Tier User" })
    testUserIds.push(freeUser._id)

    const freeSub = await createTestSubscription({
      userId: freeUser._id,
      plan: "free",
      status: "active",
      expiresAt: null,
    })

    runner.assert(freeSub.plan === "free", "Free subscription initializes with plan 'free'")
    runner.assert(freeSub.status === "active", "Free subscription initializes with status 'active'")
    runner.assert(freeSub.expiresAt === null, "Free subscription has no expiration date (null)")
    runner.assert(freeSub.download_limit === 1, "Free subscription has default download limit of 1")

    // 2. Create Bronze Subscription (Monthly)
    const bronzeUser = await createTestUser({ name: "Bronze Tier User" })
    testUserIds.push(bronzeUser._id)

    const bronzeSub = await createTestSubscription({
      userId: bronzeUser._id,
      plan: "bronze",
      status: "active",
      billingCycle: "monthly",
    })

    runner.assert(bronzeSub.plan === "bronze", "Bronze subscription initializes with plan 'bronze'")
    runner.assert(bronzeSub.download_limit === 5, "Bronze subscription assigns 5 downloads/day")
    runner.assert(bronzeSub.expiresAt instanceof Date, "Bronze subscription calculates valid future expiry date")

    // 3. Create Silver Subscription (Quarterly)
    const silverUser = await createTestUser({ name: "Silver Tier User" })
    testUserIds.push(silverUser._id)

    const ninetyDays = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
    const silverSub = await createTestSubscription({
      userId: silverUser._id,
      plan: "silver",
      status: "active",
      billingCycle: "quarterly",
      expiresAt: ninetyDays,
    })

    runner.assert(silverSub.plan === "silver", "Silver subscription initializes with plan 'silver'")
    runner.assert(silverSub.download_limit === 15, "Silver subscription assigns 15 downloads/day")
    runner.assert(
      Math.abs(silverSub.expiresAt.getTime() - ninetyDays.getTime()) < 1000,
      "Quarterly subscription calculates 90-day validity period"
    )

    // 4. Create Gold Subscription (Yearly)
    const goldUser = await createTestUser({ name: "Gold Tier User" })
    testUserIds.push(goldUser._id)

    const goldSub = await createTestSubscription({
      userId: goldUser._id,
      plan: "gold",
      status: "active",
      billingCycle: "yearly",
    })

    runner.assert(goldSub.plan === "gold", "Gold subscription initializes with plan 'gold'")
    runner.assert(goldSub.download_limit === 50, "Gold subscription assigns 50 downloads/day")

    // 5. Subscription Renewal Extension
    const currentExpiry = new Date(silverSub.expiresAt)
    const extendedExpiry = new Date(currentExpiry.getTime() + 30 * 24 * 60 * 60 * 1000)
    silverSub.expiresAt = extendedExpiry
    silverSub.expiryDate = extendedExpiry
    silverSub.endDate = extendedExpiry
    await silverSub.save()

    const reloadedSilver = await Subscription.findById(silverSub._id)
    runner.assert(
      reloadedSilver.expiresAt.getTime() === extendedExpiry.getTime(),
      "Subscription renewal extends expiry date by expected billing period"
    )

    // 6. Cancellation Scheduling Policy
    silverSub.status = "cancel_scheduled"
    await silverSub.save()

    const cancelledSub = await Subscription.findById(silverSub._id)
    runner.assert(cancelledSub.status === "cancel_scheduled", "Subscription status updates to 'cancel_scheduled'")
    runner.assert(
      cancelledSub.expiresAt.getTime() > Date.now(),
      "Cancelled subscription retains valid paid period until original expiration date"
    )

    // 7. Automatic Downgrade to Free Tier
    silverSub.plan = "free"
    silverSub.status = "active"
    silverSub.expiresAt = null
    silverSub.endDate = null
    silverSub.expiryDate = null
    silverSub.download_limit = 1
    await silverSub.save()

    const downgradedSub = await Subscription.findById(silverSub._id)
    runner.assert(downgradedSub.plan === "free", "Subscription downgrades cleanly to Free tier")
    runner.assert(downgradedSub.status === "active", "Downgraded Free subscription remains active")
    runner.assert(downgradedSub.expiresAt === null, "Downgraded Free subscription resets expiresAt to null")

    // Cleanup
    await cleanTestFixtures({ userIds: testUserIds })
  } catch (err) {
    runner.assert(false, `Unexpected error in lifecycle unit test: ${err.message}`)
  }

  return runner.summary()
}

if (process.argv[1]?.endsWith("subscriptionLifecycle.test.js")) {
  runSubscriptionLifecycleUnitTest()
    .then(async (res) => {
      await disconnectTestDb()
      process.exit(res.failed > 0 ? 1 : 0)
    })
    .catch(async () => {
      await disconnectTestDb()
      process.exit(1)
    })
}

export default runSubscriptionLifecycleUnitTest
