/**
 * PHASE 9: ADVANCED SUBSCRIPTION ANALYTICS, ADMIN SUBSCRIPTION MANAGEMENT,
 * REVENUE MONITORING & PLATFORM CONTROLS TEST SUITE
 */

import mongoose from "mongoose"
import dotenv from "dotenv"
import crypto from "crypto"
import jwt from "jsonwebtoken"
import http from "http"

dotenv.config()

// Models
import User from "../Modals/Auth.js"
import Subscription from "../Modals/Subscription.js"
import SubscriptionPlan from "../Modals/SubscriptionPlan.js"
import PaymentTransaction from "../Modals/PaymentTransaction.js"
import Invoice from "../Modals/Invoice.js"
import SubscriptionHistory from "../Modals/SubscriptionHistory.js"
import AdminSubscriptionAuditLog from "../Modals/AdminSubscriptionAuditLog.js"

// Services
import { revenueAnalyticsService } from "../services/admin/revenueAnalyticsService.js"
import { subscriptionAnalyticsService } from "../services/admin/subscriptionAnalyticsService.js"
import { subscriberManagementService } from "../services/admin/subscriberManagementService.js"
import {
  getAllPlansWithStats,
  updatePlan,
  togglePlanStatus,
} from "../services/admin/planManagementService.js"
import {
  generateRevenueReport,
  generateSubscribersReport,
  generatePlanPerformanceReport,
} from "../services/admin/subscriptionReportService.js"
import { authConfig } from "../config/index.js"

const DB_URI =
  process.env.DB_URL ||
  "mongodb+srv://admin:admin@cluster0.pwh5n.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0"

async function runPhase9TestSuite() {
  console.log("=========================================================================")
  console.log("  PHASE 9: ADVANCED SUBSCRIPTION ANALYTICS & ADMIN MANAGEMENT SUITE")
  console.log("=========================================================================\n")

  let passed = 0
  let failed = 0

  const assert = (condition, description) => {
    if (condition) {
      console.log(`  ✓ ${description}`)
      passed++
    } else {
      console.error(`  ✗ FAILED: ${description}`)
      failed++
    }
  }

  try {
    await mongoose.connect(DB_URI)
    console.log("Connected to MongoDB successfully.\n")

    // Test fixtures
    const testRunId = crypto.randomBytes(4).toString("hex")
    const adminUser = await User.create({
      name: `Admin Test ${testRunId}`,
      email: `admin_${testRunId}@antigravity.test`,
      role: "admin",
      status: "active",
    })

    const standardUser = await User.create({
      name: `User Test ${testRunId}`,
      email: `user_${testRunId}@antigravity.test`,
      role: "user",
      status: "active",
    })

    const subscriberUser = await User.create({
      name: `Subscriber Test ${testRunId}`,
      email: `sub_${testRunId}@antigravity.test`,
      role: "user",
      status: "active",
    })

    console.log("--- 1. Admin Subscription Audit Log Schema Validation ---")
    const auditRecord = await AdminSubscriptionAuditLog.create({
      adminId: adminUser._id,
      userId: subscriberUser._id,
      action: "EXTEND_VALIDITY",
      previousValue: { expiresAt: new Date() },
      newValue: { expiresAt: new Date(Date.now() + 30 * 86400000), durationDays: 30 },
      reason: "Customer satisfaction extension for platform testing",
      ip: "127.0.0.1",
      userAgent: "Phase9TestRunner/1.0",
    })

    assert(auditRecord._id !== undefined, "AdminSubscriptionAuditLog saves with valid fields")
    assert(auditRecord.action === "EXTEND_VALIDITY", "Audit log records action type")
    assert(auditRecord.reason.includes("Customer satisfaction"), "Audit log preserves administrative reason")
    assert(auditRecord.timestamp !== undefined, "Audit log automatically populates timestamp")

    console.log("\n--- 2. Revenue Analytics & Currency Verification ---")
    // Create test payment transactions: success, failed, pending
    const tx1 = await PaymentTransaction.create({
      userId: subscriberUser._id,
      orderId: `order_${testRunId}_1`,
      paymentId: `pay_${testRunId}_1`,
      transactionId: `tx_${testRunId}_1`,
      planKey: "gold",
      amount: 999, // in Rupees
      amountInRupees: true,
      currency: "INR",
      status: "success",
      paymentMethod: "card",
    })

    const tx2 = await PaymentTransaction.create({
      userId: subscriberUser._id,
      orderId: `order_${testRunId}_2`,
      paymentId: `pay_${testRunId}_2`,
      transactionId: `tx_${testRunId}_2`,
      planKey: "silver",
      amount: 49900, // in Paise (should normalize to 499)
      currency: "INR",
      status: "successful",
      paymentMethod: "upi",
    })

    const txFailed = await PaymentTransaction.create({
      userId: subscriberUser._id,
      orderId: `order_${testRunId}_f`,
      paymentId: `pay_${testRunId}_f`,
      transactionId: `tx_${testRunId}_f`,
      planKey: "gold",
      amount: 99900,
      currency: "INR",
      status: "failed", // MUST NOT be counted in revenue
      paymentMethod: "card",
    })

    const txPending = await PaymentTransaction.create({
      userId: subscriberUser._id,
      orderId: `order_${testRunId}_p`,
      paymentId: `pay_${testRunId}_p`,
      transactionId: `tx_${testRunId}_p`,
      planKey: "bronze",
      amount: 199,
      amountInRupees: true,
      currency: "INR",
      status: "pending", // MUST NOT be counted in revenue
      paymentMethod: "netbanking",
    })

    const totalRev = await revenueAnalyticsService.getTotalRevenue()
    assert(totalRev.totalRevenue >= 1498, "Total revenue aggregates verified successful payments")
    assert(totalRev.currency === "INR", "Revenue currency is INR")

    const todayRev = await revenueAnalyticsService.getTodayRevenue()
    assert(todayRev.todayRevenue >= 1498, "Today revenue includes today's verified transactions")

    const revByPlan = await revenueAnalyticsService.getRevenueByPlan()
    assert(Array.isArray(revByPlan.breakdown), "Revenue by plan returns an array breakdown")
    const goldPlanRev = revByPlan.breakdown.find((b) => b.plan === "gold")
    assert(goldPlanRev && goldPlanRev.revenue >= 999, "Gold tier revenue accurately tracks gold transactions")

    const dailyTrends = await revenueAnalyticsService.getRevenueTimeSeries({ period: "daily" })
    assert(dailyTrends.points.length > 0, "Revenue daily time series generates trend points")
    assert(dailyTrends.totalPeriodRevenue >= 1498, "Daily time series captures period revenue correctly")

    const monthlyTrends = await revenueAnalyticsService.getRevenueTimeSeries({ period: "monthly" })
    assert(monthlyTrends.points.length > 0, "Revenue monthly time series generates trend points")

    console.log("\n--- 3. Subscription KPI & Health Analytics ---")
    // Create test active subscription
    const subGold = await Subscription.create({
      user: subscriberUser._id,
      userId: subscriberUser._id,
      plan: "gold",
      status: "active",
      billingCycle: "monthly",
      startDate: new Date(),
      endDate: new Date(Date.now() + 25 * 86400000),
      expiresAt: new Date(Date.now() + 25 * 86400000),
      autoRenew: true,
      isActive: true,
    })

    const subscriberCounts = await subscriptionAnalyticsService.getSubscriberCounts()
    assert(subscriberCounts.totalUsers >= 3, "Subscriber counts reflect platform users")
    assert(subscriberCounts.paidSubscribers >= 1, "Counts accurately detect paid subscribers")
    assert(subscriberCounts.plans.gold >= 1, "Gold tier subscriber count updated")

    const planDist = await subscriptionAnalyticsService.getPlanDistribution()
    assert(planDist.length > 0, "Plan distribution returns array of plan tiers")
    const totalDistPercent = planDist.reduce((acc, d) => acc + d.percentage, 0)
    assert(Math.round(totalDistPercent) >= 95, "Plan distribution percentages sum to ~100%")

    const rates = await subscriptionAnalyticsService.getConversionAndRenewalRates()
    assert(typeof rates.conversionRate === "number", "Conversion rate calculated as a number")
    assert(typeof rates.renewalRate === "number", "Renewal rate calculated as a number")
    assert(typeof rates.arpu === "number", "ARPU calculated as a number")

    const payHealth = await subscriptionAnalyticsService.getPaymentHealthMetrics()
    assert(payHealth.totalAttempts >= 4, "Payment health counts total payment attempts")
    assert(payHealth.failedPayments >= 1, "Payment health records failed transactions")
    assert(payHealth.failureRate > 0, "Payment health calculates accurate failure percentage")

    const adminAlerts = await subscriptionAnalyticsService.getAdminAlerts()
    assert(Array.isArray(adminAlerts), "Admin alerts returned as an array")

    console.log("\n--- 4. Subscriber Management & Administrative Actions ---")
    // Subscriber directory listing & filtering
    const subList = await subscriberManagementService.listSubscribers({
      page: 1,
      limit: 10,
      search: subscriberUser.email,
    })
    assert(subList.subscribers.length === 1, "Subscriber search finds user by email")
    assert(subList.subscribers[0].plan === "gold", "Subscriber list includes current plan")

    // Filter by plan
    const subListGold = await subscriberManagementService.listSubscribers({
      plan: "gold",
    })
    assert(subListGold.subscribers.some((s) => s.userId === subscriberUser._id.toString()), "Filter by plan matches gold subscribers")

    // Aggregated 360-degree profile
    const profile = await subscriberManagementService.getSubscriberProfile(subscriberUser._id.toString())
    assert(profile.user.email === subscriberUser.email, "Subscriber profile includes user credentials")
    assert(profile.subscription.plan === "gold", "Subscriber profile includes active subscription")
    assert(profile.transactions.length >= 2, "Subscriber profile aggregates payment transactions")

    // Admin Action: Extend validity
    const extendResult = await subscriberManagementService.extendSubscriptionValidity({
      userId: subscriberUser._id.toString(),
      durationDays: 14,
      reason: "Test extension: platform maintenance downtime compensation",
      adminId: adminUser._id,
      ip: "127.0.0.1",
    })
    assert(extendResult.success === true, "Admin validity extension succeeds")
    assert(extendResult.daysAdded === 14, "Correct number of days added to validity")

    const updatedSub1 = await Subscription.findById(subGold._id)
    const expectedExpiry = extendResult.newExpiry.getTime()
    assert(updatedSub1.expiresAt.getTime() === expectedExpiry, "Subscription expiry persisted in database")

    // Admin Action: Suspend subscription
    const suspendResult = await subscriberManagementService.suspendSubscription({
      userId: subscriberUser._id.toString(),
      reason: "Test suspension: fraudulent activity suspected",
      adminId: adminUser._id,
      ip: "127.0.0.1",
    })
    assert(suspendResult.success === true, "Admin subscription suspension succeeds")
    assert(suspendResult.status === "suspended", "Subscription status transitioned to 'suspended'")

    const updatedSub2 = await Subscription.findById(subGold._id)
    assert(updatedSub2.status === "suspended", "Suspended status persisted in database")

    // Admin Action: Restore subscription
    const restoreResult = await subscriberManagementService.restoreSubscription({
      userId: subscriberUser._id.toString(),
      reason: "Test restore: identity verified by support team",
      adminId: adminUser._id,
      ip: "127.0.0.1",
    })
    assert(restoreResult.success === true, "Admin subscription restore succeeds")
    assert(restoreResult.status === "active", "Subscription status restored to 'active'")

    // Admin Action: Move to Free tier
    const moveFreeResult = await subscriberManagementService.moveToFreeTier({
      userId: subscriberUser._id.toString(),
      reason: "Test downgrade: user requested account tier reset",
      adminId: adminUser._id,
      ip: "127.0.0.1",
    })
    assert(moveFreeResult.success === true, "Admin move to Free tier succeeds")
    assert(moveFreeResult.newPlan === "free", "Subscription plan changed to 'free'")

    const updatedSub3 = await Subscription.findById(subGold._id)
    assert(updatedSub3.plan === "free", "Plan 'free' persisted in database")
    assert(updatedSub3.expiresAt === null, "Free tier has null expiration date")

    // Verify rejection when reason is absent or too short
    let failedReasonCheck = false
    try {
      await subscriberManagementService.extendSubscriptionValidity({
        userId: subscriberUser._id.toString(),
        durationDays: 7,
        reason: "ab", // Too short
        adminId: adminUser._id,
      })
    } catch {
      failedReasonCheck = true
    }
    assert(failedReasonCheck, "Admin action strictly rejects short or missing reasons")

    console.log("\n--- 5. Plan Management & Version Control ---")
    const allPlans = await getAllPlansWithStats()
    assert(allPlans.length >= 4, "Plan management lists all default tiers (Free, Bronze, Silver, Gold)")
    const goldTier = allPlans.find((p) => p.slug === "gold")
    assert(goldTier && goldTier.stats !== undefined, "Plan stats include active subscriber and revenue metrics")

    // Update plan settings
    const updatedPlan = await updatePlan({
      planId: goldTier._id,
      updates: {
        description: "Cinema & 4K UHD Masterclass experience updated",
        limits: { maxDevices: 10 },
      },
      reason: "Device limit expansion for power users",
      adminId: adminUser._id,
    })
    assert(updatedPlan.limits.maxDevices === 10, "Plan limits updated successfully in database")

    // Toggle plan status
    const toggledPlan = await togglePlanStatus({
      planId: goldTier._id,
      isActive: false,
      reason: "Temporary maintenance lock on Gold plan tier",
      adminId: adminUser._id,
    })
    assert(toggledPlan.isActive === false, "Plan status toggled to inactive")

    // Restore plan status
    await togglePlanStatus({
      planId: goldTier._id,
      isActive: true,
      reason: "Re-enabling Gold plan tier after testing",
      adminId: adminUser._id,
    })

    console.log("\n--- 6. Subscription Reporting & RFC 4180 CSV Export ---")
    // Revenue report
    const revReport = await generateRevenueReport()
    assert(revReport.reportType === "revenue", "Revenue report generated with correct reportType")
    assert(revReport.rows.length >= 2, "Revenue report rows include successful transactions")
    assert(typeof revReport.csv === "string", "Revenue report exports CSV string")
    assert(revReport.csv.includes("Transaction ID,Order ID,Customer Name"), "CSV contains RFC 4180 header row")
    assert(revReport.csv.includes("₹") === false, "CSV numbers are clean numeric values without currency symbols")

    // Subscribers report
    const subsReport = await generateSubscribersReport({ plan: "all", status: "all" })
    assert(subsReport.reportType === "subscribers", "Subscribers report generated with correct type")
    assert(subsReport.rows.length > 0, "Subscribers report contains cohort rows")
    assert(subsReport.csv.includes("User ID,Full Name,Email Address"), "Subscribers CSV contains appropriate headers")

    // Plan performance report
    const planReport = await generatePlanPerformanceReport()
    assert(planReport.reportType === "plans", "Plan performance report generated")
    assert(planReport.rows.length >= 4, "Plan performance report includes all tiers")
    assert(planReport.csv.includes("Plan Name,Identifier / Slug"), "Plan report CSV contains tier columns")

    console.log("\n--- 7. Admin HTTP Route Gating & Authorization ---")
    // Helper to test HTTP endpoints on running port 5004
    const makeRequest = (path, token = null) => {
      return new Promise((resolve, reject) => {
        const headers = {}
        if (token) headers.Authorization = `Bearer ${token}`

        const req = http.request(
          {
            hostname: "localhost",
            port: 5004,
            path,
            method: "GET",
            headers,
          },
          (res) => {
            let data = ""
            res.on("data", (chunk) => (data += chunk))
            res.on("end", () => resolve({ statusCode: res.statusCode, data }))
          }
        )
        req.on("error", reject)
        req.end()
      })
    }

    // 7.1 Unauthenticated request returns 401
    const unauthRes = await makeRequest("/api/admin/subscriptions/analytics")
    assert(unauthRes.statusCode === 401, "Unauthenticated request to admin route returns 401")

    // 7.2 Non-admin token returns 403 Forbidden
    const userJwt = jwt.sign(
      { id: standardUser._id.toString(), email: standardUser.email, role: "user" },
      authConfig.jwtSecret,
      { expiresIn: "1h" }
    )
    const nonAdminRes = await makeRequest("/api/admin/subscriptions/analytics", userJwt)
    assert(nonAdminRes.statusCode === 403, "Non-admin user token returns 403 Forbidden")

    // 7.3 Admin token returns 200 OK
    const adminJwt = jwt.sign(
      { id: adminUser._id.toString(), email: adminUser.email, role: "admin" },
      authConfig.jwtSecret,
      { expiresIn: "1h" }
    )
    const adminRes = await makeRequest("/api/admin/subscriptions/analytics/overview", adminJwt)
    assert(adminRes.statusCode === 200, "Admin user token returns 200 OK on analytics overview")

    const parsedAdminRes = JSON.parse(adminRes.data)
    assert(parsedAdminRes.success === true, "Analytics overview returns success true")
    assert(parsedAdminRes.data?.kpis !== undefined, "Analytics response includes KPI metrics")
    assert(parsedAdminRes.data?.revenue !== undefined, "Analytics response includes revenue stats")

    // Clean up test records
    await AdminSubscriptionAuditLog.deleteMany({ userId: { $in: [subscriberUser._id, standardUser._id] } })
    await PaymentTransaction.deleteMany({ userId: subscriberUser._id })
    await Subscription.deleteMany({ user: subscriberUser._id })
    await User.deleteMany({ _id: { $in: [adminUser._id, standardUser._id, subscriberUser._id] } })

    console.log("\n=========================================================================")
    console.log(`  PHASE 9 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`)
    console.log("=========================================================================\n")

    if (failed > 0) {
      process.exit(1)
    } else {
      process.exit(0)
    }
  } catch (err) {
    console.error("FATAL: Test execution failed with error:", err)
    process.exit(1)
  }
}

runPhase9TestSuite()
