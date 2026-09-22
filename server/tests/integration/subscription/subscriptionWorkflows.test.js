import { TestRunner } from "../../helpers/testEnv.js"
import { connectTestDb, disconnectTestDb, cleanTestFixtures } from "../../helpers/testDatabase.js"
import { createTestUser, createTestSubscription } from "../../helpers/testDataFactories.js"
import Subscription from "../../../Modals/Subscription.js"
import SubscriptionHistory from "../../../Modals/SubscriptionHistory.js"
import { SubscriptionActivationService } from "../../../services/subscriptionActivationService.js"
import { SubscriptionLifecycleService } from "../../../services/subscriptionLifecycleService.js"

const activationService = new SubscriptionActivationService()
const lifecycleService = new SubscriptionLifecycleService()

export async function runSubscriptionWorkflowsIntegrationTest() {
  const runner = new TestRunner("Integration: End-to-End Subscription Workflows")
  runner.start()

  const testUserIds = []

  try {
    await connectTestDb()

    // 1. Setup User on Free Plan
    const user = await createTestUser({ name: "Workflow Subscriber" })
    testUserIds.push(user._id)

    const initialSub = await createTestSubscription({
      userId: user._id,
      plan: "free",
      status: "active",
    })

    runner.assert(initialSub.plan === "free", "Initial user subscription is Free tier")
    runner.assert(initialSub.status === "active", "Initial user subscription status is active")

    // 2. Upgrade Free -> Silver Monthly
    const silverActivation = await activationService.activateSubscription({
      userId: user._id,
      planKey: "silver",
      billingCycle: "monthly",
      amountPaid: 499,
      paymentId: "pay_test_silver_001",
      actionType: "subscription_upgraded",
      customerName: user.name,
      customerEmail: user.email,
    })

    runner.assert(silverActivation.plan === "silver", "Subscription successfully upgraded to Silver")
    runner.assert(silverActivation.subscription.status === "active", "Upgraded Silver subscription is active")
    runner.assert(silverActivation.subscription.download_limit === 15, "Silver plan daily download limit set to 15")
    runner.assert(silverActivation.expiresAt instanceof Date, "Silver subscription has valid expiry date")

    // Check SubscriptionHistory entry
    const silverHistory = await SubscriptionHistory.findOne({
      userId: user._id,
      "metadata.newPlan": "silver",
    })
    runner.assert(silverHistory !== null, "SubscriptionHistory recorded upgrade to Silver")

    // 3. Upgrade Silver -> Gold Annual
    const goldActivation = await activationService.activateSubscription({
      userId: user._id,
      planKey: "gold",
      billingCycle: "yearly",
      amountPaid: 9990,
      paymentId: "pay_test_gold_001",
      actionType: "subscription_upgraded",
      customerName: user.name,
      customerEmail: user.email,
    })

    runner.assert(goldActivation.plan === "gold", "Subscription successfully upgraded to Gold")
    runner.assert(goldActivation.billingCycle === "yearly", "Billing cycle updated to yearly")
    runner.assert(goldActivation.subscription.download_limit === 50, "Gold plan daily download limit set to 50")

    // Check history count
    const goldHistory = await SubscriptionHistory.findOne({
      userId: user._id,
      "metadata.newPlan": "gold",
    })
    runner.assert(goldHistory !== null, "SubscriptionHistory recorded upgrade to Gold")

    // 4. Request Plan Downgrade (Gold -> Bronze)
    const downgradeReq = await lifecycleService.requestPlanChange({
      userId: user._id,
      targetPlanKey: "bronze",
    })

    runner.assert(
      downgradeReq.action === "DOWNGRADE_SCHEDULED",
      "Downgrade request returns DOWNGRADE_SCHEDULED action"
    )
    runner.assert(
      downgradeReq.requiresPayment === false,
      "Downgrade does not require immediate payment"
    )

    const subAfterDowngrade = await Subscription.findOne({ userId: user._id })
    runner.assert(
      subAfterDowngrade.downgradeToPlan === "bronze",
      "Subscription records scheduled downgrade to bronze"
    )
    runner.assert(
      subAfterDowngrade.plan === "gold",
      "Subscription remains active Gold until current billing cycle expires"
    )

    // 5. Schedule Cancellation
    const cancelResult = await lifecycleService.scheduleCancellation(user._id, {
      reason: "Integration test cancellation",
      cancelledBy: "user",
    })

    runner.assert(
      cancelResult.status === "cancel_scheduled",
      "Cancellation schedules status as cancel_scheduled"
    )

    const subAfterCancel = await Subscription.findOne({ userId: user._id })
    runner.assert(
      subAfterCancel.cancelScheduled === true || subAfterCancel.status === "cancel_scheduled",
      "Subscription retains paid benefits until expiration date"
    )

    // Cleanup
    await cleanTestFixtures({ userIds: testUserIds })
    await SubscriptionHistory.deleteMany({ userId: { $in: testUserIds } })
  } catch (err) {
    runner.assert(false, `Unexpected error in subscription workflow integration test: ${err.message}`)
    await cleanTestFixtures({ userIds: testUserIds })
  }

  return runner.summary()
}

if (process.argv[1]?.endsWith("subscriptionWorkflows.test.js")) {
  runSubscriptionWorkflowsIntegrationTest()
    .then((res) => {
      disconnectTestDb()
      process.exit(res.failed > 0 ? 1 : 0)
    })
    .catch(() => {
      disconnectTestDb()
      process.exit(1)
    })
}
