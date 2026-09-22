import { TestRunner } from "../../helpers/testEnv.js"
import { connectTestDb, disconnectTestDb, cleanTestFixtures } from "../../helpers/testDatabase.js"
import { createTestUser, createTestAdmin, createTestSubscription } from "../../helpers/testDataFactories.js"
import Subscription from "../../../Modals/Subscription.js"
import AdminSubscriptionAuditLog from "../../../Modals/AdminSubscriptionAuditLog.js"
import SubscriptionHistory from "../../../Modals/SubscriptionHistory.js"
import { SubscriberManagementService } from "../../../services/admin/subscriberManagementService.js"

const adminService = new SubscriberManagementService()

export async function runAdminControlsFlowIntegrationTest() {
  const runner = new TestRunner("Integration: Admin Subscription Controls & Audit Logs")
  runner.start()

  const testUserIds = []

  try {
    await connectTestDb()

    // 1. Create Admin & Regular Subscriber
    const admin = await createTestAdmin()
    const user = await createTestUser({ name: "Subscribed Client" })
    testUserIds.push(admin._id, user._id)

    const sub = await createTestSubscription({
      userId: user._id,
      plan: "silver",
      status: "active",
      billingCycle: "monthly",
    })

    const originalExpiry = sub.expiresAt

    // 2. Admin Extends Validity (+30 Days)
    const extendResult = await adminService.extendValidity({
      userId: user._id,
      additionalDays: 30,
      reason: "Customer loyalty compensation for platform downtime",
      adminId: admin._id,
    })

    runner.assert(extendResult.success === true, "Admin extendValidity succeeds")
    runner.assert(extendResult.daysAdded === 30, "30 days added to validity")
    runner.assert(
      extendResult.newExpiry.getTime() > originalExpiry.getTime(),
      "New expiry is strictly later than previous expiry"
    )

    // Verify Admin Subscription Audit Log
    const extendAudit = await AdminSubscriptionAuditLog.findOne({
      userId: user._id,
      action: "EXTEND_VALIDITY",
    })
    runner.assert(extendAudit !== null, "AdminSubscriptionAuditLog recorded EXTEND_VALIDITY action")
    runner.assert(extendAudit.adminId.toString() === admin._id.toString(), "Audit log records operating admin ID")

    // 3. Admin Suspends Subscription
    const suspendResult = await adminService.suspendSubscription({
      userId: user._id,
      reason: "Payment dispute reported by card issuer",
      adminId: admin._id,
    })

    runner.assert(suspendResult.success === true, "Admin suspendSubscription succeeds")
    runner.assert(suspendResult.newStatus === "suspended", "Subscription status changed to 'suspended'")

    const subAfterSuspend = await Subscription.findOne({ userId: user._id })
    runner.assert(subAfterSuspend.status === "suspended", "Subscription document in DB updated to 'suspended'")

    const suspendAudit = await AdminSubscriptionAuditLog.findOne({
      userId: user._id,
      action: "SUSPEND_SUBSCRIPTION",
    })
    runner.assert(suspendAudit !== null, "AdminSubscriptionAuditLog recorded SUSPEND_SUBSCRIPTION action")

    // 4. Admin Restores Subscription
    const restoreResult = await adminService.restoreSubscription({
      userId: user._id,
      reason: "Dispute resolved with card issuer",
      adminId: admin._id,
    })

    runner.assert(restoreResult.success === true, "Admin restoreSubscription succeeds")
    runner.assert(restoreResult.newStatus === "active", "Subscription status restored to 'active'")

    const subAfterRestore = await Subscription.findOne({ userId: user._id })
    runner.assert(subAfterRestore.status === "active", "Subscription document in DB restored to 'active'")

    const restoreAudit = await AdminSubscriptionAuditLog.findOne({
      userId: user._id,
      action: "RESTORE_SUBSCRIPTION",
    })
    runner.assert(restoreAudit !== null, "AdminSubscriptionAuditLog recorded RESTORE_SUBSCRIPTION action")

    // 5. Admin Forces Downgrade to Free Tier
    const freeResult = await adminService.moveToFreeTier({
      userId: user._id,
      reason: "User requested downgrade via priority support ticket",
      adminId: admin._id,
    })

    runner.assert(freeResult.success === true, "Admin moveToFreeTier succeeds")
    runner.assert(freeResult.newPlan === "free", "Subscription plan downgraded to 'free'")

    const subAfterFree = await Subscription.findOne({ userId: user._id })
    runner.assert(subAfterFree.plan === "free", "Subscription in DB is now Free tier")
    runner.assert(subAfterFree.expiresAt === null, "Free tier has no expiration date")

    const freeAudit = await AdminSubscriptionAuditLog.findOne({
      userId: user._id,
      action: "MOVE_TO_FREE",
    })
    runner.assert(freeAudit !== null, "AdminSubscriptionAuditLog recorded MOVE_TO_FREE action")

    // 6. Validation: Reject Admin Action Without Minimum Reason
    let badReasonBlocked = false
    try {
      await adminService.extendValidity({
        userId: user._id,
        additionalDays: 10,
        reason: "ok", // too short (< 5 chars)
        adminId: admin._id,
      })
    } catch (err) {
      badReasonBlocked = err.statusCode === 400 || err.code === "INVALID_REASON"
    }
    runner.assert(badReasonBlocked === true, "Admin action without descriptive reason is rejected with 400 Bad Request")

    // Cleanup
    await cleanTestFixtures({ userIds: testUserIds })
    await AdminSubscriptionAuditLog.deleteMany({ userId: { $in: testUserIds } })
    await SubscriptionHistory.deleteMany({ userId: { $in: testUserIds } })
  } catch (err) {
    runner.assert(false, `Unexpected error in admin controls integration test: ${err.message}`)
    await cleanTestFixtures({ userIds: testUserIds })
  }

  return runner.summary()
}

if (process.argv[1]?.endsWith("adminControlsFlow.test.js")) {
  runAdminControlsFlowIntegrationTest()
    .then((res) => {
      disconnectTestDb()
      process.exit(res.failed > 0 ? 1 : 0)
    })
    .catch(() => {
      disconnectTestDb()
      process.exit(1)
    })
}
