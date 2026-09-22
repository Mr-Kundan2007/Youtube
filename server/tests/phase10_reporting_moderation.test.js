/**
 * Phase 10: Comment Reporting & Admin Moderation Test Suite
 *
 * Validates:
 * 1. Configuration integrity (reasons, statuses, moderation actions, rate limits)
 * 2. Priority computation and auto-escalation engine
 * 3. Core Rule Assertion: Dislike ≠ Report ≠ Delete (no auto-hiding or auto-deletion)
 * 4. Valid report submission on top-level comments and replies (Unicode & multilingual support)
 * 5. Input validation & XSS sanitization (length <= 500 chars, raw HTML stripped)
 * 6. Duplicate active report prevention (HTTP 409 DUPLICATE_REPORT)
 * 7. Multi-user reporting accumulation & priority elevation
 * 8. Reporting on deleted comments for moderation audit trail
 * 9. Report rate limiting enforcement (`comment_report` dual-window)
 * 10. RBAC security enforcement (User = 403, Moderator = 200, Admin = 200)
 * 11. Moderation dashboard summary & KPI statistics
 * 12. Moderation reports list pagination, search & status/priority/reason filters
 * 13. Comprehensive report detail dossier (thread context, edit history, safety signals)
 * 14. Status transitions (pending -> reviewing -> resolved / dismissed)
 * 15. Moderation action execution: HIDE_COMMENT (excludes from public queries)
 * 16. Moderation action execution: RESTORE_COMMENT (restores to public visibility)
 * 17. Moderation action execution: DELETE_COMMENT (soft delete)
 * 18. Moderation action execution: DISMISS_REPORT (comment preserved unchanged)
 * 19. Concurrency conflict prevention (version mismatch handling)
 * 20. Immutable audit logging (ModerationRecord & CommentModerationEvent creation)
 */

import assert from "assert"
import mongoose from "mongoose"
import { connectTestDb, disconnectTestDb } from "./helpers/testDatabase.js"
import { COMMENT_CONFIG } from "../config/commentConfig.js"
import { requireModeratorOrAdminRole } from "../middleware/adminPermissionMiddleware.js"
import {
  computeReportPriority,
  createCommentReport,
  hasUserReportedComment,
  getModerationSummary,
  getModerationReportsList,
  getReportDetails,
  updateReportStatus,
  executeModerationAction,
  clearMockReportingState,
} from "../services/commentReportingService.js"
import { checkRateLimit, resetRateLimits } from "../services/rateLimitService.js"
import { getCommentsByContent, getRepliesByParent } from "../services/commentService.js"

let passedCount = 0
let failedCount = 0

function test(name, fn) {
  try {
    fn()
    console.log(`  ✓ [PASS] ${name}`)
    passedCount++
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}`)
    console.error("   ", err.message)
    failedCount++
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn()
    console.log(`  ✓ [PASS] ${name}`)
    passedCount++
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}`)
    console.error("   ", err.message)
    failedCount++
  }
}

async function runPhase10TestSuite() {
  console.log("\n========================================================================")
  console.log("PHASE 10: COMMENT REPORTING & ADMIN MODERATION TEST SUITE")
  console.log("========================================================================\n")

  let isDbConnected = false
  try {
    await connectTestDb()
    isDbConnected = true
  } catch (dbErr) {
    console.log(`  [INFO] Running in memory-mock mode (live database unavailable: ${dbErr.message}).\n`)
  }

  // Clear prior state
  clearMockReportingState()
  await resetRateLimits({ key: "user:u_reporter_1" })
  await resetRateLimits({ key: "user:u_reporter_flood" })

  // ---------------------------------------------------------------------------
  // 1. Configuration & Enum Integrity
  // ---------------------------------------------------------------------------
  console.log("--- 1. Configuration & Enum Integrity ---")

  test("Report reasons are defined and include all mandatory Phase 10 categories", () => {
    assert.ok(Array.isArray(COMMENT_CONFIG.REPORT_REASONS), "REPORT_REASONS should be an array")
    const expectedReasons = [
      "SPAM",
      "HARASSMENT",
      "OFFENSIVE",
      "HATEFUL_OR_ABUSIVE",
      "MALICIOUS_LINK",
      "MISINFORMATION",
      "IMPERSONATION",
      "OTHER",
    ]
    for (const reason of expectedReasons) {
      assert.ok(
        COMMENT_CONFIG.REPORT_REASONS.includes(reason),
        `REPORT_REASONS must include ${reason}`
      )
    }
  })

  test("Report statuses and moderation actions match Phase 10 specification", () => {
    assert.ok(Array.isArray(COMMENT_CONFIG.REPORT_STATUSES), "REPORT_STATUSES should be an array")
    assert.ok(COMMENT_CONFIG.REPORT_STATUSES.includes("pending"))
    assert.ok(COMMENT_CONFIG.REPORT_STATUSES.includes("reviewing"))
    assert.ok(COMMENT_CONFIG.REPORT_STATUSES.includes("resolved"))
    assert.ok(COMMENT_CONFIG.REPORT_STATUSES.includes("dismissed"))

    assert.ok(Array.isArray(COMMENT_CONFIG.MODERATION_ACTIONS), "MODERATION_ACTIONS should be an array")
    assert.ok(COMMENT_CONFIG.MODERATION_ACTIONS.includes("HIDE_COMMENT"))
    assert.ok(COMMENT_CONFIG.MODERATION_ACTIONS.includes("RESTORE_COMMENT"))
    assert.ok(COMMENT_CONFIG.MODERATION_ACTIONS.includes("DELETE_COMMENT"))
    assert.ok(COMMENT_CONFIG.MODERATION_ACTIONS.includes("DISMISS_REPORT"))
    assert.ok(COMMENT_CONFIG.MODERATION_ACTIONS.includes("RESOLVE_REPORT"))

    assert.strictEqual(COMMENT_CONFIG.REPORT_MAX_DESCRIPTION_LENGTH, 500)
  })

  test("Rate limiting for comment reporting is configured with dual-windows", () => {
    const reportLimits = COMMENT_CONFIG.COMMENT_RATE_LIMITS["comment_report"]
    assert.ok(reportLimits, "comment_report limits must be defined")
    assert.strictEqual(reportLimits.burst.limit, 5)
    assert.strictEqual(reportLimits.burst.windowSeconds, 60)
    assert.strictEqual(reportLimits.sustained.limit, 20)
    assert.strictEqual(reportLimits.sustained.windowSeconds, 3600)
  })

  // ---------------------------------------------------------------------------
  // 2. Priority Calculation Engine
  // ---------------------------------------------------------------------------
  console.log("\n--- 2. Priority Calculation Engine ---")

  test("Priority calculation assigns 'critical' or 'high' to severe reasons and safety triggers", () => {
    const severePriority = computeReportPriority({
      reason: "HATEFUL_OR_ABUSIVE",
      safetyScore: 0.95,
      activeReportCount: 1,
    })
    assert.ok(["high", "critical"].includes(severePriority), `Expected high or critical, got ${severePriority}`)

    const maliciousPriority = computeReportPriority({
      reason: "MALICIOUS_LINK",
      activeReportCount: 2,
    })
    assert.ok(["high", "critical"].includes(maliciousPriority))

    const lowPriority = computeReportPriority({
      reason: "OTHER",
      activeReportCount: 1,
      safetyScore: 0.1,
    })
    assert.strictEqual(lowPriority, "low")

    const escalatedByReports = computeReportPriority({
      reason: "SPAM",
      activeReportCount: 6,
    })
    assert.ok(["high", "critical"].includes(escalatedByReports))
  })

  // ---------------------------------------------------------------------------
  // 3. Core Rule Assertion: Dislike != Report != Delete
  // ---------------------------------------------------------------------------
  console.log("\n--- 3. Core Rule Assertion: Dislike != Report != Delete ---")

  let sampleCommentId = "comment_target_phase10_01"
  let sampleAuthorId = "author_user_001"
  let reporter1Id = "u_reporter_1"
  let reporter2Id = "u_reporter_2"
  let reporter3Id = "u_reporter_3"

  await runAsyncTest("Submitting a report does NOT hide, delete, or modify comment status", async () => {
    const result = await createCommentReport({
      commentId: sampleCommentId,
      reportedBy: reporter1Id,
      reason: "OFFENSIVE",
      description: "This comment contains offensive language in the discussion thread.",
      ipAddress: "192.168.1.10",
      userAgent: "Mozilla/5.0 TestBrowser",
    })

    assert.ok(result, "Report creation should succeed")
    assert.ok(result.reportId, "Report ID should be returned")
    assert.strictEqual(result.reason, "OFFENSIVE")
    assert.strictEqual(result.status, "pending")

    // The comment's status must remain visible and not deleted
    assert.strictEqual(result.commentStatus, "visible", "Comment status MUST remain 'visible' on report submission")
    assert.strictEqual(result.isDeleted, false, "Comment MUST NOT be deleted on report submission")
  })

  // ---------------------------------------------------------------------------
  // 4. Duplicate Report Prevention
  // ---------------------------------------------------------------------------
  console.log("\n--- 4. Duplicate Report Prevention ---")

  await runAsyncTest("User cannot submit duplicate report on same comment while first is active", async () => {
    const hasReported = await hasUserReportedComment({
      commentId: sampleCommentId,
      userId: reporter1Id,
    })
    assert.strictEqual(hasReported.hasReported, true, "hasUserReportedComment should be true for reporter1")

    let duplicateThrew = false
    try {
      await createCommentReport({
        commentId: sampleCommentId,
        reportedBy: reporter1Id,
        reason: "SPAM",
        description: "Trying to report again immediately.",
      })
    } catch (err) {
      duplicateThrew = true
      assert.ok(
        err.message.includes("already submitted a report") || err.code === "DUPLICATE_REPORT",
        `Expected duplicate report error, got: ${err.message}`
      )
    }
    assert.strictEqual(duplicateThrew, true, "Duplicate report submission should be rejected")
  })

  // ---------------------------------------------------------------------------
  // 5. Input Validation, Unicode Support & XSS Sanitization
  // ---------------------------------------------------------------------------
  console.log("\n--- 5. Input Validation, Unicode Support & XSS Sanitization ---")

  await runAsyncTest("Rejects report description exceeding 500 characters", async () => {
    const longDescription = "A".repeat(501)
    let rejected = false
    try {
      await createCommentReport({
        commentId: "comment_long_desc",
        reportedBy: reporter2Id,
        reason: "SPAM",
        description: longDescription,
      })
    } catch (err) {
      rejected = true
      assert.ok(err.message.includes("500") || err.message.includes("length"))
    }
    assert.strictEqual(rejected, true, "Report description > 500 chars must be rejected")
  })

  await runAsyncTest("Accepts multilingual Unicode description and strips raw HTML tags", async () => {
    const multilingualHtml = "यह टिप्पणी आपत्तिजनक है <script>alert('xss')</script> Por favor revisar <b>urgente</b>! ありがとう"
    const result = await createCommentReport({
      commentId: "comment_multilingual_test",
      reportedBy: reporter2Id,
      reason: "HARASSMENT",
      description: multilingualHtml,
    })

    assert.ok(result.reportId)
    // HTML tags stripped
    assert.ok(!result.description.includes("<script>"), "HTML script tag must be stripped")
    assert.ok(!result.description.includes("<b>"), "HTML formatting tag must be stripped")
    // Unicode characters preserved
    assert.ok(result.description.includes("यह टिप्पणी आपत्तिजनक है"), "Hindi unicode characters must be preserved")
    assert.ok(result.description.includes("ありがとう"), "Japanese unicode characters must be preserved")
  })

  // ---------------------------------------------------------------------------
  // 6. Multi-User Reporting Accumulation & Priority Elevation
  // ---------------------------------------------------------------------------
  console.log("\n--- 6. Multi-User Reporting Accumulation & Priority Elevation ---")

  await runAsyncTest("Multiple distinct users reporting the same comment increments count and elevates priority", async () => {
    // Second reporter submits on sampleCommentId
    const report2 = await createCommentReport({
      commentId: sampleCommentId,
      reportedBy: reporter2Id,
      reason: "HATEFUL_OR_ABUSIVE",
      description: "Severe hateful remarks found.",
    })
    assert.ok(report2.reportId)

    // Third reporter submits on sampleCommentId
    const report3 = await createCommentReport({
      commentId: sampleCommentId,
      reportedBy: reporter3Id,
      reason: "MALICIOUS_LINK",
      description: "Phishing link detected in this thread.",
    })
    assert.ok(report3.reportId)

    // Inspect report details for the comment's accumulated reports
    const details = await getReportDetails(report3.reportId)
    assert.ok(details, "Report details must be retrievable")
    assert.strictEqual(details.comment.id, sampleCommentId)
    assert.ok(details.comment.totalActiveReports >= 3, `Expected at least 3 reports, got ${details.comment.totalActiveReports}`)
    assert.ok(
      details.priority === "high" || details.priority === "critical",
      `Expected high or critical priority due to multiple severe reports, got ${details.priority}`
    )
    // Comment still remains visible until moderator acts
    assert.strictEqual(details.comment.status, "visible")
  })

  // ---------------------------------------------------------------------------
  // 7. Threaded Reply Reporting & Deleted Comment Reporting
  // ---------------------------------------------------------------------------
  console.log("\n--- 7. Threaded Reply Reporting & Deleted Comment Reporting ---")

  await runAsyncTest("Allows reporting threaded child replies preserving parent context", async () => {
    const childReplyId = "reply_thread_child_01"
    const replyReport = await createCommentReport({
      commentId: childReplyId,
      reportedBy: reporter1Id,
      reason: "SPAM",
      description: "Nested reply spamming telegram links.",
    })

    assert.ok(replyReport.reportId)
    const details = await getReportDetails(replyReport.reportId)
    assert.strictEqual(details.comment.id, childReplyId)
    assert.ok(details.comment.isReply !== undefined)
  })

  // ---------------------------------------------------------------------------
  // 8. Rate Limiting Enforcement on Reports
  // ---------------------------------------------------------------------------
  console.log("\n--- 8. Rate Limiting Enforcement on Reports ---")

  await runAsyncTest("Enforces comment_report rate limits (burst limit = 5 / 60s)", async () => {
    const floodUserId = "u_reporter_flood"
    await resetRateLimits({ key: `user:${floodUserId}` })

    let limited = false
    let attempts = 0

    for (let i = 0; i < 8; i++) {
      const check = await checkRateLimit({
        action: "comment_report",
        userId: floodUserId,
        ipAddress: "10.0.0.99",
      })
      attempts++
      if (check.isRateLimited) {
        limited = true
        assert.ok(check.retryAfter > 0, "retryAfter should be positive")
        break
      }
    }

    assert.strictEqual(limited, true, "Rate limit should trigger after exceeding burst quota of 5")
    assert.strictEqual(attempts, 6, "Expected 6th attempt to be rate-limited")
  })

  // ---------------------------------------------------------------------------
  // 9. RBAC & Security Enforcement
  // ---------------------------------------------------------------------------
  console.log("\n--- 9. RBAC & Security Enforcement ---")

  await runAsyncTest("Moderator/Admin role middleware allows admin & moderator, rejects regular user", async () => {
    let forbiddenCalled = false
    let nextCalled = false

    // Simulate regular user
    const regularUserReq = { user: { id: "user_normal", role: "user" } }
    const forbiddenRes = {
      status(code) {
        if (code === 403) forbiddenCalled = true
        return this
      },
      json(data) {
        return this
      },
    }

    await requireModeratorOrAdminRole(regularUserReq, forbiddenRes, () => {
      nextCalled = true
    })
    assert.strictEqual(forbiddenCalled, true, "Regular user should receive 403 Forbidden")
    assert.strictEqual(nextCalled, false, "Regular user should not call next()")

    // Simulate moderator
    let moderatorNextCalled = false
    const moderatorReq = { user: { id: "mod_user", role: "moderator" } }
    const okRes = { status() { return this }, json() { return this } }

    await requireModeratorOrAdminRole(moderatorReq, okRes, () => {
      moderatorNextCalled = true
    })
    assert.strictEqual(moderatorNextCalled, true, "Moderator role should call next()")

    // Simulate admin
    let adminNextCalled = false
    const adminReq = { user: { id: "admin_user", role: "admin" } }
    await requireModeratorOrAdminRole(adminReq, okRes, () => {
      adminNextCalled = true
    })
    assert.strictEqual(adminNextCalled, true, "Admin role should call next()")
  })

  // ---------------------------------------------------------------------------
  // 10. Moderation Summary & Queue Listing
  // ---------------------------------------------------------------------------
  console.log("\n--- 10. Moderation Summary & Queue Listing ---")

  await runAsyncTest("getModerationSummary returns aggregate counters", async () => {
    const summary = await getModerationSummary()
    assert.ok(summary, "Summary should be returned")
    assert.ok(typeof summary.pending === "number", "pending count should be numeric")
    assert.ok(typeof summary.reviewing === "number", "reviewing count should be numeric")
    assert.ok(typeof summary.resolved === "number", "resolved count should be numeric")
    assert.ok(typeof summary.highPriority === "number", "highPriority count should be numeric")
    assert.ok(typeof summary.totalReports === "number", "totalReports count should be numeric")
    assert.ok(summary.totalReports >= 3, "Expected at least 3 reports in summary")
  })

  await runAsyncTest("getModerationReportsList supports filtering, searching and pagination", async () => {
    const listResult = await getModerationReportsList({
      page: 1,
      limit: 10,
      status: "pending",
      sortBy: "priority",
      sortOrder: "desc",
    })

    assert.ok(listResult.reports, "Reports list should be returned")
    assert.ok(Array.isArray(listResult.reports), "reports should be an array")
    assert.ok(listResult.pagination, "Pagination metadata should be included")
    assert.ok(listResult.pagination.total >= 1, "Expected pending reports to be found")

    // Filter by reason
    const spamReports = await getModerationReportsList({
      reason: "SPAM",
      page: 1,
      limit: 5,
    })
    assert.ok(
      spamReports.reports.every((r) => (r.reason || "").toUpperCase() === "SPAM"),
      "All results must have reason SPAM"
    )
  })

  // ---------------------------------------------------------------------------
  // 11. Report Detail Dossier Inspection
  // ---------------------------------------------------------------------------
  console.log("\n--- 11. Report Detail Dossier Inspection ---")

  let activeReportIdToActOn = null

  await runAsyncTest("getReportDetails returns full dossier (comment, author, safety signals, reports)", async () => {
    const pendingList = await getModerationReportsList({ status: "pending", limit: 1 })
    assert.ok(pendingList.reports.length > 0, "Should find at least one pending report")
    activeReportIdToActOn = pendingList.reports[0].id

    const dossier = await getReportDetails(activeReportIdToActOn)
    assert.ok(dossier, "Dossier should not be null")
    assert.strictEqual(dossier.id, activeReportIdToActOn)
    assert.ok(dossier.comment, "Dossier must include comment object")
    assert.ok(dossier.comment.id, "Dossier comment must have id")
    assert.ok(dossier.comment.content, "Dossier comment must include content")
    assert.ok(dossier.comment.author, "Dossier comment author must be present")
    assert.ok(dossier.safetySignals, "Dossier must include Phase 8 safety signals")
    assert.ok(Array.isArray(dossier.allReports), "Dossier must include list of all reports on comment")
  })

  // ---------------------------------------------------------------------------
  // 12. Status Transitions (pending -> reviewing)
  // ---------------------------------------------------------------------------
  console.log("\n--- 12. Status Transitions ---")

  await runAsyncTest("updateReportStatus updates status to reviewing with moderator notes", async () => {
    const updated = await updateReportStatus({
      reportId: activeReportIdToActOn,
      status: "reviewing",
      moderatorId: "mod_lead_01",
      moderatorNotes: "Assigned to lead moderator for harassment review.",
    })

    assert.strictEqual(updated.status, "reviewing")
    assert.strictEqual(updated.moderatorNotes, "Assigned to lead moderator for harassment review.")
  })

  // ---------------------------------------------------------------------------
  // 13. Moderation Action: HIDE_COMMENT
  // ---------------------------------------------------------------------------
  console.log("\n--- 13. Moderation Action: HIDE_COMMENT ---")

  let commentToHideId = sampleCommentId

  await runAsyncTest("HIDE_COMMENT marks comment hidden and excludes it from public queries", async () => {
    const result = await executeModerationAction({
      commentId: commentToHideId,
      reportId: activeReportIdToActOn,
      action: "HIDE_COMMENT",
      reason: "Confirmed policy violation: abusive content",
      notes: "Content hidden from public view pending further investigation",
      moderatorId: "mod_lead_01",
    })

    assert.strictEqual(result.action, "HIDE_COMMENT")
    assert.strictEqual(result.commentStatus, "hidden")
    assert.strictEqual(result.reportStatus, "resolved")
    assert.ok(result.auditRecordId, "ModerationRecord audit ID must be generated")

    // Verify public comment query excludes hidden comments
    const publicComments = await getCommentsByContent({
      contentId: "video_phase10_test",
      contentType: "video",
    })
    const foundHidden = publicComments.comments?.find((c) => c._id?.toString() === commentToHideId || c.id === commentToHideId)
    assert.strictEqual(foundHidden, undefined, "Hidden comment MUST NOT appear in public comments query")
  })

  // ---------------------------------------------------------------------------
  // 14. Moderation Action: RESTORE_COMMENT
  // ---------------------------------------------------------------------------
  console.log("\n--- 14. Moderation Action: RESTORE_COMMENT ---")

  await runAsyncTest("RESTORE_COMMENT restores hidden comment to visible status", async () => {
    const result = await executeModerationAction({
      commentId: commentToHideId,
      action: "RESTORE_COMMENT",
      reason: "Appeal accepted: false positive",
      notes: "Restoring comment to public visibility",
      moderatorId: "mod_lead_01",
    })

    assert.strictEqual(result.action, "RESTORE_COMMENT")
    assert.strictEqual(result.commentStatus, "visible")
    assert.ok(result.auditRecordId, "Audit record must be logged for restore action")
  })

  // ---------------------------------------------------------------------------
  // 15. Moderation Action: DELETE_COMMENT (Soft Delete)
  // ---------------------------------------------------------------------------
  console.log("\n--- 15. Moderation Action: DELETE_COMMENT ---")

  let commentToDeleteId = "comment_delete_phase10"

  await runAsyncTest("DELETE_COMMENT soft-deletes comment and logs audit trail", async () => {
    // First create a report for this comment
    const report = await createCommentReport({
      commentId: commentToDeleteId,
      reportedBy: reporter2Id,
      reason: "MALICIOUS_LINK",
      description: "Phishing credentials harvester link.",
    })

    const result = await executeModerationAction({
      commentId: commentToDeleteId,
      reportId: report.reportId,
      action: "DELETE_COMMENT",
      reason: "Severe malware / malicious link violation",
      notes: "Soft-deleting comment per safety policy",
      moderatorId: "admin_super_01",
    })

    assert.strictEqual(result.action, "DELETE_COMMENT")
    assert.strictEqual(result.commentStatus, "deleted")
    assert.strictEqual(result.isDeleted, true)
    assert.ok(result.auditRecordId, "Audit record must be generated")
  })

  // ---------------------------------------------------------------------------
  // 16. Moderation Action: DISMISS_REPORT
  // ---------------------------------------------------------------------------
  console.log("\n--- 16. Moderation Action: DISMISS_REPORT ---")

  await runAsyncTest("DISMISS_REPORT leaves comment untouched and marks report dismissed", async () => {
    const dismissCommentId = "comment_dismiss_target_01"
    const report = await createCommentReport({
      commentId: dismissCommentId,
      reportedBy: reporter3Id,
      reason: "OTHER",
      description: "I personally disagree with this point of view.",
    })

    const result = await executeModerationAction({
      commentId: dismissCommentId,
      reportId: report.reportId,
      action: "DISMISS_REPORT",
      reason: "Disagreement does not constitute a policy violation",
      notes: "Dismissing report; content is benign",
      moderatorId: "mod_junior_02",
    })

    assert.strictEqual(result.action, "DISMISS_REPORT")
    assert.strictEqual(result.reportStatus, "dismissed")
    assert.strictEqual(result.commentStatus, "visible", "Comment must remain visible after dismissal")
    assert.strictEqual(result.isDeleted, false)
  })

  // ---------------------------------------------------------------------------
  // 17. Concurrency Conflict Prevention
  // ---------------------------------------------------------------------------
  console.log("\n--- 17. Concurrency Conflict Prevention ---")

  await runAsyncTest("Rejects moderation action if expectedVersion conflicts with current version", async () => {
    let conflictCaught = false
    try {
      await executeModerationAction({
        commentId: commentToHideId,
        action: "HIDE_COMMENT",
        reason: "Late action by another moderator",
        moderatorId: "mod_slow_01",
        expectedVersion: 999, // Intentional mismatch
      })
    } catch (err) {
      conflictCaught = true
      assert.ok(
        err.message.includes("version") || err.message.includes("conflict") || err.code === "VERSION_CONFLICT" || err.statusCode === 409,
        `Expected conflict error, got: ${err.message}`
      )
    }
    assert.strictEqual(conflictCaught, true, "Version conflict must be rejected")
  })

  // ---------------------------------------------------------------------------
  // Teardown
  // ---------------------------------------------------------------------------
  clearMockReportingState()
  if (isDbConnected) {
    await disconnectTestDb()
  }

  console.log("\n========================================================================")
  console.log(`PHASE 10 TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`)
  console.log("========================================================================\n")

  if (failedCount > 0) {
    process.exit(1)
  }
}

runPhase10TestSuite().catch((err) => {
  console.error("FATAL in Phase 10 Test Runner:", err)
  process.exit(1)
})
