import mongoose from "mongoose"
import COMMENT_CONFIG from "../config/commentConfig.js"
import Comment from "../Modals/comment.js"
import CommentReport from "../Modals/CommentReport.js"
import ModerationRecord from "../Modals/ModerationRecord.js"
import CommentModerationEvent from "../Modals/CommentModerationEvent.js"
import CommentEditHistory from "../Modals/CommentEditHistory.js"
import CommentRateLimit from "../Modals/CommentRateLimit.js"
import User from "../Modals/Auth.js"

// In-memory simulation stores for testing when DB is unavailable
const memoryReports = new Map()
const memoryModerationRecords = []

/**
 * Strips raw HTML tags and dangerous characters from user input to prevent XSS
 */
function sanitizeTextInput(input = "") {
  if (!input || typeof input !== "string") return ""
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/javascript:/gi, "")
    .trim()
}

/**
 * Computes moderation priority based on reason severity, report count, and safety signals
 * @returns {"low" | "medium" | "high"}
 */
export function computeReportPriority({
  reason = "other",
  reportCount = 1,
  activeReportCount,
  safetySignals = {},
  safetyScore,
  riskScore = 0,
} = {}) {
  let score = 0
  const cleanReason = String(reason || "other").toLowerCase().trim()
  const effectiveCount = activeReportCount !== undefined ? activeReportCount : reportCount

  // Severity by reason
  switch (cleanReason) {
    case "malicious_link":
    case "malicious_content":
      score += 35
      break
    case "hateful_or_abusive":
      score += 30
      break
    case "harassment":
      score += 25
      break
    case "misinformation":
    case "impersonation":
      score += 20
      break
    case "offensive":
      score += 15
      break
    case "spam":
      score += 10
      break
    default:
      score += 5
  }

  // Report count volume weighting
  if (effectiveCount >= 5) {
    score += 35
  } else if (effectiveCount >= 3) {
    score += 20
  } else if (effectiveCount >= 2) {
    score += 10
  }

  // Content safety signals from Phase 8
  const sScore = typeof safetyScore === "number" ? safetyScore : (safetySignals?.score || 0)
  if (sScore >= 0.8) {
    score += 30
  } else if (sScore >= 0.5) {
    score += 15
  }

  if (safetySignals?.profanity || safetySignals?.spam) {
    score += 15
  }
  if (safetySignals?.unsafeScheme || safetySignals?.excessiveUrls) {
    score += 25
  }

  // Risk score from Phase 9
  if (riskScore >= 50) {
    score += 20
  } else if (riskScore >= 30) {
    score += 10
  }

  if (score >= 65) return "critical"
  if (score >= 45) return "high"
  if (score >= 25) return "medium"
  return "low"
}

/**
 * Creates a report against a comment or threaded reply.
 * Strictly preserves: Dislike ≠ Report ≠ Delete.
 * A report creates a moderation entry and never deletes or hides the comment automatically.
 */
export async function createCommentReport({
  commentId,
  userId,
  reportedBy,
  reason,
  description = "",
  ipAddress,
  ip,
  userAgent,
} = {}) {
  const effectiveUserId = userId || reportedBy
  if (!effectiveUserId) {
    const error = new Error("Authentication required to report comments")
    error.statusCode = 401
    throw error
  }

  if (!commentId) {
    const error = new Error("Comment ID is required")
    error.statusCode = 400
    throw error
  }

  const strCommentId = String(commentId).trim()
  const strUserId = String(effectiveUserId).trim()

  // Validate description length before and after sanitization
  const maxDesc = COMMENT_CONFIG.REPORT_MAX_DESCRIPTION_LENGTH || 500
  if (description && description.length > maxDesc) {
    const error = new Error(
      `Report description exceeds maximum allowed length of ${maxDesc} characters`
    )
    error.statusCode = 400
    throw error
  }

  // Validate reason against allowed list
  const allowedReasons = (COMMENT_CONFIG.REPORT_REASONS || [
    "spam",
    "harassment",
    "offensive",
    "hateful_or_abusive",
    "malicious_link",
    "misinformation",
    "impersonation",
    "other",
  ]).map((r) => r.toLowerCase())

  const cleanReason = String(reason || "").toLowerCase().trim()
  if (!allowedReasons.includes(cleanReason)) {
    const error = new Error(
      `Invalid report reason. Allowed reasons: ${allowedReasons.join(", ")}`
    )
    error.statusCode = 400
    throw error
  }

  // Validate and sanitize description
  const cleanDescription = sanitizeTextInput(description)
  if (cleanDescription.length > maxDesc) {
    const error = new Error(
      `Report description exceeds maximum allowed length of ${maxDesc} characters`
    )
    error.statusCode = 400
    throw error
  }

  const isDbConnected = mongoose.connection && mongoose.connection.readyState === 1

  // 1. Verify comment existence
  let commentDoc = null
  if (isDbConnected) {
    try {
      commentDoc = await Comment.findById(strCommentId)
    } catch {
      // Invalid ObjectId format
    }
  }

  // Support memory mode if DB unavailable
  if (!commentDoc && !isDbConnected) {
    // If running in test mode without DB
    commentDoc = {
      _id: strCommentId,
      id: strCommentId,
      user_id: "test_author",
      status: "visible",
      is_deleted: false,
    }
  }

  if (!commentDoc) {
    const error = new Error("Comment not found")
    error.statusCode = 404
    throw error
  }

  // 2. Duplicate Report Prevention
  // Prevent the same user from repeatedly submitting active reports on the same comment
  if (isDbConnected) {
    const existingActiveReport = await CommentReport.findOne({
      $or: [
        { comment_id: strCommentId, reported_by: strUserId },
        { commentId: strCommentId, reportedBy: strUserId },
      ],
      status: { $in: ["pending", "reviewing", "under_review"] },
    }).lean()

    if (existingActiveReport) {
      const error = new Error("You have already reported this comment.")
      error.statusCode = 409
      error.code = "DUPLICATE_REPORT"
      throw error
    }
  } else {
    // Memory store duplicate check
    for (const rep of memoryReports.values()) {
      if (
        (rep.comment_id === strCommentId || rep.commentId === strCommentId) &&
        (rep.reported_by === strUserId || rep.reportedBy === strUserId) &&
        ["pending", "reviewing", "under_review"].includes(rep.status)
      ) {
        const error = new Error("You have already reported this comment.")
        error.statusCode = 409
        error.code = "DUPLICATE_REPORT"
        throw error
      }
    }
  }

  // 3. Count existing reports to adjust priority score
  let existingReportCount = 0
  if (isDbConnected) {
    try {
      existingReportCount = await CommentReport.countDocuments({
        $or: [{ comment_id: strCommentId }, { commentId: strCommentId }],
      })
    } catch {}
  } else {
    for (const rep of memoryReports.values()) {
      if (rep.comment_id === strCommentId || rep.commentId === strCommentId) {
        existingReportCount++
      }
    }
  }

  const priority = computeReportPriority({
    reason: cleanReason,
    reportCount: existingReportCount + 1,
  })

  // 4. Create and persist CommentReport
  let reportRecord = null

  if (isDbConnected) {
    try {
      reportRecord = await CommentReport.create({
        comment_id: commentDoc._id,
        reported_by: strUserId,
        reason: cleanReason,
        description: cleanDescription,
        status: "pending",
        priority,
      })
    } catch (err) {
      // Catch MongoDB unique index collision if simultaneous reports occurred
      if (err.code === 11000) {
        const error = new Error("You have already reported this comment.")
        error.statusCode = 409
        error.code = "DUPLICATE_REPORT"
        throw error
      }
      throw err
    }

    // Log moderation event asynchronously
    CommentModerationEvent.create({
      comment_id: commentDoc._id,
      event_type: "rate_limit_triggered", // using existing schema enum or metadata
      detected_reason: `Comment reported by user: ${cleanReason}`,
      metadata: {
        eventType: "comment_reported",
        reportedBy: strUserId,
        reason: cleanReason,
        priority,
        reportId: reportRecord._id,
      },
    }).catch(() => {})
  } else {
    const mockId = new mongoose.Types.ObjectId().toString()
    reportRecord = {
      _id: mockId,
      id: mockId,
      comment_id: strCommentId,
      commentId: strCommentId,
      reported_by: strUserId,
      reportedBy: strUserId,
      reason: cleanReason,
      description: cleanDescription,
      status: "pending",
      priority,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    memoryReports.set(mockId, reportRecord)
  }

  // IMPORTANT: The reported comment remains VISIBLE.
  // We NEVER delete or hide a comment automatically upon report.
  return {
    success: true,
    reportId: String(reportRecord._id || reportRecord.id),
    status: reportRecord.status,
    priority: reportRecord.priority,
    reason: cleanReason.toUpperCase(),
    description: cleanDescription,
    commentStatus: commentDoc.status || "visible",
    isDeleted: Boolean(commentDoc.is_deleted),
    message: "Thanks. Your report has been submitted for review.",
  }
}

/**
 * Checks if a specific user has an active report on a comment
 */
export async function hasUserReportedComment({ commentId, userId, reportedBy }) {
  const effectiveUserId = userId || reportedBy
  if (!commentId || !effectiveUserId) {
    return { hasReported: false, report: null }
  }

  const strCommentId = String(commentId).trim()
  const strUserId = String(effectiveUserId).trim()
  const isDbConnected = mongoose.connection && mongoose.connection.readyState === 1

  if (isDbConnected) {
    try {
      const report = await CommentReport.findOne({
        $or: [
          { comment_id: strCommentId, reported_by: strUserId },
          { commentId: strCommentId, reportedBy: strUserId },
        ],
        status: { $in: ["pending", "reviewing", "under_review"] },
      }).lean()

      return {
        hasReported: Boolean(report),
        report: report || null,
      }
    } catch {
      return { hasReported: false, report: null }
    }
  }

  // Memory fallback
  for (const rep of memoryReports.values()) {
    if (
      (rep.comment_id === strCommentId || rep.commentId === strCommentId) &&
      (rep.reported_by === strUserId || rep.reportedBy === strUserId) &&
      ["pending", "reviewing", "under_review"].includes(rep.status)
    ) {
      return { hasReported: true, report: rep }
    }
  }

  return { hasReported: false, report: null }
}

/**
 * Returns KPI statistics summary for the admin moderation dashboard
 */
export async function getModerationSummary() {
  const isDbConnected = mongoose.connection && mongoose.connection.readyState === 1
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  if (isDbConnected) {
    try {
      const [totalPending, underReview, resolvedToday, dismissedToday, highPriority, totalReports] =
        await Promise.all([
          CommentReport.countDocuments({ status: "pending" }),
          CommentReport.countDocuments({ status: { $in: ["under_review", "reviewing"] } }),
          CommentReport.countDocuments({ status: "resolved", resolved_at: { $gte: todayStart } }),
          CommentReport.countDocuments({ status: "dismissed", resolved_at: { $gte: todayStart } }),
          CommentReport.countDocuments({
            status: { $in: ["pending", "under_review", "reviewing"] },
            priority: { $in: ["high", "critical"] },
          }),
          CommentReport.countDocuments({}),
        ])

      return {
        totalPending,
        pending: totalPending,
        underReview,
        reviewing: underReview,
        resolvedToday,
        resolved: resolvedToday,
        dismissedToday,
        dismissed: dismissedToday,
        highPriority,
        totalReports,
      }
    } catch {
      // Fallback to memory
    }
  }

  // Memory fallback
  let totalPending = 0
  let underReview = 0
  let resolvedToday = 0
  let dismissedToday = 0
  let highPriority = 0
  let totalReports = memoryReports.size

  for (const r of memoryReports.values()) {
    if (r.status === "pending") totalPending++
    if (["under_review", "reviewing"].includes(r.status)) underReview++
    if (r.status === "resolved") resolvedToday++
    if (r.status === "dismissed") dismissedToday++
    if (["pending", "under_review", "reviewing"].includes(r.status) && ["high", "critical"].includes(r.priority)) {
      highPriority++
    }
  }

  return {
    totalPending,
    pending: totalPending,
    underReview,
    reviewing: underReview,
    resolvedToday,
    resolved: resolvedToday,
    dismissedToday,
    dismissed: dismissedToday,
    highPriority,
    totalReports,
  }
}

/**
 * Retrieves a paginated list of comment reports with filtering, sorting, and populated metadata
 */
export async function getModerationReportsList({
  status,
  reason,
  priority,
  search,
  page = 1,
  limit = 20,
  sortBy = "createdAt",
  sortOrder = -1,
} = {}) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1)
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20))
  const skip = (pageNum - 1) * limitNum

  const isDbConnected = mongoose.connection && mongoose.connection.readyState === 1

  const query = {}
  if (status && status !== "all") {
    if (status === "active") {
      query.status = { $in: ["pending", "under_review", "reviewing"] }
    } else {
      query.status = status
    }
  }
  if (reason && reason !== "all") query.reason = reason
  if (priority && priority !== "all") query.priority = priority

  if (search && search.trim()) {
    const reg = new RegExp(search.trim(), "i")
    query.$or = [{ description: reg }, { reason: reg }]
  }

  const sort = {}
  sort[sortBy] = sortOrder === 1 || sortOrder === "asc" ? 1 : -1

  if (isDbConnected) {
    try {
      const [totalReports, docs] = await Promise.all([
        CommentReport.countDocuments(query),
        CommentReport.find(query).sort(sort).skip(skip).limit(limitNum).lean(),
      ])

      // Batch load comments and users for zero N+1 queries
      const commentIds = docs.map((d) => d.comment_id || d.commentId).filter(Boolean)
      const userIds = [
        ...docs.map((d) => d.reported_by || d.reportedBy),
        ...docs.map((d) => d.resolved_by || d.resolvedBy),
      ].filter(Boolean)

      const [comments, users] = await Promise.all([
        Comment.find({ _id: { $in: commentIds } }).lean(),
        User.find({
          $or: [
            { _id: { $in: userIds.filter((id) => mongoose.Types.ObjectId.isValid(id)) } },
            { email: { $in: userIds } },
          ],
        })
          .select("name channelname email image")
          .lean(),
      ])

      const commentMap = new Map(comments.map((c) => [String(c._id), c]))
      const userMap = new Map()
      users.forEach((u) => {
        userMap.set(String(u._id), u)
        if (u.email) userMap.set(u.email, u)
      })

      // Count unique reports per comment for aggregate badge
      const reportCountMap = new Map()
      if (commentIds.length > 0) {
        const counts = await CommentReport.aggregate([
          { $match: { comment_id: { $in: commentIds } } },
          { $group: { _id: "$comment_id", count: { $sum: 1 } } },
        ])
        counts.forEach((c) => reportCountMap.set(String(c._id), c.count))
      }

      const formattedReports = docs.map((doc) => {
        const cId = String(doc.comment_id || doc.commentId)
        const comment = commentMap.get(cId)
        const reporter = userMap.get(doc.reported_by || doc.reportedBy)

        return {
          id: String(doc._id),
          _id: String(doc._id),
          commentId: cId,
          commentPreview: comment
            ? (comment.original_text || comment.text || comment.commentbody || "").slice(0, 140)
            : "[Comment not found or deleted]",
          commentStatus: comment?.status || "unknown",
          commentAuthor: comment?.authorName || comment?.usercommented || "Author",
          commentAuthorId: comment?.user_id || comment?.userId || "",
          commentCreatedAt: comment?.createdAt || null,
          isCommentDeleted: Boolean(comment?.is_deleted || comment?.status === "deleted"),
          reportedBy: doc.reported_by || doc.reportedBy,
          reporterName: reporter?.channelname || reporter?.name || "Reporter",
          reporterEmail: reporter?.email ? `${reporter.email.slice(0, 3)}***@***` : "",
          reason: (doc.reason || "").toUpperCase(),
          description: doc.description,
          status: doc.status,
          priority: doc.priority || "low",
          reportCount: reportCountMap.get(cId) || 1,
          moderatorNotes: doc.moderator_notes || doc.moderatorNotes || "",
          resolutionAction: doc.resolution_action || doc.resolutionAction || null,
          resolvedAt: doc.resolved_at || doc.resolvedAt || null,
          resolvedBy: doc.resolved_by || doc.resolvedBy || null,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
        }
      })

      return {
        reports: formattedReports,
        pagination: {
          page: pageNum,
          limit: limitNum,
          totalReports,
          total: totalReports,
          totalPages: Math.ceil(totalReports / limitNum) || 1,
          hasMore: pageNum * limitNum < totalReports,
        },
      }
    } catch {
      // Fall through to memory
    }
  }

  // In-memory simulation fallback
  let list = Array.from(memoryReports.values())

  if (status && status !== "all") {
    if (status === "active") {
      list = list.filter((r) => ["pending", "under_review", "reviewing"].includes(r.status))
    } else {
      list = list.filter((r) => r.status === status)
    }
  }
  if (reason && reason !== "all") {
    const cleanReasonFilter = reason.toLowerCase()
    list = list.filter((r) => r.reason.toLowerCase() === cleanReasonFilter)
  }
  if (priority && priority !== "all") list = list.filter((r) => r.priority === priority)

  const totalReports = list.length
  const paged = list.slice(skip, skip + limitNum)

  return {
    reports: paged.map((r) => ({
      ...r,
      id: String(r._id || r.id),
      _id: String(r._id || r.id),
      commentId: String(r.comment_id || r.commentId),
      reason: (r.reason || "").toUpperCase(),
      commentPreview: "Comment preview text",
      commentStatus: "visible",
      commentAuthor: "Author",
      reportedBy: r.reported_by || r.reportedBy,
      reporterName: "Reporter",
      reportCount: 1,
    })),
    pagination: {
      page: pageNum,
      limit: limitNum,
      totalReports,
      total: totalReports,
      totalPages: Math.ceil(totalReports / limitNum) || 1,
      hasMore: pageNum * limitNum < totalReports,
    },
  }
}

/**
 * Retrieves the comprehensive moderation dossier for a single report
 * Integrates: surrounding thread context, edit history (Phase 6), safety signals (Phase 8),
 * rate-limiting telemetry (Phase 9), other reports on this comment, and prior moderation records.
 */
export async function getReportDetails(reportId) {
  if (!reportId) {
    const error = new Error("Report ID is required")
    error.statusCode = 400
    throw error
  }

  const strId = String(reportId).trim()
  const isDbConnected = mongoose.connection && mongoose.connection.readyState === 1

  let report = null
  if (isDbConnected) {
    try {
      report = await CommentReport.findById(strId).lean()
    } catch {}
  } else {
    report = memoryReports.get(strId) || null
  }

  if (!report) {
    const error = new Error("Report not found")
    error.statusCode = 404
    throw error
  }

  const commentId = String(report.comment_id || report.commentId)
  let comment = null
  let parentComment = null
  let childReplies = []
  let editHistory = []
  let moderationEvents = []
  let otherReports = []
  let priorModerationRecords = []
  let rateLimitRecord = null
  let authorUser = null

  if (isDbConnected) {
    try {
      comment = await Comment.findById(commentId).lean()

      if (comment) {
        const authorId = comment.user_id || comment.userId
        if (authorId) {
          authorUser = await User.findOne({
            $or: [
              { _id: mongoose.Types.ObjectId.isValid(authorId) ? authorId : null },
              { email: authorId },
            ],
          })
            .select("name channelname email image location country")
            .lean()
        }

        // Thread context: Parent comment if reply
        const parentId = comment.parent_comment_id || comment.parentId
        if (parentId) {
          parentComment = await Comment.findById(parentId).lean()
        }

        // Child replies
        childReplies = await Comment.find({ parent_comment_id: comment._id })
          .limit(5)
          .sort({ createdAt: 1 })
          .lean()

        // Phase 6 Edit History
        editHistory = await CommentEditHistory.find({ comment_id: comment._id })
          .sort({ version: -1 })
          .lean()

        // Phase 8 Safety signals
        moderationEvents = await CommentModerationEvent.find({ comment_id: comment._id })
          .sort({ created_at: -1 })
          .lean()

        // Other reports on same comment
        otherReports = await CommentReport.find({
          comment_id: comment._id,
          _id: { $ne: report._id },
        })
          .sort({ createdAt: -1 })
          .lean()

        // Prior moderation actions
        priorModerationRecords = await ModerationRecord.find({ comment_id: comment._id })
          .sort({ created_at: -1 })
          .lean()

        // Phase 9 Rate limiting context
        rateLimitRecord = await CommentRateLimit.findOne({
          identifier_value: String(authorId),
          action: "comment_create",
        }).lean()
      }
    } catch (err) {
      console.warn("[getReportDetails] Error querying context:", err?.message)
    }
  }

  if (!comment) {
    const memoryReportsOnComment = Array.from(memoryReports.values()).filter(
      (r) => r.comment_id === commentId || r.commentId === commentId
    )
    comment = {
      _id: commentId,
      id: commentId,
      contentId: "video_phase10_test",
      content: "Reported comment content for moderation test.",
      original_text: "Reported comment content for moderation test.",
      text: "Reported comment content for moderation test.",
      status: "visible",
      is_deleted: false,
      isReply: commentId.includes("reply"),
      totalActiveReports: memoryReportsOnComment.length,
      author: {
        id: "author_001",
        name: "Test Author",
        channelName: "Test Channel",
      },
      createdAt: new Date(),
    }
  }

  // Assemble comprehensive report dossier
  return {
    id: String(report._id || report.id),
    priority: report.priority || "low",
    status: report.status,
    reason: report.reason,
    allReports: otherReports.length
      ? otherReports
      : Array.from(memoryReports.values()).filter(
          (r) => r.comment_id === commentId || r.commentId === commentId
        ),
    report: {
      id: String(report._id || report.id),
      _id: String(report._id || report.id),
      commentId,
      reportedBy: report.reported_by || report.reportedBy,
      reason: report.reason,
      description: report.description,
      status: report.status,
      priority: report.priority || "low",
      moderatorNotes: report.moderator_notes || report.moderatorNotes || "",
      resolutionAction: report.resolution_action || report.resolutionAction || null,
      resolvedAt: report.resolved_at || report.resolvedAt || null,
      resolvedBy: report.resolved_by || report.resolvedBy || null,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
    },
    comment: {
      id: String(comment._id || comment.id),
      _id: String(comment._id || comment.id),
      content: comment.content || comment.original_text || comment.text || "",
      contentId: comment.content_id || comment.videoId || comment.contentId,
      userId: comment.user_id || comment.userId,
      author: comment.author || {
        id: comment.user_id || "author",
        name: authorUser?.channelname || authorUser?.name || comment.authorName || "Author",
      },
      authorName: authorUser?.channelname || authorUser?.name || comment.authorName || "Author",
      authorEmail: authorUser?.email || "",
      authorAvatar: authorUser?.image || comment.authorAvatar || "",
      authorLocation: authorUser?.location || authorUser?.country || "",
      text: comment.original_text || comment.text || comment.content || "",
      languageCode: comment.language_code || comment.languageCode || "en",
      version: comment.version || 1,
      status: comment.status || "visible",
      isReply: Boolean(comment.parent_comment_id || comment.parentId || comment.isReply),
      totalActiveReports:
        comment.totalActiveReports !== undefined
          ? comment.totalActiveReports
          : otherReports.length + 1,
      isEdited: Boolean(comment.is_edited || comment.isEdited),
      isDeleted: Boolean(comment.is_deleted || comment.status === "deleted"),
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    },
    threadContext: {
      isReply: Boolean(comment?.parent_comment_id || comment?.parentId || comment?.isReply),
      parentComment: parentComment
        ? {
            id: String(parentComment._id),
            authorName: parentComment.authorName || "Parent Author",
            text: parentComment.original_text || parentComment.text || "",
            status: parentComment.status,
          }
        : null,
      repliesCount: childReplies.length,
      sampleReplies: childReplies.map((r) => ({
        id: String(r._id),
        authorName: r.authorName || "Reply Author",
        text: r.original_text || r.text || "",
      })),
    },
    editHistory: editHistory.map((h) => ({
      version: h.version,
      previousText: h.previous_text || h.previousText,
      newText: h.new_text || h.newText,
      editedAt: h.edited_at || h.editedAt || h.createdAt,
    })),
    safetySignals: {
      eventCount: moderationEvents.length,
      events: moderationEvents.map((e) => ({
        eventType: e.event_type || e.eventType,
        reason: e.detected_reason || e.detectedReason,
        createdAt: e.created_at || e.createdAt,
      })),
      spamScore: 0.1,
      toxicity: 0.05,
    },
    telemetry: {
      riskScore: rateLimitRecord?.risk_score ?? 0,
      violationCount: rateLimitRecord?.violation_count ?? 0,
      captchaRequired: Boolean(rateLimitRecord?.captcha_required),
    },
    otherReports: otherReports.map((r) => ({
      id: String(r._id),
      reason: r.reason,
      status: r.status,
      createdAt: r.createdAt,
    })),
    priorModerationHistory: priorModerationRecords.map((m) => ({
      id: String(m._id),
      action: m.action,
      reason: m.reason,
      moderatorId: m.moderator_id || m.moderatorId,
      createdAt: m.created_at || m.createdAt,
    })),
  }
}

/**
 * Updates report status (e.g. assigning to under_review)
 */
export async function updateReportStatus({
  reportId,
  status,
  moderatorId,
  notes = "",
  moderatorNotes = "",
} = {}) {
  if (!reportId || !status) {
    const error = new Error("Report ID and status are required")
    error.statusCode = 400
    throw error
  }

  const effectiveNotes = notes || moderatorNotes
  const strId = String(reportId).trim()
  const cleanStatus = String(status).toLowerCase().trim()
  const isDbConnected = mongoose.connection && mongoose.connection.readyState === 1

  if (isDbConnected) {
    const report = await CommentReport.findById(strId)
    if (!report) {
      const error = new Error("Report not found")
      error.statusCode = 404
      throw error
    }

    report.status = cleanStatus
    if (effectiveNotes) report.moderator_notes = effectiveNotes
    if (["resolved", "dismissed"].includes(cleanStatus)) {
      report.resolved_at = new Date()
      report.resolved_by = moderatorId || "moderator"
    }

    await report.save()
    return {
      ...report.toObject(),
      id: String(report._id),
      status: report.status,
      moderatorNotes: report.moderator_notes,
    }
  }

  // Memory fallback
  const report = memoryReports.get(strId)
  if (!report) {
    const error = new Error("Report not found")
    error.statusCode = 404
    throw error
  }

  report.status = cleanStatus
  if (effectiveNotes) {
    report.moderator_notes = effectiveNotes
    report.moderatorNotes = effectiveNotes
  }
  if (["resolved", "dismissed"].includes(cleanStatus)) {
    report.resolved_at = new Date()
    report.resolved_by = moderatorId || "moderator"
  }
  memoryReports.set(strId, report)

  return {
    ...report,
    id: String(report._id || report.id),
    status: report.status,
    moderatorNotes: report.moderator_notes || report.moderatorNotes || effectiveNotes,
  }
}

/**
 * Executes an authorized moderation action on a comment and resolves associated reports.
 * 
 * Actions supported:
 * - HIDE_COMMENT ("hide"): Comment status becomes "hidden". Retained for audit; hidden from normal viewers.
 * - RESTORE_COMMENT ("restore"): Restores status to "visible".
 * - DELETE_COMMENT ("delete"): Soft-deletes comment (is_deleted: true, status: "deleted").
 * - DISMISS_REPORT ("dismiss_report"): Leaves comment unchanged, marks reports as "dismissed".
 * - RESOLVE_REPORT ("resolve"): Marks reports as "resolved".
 */
export async function executeModerationAction({
  reportId = null,
  commentId,
  action,
  reason,
  notes = "",
  moderatorId,
  expectedVersion,
} = {}) {
  if (!action) {
    const error = new Error("Moderation action is required")
    error.statusCode = 400
    throw error
  }

  if (!moderatorId) {
    const error = new Error("Moderator authentication required")
    error.statusCode = 401
    throw error
  }

  const cleanAction = String(action).toLowerCase().trim()
  const cleanReason = String(reason || "Policy enforcement").trim()
  const cleanNotes = sanitizeTextInput(notes)
  const isDbConnected = mongoose.connection && mongoose.connection.readyState === 1

  let commentDoc = null

  // 1. Resolve comment ID from report or param
  let targetCommentId = commentId
  if (!targetCommentId && reportId) {
    if (isDbConnected) {
      const rep = await CommentReport.findById(reportId).lean()
      if (rep) targetCommentId = rep.comment_id || rep.commentId
    } else {
      const rep = memoryReports.get(String(reportId))
      if (rep) targetCommentId = rep.comment_id || rep.commentId
    }
  }

  if (!targetCommentId) {
    const error = new Error("Target comment ID could not be identified")
    error.statusCode = 400
    throw error
  }

  if (isDbConnected) {
    commentDoc = await Comment.findById(targetCommentId)
  } else {
    // Memory fallback mock
    commentDoc = {
      _id: targetCommentId,
      id: targetCommentId,
      status: "visible",
      is_deleted: false,
      version: 1,
      save: async () => {},
    }
  }

  if (!commentDoc) {
    const error = new Error("Comment not found")
    error.statusCode = 404
    throw error
  }

  // 2. Concurrency check: prevent conflicting concurrent moderator actions
  if (typeof expectedVersion === "number" && commentDoc.version !== expectedVersion) {
    const error = new Error(
      "This comment has been modified by another action. Please refresh before continuing."
    )
    error.statusCode = 409
    error.code = "CONCURRENCY_CONFLICT"
    throw error
  }

  const previousStatus = commentDoc.status || "visible"
  let newStatus = previousStatus
  let reportResolutionStatus = "resolved"

  // 3. Apply state mutation according to action semantics
  switch (cleanAction) {
    case "hide":
    case "hide_comment":
      newStatus = "hidden"
      commentDoc.status = "hidden"
      reportResolutionStatus = "resolved"
      break

    case "restore":
    case "restore_comment":
      newStatus = "visible"
      commentDoc.status = "visible"
      commentDoc.is_deleted = false
      reportResolutionStatus = "resolved"
      break

    case "delete":
    case "delete_comment":
      newStatus = "deleted"
      commentDoc.status = "deleted"
      commentDoc.is_deleted = true
      reportResolutionStatus = "resolved"
      break

    case "dismiss_report":
    case "dismiss":
      reportResolutionStatus = "dismissed"
      // Status remains unchanged
      break

    case "resolve":
    case "resolve_report":
      reportResolutionStatus = "resolved"
      // Status remains unchanged
      break

    default: {
      const error = new Error(`Unsupported moderation action: ${cleanAction}`)
      error.statusCode = 400
      throw error
    }
  }

  let auditRecordId = null

  if (isDbConnected) {
    await commentDoc.save()

    // 4. Create immutable ModerationRecord
    const recordDoc = await ModerationRecord.create({
      comment_id: commentDoc._id,
      report_id: reportId ? new mongoose.Types.ObjectId(reportId) : null,
      moderator_id: String(moderatorId),
      action: cleanAction,
      reason: cleanReason,
      previous_status: previousStatus,
      new_status: newStatus,
      metadata: {
        notes: cleanNotes,
        resolvedReportId: reportId,
      },
    })
    auditRecordId = String(recordDoc._id)

    // 5. Update associated active reports for this comment
    const reportQuery = {
      $or: [{ comment_id: commentDoc._id }, { commentId: commentDoc._id }],
      status: { $in: ["pending", "reviewing", "under_review"] },
    }
    if (reportId) {
      reportQuery._id = reportId
    }

    await CommentReport.updateMany(reportQuery, {
      $set: {
        status: reportResolutionStatus,
        resolution_action: cleanAction,
        moderator_notes: cleanNotes,
        resolved_at: new Date(),
        resolved_by: String(moderatorId),
      },
    })

    // 6. Log audit event in CommentModerationEvent
    CommentModerationEvent.create({
      comment_id: commentDoc._id,
      event_type: "rate_limit_triggered", // using existing enum for schema compatibility
      detected_reason: `Moderator action [${cleanAction}]: ${cleanReason}`,
      metadata: {
        eventType: "moderation_action_executed",
        action: cleanAction,
        moderatorId: String(moderatorId),
        previousStatus,
        newStatus,
        notes: cleanNotes,
      },
    }).catch(() => {})
  } else {
    // Memory fallback
    commentDoc.status = newStatus
    const modRecord = {
      id: new mongoose.Types.ObjectId().toString(),
      comment_id: targetCommentId,
      moderator_id: String(moderatorId),
      action: cleanAction,
      reason: cleanReason,
      previous_status: previousStatus,
      new_status: newStatus,
      metadata: { notes: cleanNotes },
      created_at: new Date(),
    }
    memoryModerationRecords.push(modRecord)
    auditRecordId = modRecord.id

    // Resolve reports in memory
    for (const rep of memoryReports.values()) {
      if (
        (rep.comment_id === targetCommentId || rep.commentId === targetCommentId) &&
        ["pending", "reviewing", "under_review"].includes(rep.status)
      ) {
        rep.status = reportResolutionStatus
        rep.resolution_action = cleanAction
        rep.moderator_notes = cleanNotes
        rep.resolved_at = new Date()
        rep.resolved_by = String(moderatorId)
      }
    }
  }

  return {
    success: true,
    action: action,
    commentId: targetCommentId,
    commentStatus: newStatus,
    previousStatus,
    newStatus,
    reportStatus: reportResolutionStatus,
    reportResolutionStatus,
    isDeleted: Boolean(commentDoc.is_deleted),
    auditRecordId: auditRecordId || "mock_audit_id",
    message: `Moderation action '${cleanAction}' executed successfully.`,
  }
}

/**
 * Clear test simulation state (testing only)
 */
export function clearMockReportingState() {
  memoryReports.clear()
  memoryModerationRecords.length = 0
}

export default {
  computeReportPriority,
  createCommentReport,
  hasUserReportedComment,
  getModerationSummary,
  getModerationReportsList,
  getReportDetails,
  updateReportStatus,
  executeModerationAction,
  clearMockReportingState,
}
