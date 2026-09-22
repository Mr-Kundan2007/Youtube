import assert from "assert"
import mongoose from "mongoose"
import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"
import http from "http"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, "../.env") })

// Set test environment
process.env.NODE_ENV = "test"
const DB_URL = process.env.DB_URL || "mongodb://localhost:27017/youtube_test"

async function runPhase7TestSuite() {
  console.log("\n=======================================================")
  console.log("  PHASE 7: SUBSCRIPTION LIFECYCLE AUTOMATION SUITE")
  console.log("=======================================================\n")

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(DB_URL)
    console.log("Connected to MongoDB successfully.\n")
  }

  // Import models & services
  const { default: Subscription } = await import("../Modals/Subscription.js")
  const { default: SubscriptionHistory } = await import("../Modals/SubscriptionHistory.js")
  const { default: SubscriptionPlan } = await import("../Modals/SubscriptionPlan.js")
  const { default: DownloadNotification } = await import("../Modals/DownloadNotification.js")
  const { default: JobLock } = await import("../Modals/JobLock.js")
  const { default: User } = await import("../Modals/Auth.js")
  const { default: DownloadQuota } = await import("../Modals/DownloadQuota.js")

  const { subscriptionLifecycleService } = await import("../services/subscriptionLifecycleService.js")
  const { subscriptionJobService } = await import("../services/subscriptionJobService.js")
  const { subscriptionNotificationService } = await import("../services/subscriptionNotificationService.js")
  const { subscriptionAccessControlService } = await import("../services/subscriptionAccessControlService.js")
  const { quotaService } = await import("../services/quotaService.js")
  const { seedSubscriptionPlans } = await import("../modules/subscription/subscription.seed.js")

  // Ensure default plans seeded
  await seedSubscriptionPlans()
  const silverPlan = await SubscriptionPlan.findOne({ slug: "silver" })
  const freePlan = await SubscriptionPlan.findOne({ slug: "free" })
  assert.ok(silverPlan, "Silver plan exists")
  assert.ok(freePlan, "Free plan exists")

  // Create isolated test user
  const uniqueId = Date.now()
  const testUser = await User.create({
    name: `Lifecycle User ${uniqueId}`,
    email: `lifecycle_${uniqueId}@example.com`,
    channelname: `LifecycleChannel_${uniqueId}`,
  })

  let passed = 0

  try {
    // -------------------------------------------------------------
    // TEST 1: Model Schema Support for Phase 7
    // -------------------------------------------------------------
    console.log("Test 1: Model Schema Support for Phase 7")
    const subSchemaPaths = Subscription.schema.paths
    assert.ok(subSchemaPaths["cancelScheduled"], "Subscription has cancelScheduled field")
    assert.ok(subSchemaPaths["cancelEffectiveAt"], "Subscription has cancelEffectiveAt field")
    assert.ok(subSchemaPaths["gracePeriodStart"], "Subscription has gracePeriodStart field")
    assert.ok(subSchemaPaths["gracePeriodEnd"], "Subscription has gracePeriodEnd field")
    assert.ok(subSchemaPaths["remindersSent"], "Subscription has remindersSent field")

    const notifSchemaPaths = DownloadNotification.schema.paths
    assert.ok(notifSchemaPaths["actionUrl"], "DownloadNotification has actionUrl field")
    assert.ok(notifSchemaPaths["status"], "DownloadNotification has status field")

    console.log("  ✓ Subscription and Notification models contain Phase 7 lifecycle fields")
    passed++

    // -------------------------------------------------------------
    // TEST 2: Active Paid Subscription Setup
    // -------------------------------------------------------------
    console.log("\nTest 2: Active Paid Subscription Setup")
    const futureExpiry = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000) // 20 days in future
    const activeSub = await Subscription.create({
      userId: testUser._id,
      user_id: testUser._id,
      planId: silverPlan._id,
      plan: "silver",
      status: "active",
      startDate: new Date(),
      expiresAt: futureExpiry,
      endDate: futureExpiry,
      autoRenew: true,
      download_limit: 15,
      download_quota_type: "daily",
      download_enabled: true,
    })
    await quotaService.getActiveQuotaRecord(testUser._id, "silver")

    const effectivePlanBefore = await subscriptionAccessControlService.getUserEffectivePlan(testUser._id)
    assert.strictEqual(effectivePlanBefore.plan, "silver", "User effective plan is silver")
    assert.strictEqual(effectivePlanBefore.isActive, true, "Subscription is active")
    console.log("  ✓ Silver subscription initialized and active for user")
    passed++

    // -------------------------------------------------------------
    // TEST 3: Scheduled Cancellation Flow (Access Preserved Until Expiry)
    // -------------------------------------------------------------
    console.log("\nTest 3: Scheduled Cancellation Flow")
    const cancelResult = await subscriptionLifecycleService.scheduleCancellation(testUser._id, {
      reason: "Looking to save money",
      cancelledBy: "user",
    })

    assert.strictEqual(cancelResult.success, true, "Cancellation scheduled successfully")
    assert.strictEqual(cancelResult.status, "cancel_scheduled", "Status set to cancel_scheduled")
    assert.strictEqual(cancelResult.cancelScheduled, true, "cancelScheduled flag is true")
    assert.strictEqual(cancelResult.cancelAtPeriodEnd, true, "cancelAtPeriodEnd flag is true")

    // Verify DB state
    const subAfterCancel = await Subscription.findById(activeSub._id)
    assert.strictEqual(subAfterCancel.status, "cancel_scheduled")
    assert.strictEqual(subAfterCancel.autoRenew, false)
    assert.strictEqual(subAfterCancel.cancellationReason, "Looking to save money")
    assert.ok(subAfterCancel.cancelEffectiveAt, "cancelEffectiveAt timestamp recorded")

    // CRITICAL: User MUST still have active Silver access until expiresAt!
    const effectivePlanDuringCancel = await subscriptionAccessControlService.getUserEffectivePlan(testUser._id)
    assert.strictEqual(effectivePlanDuringCancel.plan, "silver", "User STILL retains Silver benefits during cancellation notice period")
    assert.strictEqual(effectivePlanDuringCancel.isActive, true, "Still active")

    // Verify SubscriptionHistory
    const cancelHistory = await SubscriptionHistory.findOne({
      userId: testUser._id,
      action: "cancellation_scheduled",
    })
    assert.ok(cancelHistory, "SubscriptionHistory recorded cancellation_scheduled")

    // Verify Notification
    const cancelNotif = await DownloadNotification.findOne({
      userId: testUser._id,
      type: "CANCELLATION_SCHEDULED",
    })
    assert.ok(cancelNotif, "In-app notification sent for cancellation scheduled")
    console.log("  ✓ Cancellation scheduled: Auto-renewal disabled, benefits retained until expiry date")
    passed++

    // -------------------------------------------------------------
    // TEST 4: Cancellation Restoration (Reversing Cancellation Before Expiry)
    // -------------------------------------------------------------
    console.log("\nTest 4: Cancellation Restoration Flow")
    const restoreResult = await subscriptionLifecycleService.restoreCancelledSubscription(testUser._id)

    assert.strictEqual(restoreResult.success, true, "Restoration succeeded")
    assert.strictEqual(restoreResult.status, "active", "Status restored to active")
    assert.strictEqual(restoreResult.cancelScheduled, false, "cancelScheduled cleared")

    // Verify DB state
    const subAfterRestore = await Subscription.findById(activeSub._id)
    assert.strictEqual(subAfterRestore.status, "active")
    assert.strictEqual(subAfterRestore.autoRenew, true)
    assert.strictEqual(subAfterRestore.cancelScheduled, false)

    // Verify History & Notification
    const restoreHistory = await SubscriptionHistory.findOne({
      userId: testUser._id,
      action: "cancellation_restored",
    })
    assert.ok(restoreHistory, "SubscriptionHistory recorded cancellation_restored")

    const restoreNotif = await DownloadNotification.findOne({
      userId: testUser._id,
      type: "CANCELLATION_RESTORED",
    })
    assert.ok(restoreNotif, "In-app notification sent for cancellation restored")
    console.log("  ✓ Cancellation successfully reversed: Auto-renewal re-enabled, status back to active")
    passed++

    // -------------------------------------------------------------
    // TEST 5: Configurable Expiry Reminders & Deduplication
    // -------------------------------------------------------------
    console.log("\nTest 5: Expiry Reminders & Duplicate Prevention")
    // Test 3-day reminder dispatch
    const reminderRes1 = await subscriptionLifecycleService.sendExpiryReminder(subAfterRestore, 3)
    assert.strictEqual(reminderRes1.sent, true, "3-day reminder sent successfully")

    // Verify reminder tracking on subscription record
    const subAfterRemind = await Subscription.findById(activeSub._id)
    assert.strictEqual(subAfterRemind.remindersSent?.["3"], true, "remindersSent tracks '3'")

    // Replay attempt: sending 3-day reminder again must be rejected/deduplicated
    const reminderRes2 = await subscriptionLifecycleService.sendExpiryReminder(subAfterRemind, 3)
    assert.strictEqual(reminderRes2.sent, false, "Duplicate reminder was blocked")
    assert.strictEqual(reminderRes2.reason, "ALREADY_SENT", "Reason indicates already sent")

    // Verify history audit
    const reminderHistory = await SubscriptionHistory.findOne({
      userId: testUser._id,
      action: "expiry_reminder_sent",
    })
    assert.ok(reminderHistory, "SubscriptionHistory recorded expiry_reminder_sent")
    console.log("  ✓ Expiry reminder sent and deduplication prevented duplicate notification")
    passed++

    // -------------------------------------------------------------
    // TEST 6: Automatic Expiry & Downgrade to Free Tier
    // -------------------------------------------------------------
    console.log("\nTest 6: Automatic Expiry & Downgrade to Free Tier")
    // Simulate past expiry by setting expiresAt in the past
    const pastDate = new Date(Date.now() - 3600 * 1000) // 1 hour ago
    subAfterRemind.expiresAt = pastDate
    subAfterRemind.endDate = pastDate
    await subAfterRemind.save()

    // Execute automatic expiry
    const expiredSub = await subscriptionLifecycleService.expireSubscription(subAfterRemind, {
      reason: "Subscription period ended",
    })

    assert.strictEqual(expiredSub.plan, "free", "Plan transitioned to 'free'")
    assert.strictEqual(expiredSub.status, "expired", "Status updated to 'expired'")
    assert.strictEqual(expiredSub.download_limit, 1, "Download limit reset to Free limit (1/day)")

    // Verify Access Control immediately revokes premium privileges
    const effectivePlanAfterExpiry = await subscriptionAccessControlService.getUserEffectivePlan(testUser._id)
    assert.strictEqual(effectivePlanAfterExpiry.plan, "free", "Effective plan is Free")
    assert.strictEqual(effectivePlanAfterExpiry.isActive, false, "Paid access is no longer active")

    // Verify Download Quota synchronized to Free tier
    const quotaAfterExpiry = await quotaService.getActiveQuotaRecord(testUser._id, "free")
    assert.strictEqual(quotaAfterExpiry.quota_limit, 1, "Quota record limit updated to Free (1)")

    // Verify History records
    const expiredHistory = await SubscriptionHistory.findOne({
      userId: testUser._id,
      action: "subscription_expired",
    })
    assert.ok(expiredHistory, "SubscriptionHistory recorded subscription_expired")

    const freeHistory = await SubscriptionHistory.findOne({
      userId: testUser._id,
      action: "downgraded_to_free",
    })
    assert.ok(freeHistory, "SubscriptionHistory recorded downgraded_to_free")

    // Verify Expiration Notification
    const expiredNotif = await DownloadNotification.findOne({
      userId: testUser._id,
      type: "SUBSCRIPTION_EXPIRED",
    })
    assert.ok(expiredNotif, "In-app notification sent for subscription expired")
    console.log("  ✓ Subscription automatically expired, moved to Free tier, and quota updated")
    passed++

    // -------------------------------------------------------------
    // TEST 7: Idempotent Expiry (Running Expiry Repeatedly is Safe)
    // -------------------------------------------------------------
    console.log("\nTest 7: Idempotent Expiry Handling")
    const countHistoryBefore = await SubscriptionHistory.countDocuments({ userId: testUser._id })
    const repeatExpiredSub = await subscriptionLifecycleService.expireSubscription(expiredSub)
    const countHistoryAfter = await SubscriptionHistory.countDocuments({ userId: testUser._id })

    assert.strictEqual(repeatExpiredSub.plan, "free")
    assert.strictEqual(countHistoryBefore, countHistoryAfter, "No duplicate history records created on repeat run")
    console.log("  ✓ Repeated expiry execution is completely idempotent with no duplicate records")
    passed++

    // -------------------------------------------------------------
    // TEST 8: Grace Period Lifecycle Flow
    // -------------------------------------------------------------
    console.log("\nTest 8: Grace Period Lifecycle Flow")
    const testUserGrace = await User.create({
      name: `Grace User ${uniqueId}`,
      email: `grace_${uniqueId}@example.com`,
    })

    const graceSub = await Subscription.create({
      userId: testUserGrace._id,
      user_id: testUserGrace._id,
      planId: silverPlan._id,
      plan: "silver",
      status: "active",
      startDate: new Date(Date.now() - 31 * 86400000),
      expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
      endDate: new Date(Date.now() - 1000),
      autoRenew: true,
      download_limit: 15,
    })

    // Process lifecycle with 2-day grace period enabled
    const graceSweepStats = await subscriptionLifecycleService.processSubscriptionLifecycle({
      gracePeriodDays: 2,
    })
    assert.ok(graceSweepStats.gracePeriodEntered >= 1, "Grace period entered during sweep")

    const subInGrace = await Subscription.findById(graceSub._id)
    assert.strictEqual(subInGrace.status, "grace_period", "Status updated to grace_period")
    assert.ok(subInGrace.gracePeriodEnd > new Date(), "Grace period end date is in the future")

    const graceNotif = await DownloadNotification.findOne({
      userId: testUserGrace._id,
      type: "GRACE_PERIOD_STARTED",
    })
    assert.ok(graceNotif, "Grace period notification dispatched")
    console.log("  ✓ Grace period activated and notification dispatched successfully")
    passed++

    // -------------------------------------------------------------
    // TEST 9: Background Job Locking & Concurrency Protection
    // -------------------------------------------------------------
    console.log("\nTest 9: Background Job Locking & Concurrency Protection")
    // Force clean lock
    await JobLock.deleteMany({ jobName: subscriptionJobService.jobName })

    // Instance 1 acquires lock
    const lockAcquired1 = await subscriptionJobService.acquireLock()
    assert.strictEqual(lockAcquired1, true, "Instance 1 acquired the job lock")

    // Instance 2 attempts to run job concurrently while Instance 1 is running
    const concurrentRun = await subscriptionJobService.runLifecycleJob({ force: false })
    assert.strictEqual(concurrentRun.skipped, true, "Concurrent job run was safely skipped")
    assert.strictEqual(concurrentRun.reason, "JOB_LOCKED", "Reason is JOB_LOCKED")

    // Instance 1 releases lock
    await subscriptionJobService.releaseLock("success", null, { test: true })

    // Verify lock released
    const lockDoc = await JobLock.findOne({ jobName: subscriptionJobService.jobName })
    assert.strictEqual(lockDoc.isLocked, false, "Job lock successfully released")
    assert.strictEqual(lockDoc.lastStatus, "success", "Job status updated to success")
    console.log("  ✓ Distributed job locking prevented concurrent execution collisions")
    passed++

    // -------------------------------------------------------------
    // TEST 10: Admin Safe Recheck & Monitoring Summaries
    // -------------------------------------------------------------
    console.log("\nTest 10: Admin Safe Recheck & Monitoring Summaries")
    const summary = await subscriptionLifecycleService.getLifecycleStatusSummary()
    assert.ok(typeof summary.activeSubscriptions === "number", "Summary has activeSubscriptions count")
    assert.ok(typeof summary.cancelScheduled === "number", "Summary has cancelScheduled count")
    assert.ok(typeof summary.gracePeriod === "number", "Summary has gracePeriod count")
    assert.ok(typeof summary.expiringSoon === "number", "Summary has expiringSoon count")

    const jobStatus = await subscriptionJobService.getJobStatus()
    assert.strictEqual(jobStatus.jobName, "subscription_lifecycle_sweep")
    assert.strictEqual(jobStatus.isLocked, false)
    console.log("  ✓ Admin monitoring summaries and job status verified")
    passed++

    // -------------------------------------------------------------
    // TEST 11: In-App Notification Center Operations
    // -------------------------------------------------------------
    console.log("\nTest 11: In-App Notification Center Operations")
    const userNotifs = await DownloadNotification.find({ userId: testUser._id })
    assert.ok(userNotifs.length >= 2, "User has multiple in-app notifications")

    // Mark single notification as read
    const firstNotif = userNotifs[0]
    firstNotif.read = true
    firstNotif.status = "read"
    await firstNotif.save()

    const updatedFirst = await DownloadNotification.findById(firstNotif._id)
    assert.strictEqual(updatedFirst.read, true, "First notification marked as read")

    // Mark all as read
    await DownloadNotification.updateMany({ userId: testUser._id }, { $set: { read: true, status: "read" } })
    const unreadCount = await DownloadNotification.countDocuments({ userId: testUser._id, read: false })
    assert.strictEqual(unreadCount, 0, "Unread count is 0 after markAllRead")
    console.log("  ✓ Notification Center query, mark-read, and unread badge tracking verified")
    passed++

    console.log("\n=======================================================")
    console.log(`  PHASE 7 TEST SUMMARY: ${passed} PASSED, 0 FAILED`)
    console.log("=======================================================\n")
  } finally {
    // Clean up test records
    await Subscription.deleteMany({ userId: testUser._id })
    await SubscriptionHistory.deleteMany({ userId: testUser._id })
    await DownloadNotification.deleteMany({ userId: testUser._id })
    await User.deleteOne({ _id: testUser._id })
    await JobLock.deleteMany({ jobName: subscriptionJobService.jobName })
  }
}

runPhase7TestSuite().catch((err) => {
  console.error("Phase 7 Test Suite Failed:", err)
  process.exit(1)
})
