/**
 * PHASE 8: ADVANCED BILLING MANAGEMENT, INVOICE GENERATION,
 * PAYMENT RECEIPTS & SUBSCRIPTION COMMUNICATION TEST SUITE
 */

import mongoose from "mongoose"
import dotenv from "dotenv"
import crypto from "crypto"

dotenv.config()

// Models
import User from "../Modals/Auth.js"
import Subscription from "../Modals/Subscription.js"
import SubscriptionPlan from "../Modals/SubscriptionPlan.js"
import PaymentTransaction from "../Modals/PaymentTransaction.js"
import Invoice from "../Modals/Invoice.js"
import BillingEmailLog from "../Modals/BillingEmailLog.js"
import BillingAuditLog from "../Modals/BillingAuditLog.js"

// Services
import billingService from "../services/billing/billingService.js"
import billingHistoryService from "../services/billing/billingHistoryService.js"
import invoiceService from "../services/billing/invoiceService.js"
import receiptService from "../services/billing/receiptService.js"
import emailNotificationService from "../services/notifications/emailNotificationService.js"
import * as emailTemplates from "../services/notifications/subscriptionEmailTemplates.js"
import {
  calculateGstBreakdown,
  generateInvoiceNumber,
  generateReceiptNumber,
  sanitizeTransactionForClient,
} from "../services/billing/billingUtils.js"

const DB_URI =
  process.env.DB_URL ||
  "mongodb+srv://admin:admin@cluster0.pwh5n.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0"

async function runPhase8TestSuite() {
  console.log("=======================================================")
  console.log("  PHASE 8: ADVANCED BILLING & INVOICE MANAGEMENT SUITE")
  console.log("=======================================================\n")

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

    // Setup test users & test plans
    const testUserAId = new mongoose.Types.ObjectId()
    const testUserBId = new mongoose.Types.ObjectId()

    await User.deleteMany({ _id: { $in: [testUserAId, testUserBId] } })
    await User.create([
      {
        _id: testUserAId,
        email: `alice_${Date.now()}@example.com`,
        name: "Alice Billing",
        channelname: "Alice Tech",
      },
      {
        _id: testUserBId,
        email: `bob_${Date.now()}@example.com`,
        name: "Bob Security",
        channelname: "Bob Tech",
      },
    ])

    const silverPlan = await SubscriptionPlan.findOne({ slug: "silver" })
    const goldPlan = await SubscriptionPlan.findOne({ slug: "gold" })

    // Clean up test transactions & invoices
    await PaymentTransaction.deleteMany({ userId: { $in: [testUserAId, testUserBId] } })
    await Invoice.deleteMany({ userId: { $in: [testUserAId, testUserBId] } })
    await BillingEmailLog.deleteMany({ userId: { $in: [testUserAId, testUserBId] } })
    await BillingAuditLog.deleteMany({ userId: { $in: [testUserAId, testUserBId] } })
    await Subscription.deleteMany({ userId: { $in: [testUserAId, testUserBId] } })

    // Test 1: Tax Breakdown & Utility Number Generators
    console.log("Test 1: Tax Calculations & Number Generators")
    const gst1000 = calculateGstBreakdown(1000, 18)
    assert(gst1000.total === 1000, "GST total matches 1000")
    assert(gst1000.subtotal === 847.46, `Subtotal is 847.46 (got ${gst1000.subtotal})`)
    assert(gst1000.taxAmount === 152.54, `Tax amount is 152.54 (got ${gst1000.taxAmount})`)
    assert(gst1000.cgst === 76.27, `CGST is 76.27 (got ${gst1000.cgst})`)
    assert(gst1000.sgst === 76.27, `SGST is 76.27 (got ${gst1000.sgst})`)

    const invNum = generateInvoiceNumber()
    assert(/^INV-\d{8}-[A-F0-9]{6}$/.test(invNum), `Generated invoice number format matches (${invNum})`)

    const rcptNum = generateReceiptNumber()
    assert(/^RCPT-\d{8}-[A-F0-9]{6}$/.test(rcptNum), `Generated receipt number format matches (${rcptNum})`)

    // Test 2: Active User Transactions Setup
    console.log("\nTest 2: Setting up Mock Transactions (Success, Pending, Failed)")
    const tx1Success = await PaymentTransaction.create({
      userId: testUserAId,
      orderId: `order_test_${Date.now()}_1`,
      paymentId: `pay_test_${Date.now()}_1`,
      amount: 49900, // in paise = 499 INR
      currency: "INR",
      planKey: "silver",
      planId: silverPlan?._id,
      billingCycle: "monthly",
      actionType: "new_subscription",
      status: "success",
      paymentGateway: "razorpay",
      paymentMethod: "upi",
      paymentVerifiedAt: new Date(),
    })

    const tx2Failed = await PaymentTransaction.create({
      userId: testUserAId,
      orderId: `order_test_${Date.now()}_2`,
      amount: 49900,
      currency: "INR",
      planKey: "silver",
      planId: silverPlan?._id,
      billingCycle: "monthly",
      actionType: "upgrade",
      status: "failed",
      failureCode: "PAYMENT_DECLINED",
      failureReason: "User cancelled at checkout bank portal",
    })

    const tx3SuccessGold = await PaymentTransaction.create({
      userId: testUserAId,
      orderId: `order_test_${Date.now()}_3`,
      paymentId: `pay_test_${Date.now()}_3`,
      amount: 99900, // 999 INR
      currency: "INR",
      planKey: "gold",
      planId: goldPlan?._id,
      billingCycle: "monthly",
      actionType: "upgrade",
      status: "success",
      paymentGateway: "razorpay",
      paymentMethod: "card",
      paymentVerifiedAt: new Date(),
    })

    assert(tx1Success && tx2Failed && tx3SuccessGold, "Transactions initialized across states")

    // Setup active subscription for User A
    await Subscription.create({
      userId: testUserAId,
      user_id: testUserAId,
      plan: "gold",
      planId: goldPlan?._id,
      status: "active",
      isActive: true,
      autoRenew: true,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    })

    // Test 3: Authoritative Invoice Creation & Deduplication Guarantee
    console.log("\nTest 3: Authoritative Invoice Generation & Deduplication")
    const invoice1 = await invoiceService.createInvoice({
      transaction: tx1Success,
      user: { name: "Alice Billing", email: "alice@example.com" },
    })

    assert(invoice1 && invoice1.invoiceNumber, `Invoice generated successfully (${invoice1.invoiceNumber})`)
    assert(invoice1.amount === 499, `Invoice amount is 499 (got ${invoice1.amount})`)
    assert(invoice1.taxAmount > 0, `Invoice contains tax breakdown (${invoice1.taxAmount})`)
    assert(invoice1.status === "paid", "Invoice status is 'paid'")

    // Attempt duplicate generation
    const invoice1Duplicate = await invoiceService.createInvoice({
      transaction: tx1Success,
      user: { name: "Alice Billing", email: "alice@example.com" },
    })
    assert(
      String(invoice1._id) === String(invoice1Duplicate._id),
      "Idempotent: Duplicate invoice creation returns identical existing record"
    )

    const invoiceCount = await Invoice.countDocuments({ transactionId: tx1Success._id })
    assert(invoiceCount === 1, `Strictly 1 invoice exists for transaction (got ${invoiceCount})`)

    // Non-successful transactions must reject invoice creation
    let rejectedFailedInvoice = false
    try {
      await invoiceService.createInvoice({ transaction: tx2Failed })
    } catch {
      rejectedFailedInvoice = true
    }
    assert(rejectedFailedInvoice, "Invoice creation correctly rejected for non-successful transactions")

    // Test 4: Cross-User Authorization & Ownership Security
    console.log("\nTest 4: Invoice Ownership Validation & Cross-User Protection")
    // Alice requests her invoice -> allowed
    const aliceInvoice = await invoiceService.getInvoiceById(invoice1._id, testUserAId)
    assert(aliceInvoice && aliceInvoice._id, "Owner (Alice) can access her own invoice")

    // Bob requests Alice's invoice -> 403 Forbidden
    let bobBlocked = false
    try {
      await invoiceService.getInvoiceById(invoice1._id, testUserBId)
    } catch (err) {
      if (err.statusCode === 403) bobBlocked = true
    }
    assert(bobBlocked, "Cross-user access blocked with 403 Forbidden")

    // Admin access -> allowed
    const adminView = await invoiceService.getInvoiceById(invoice1._id, testUserBId, true)
    assert(adminView && adminView._id, "Admin can access invoice with authorization")

    // Test 5: Server-Side PDF Invoice Generation
    console.log("\nTest 5: Server-Side PDF Invoice Generation")
    const pdfBuffer = await invoiceService.generateInvoicePdf(invoice1)
    assert(Buffer.isBuffer(pdfBuffer), "Invoice PDF output is a valid binary Buffer")
    assert(pdfBuffer.length > 500, `PDF has substantial binary content (${pdfBuffer.length} bytes)`)
    assert(pdfBuffer.toString("utf8", 0, 4) === "%PDF", "PDF starts with standard '%PDF' magic bytes")

    // HTML representation
    const invoiceHtml = invoiceService.generateInvoiceHtml(invoice1)
    assert(invoiceHtml.includes(invoice1.invoiceNumber), "HTML invoice includes invoice number")
    assert(invoiceHtml.includes("YouTube Premium"), "HTML invoice includes platform branding")

    // Test 6: Payment Receipts for Successful Transactions
    console.log("\nTest 6: Payment Receipt System (Successful Transactions Only)")
    const receipt1 = await receiptService.getReceiptByTransaction(tx1Success._id, testUserAId)
    assert(receipt1 && receipt1.receiptNumber, `Receipt created with number: ${receipt1.receiptNumber}`)
    assert(receipt1.paymentStatus === "Successful", "Receipt confirms successful payment status")
    assert(receipt1.amount === 499, `Receipt amount matches 499 (got ${receipt1.amount})`)

    // Refusal for failed transaction
    let receiptRefused = false
    try {
      await receiptService.getReceiptByTransaction(tx2Failed._id, testUserAId)
    } catch {
      receiptRefused = true
    }
    assert(receiptRefused, "Receipt correctly refused for failed payment")

    // Server-side PDF receipt generation
    const receiptPdfBuffer = await receiptService.generateReceiptPdf(receipt1)
    assert(Buffer.isBuffer(receiptPdfBuffer), "Receipt PDF is a valid binary Buffer")
    assert(receiptPdfBuffer.toString("utf8", 0, 4) === "%PDF", "Receipt PDF starts with standard '%PDF'")

    // Test 7: Billing History Query Pipeline (Pagination, Filtering, Search, Sorting)
    console.log("\nTest 7: Billing History Query Engine")
    // Alice's full history
    const historyAll = await billingHistoryService.getBillingHistory(testUserAId, {
      page: 1,
      limit: 10,
    })
    assert(historyAll.transactions.length === 3, `All 3 transactions retrieved (got ${historyAll.transactions.length})`)
    assert(historyAll.pagination.total === 3, "Pagination total is 3")

    // Status filter: success
    const historySuccess = await billingHistoryService.getBillingHistory(testUserAId, {
      status: "success",
    })
    assert(historySuccess.transactions.length === 2, `Filter status=success returned 2 transactions (got ${historySuccess.transactions.length})`)

    // Status filter: failed
    const historyFailed = await billingHistoryService.getBillingHistory(testUserAId, {
      status: "failed",
    })
    assert(historyFailed.transactions.length === 1, `Filter status=failed returned 1 transaction (got ${historyFailed.transactions.length})`)

    // Plan filter: gold
    const historyGold = await billingHistoryService.getBillingHistory(testUserAId, {
      plan: "gold",
    })
    assert(historyGold.transactions.length === 1, "Filter plan=gold returned 1 transaction")
    assert(historyGold.transactions[0].planKey === "gold", "Returned transaction is gold tier")

    // Search filter
    const historySearch = await billingHistoryService.getBillingHistory(testUserAId, {
      search: tx1Success.orderId,
    })
    assert(historySearch.transactions.length === 1, `Search by orderId found 1 transaction (${tx1Success.orderId})`)

    // Sorting by amount desc
    const historySortedAmount = await billingHistoryService.getBillingHistory(testUserAId, {
      sortBy: "amount",
      sortOrder: "desc",
    })
    assert(historySortedAmount.transactions[0].amount >= historySortedAmount.transactions[1].amount, "Transactions correctly sorted by amount descending")

    // Test 8: Sanitized Transaction Details (Zero Secret Exposure)
    console.log("\nTest 8: Transaction Details & Data Sanitization")
    const txDetails = await billingHistoryService.getTransactionDetails(tx1Success._id, testUserAId)
    assert(txDetails && txDetails._id, "Transaction details retrieved successfully")
    assert(txDetails.invoice && txDetails.invoice.invoiceNumber, "Transaction links to generated invoice")
    assert(txDetails.signature === undefined, "Security: Signature field strictly stripped")
    assert(txDetails.key_secret === undefined, "Security: Secret keys strictly absent")
    assert(txDetails.hasReceipt === true, "Indicates receipt availability")

    // Test 9: Billing Summary Aggregation
    console.log("\nTest 9: Master Billing Summary Resolution")
    const summary = await billingService.getBillingSummary(testUserAId)
    assert(summary.currentPlan.name === "Gold", `Current plan is Gold (got ${summary.currentPlan.name})`)
    assert(summary.status === "active", "Subscription status is active")
    assert(summary.metrics.totalTransactions === 3, `Total transactions is 3 (got ${summary.metrics.totalTransactions})`)
    assert(summary.metrics.successfulPayments === 2, `Successful payments is 2 (got ${summary.metrics.successfulPayments})`)
    assert(summary.metrics.totalSpent === 1498, `Total spent is 1498 (got ${summary.metrics.totalSpent})`)
    assert(summary.lastPayment !== null, "Last payment record resolved")

    // Test 10: Subscription Email Templates Rendering
    console.log("\nTest 10: Subscription Email Templates Rendering")
    const tpl1 = emailTemplates.paymentSuccessfulTemplate({
      userName: "Alice",
      planName: "Silver",
      amount: 499,
      invoiceNumber: "INV-2026-001",
    })
    assert(tpl1.subject.includes("Payment Successful"), "paymentSuccessful template subject valid")
    assert(tpl1.html.includes("INV-2026-001"), "paymentSuccessful template renders invoice")

    const tpl2 = emailTemplates.subscriptionActivatedTemplate({
      userName: "Alice",
      planName: "Silver",
    })
    assert(tpl2.subject.includes("Welcome to Silver"), "subscriptionActivated template valid")

    const tpl3 = emailTemplates.subscriptionRenewedTemplate({
      userName: "Alice",
      planName: "Silver",
    })
    assert(tpl3.subject.includes("Renewed"), "subscriptionRenewed template valid")

    const tpl4 = emailTemplates.subscriptionUpgradedTemplate({
      userName: "Alice",
      previousPlan: "Bronze",
      newPlan: "Silver",
    })
    assert(tpl4.subject.includes("Upgraded"), "subscriptionUpgraded template valid")

    const tpl5 = emailTemplates.paymentFailedTemplate({
      userName: "Alice",
      safeFailureMessage: "Insufficient balance",
    })
    assert(tpl5.subject.includes("Payment Issue"), "paymentFailed template valid")

    const tpl6 = emailTemplates.paymentCancelledTemplate({
      userName: "Alice",
    })
    assert(tpl6.subject.includes("Cancelled"), "paymentCancelled template valid")

    const tpl7 = emailTemplates.invoiceCreatedTemplate({
      userName: "Alice",
      invoiceNumber: "INV-2026-001",
    })
    assert(tpl7.subject.includes("Tax Invoice"), "invoiceCreated template valid")

    const tpl8 = emailTemplates.subscriptionExpiredTemplate({
      userName: "Alice",
      planName: "Silver",
    })
    assert(tpl8.subject.includes("Expired"), "subscriptionExpired template valid")

    // Test 11: Email Dispatch, Delivery Logging & Deduplication
    console.log("\nTest 11: Email Dispatch, Delivery Logging & Deduplication")
    const emailLog = await emailNotificationService.sendPaymentSuccessfulEmail({
      userId: testUserAId,
      transaction: tx1Success,
      invoice: invoice1,
      user: { email: "alice@example.com", name: "Alice Billing" },
    })

    assert(emailLog && emailLog.status === "sent", "Email successfully dispatched and logged as 'sent'")
    assert(emailLog.attemptCount >= 1, "Attempt count recorded in BillingEmailLog")

    // Attempt duplicate dispatch for identical transaction
    const emailDuplicate = await emailNotificationService.sendPaymentSuccessfulEmail({
      userId: testUserAId,
      transaction: tx1Success,
      invoice: invoice1,
      user: { email: "alice@example.com", name: "Alice Billing" },
    })
    assert(
      String(emailLog._id) === String(emailDuplicate._id),
      "Email deduplication prevented re-sending identical confirmation"
    )

    // Test 12: Billing Audit Logging
    console.log("\nTest 12: Billing Audit Log Verification")
    const auditCount = await BillingAuditLog.countDocuments({ userId: testUserAId })
    assert(auditCount >= 2, `Audit events captured in BillingAuditLog (${auditCount} logs)`)

    const invoiceAudit = await BillingAuditLog.findOne({
      userId: testUserAId,
      event: "INVOICE_CREATED",
    })
    assert(invoiceAudit !== null, "INVOICE_CREATED audit event logged with safe metadata")

    console.log("\n=======================================================")
    console.log(`  PHASE 8 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`)
    console.log("=======================================================\n")

    // Cleanup
    await User.deleteMany({ _id: { $in: [testUserAId, testUserBId] } })
    await PaymentTransaction.deleteMany({ userId: { $in: [testUserAId, testUserBId] } })
    await Invoice.deleteMany({ userId: { $in: [testUserAId, testUserBId] } })
    await BillingEmailLog.deleteMany({ userId: { $in: [testUserAId, testUserBId] } })
    await BillingAuditLog.deleteMany({ userId: { $in: [testUserAId, testUserBId] } })
    await Subscription.deleteMany({ userId: { $in: [testUserAId, testUserBId] } })

    await mongoose.disconnect()

    if (failed > 0) {
      process.exit(1)
    } else {
      process.exit(0)
    }
  } catch (err) {
    console.error("Test execution failed:", err)
    process.exit(1)
  }
}

runPhase8TestSuite()
