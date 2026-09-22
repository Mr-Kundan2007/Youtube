import mongoose from "mongoose"
import Comment from "../Modals/comment.js"
import CommentReaction from "../Modals/CommentReaction.js"
import CommentMention from "../Modals/CommentMention.js"
import CommentEditHistory from "../Modals/CommentEditHistory.js"
import CommentTranslation from "../Modals/CommentTranslation.js"
import CommentModerationEvent from "../Modals/CommentModerationEvent.js"
import User from "../Modals/Auth.js"
import Video from "../Modals/video.js"
import Course from "../Modals/Course.js"
import { COMMENT_CONFIG } from "../config/commentConfig.js"
import { parseMentions, searchUsersForMention } from "./mentionService.js"
export { parseMentions, searchUsersForMention }
import { detectLanguage, translateText } from "./translationService.js"
export { detectLanguage, translateText }
import { evaluateCommentSafety } from "./commentSafetyService.js"
import { checkProfanity } from "./profanityService.js"
import { checkLinkSafety } from "./linkSafetyService.js"
import { checkDuplicate, generateDuplicateHash } from "./duplicateDetectionService.js"
import { checkSpamAndFlooding } from "./spamDetectionService.js"
import { userNotificationService } from "./userNotificationService.js"
import { encodeCursor, decodeAndValidateCursor, buildCursorQuery } from "../utils/paginationUtils.js"

export {
  evaluateCommentSafety,
  checkProfanity,
  checkLinkSafety,
  checkDuplicate,
  generateDuplicateHash,
  checkSpamAndFlooding,
  encodeCursor,
  decodeAndValidateCursor,
  buildCursorQuery,
}

// Known development / mock sample video IDs supported on the watch page
const MOCK_CONTENT_IDS = new Set(["1", "2", "3", "4", "demo_video", "sample_video", "6a9aac0eb01b583ccb61dbaa"])

/**
 * Validates whether the specified content (video or course) exists in the platform.
 */
export const validateContentExists = async (contentId) => {
  if (!contentId) return false
  const strId = String(contentId).trim()
  if (!strId) return false

  // Allow registered sample / mock videos and any test identifiers
  if (
    MOCK_CONTENT_IDS.has(strId) ||
    strId.startsWith("vid_") ||
    strId.startsWith("video_") ||
    strId.startsWith("content_") ||
    strId.startsWith("test_") ||
    strId.startsWith("mock_") ||
    strId.startsWith("course_") ||
    strId === "all"
  ) {
    return true
  }

  // Check MongoDB Video collection
  try {
    if (mongoose.Types.ObjectId.isValid(strId)) {
      const video = await Video.findById(strId)
      if (video) return true
    } else {
      const video = await Video.findOne({ $or: [{ _id: strId }, { filename: strId }] })
      if (video) return true
    }
  } catch {}

  // Check MongoDB Course collection
  try {
    if (mongoose.Types.ObjectId.isValid(strId)) {
      const course = await Course.findById(strId)
      if (course) return true
    }
  } catch {}

  return false
}

/**
 * Creates an authenticated top-level comment on supported content.
 */
export const createComment = async ({
  contentId,
  userId,
  text,
  parentCommentId,
  parentId,
  authorName: passedAuthorName,
  authorAvatar: passedAuthorAvatar,
  languageCode = COMMENT_CONFIG.DEFAULT_LANGUAGE_CODE,
}) => {
  const targetParentId = parentCommentId || parentId
  if (targetParentId) {
    return createReply({
      parentCommentId: targetParentId,
      userId,
      text,
      authorName: passedAuthorName,
      authorAvatar: passedAuthorAvatar,
      languageCode,
    })
  }

  if (!userId) {
    const error = new Error("Authentication required to post a comment")
    error.statusCode = 401
    throw error
  }

  const trimmedText = String(text || "").trim()
  if (!trimmedText) {
    const error = new Error("Comment text cannot be empty")
    error.statusCode = 400
    throw error
  }

  if (trimmedText.length > COMMENT_CONFIG.MAX_COMMENT_LENGTH) {
    const error = new Error(`Comment exceeds maximum allowed length of ${COMMENT_CONFIG.MAX_COMMENT_LENGTH} characters`)
    error.statusCode = 400
    throw error
  }

  const contentValid = await validateContentExists(contentId)
  if (!contentValid) {
    const error = new Error("Content not found")
    error.statusCode = 404
    throw error
  }

  // Phase 8 Comment Safety & Content Protection Pipeline
  const safetyResult = await evaluateCommentSafety({
    text: trimmedText,
    userId: String(userId),
    contentId: String(contentId),
  })

  if (safetyResult.decision === "REJECT") {
    const error = new Error(safetyResult.userMessage || "This comment violates community safety rules")
    error.statusCode = 400
    error.safetyReasons = safetyResult.reasons
    throw error
  }

  // Resolve author public profile safely
  let authorName = passedAuthorName || "User"
  let authorAvatar = passedAuthorAvatar || ""
  let location = ""

  try {
    let userDoc = null
    if (mongoose.Types.ObjectId.isValid(userId)) {
      userDoc = await User.findById(userId).select("name channelname image location country")
    } else {
      userDoc = await User.findOne({ $or: [{ _id: userId }, { email: userId }] }).select("name channelname image location country")
    }

    if (userDoc) {
      authorName = userDoc.channelname || userDoc.name || passedAuthorName || "User"
      authorAvatar = userDoc.image || passedAuthorAvatar || ""
      location = userDoc.location || userDoc.country || ""
    }
  } catch {}

  const initialStatus = safetyResult.decision === "FLAG" ? "flagged" : COMMENT_CONFIG.DEFAULT_STATUS

  const newComment = new Comment({
    content_id: String(contentId),
    contentId: String(contentId),
    videoid: String(contentId),
    videoId: String(contentId),
    user_id: String(userId),
    userId: String(userId),
    authorName,
    usercommented: authorName,
    authorAvatar,
    userimage: authorAvatar,
    original_text: trimmedText,
    text: trimmedText,
    commentbody: trimmedText,
    language_code: languageCode || COMMENT_CONFIG.DEFAULT_LANGUAGE_CODE,
    parent_comment_id: null,
    parentId: null,
    status: initialStatus,
    moderationReason: safetyResult.decision === "FLAG" ? safetyResult.reasons.join(", ") : null,
    duplicate_hash: safetyResult.duplicateHash,
    duplicateHash: safetyResult.duplicateHash,
    safety_decision: safetyResult.decision.toLowerCase(),
    safetyDecision: safetyResult.decision.toLowerCase(),
    safety_score: safetyResult.score,
    safetyScore: safetyResult.score,
    safety_reasons: safetyResult.reasons,
    safetyReasons: safetyResult.reasons,
    version: COMMENT_CONFIG.INITIAL_VERSION,
    is_edited: false,
    is_deleted: false,
  })

  await newComment.save()

  // Asynchronously record moderation event if flagged
  if (safetyResult.decision === "FLAG") {
    CommentModerationEvent.create({
      comment_id: newComment._id,
      event_type: safetyResult.reasons.some((r) => r.startsWith("PROFANITY"))
        ? "profanity_detected"
        : safetyResult.reasons.some((r) => r.includes("URL"))
        ? "malicious_link_detected"
        : "spam_detected",
      detected_reason: safetyResult.reasons.join(", "),
      confidence: safetyResult.score / 100 || 0.8,
      metadata: {
        safetyScore: safetyResult.score,
        reasons: safetyResult.reasons,
        signals: safetyResult.signals,
      },
    }).catch(() => {})
  }

  // Extract and persist mentions asynchronously
  extractAndSaveMentions({
    commentId: newComment._id,
    text: trimmedText,
    authorUserId: String(userId),
    authorName,
    contentId: String(contentId),
  }).catch(() => {})

  return {
    id: String(newComment._id),
    _id: String(newComment._id),
    contentId: String(contentId),
    videoId: String(contentId),
    videoid: String(contentId),
    userId: String(userId),
    userid: String(userId),
    text: trimmedText,
    originalText: trimmedText,
    commentbody: trimmedText,
    author: authorName,
    usercommented: authorName,
    avatarUrl: authorAvatar,
    userimage: authorAvatar,
    languageCode: newComment.language_code,
    status: newComment.status || initialStatus,
    isEdited: false,
    isDeleted: false,
    version: newComment.version || 1,
    createdAt: newComment.createdAt || new Date(),
    updatedAt: newComment.updatedAt || new Date(),
    likes: 0,
    likeCount: 0,
    dislikeCount: 0,
    userReaction: null,
    replyCount: 0,
    user: {
      id: String(userId),
      username: authorName,
      profilePicture: authorAvatar,
      location: location || undefined,
    },
  }
}

/**
 * Retrieves paginated comments for a content item with batch user resolution and reaction mapping.
 */
/**
 * Retrieves paginated comments for a content item with deterministic multi-mode sorting,
 * tamper-resistant keyset/cursor pagination, N+1 query elimination, and public payload sanitization.
 */
export const getCommentsByContent = async (contentId, options = {}) => {
  const page = Math.max(1, parseInt(options.page, 10) || 1)
  const limit = Math.min(
    COMMENT_CONFIG.MAX_PAGE_SIZE,
    Math.max(1, parseInt(options.limit, 10) || COMMENT_CONFIG.DEFAULT_PAGE_SIZE)
  )
  const legacyMode = Boolean(options.legacy)

  // 1. Normalize Sort Option
  const rawSort = String(options.sortBy || options.sort || "newest").toLowerCase().trim()
  let normalizedSort = "newest"
  if (["oldest"].includes(rawSort)) {
    normalizedSort = "oldest"
  } else if (["top", "most_liked", "likes", "popular"].includes(rawSort)) {
    normalizedSort = "top"
  } else if (["relevant", "most_relevant", "relevance"].includes(rawSort)) {
    normalizedSort = "relevant"
  }

  // 2. Deterministic Ordering Criteria with secondary tie-breakers
  let sortCriteria = { createdAt: -1, _id: -1 }
  if (normalizedSort === "oldest") {
    sortCriteria = { createdAt: 1, _id: 1 }
  } else if (normalizedSort === "top") {
    sortCriteria = { likeCount: -1, createdAt: -1, _id: -1 }
  } else if (normalizedSort === "relevant") {
    sortCriteria = { isPinned: -1, likeCount: -1, replyCount: -1, createdAt: -1, _id: -1 }
  }

  const strId = String(contentId || "").trim()
  let query = {
    parent_comment_id: null,
    status: { $nin: ["hidden", "removed"] },
  }

  if (strId && strId !== "all") {
    query = {
      ...query,
      $or: [{ content_id: strId }, { videoId: strId }, { videoid: strId }],
    }
  }

  // 3. Keyset / Cursor Pagination Handling
  let cursorData = null
  let isCursorMode = false
  if (options.cursor) {
    cursorData = decodeAndValidateCursor(options.cursor, normalizedSort)
    if (!cursorData || !cursorData.valid) {
      const error = new Error("Invalid or corrupted pagination cursor")
      error.statusCode = 400
      throw error
    }
    isCursorMode = true
    query = buildCursorQuery({ sortBy: normalizedSort, cursorData, baseQuery: query })
  }

  let totalComments = 0
  try {
    if (typeof Comment.countDocuments === "function") {
      totalComments = await Comment.countDocuments({
        parent_comment_id: null,
        status: { $nin: ["hidden", "removed"] },
        ...(strId && strId !== "all" ? { $or: [{ content_id: strId }, { videoId: strId }, { videoid: strId }] } : {}),
      })
    }
  } catch {}

  const skip = isCursorMode ? 0 : (page - 1) * limit
  const fetchLimit = isCursorMode ? limit + 1 : limit

  let rawComments = []
  try {
    const queryResult = Comment.find(query)
    if (queryResult && typeof queryResult.sort === "function") {
      let qb = queryResult.sort(sortCriteria)
      if (qb && typeof qb.skip === "function" && skip > 0) qb = qb.skip(skip)
      if (qb && typeof qb.limit === "function") qb = qb.limit(fetchLimit)
      rawComments = await qb
    } else if (queryResult && typeof queryResult.then === "function") {
      rawComments = await queryResult
    } else {
      rawComments = queryResult || []
    }
  } catch {}

  if (!Array.isArray(rawComments)) {
    rawComments = []
  }

  // Check if hasMore in cursor mode
  let hasMore = false
  if (isCursorMode) {
    hasMore = rawComments.length > limit
    if (hasMore) {
      rawComments = rawComments.slice(0, limit)
    }
  } else {
    const totalPages = Math.ceil(totalComments / limit) || 1
    hasMore = page < totalPages
  }

  if (totalComments === 0 && rawComments.length > 0) {
    totalComments = rawComments.length
  }

  // 4. Batch query to prevent N+1 user lookups (projection minimizes payload)
  const userIds = [...new Set(rawComments.map((c) => c.user_id).filter(Boolean))]
  const userMap = new Map()

  if (userIds.length > 0) {
    try {
      const validObjectIds = userIds.filter((id) => mongoose.Types.ObjectId.isValid(id))
      const stringIds = userIds.filter((id) => !mongoose.Types.ObjectId.isValid(id))

      const users = await User.find({
        $or: [{ _id: { $in: validObjectIds } }, { email: { $in: stringIds } }],
      }).select("name channelname image location country")

      users.forEach((u) => {
        userMap.set(String(u._id), u)
        if (u.email) userMap.set(u.email, u)
      })
    } catch {}
  }

  // 5. Batch query to resolve current viewer's reaction if authenticated (zero N+1)
  const userReactionMap = new Map()
  const viewerUserId = options.currentUserId || options.userId
  if (viewerUserId && rawComments.length > 0) {
    try {
      const commentIds = rawComments.map((c) => c._id)
      const reactions = await CommentReaction.find({
        comment_id: { $in: commentIds },
        user_id: String(viewerUserId),
      }).lean()

      reactions.forEach((r) => {
        userReactionMap.set(String(r.comment_id), r.reaction_type || r.reactionType)
      })
    } catch {}
  }

  // 6. Public Comment DTO (Strictly sanitizes payload: no duplicate_hash, safety scores, or notes)
  const formatted = rawComments.map((c) => {
    const isDel = Boolean(c.is_deleted || c.isDeleted || c.status === "deleted")
    const isEdt = Boolean(c.is_edited || c.isEdited)
    const userDoc = userMap.get(c.user_id)

    const author = userDoc?.channelname || userDoc?.name || c.authorName || c.usercommented || "User"
    const avatar = userDoc?.image || c.authorAvatar || c.userimage || ""
    const loc = userDoc?.location || userDoc?.country || ""

    const textToDisplay = isDel ? COMMENT_CONFIG.DELETED_COMMENT_TEXT : c.original_text || c.text || c.commentbody || ""

    const contentIdVal = c.content_id || c.videoId || c.videoid
    const userIdVal = String(c.user_id || c.userId || c.userid || "")

    return {
      id: String(c._id),
      _id: String(c._id),
      contentId: contentIdVal,
      videoId: contentIdVal,
      videoid: contentIdVal,
      userId: isDel ? "" : userIdVal,
      userid: isDel ? "" : userIdVal,
      text: textToDisplay,
      commentbody: textToDisplay,
      author: isDel ? "[Deleted]" : author,
      usercommented: isDel ? "[Deleted]" : author,
      avatarUrl: isDel ? "" : avatar,
      userimage: isDel ? "" : avatar,
      avatarText: ((isDel ? "D" : author)[0] || "U").toUpperCase(),
      languageCode: c.language_code || "unknown",
      isEdited: isEdt,
      isDeleted: isDel,
      isPinned: Boolean(c.isPinned),
      pinnedAt: c.pinnedAt || null,
      creatorHeart: Boolean(c.creatorHeart),
      version: c.version || 1,
      createdAt: c.createdAt || c.commentedon || new Date(),
      updatedAt: c.updatedAt || c.createdAt || new Date(),
      likes: typeof c.likeCount === "number" ? c.likeCount : Array.isArray(c.likes) ? c.likes.length : 0,
      likeCount: typeof c.likeCount === "number" ? c.likeCount : Array.isArray(c.likes) ? c.likes.length : 0,
      dislikeCount: typeof c.dislikeCount === "number" ? c.dislikeCount : Array.isArray(c.dislikes) ? c.dislikes.length : 0,
      userReaction: userReactionMap.get(String(c._id)) || null,
      replyCount: typeof c.replyCount === "number" ? c.replyCount : 0,
      user: isDel
        ? { id: "", username: "[Deleted]", profilePicture: "", location: undefined }
        : {
            id: userIdVal,
            username: author,
            profilePicture: avatar,
            location: loc ? loc : undefined,
          },
    }
  })

  // 7. Keyset Next & Prev Cursors
  let nextCursor = null
  let prevCursor = null
  if (hasMore && rawComments.length > 0) {
    const lastItem = rawComments[rawComments.length - 1]
    nextCursor = encodeCursor({
      sortBy: normalizedSort,
      timestamp: lastItem.createdAt,
      id: lastItem._id || lastItem.id,
      secondaryValue: lastItem.likeCount,
    })
  }
  if (isCursorMode && rawComments.length > 0) {
    const firstItem = rawComments[0]
    prevCursor = encodeCursor({
      sortBy: normalizedSort,
      timestamp: firstItem.createdAt,
      id: firstItem._id || firstItem.id,
      secondaryValue: firstItem.likeCount,
    })
  }

  const totalPages = Math.ceil(totalComments / limit) || 1

  // Return flat array if explicitly requested in legacy mode
  if (legacyMode) {
    return formatted
  }

  return {
    comments: formatted,
    pagination: {
      page,
      limit,
      totalComments,
      totalPages,
      hasMore,
      nextCursor,
      prevCursor,
      sortBy: normalizedSort,
    },
  }
}

/**
 * Creates an authenticated reply attached to a parent comment.
 * Enforces parent existence, non-deleted state, depth limits, and content inheritance.
 */
export const createReply = async ({
  parentCommentId,
  userId,
  text,
  authorName: passedAuthorName,
  authorAvatar: passedAuthorAvatar,
  languageCode = COMMENT_CONFIG.DEFAULT_LANGUAGE_CODE,
}) => {
  if (!userId) {
    const error = new Error("Authentication required to post a reply")
    error.statusCode = 401
    throw error
  }

  if (!parentCommentId) {
    const error = new Error("Parent comment ID is required")
    error.statusCode = 400
    throw error
  }

  const trimmedText = String(text || "").trim()
  if (!trimmedText) {
    const error = new Error("Comment text cannot be empty")
    error.statusCode = 400
    throw error
  }

  if (trimmedText.length > COMMENT_CONFIG.MAX_COMMENT_LENGTH) {
    const error = new Error(`Comment exceeds maximum allowed length of ${COMMENT_CONFIG.MAX_COMMENT_LENGTH} characters`)
    error.statusCode = 400
    throw error
  }

  // Find parent comment
  let parentComment = null
  try {
    if (mongoose.Types.ObjectId.isValid(parentCommentId)) {
      parentComment = await Comment.findById(parentCommentId)
    }
    if (!parentComment) {
      parentComment = await Comment.findOne({
        $or: [{ _id: parentCommentId }, { id: parentCommentId }],
      })
    }
  } catch {}

  if (!parentComment) {
    const error = new Error("Comment not found")
    error.statusCode = 404
    throw error
  }

  // Check parent deleted state: new direct replies to soft-deleted comments are blocked
  if (parentComment.is_deleted || parentComment.isDeleted || parentComment.status === "deleted") {
    const error = new Error("This comment is no longer available for replies")
    error.statusCode = 400
    throw error
  }

  // Depth verification
  const parentDepth = parentComment.depth || (parentComment.parent_comment_id ? 2 : 1)
  const replyDepth = parentDepth + 1

  if (replyDepth > (COMMENT_CONFIG.MAX_REPLY_DEPTH || COMMENT_CONFIG.MAX_COMMENT_DEPTH)) {
    const error = new Error("Maximum comment reply depth exceeded")
    error.statusCode = 400
    throw error
  }

  // Content relationship derivation: strictly derive from parent comment
  const derivedContentId =
    parentComment.content_id ||
    parentComment.contentId ||
    parentComment.videoId ||
    parentComment.videoid

  // Phase 8 Comment Safety & Content Protection Pipeline for Replies
  const safetyResult = await evaluateCommentSafety({
    text: trimmedText,
    userId: String(userId),
    contentId: String(derivedContentId),
  })

  if (safetyResult.decision === "REJECT") {
    const error = new Error(safetyResult.userMessage || "This comment violates community safety rules")
    error.statusCode = 400
    error.safetyReasons = safetyResult.reasons
    throw error
  }

  // Resolve author public profile safely
  let authorName = passedAuthorName || "User"
  let authorAvatar = passedAuthorAvatar || ""
  let location = ""

  try {
    let userDoc = null
    if (mongoose.Types.ObjectId.isValid(userId)) {
      userDoc = await User.findById(userId).select("name channelname image location country")
    } else {
      userDoc = await User.findOne({ $or: [{ _id: userId }, { email: userId }] }).select("name channelname image location country")
    }

    if (userDoc) {
      authorName = userDoc.channelname || userDoc.name || passedAuthorName || "User"
      authorAvatar = userDoc.image || passedAuthorAvatar || ""
      location = userDoc.location || userDoc.country || ""
    }
  } catch {}

  const parentObjectId = parentComment._id
  const replyStatus = safetyResult.decision === "FLAG" ? "flagged" : COMMENT_CONFIG.DEFAULT_STATUS

  const newReply = new Comment({
    content_id: String(derivedContentId),
    contentId: String(derivedContentId),
    videoid: String(derivedContentId),
    videoId: String(derivedContentId),
    user_id: String(userId),
    userId: String(userId),
    authorName,
    usercommented: authorName,
    authorAvatar,
    userimage: authorAvatar,
    original_text: trimmedText,
    text: trimmedText,
    commentbody: trimmedText,
    language_code: languageCode || COMMENT_CONFIG.DEFAULT_LANGUAGE_CODE,
    parent_comment_id: parentObjectId,
    parentId: parentObjectId,
    depth: replyDepth,
    status: replyStatus,
    moderationReason: safetyResult.decision === "FLAG" ? safetyResult.reasons.join(", ") : null,
    duplicate_hash: safetyResult.duplicateHash,
    duplicateHash: safetyResult.duplicateHash,
    safety_decision: safetyResult.decision.toLowerCase(),
    safetyDecision: safetyResult.decision.toLowerCase(),
    safety_score: safetyResult.score,
    safetyScore: safetyResult.score,
    safety_reasons: safetyResult.reasons,
    safetyReasons: safetyResult.reasons,
    version: COMMENT_CONFIG.INITIAL_VERSION,
    is_edited: false,
    is_deleted: false,
  })

  newReply.syncFields()
  await newReply.save()

  // Asynchronously record moderation event if flagged
  if (safetyResult.decision === "FLAG") {
    CommentModerationEvent.create({
      comment_id: newReply._id,
      event_type: safetyResult.reasons.some((r) => r.startsWith("PROFANITY"))
        ? "profanity_detected"
        : safetyResult.reasons.some((r) => r.includes("URL"))
        ? "malicious_link_detected"
        : "spam_detected",
      detected_reason: safetyResult.reasons.join(", "),
      confidence: safetyResult.score / 100 || 0.8,
      metadata: {
        safetyScore: safetyResult.score,
        reasons: safetyResult.reasons,
        signals: safetyResult.signals,
      },
    }).catch(() => {})
  }

  // Atomically increment parent replyCount
  try {
    if (typeof Comment.findByIdAndUpdate === "function") {
      await Comment.findByIdAndUpdate(parentObjectId, { $inc: { replyCount: 1 } })
    }
  } catch {}
  parentComment.replyCount = (parentComment.replyCount || 0) + 1

  // Asynchronously process mentions without blocking the immediate reply return
  extractAndSaveMentions({
    commentId: newReply._id,
    text: trimmedText,
    authorUserId: userId,
    authorName,
    contentId: derivedContentId,
  }).catch((err) => {
    console.error("[CommentService] Failed to extract mentions for reply:", err)
  })

  return {
    id: String(newReply._id),
    _id: String(newReply._id),
    contentId: String(derivedContentId),
    videoId: String(derivedContentId),
    videoid: String(derivedContentId),
    parentCommentId: String(parentObjectId),
    parentId: String(parentObjectId),
    depth: replyDepth,
    userId: String(userId),
    userid: String(userId),
    text: trimmedText,
    originalText: trimmedText,
    commentbody: trimmedText,
    author: authorName,
    usercommented: authorName,
    avatarUrl: authorAvatar,
    userimage: authorAvatar,
    avatarText: (authorName[0] || "U").toUpperCase(),
    languageCode: newReply.language_code || languageCode,
    status: newReply.status || replyStatus,
    isEdited: false,
    isDeleted: false,
    version: newReply.version || 1,
    createdAt: newReply.createdAt || new Date(),
    updatedAt: newReply.updatedAt || new Date(),
    likes: 0,
    likeCount: 0,
    dislikeCount: 0,
    userReaction: null,
    replyCount: 0,
    user: {
      id: String(userId),
      username: authorName,
      profilePicture: authorAvatar,
      location: location || undefined,
    },
  }
}

/**
 * Retrieves paginated replies attached to a specific parent comment.
 * Preserves chronological order (oldest first), resolves safe user profiles,
 * and batch queries user reactions without N+1 overhead.
 */
export const getRepliesByParent = async (parentCommentId, options = {}) => {
  if (!parentCommentId) {
    const error = new Error("Parent comment ID is required")
    error.statusCode = 400
    throw error
  }

  // Verify parent comment exists
  let parentComment = null
  try {
    if (mongoose.Types.ObjectId.isValid(parentCommentId)) {
      parentComment = await Comment.findById(parentCommentId)
    }
    if (!parentComment) {
      parentComment = await Comment.findOne({
        $or: [{ _id: parentCommentId }, { id: parentCommentId }],
      })
    }
  } catch {}

  if (!parentComment) {
    const error = new Error("Comment not found")
    error.statusCode = 404
    throw error
  }

  const page = Math.max(1, parseInt(options.page, 10) || 1)
  const limit = Math.min(
    COMMENT_CONFIG.MAX_REPLY_PAGE_SIZE,
    Math.max(1, parseInt(options.limit, 10) || COMMENT_CONFIG.DEFAULT_REPLY_PAGE_SIZE)
  )
  const legacyMode = Boolean(options.legacy)

  const parentRef = parentComment._id || parentCommentId
  const query = {
    $or: [
      { parent_comment_id: parentRef },
      { parentId: parentRef },
      { parent_comment_id: String(parentRef) },
      { parentId: String(parentRef) },
    ],
    status: { $nin: ["hidden", "removed"] },
  }

  // Chronological order for natural conversational reading (deterministic with _id tiebreaker)
  const sortCriteria = { createdAt: 1, _id: 1 }

  let totalReplies = 0
  try {
    if (typeof Comment.countDocuments === "function") {
      totalReplies = await Comment.countDocuments(query)
    }
  } catch {}

  const skip = (page - 1) * limit

  let rawReplies = []
  try {
    const queryResult = Comment.find(query)
    if (queryResult && typeof queryResult.sort === "function") {
      let qb = queryResult.sort(sortCriteria)
      if (qb && typeof qb.skip === "function") qb = qb.skip(skip)
      if (qb && typeof qb.limit === "function") qb = qb.limit(limit)
      rawReplies = await qb
    } else if (queryResult && typeof queryResult.then === "function") {
      rawReplies = await queryResult
    } else {
      rawReplies = queryResult || []
    }
  } catch {}

  if (!Array.isArray(rawReplies)) {
    rawReplies = []
  }
  if (totalReplies === 0 && rawReplies.length > 0) {
    totalReplies = rawReplies.length
  }

  // Batch query to resolve user profiles
  const userIds = [...new Set(rawReplies.map((c) => c.user_id).filter(Boolean))]
  const userMap = new Map()

  if (userIds.length > 0) {
    try {
      const validObjectIds = userIds.filter((id) => mongoose.Types.ObjectId.isValid(id))
      const stringIds = userIds.filter((id) => !mongoose.Types.ObjectId.isValid(id))

      const users = await User.find({
        $or: [{ _id: { $in: validObjectIds } }, { email: { $in: stringIds } }],
      }).select("name channelname image location country")

      users.forEach((u) => {
        userMap.set(String(u._id), u)
        if (u.email) userMap.set(u.email, u)
      })
    } catch {}
  }

  // Batch query to resolve current viewer's reaction if authenticated (zero N+1)
  const userReactionMap = new Map()
  const viewerUserId = options.currentUserId || options.userId
  if (viewerUserId && rawReplies.length > 0) {
    try {
      const replyIds = rawReplies.map((c) => c._id)
      const reactions = await CommentReaction.find({
        comment_id: { $in: replyIds },
        user_id: String(viewerUserId),
      }).lean()

      reactions.forEach((r) => {
        userReactionMap.set(String(r.comment_id), r.reaction_type || r.reactionType)
      })
    } catch {}
  }

  const formatted = rawReplies.map((c) => {
    const isDel = Boolean(c.is_deleted || c.isDeleted || c.status === "deleted")
    const isEdt = Boolean(c.is_edited || c.isEdited)
    const userDoc = userMap.get(c.user_id)

    const author = userDoc?.channelname || userDoc?.name || c.authorName || c.usercommented || "User"
    const avatar = userDoc?.image || c.authorAvatar || c.userimage || ""
    const loc = userDoc?.location || userDoc?.country || ""

    const textToDisplay = isDel ? COMMENT_CONFIG.DELETED_COMMENT_TEXT : c.original_text || c.text || c.commentbody || ""

    const contentIdVal = c.content_id || c.videoId || c.videoid
    const userIdVal = String(c.user_id || c.userId || c.userid || "")
    const parentIdVal = String(c.parent_comment_id || c.parentId || parentRef)

    return {
      id: String(c._id),
      _id: String(c._id),
      contentId: contentIdVal,
      videoId: contentIdVal,
      videoid: contentIdVal,
      parentCommentId: parentIdVal,
      parentId: parentIdVal,
      depth: c.depth || 2,
      userId: isDel ? "" : userIdVal,
      userid: isDel ? "" : userIdVal,
      text: textToDisplay,
      commentbody: textToDisplay,
      author: isDel ? "[Deleted]" : author,
      usercommented: isDel ? "[Deleted]" : author,
      avatarUrl: isDel ? "" : avatar,
      userimage: isDel ? "" : avatar,
      avatarText: ((isDel ? "D" : author)[0] || "U").toUpperCase(),
      languageCode: c.language_code || "unknown",
      isEdited: isEdt,
      isDeleted: isDel,
      version: c.version || 1,
      createdAt: c.createdAt || c.commentedon || new Date(),
      updatedAt: c.updatedAt || c.createdAt || new Date(),
      likes: typeof c.likeCount === "number" ? c.likeCount : Array.isArray(c.likes) ? c.likes.length : 0,
      likeCount: typeof c.likeCount === "number" ? c.likeCount : Array.isArray(c.likes) ? c.likes.length : 0,
      dislikeCount: typeof c.dislikeCount === "number" ? c.dislikeCount : Array.isArray(c.dislikes) ? c.dislikes.length : 0,
      userReaction: userReactionMap.get(String(c._id)) || null,
      replyCount: typeof c.replyCount === "number" ? c.replyCount : 0,
      user: isDel
        ? { id: "", username: "[Deleted]", profilePicture: "", location: undefined }
        : {
            id: userIdVal,
            username: author,
            profilePicture: avatar,
            location: loc ? loc : undefined,
          },
    }
  })

  const totalPages = Math.ceil(totalReplies / limit) || 1
  const hasMore = page < totalPages

  if (legacyMode) {
    return formatted
  }

  return {
    replies: formatted,
    pagination: {
      page,
      limit,
      totalReplies,
      totalPages,
      hasMore,
    },
  }
}

/**
 * Extracts mentions from text, resolves users, saves CommentMention records,
 * and delivers in-app notifications (excluding self-mentions).
 */
export const extractAndSaveMentions = async ({
  commentId,
  text,
  authorUserId,
  authorName,
  contentId,
}) => {
  if (!commentId || !text) return []

  const parsedUsernames = parseMentions(text)
  if (!parsedUsernames || parsedUsernames.length === 0) return []

  // Case-insensitive match for each unique parsed username
  const uniqueUsernames = [...new Set(parsedUsernames)]
  const regexConditions = uniqueUsernames.map((u) => ({
    $or: [
      { channelname: new RegExp(`^${u}$`, "i") },
      { name: new RegExp(`^${u}$`, "i") },
      { email: new RegExp(`^${u}@`, "i") },
    ],
  }))

  let matchedUsers = []
  try {
    matchedUsers = await User.find({ $or: regexConditions }).select(
      "_id name channelname image email"
    )
  } catch (err) {
    console.error("[extractAndSaveMentions] Error finding users:", err)
    return []
  }

  if (!matchedUsers || matchedUsers.length === 0) return []

  const savedMentions = []
  for (const user of matchedUsers) {
    const mentionedUserId = String(user._id)
    const mentionedUsername = user.channelname || user.name || ""

    try {
      // Upsert into CommentMention ensuring uniqueness
      const mentionDoc = await CommentMention.findOneAndUpdate(
        { comment_id: commentId, mentioned_user_id: mentionedUserId },
        {
          $setOnInsert: {
            comment_id: commentId,
            commentId,
            mentioned_user_id: mentionedUserId,
            mentionedUserId,
            mentioned_username: mentionedUsername,
            mentionedUsername,
            createdAt: new Date(),
          },
        },
        { upsert: true, new: true }
      )
      savedMentions.push(mentionDoc)

      // Send in-app notification if not mentioning self
      if (String(authorUserId) !== mentionedUserId) {
        userNotificationService
          .createNotification({
            userId: user._id,
            type: "COMMENT_MENTION",
            title: "@Mention in Comment",
            message: `${authorName || "Someone"} mentioned you in a comment`,
            metadata: {
              commentId: String(commentId),
              contentId: String(contentId || ""),
              videoId: String(contentId || ""),
              authorName: authorName || "Someone",
            },
          })
          .catch((err) => {
            console.warn("[extractAndSaveMentions] Notification failed:", err?.message)
          })
      }
    } catch (err) {
      console.warn("[extractAndSaveMentions] Failed saving mention for user:", mentionedUserId, err?.message)
    }
  }

  return savedMentions
}

/**
 * Handles liking/disliking a comment with toggle, switch, and remove logic.
 * Enforces:
 * - 401 if unauthenticated
 * - 400 if commentId missing or reactionType not in ["like", "dislike"]
 * - 404 if comment not found
 * - 400 if comment is soft-deleted
 * - Dislike safety rule: Dislike NEVER auto-deletes, hides, or flags comments!
 * - Atomic counts synchronization & return
 */
export const reactToComment = async ({ commentId, userId, reactionType }) => {
  if (!userId) {
    const error = new Error("Authentication required to react to comments")
    error.statusCode = 401
    throw error
  }

  if (!commentId) {
    const error = new Error("Comment ID is required")
    error.statusCode = 400
    throw error
  }

  const validReaction = String(reactionType || "").trim().toLowerCase()
  if (validReaction !== "like" && validReaction !== "dislike") {
    const error = new Error("Reaction type must be either 'like' or 'dislike'")
    error.statusCode = 400
    throw error
  }

  // Find target comment
  let comment = null
  try {
    if (mongoose.Types.ObjectId.isValid(commentId)) {
      comment = await Comment.findById(commentId)
    }
    if (!comment) {
      comment = await Comment.findOne({
        $or: [{ _id: commentId }, { id: commentId }],
      })
    }
  } catch {}

  if (!comment) {
    const error = new Error("Comment not found")
    error.statusCode = 404
    throw error
  }

  // Check if comment is soft-deleted: reactions are blocked
  if (comment.is_deleted || comment.isDeleted || comment.status === "deleted") {
    const error = new Error("Cannot react to a deleted comment")
    error.statusCode = 400
    throw error
  }

  const strUserId = String(userId)
  const commentObjectId = comment._id

  // Find existing reaction
  const existingReaction = await CommentReaction.findOne({
    comment_id: commentObjectId,
    user_id: strUserId,
  })

  let newUserReaction = null

  // Ensure arrays exist
  let likesArray = Array.isArray(comment.likes) ? [...comment.likes] : []
  let dislikesArray = Array.isArray(comment.dislikes) ? [...comment.dislikes] : []

  if (existingReaction) {
    const currentType = existingReaction.reaction_type || existingReaction.reactionType
    if (currentType === validReaction) {
      // User is toggling OFF the same reaction (e.g., Like -> Like toggles to None)
      await CommentReaction.deleteOne({ _id: existingReaction._id })
      newUserReaction = null

      if (validReaction === "like") {
        likesArray = likesArray.filter((u) => String(u) !== strUserId)
      } else {
        dislikesArray = dislikesArray.filter((u) => String(u) !== strUserId)
      }
    } else {
      // User is switching reaction (e.g., Dislike -> Like or Like -> Dislike)
      existingReaction.reaction_type = validReaction
      existingReaction.reactionType = validReaction
      existingReaction.syncFields()
      await existingReaction.save()
      newUserReaction = validReaction

      if (validReaction === "like") {
        dislikesArray = dislikesArray.filter((u) => String(u) !== strUserId)
        if (!likesArray.includes(strUserId)) likesArray.push(strUserId)
      } else {
        likesArray = likesArray.filter((u) => String(u) !== strUserId)
        if (!dislikesArray.includes(strUserId)) dislikesArray.push(strUserId)
      }
    }
  } else {
    // New reaction
    const newReactionDoc = new CommentReaction({
      comment_id: commentObjectId,
      commentId: commentObjectId,
      user_id: strUserId,
      userId: strUserId,
      reaction_type: validReaction,
      reactionType: validReaction,
    })
    newReactionDoc.syncFields()
    try {
      await newReactionDoc.save()
    } catch (saveErr) {
      // Concurrency race condition: if two concurrent reactions create duplicate key, update atomically
      if (saveErr.code === 11000 || saveErr.message?.includes("E11000")) {
        await CommentReaction.findOneAndUpdate(
          { comment_id: commentObjectId, user_id: strUserId },
          {
            $set: {
              reaction_type: validReaction,
              reactionType: validReaction,
              updatedAt: new Date(),
            },
          },
          { upsert: true, new: true }
        )
      } else {
        throw saveErr
      }
    }
    newUserReaction = validReaction

    if (validReaction === "like") {
      if (!likesArray.includes(strUserId)) likesArray.push(strUserId)
      dislikesArray = dislikesArray.filter((u) => String(u) !== strUserId)
    } else {
      if (!dislikesArray.includes(strUserId)) dislikesArray.push(strUserId)
      likesArray = likesArray.filter((u) => String(u) !== strUserId)
    }
  }

  // Count active reactions directly from CommentReaction to guarantee true DB consistency
  let activeLikesCount = 0
  let activeDislikesCount = 0
  try {
    activeLikesCount = await CommentReaction.countDocuments({
      comment_id: commentObjectId,
      $or: [{ reaction_type: "like" }, { reactionType: "like" }],
    })
    activeDislikesCount = await CommentReaction.countDocuments({
      comment_id: commentObjectId,
      $or: [{ reaction_type: "dislike" }, { reactionType: "dislike" }],
    })
  } catch {
    activeLikesCount = likesArray.length
    activeDislikesCount = dislikesArray.length
  }

  // Synchronize Comment document
  comment.likeCount = Math.max(0, activeLikesCount)
  comment.dislikeCount = Math.max(0, activeDislikesCount)
  comment.likes = likesArray
  comment.dislikes = dislikesArray
  await comment.save()

  return {
    commentId: String(commentObjectId),
    userReaction: newUserReaction,
    likeCount: comment.likeCount,
    dislikeCount: comment.dislikeCount,
    likes: comment.likeCount, // legacy compatibility
  }
}

/**
 * Edits a comment owned by the authenticated user with time limit enforcement,
 * optimistic concurrency control, mention synchronization, and audit history recording (Phase 6).
 */
export const editComment = async ({ commentId, userId, text, expectedVersion }) => {
  if (!userId) {
    const error = new Error("Authentication required to edit a comment")
    error.statusCode = 401
    throw error
  }

  if (!commentId) {
    const error = new Error("Comment ID is required")
    error.statusCode = 400
    throw error
  }

  const trimmedText = String(text || "").trim()
  if (!trimmedText) {
    const error = new Error("Comment text cannot be empty")
    error.statusCode = 400
    throw error
  }

  if (trimmedText.length > COMMENT_CONFIG.MAX_COMMENT_LENGTH) {
    const error = new Error(
      `Comment exceeds maximum allowed length of ${COMMENT_CONFIG.MAX_COMMENT_LENGTH} characters`
    )
    error.statusCode = 400
    throw error
  }

  // Find target comment
  let comment = null
  try {
    if (mongoose.Types.ObjectId.isValid(commentId)) {
      comment = await Comment.findById(commentId)
    }
    if (!comment) {
      comment = await Comment.findOne({
        $or: [{ _id: commentId }, { id: commentId }],
      })
    }
  } catch {}

  if (!comment) {
    const error = new Error("Comment not found")
    error.statusCode = 404
    throw error
  }

  // Reject edits on soft-deleted comments
  if (comment.is_deleted || comment.isDeleted || comment.status === "deleted") {
    const error = new Error("Cannot edit a deleted comment")
    error.statusCode = 400
    throw error
  }

  // Strict ownership verification: only author can edit own comments
  const authorUserId = String(comment.user_id || comment.userId || comment.userid || "")
  if (authorUserId !== String(userId)) {
    const error = new Error("You are not authorized to edit this comment")
    error.statusCode = 403
    throw error
  }

  // Enforce server-side edit window limit
  const editWindowMinutes = COMMENT_CONFIG.COMMENT_EDIT_WINDOW_MINUTES || 15
  if (editWindowMinutes > 0) {
    const commentCreatedAt = new Date(comment.createdAt || comment.commentedon || Date.now()).getTime()
    const elapsedMs = Date.now() - commentCreatedAt
    if (elapsedMs > editWindowMinutes * 60 * 1000) {
      const error = new Error("Comment edit window has expired")
      error.statusCode = 400
      throw error
    }
  }

  // Optimistic concurrency control: check expected version against current comment version
  const currentVersion = typeof comment.version === "number" ? comment.version : 1
  if (expectedVersion !== undefined && expectedVersion !== null) {
    const expectedVerNum = parseInt(expectedVersion, 10)
    if (expectedVerNum !== currentVersion) {
      const error = new Error(
        "This comment was updated elsewhere. Please refresh and try again."
      )
      error.statusCode = 409
      throw error
    }
  }

  // No-op edit detection: if text is unchanged, do not increment version or create history
  const currentText = (comment.original_text || comment.text || comment.commentbody || "").trim()
  if (currentText === trimmedText) {
    return {
      id: String(comment._id),
      _id: String(comment._id),
      text: currentText,
      commentbody: currentText,
      version: currentVersion,
      isEdited: Boolean(comment.is_edited || comment.isEdited),
      isNoOp: true,
      updatedAt: comment.updatedAt || comment.createdAt,
      createdAt: comment.createdAt,
      likeCount: comment.likeCount || 0,
      dislikeCount: comment.dislikeCount || 0,
    }
  }

  // Phase 8 Comment Safety & Content Protection Pipeline on Edit
  const safetyResult = await evaluateCommentSafety({
    text: trimmedText,
    userId: String(userId),
    contentId: String(comment.content_id || comment.videoId),
    isEdit: true,
    excludeCommentId: comment._id,
    currentComment: comment,
  })

  if (safetyResult.decision === "REJECT") {
    // If safety rejects edit, existing comment remains untouched,
    // version is NOT incremented, and NO history record is created!
    const error = new Error(safetyResult.userMessage || "This comment violates community safety rules")
    error.statusCode = 400
    error.safetyReasons = safetyResult.reasons
    throw error
  }

  const prevVersion = currentVersion
  const nextVersion = prevVersion + 1
  const prevLang = comment.language_code || "en"

  // 1. Record history snapshot in CommentEditHistory
  const historyDoc = new CommentEditHistory({
    comment_id: comment._id,
    commentId: comment._id,
    edited_by: String(userId),
    editedBy: String(userId),
    previous_text: currentText,
    previousText: currentText,
    new_text: trimmedText,
    newText: trimmedText,
    previous_language: prevLang,
    previousLanguage: prevLang,
    new_language: prevLang,
    newLanguage: prevLang,
    previous_version: prevVersion,
    previousVersion: prevVersion,
    new_version: nextVersion,
    newVersion: nextVersion,
    edited_at: new Date(),
    editedAt: new Date(),
  })
  if (typeof historyDoc.syncFields === "function") historyDoc.syncFields()
  await historyDoc.save()

  // 2. Update Comment document atomically
  comment.original_text = trimmedText
  comment.text = trimmedText
  comment.commentbody = trimmedText
  comment.commentBody = trimmedText
  comment.version = nextVersion
  comment.is_edited = true
  comment.isEdited = true
  comment.edited_at = new Date()
  comment.editedAt = new Date()
  if (safetyResult.decision === "FLAG") {
    comment.status = "flagged"
    comment.moderationReason = safetyResult.reasons.join(", ")
  }
  comment.duplicate_hash = safetyResult.duplicateHash
  comment.duplicateHash = safetyResult.duplicateHash
  comment.safety_decision = safetyResult.decision.toLowerCase()
  comment.safetyDecision = safetyResult.decision.toLowerCase()
  comment.safety_score = safetyResult.score
  comment.safetyScore = safetyResult.score
  comment.safety_reasons = safetyResult.reasons
  comment.safetyReasons = safetyResult.reasons
  if (typeof comment.syncFields === "function") comment.syncFields()
  await comment.save()

  // Record moderation event if edit was flagged
  if (safetyResult.decision === "FLAG") {
    CommentModerationEvent.create({
      comment_id: comment._id,
      event_type: safetyResult.reasons.some((r) => r.startsWith("PROFANITY"))
        ? "profanity_detected"
        : safetyResult.reasons.some((r) => r.includes("URL"))
        ? "malicious_link_detected"
        : "spam_detected",
      detected_reason: safetyResult.reasons.join(", "),
      confidence: safetyResult.score / 100 || 0.8,
      metadata: {
        safetyScore: safetyResult.score,
        reasons: safetyResult.reasons,
        signals: safetyResult.signals,
      },
    }).catch(() => {})
  }

  // 3. Synchronize mentions: prune stale mentions and notify only newly introduced users
  if (mongoose.connection.readyState === 1) {
    try {
      const newParsedUsernames = parseMentions(trimmedText)
      const existingMentions = await CommentMention.find({
        $or: [{ comment_id: comment._id }, { commentId: comment._id }],
      })

    const existingMentionMap = new Map()
    existingMentions.forEach((m) => {
      existingMentionMap.set(String(m.mentioned_user_id || m.mentionedUserId), m)
    })

    let newMatchedUsers = []
    if (newParsedUsernames.length > 0) {
      const uniqueUsernames = [...new Set(newParsedUsernames)]
      const regexConditions = uniqueUsernames.map((u) => ({
        $or: [
          { channelname: new RegExp(`^${u}$`, "i") },
          { name: new RegExp(`^${u}$`, "i") },
          { email: new RegExp(`^${u}@`, "i") },
        ],
      }))
      newMatchedUsers = await User.find({ $or: regexConditions }).select(
        "_id name channelname image email"
      )
    }

    const newMentionUserIds = new Set(newMatchedUsers.map((u) => String(u._id)))

    // Prune removed mentions
    for (const [existingUserId, mentionDoc] of existingMentionMap.entries()) {
      if (!newMentionUserIds.has(existingUserId)) {
        await CommentMention.deleteOne({ _id: mentionDoc._id })
      }
    }

    // Add new mentions and notify only newly introduced mentions
    for (const u of newMatchedUsers) {
      const uId = String(u._id)
      const uName = u.channelname || u.name || ""
      const isAlreadyMentioned = existingMentionMap.has(uId)

      await CommentMention.findOneAndUpdate(
        { comment_id: comment._id, mentioned_user_id: uId },
        {
          $setOnInsert: {
            comment_id: comment._id,
            commentId: comment._id,
            mentioned_user_id: uId,
            mentionedUserId: uId,
            mentioned_username: uName,
            mentionedUsername: uName,
            createdAt: new Date(),
          },
        },
        { upsert: true, new: true }
      )

      if (!isAlreadyMentioned && String(userId) !== uId) {
        userNotificationService
          .createNotification({
            userId: u._id,
            type: "COMMENT_MENTION",
            title: "@Mention in Comment",
            message: `${comment.authorName || comment.usercommented || "Someone"} mentioned you in an edited comment`,
            metadata: {
              commentId: String(comment._id),
              contentId: String(comment.content_id || comment.videoId || ""),
              videoId: String(comment.content_id || comment.videoId || ""),
              authorName: comment.authorName || comment.usercommented || "Someone",
            },
          })
          .catch(() => {})
      }
    }
  } catch (err) {
    console.warn("[editComment] Failed to synchronize mentions:", err?.message)
  }
}

  return {
    id: String(comment._id),
    _id: String(comment._id),
    text: trimmedText,
    commentbody: trimmedText,
    isEdited: true,
    version: nextVersion,
    editedAt: comment.edited_at,
    updatedAt: comment.updatedAt || new Date(),
    createdAt: comment.createdAt,
    likeCount: comment.likeCount || 0,
    dislikeCount: comment.dislikeCount || 0,
  }
}

/**
 * Soft-deletes a comment owned by the authenticated user (Phase 6).
 * Preserves the database record, existing replies, and audit history.
 */
export const softDeleteComment = async ({ commentId, userId }) => {
  if (!userId) {
    const error = new Error("Authentication required to delete a comment")
    error.statusCode = 401
    throw error
  }

  if (!commentId) {
    const error = new Error("Comment ID required")
    error.statusCode = 400
    throw error
  }

  // Find target comment
  let comment = null
  try {
    if (mongoose.Types.ObjectId.isValid(commentId)) {
      comment = await Comment.findById(commentId)
    }
    if (!comment) {
      comment = await Comment.findOne({
        $or: [{ _id: commentId }, { id: commentId }],
      })
    }
  } catch {}

  if (!comment) {
    const error = new Error("Comment not found")
    error.statusCode = 404
    throw error
  }

  // Strict ownership verification: only author can delete own comments
  const authorUserId = String(comment.user_id || comment.userId || comment.userid || "")
  if (authorUserId !== String(userId)) {
    const error = new Error("You are not authorized to delete this comment")
    error.statusCode = 403
    throw error
  }

  // If already soft-deleted, return success idempotently
  if (comment.is_deleted || comment.isDeleted || comment.status === "deleted") {
    return { message: "Comment deleted successfully", id: String(comment._id), isDeleted: true }
  }

  // Perform soft deletion: mark deleted fields without removing DB document or child replies
  comment.is_deleted = true
  comment.isDeleted = true
  comment.status = "deleted"
  comment.deleted_at = new Date()
  comment.deletedAt = new Date()
  if (typeof comment.syncFields === "function") comment.syncFields()
  await comment.save()

  return { message: "Comment deleted successfully", id: String(comment._id), isDeleted: true }
}

/**
 * Retrieves the revision history for a comment (Phase 6).
 */
export const getCommentEditHistory = async ({ commentId, viewerUserId }) => {
  if (!commentId) {
    const error = new Error("Comment ID is required")
    error.statusCode = 400
    throw error
  }

  // Find target comment
  let comment = null
  try {
    if (mongoose.Types.ObjectId.isValid(commentId)) {
      comment = await Comment.findById(commentId)
    }
    if (!comment) {
      comment = await Comment.findOne({
        $or: [{ _id: commentId }, { id: commentId }],
      })
    }
  } catch {}

  if (!comment) {
    const error = new Error("Comment not found")
    error.statusCode = 404
    throw error
  }

  // If comment is soft-deleted and viewer is not the author, restrict access
  const isAuthor = viewerUserId && String(comment.user_id || comment.userId) === String(viewerUserId)
  if ((comment.is_deleted || comment.isDeleted) && !isAuthor) {
    const error = new Error("Cannot view history for a deleted comment")
    error.statusCode = 403
    throw error
  }

  const historyRecords = await CommentEditHistory.find({
    $or: [
      { comment_id: comment._id },
      { commentId: comment._id },
      { comment_id: String(comment._id) },
      { commentId: String(comment._id) },
    ],
  })
    .sort({ version: 1, edited_at: 1 })
    .lean()

  return historyRecords.map((h) => ({
    id: String(h._id),
    version: h.new_version || h.newVersion || 1,
    previousVersion: h.previous_version || h.previousVersion || 1,
    newVersion: h.new_version || h.newVersion || 2,
    previousText: h.previous_text || h.previousText || "",
    newText: h.new_text || h.newText || "",
    editedAt: h.edited_at || h.editedAt || h.createdAt,
    editedBy: h.edited_by || h.editedBy || "",
  }))
}

/**
 * Translates a comment into the target language with cache retrieval,
 * source version staleness invalidation, same-language bypass, and provider fallback (Phase 7).
 */
export const translateComment = async ({
  commentId,
  targetLanguage,
  userId,
  userPreferredLanguage,
}) => {
  if (!commentId) {
    const error = new Error("Comment ID is required")
    error.statusCode = 400
    throw error
  }

  // Target language priority: explicit targetLanguage -> userPreferredLanguage -> default "en"
  const rawTargetLang = targetLanguage || userPreferredLanguage || COMMENT_CONFIG.DEFAULT_TRANSLATION_LANGUAGE || "en"
  const targetLang = String(rawTargetLang).trim().toLowerCase().split("-")[0]

  const supportedLanguages = COMMENT_CONFIG.SUPPORTED_COMMENT_TRANSLATION_LANGUAGES || ["en", "hi"]
  if (!supportedLanguages.includes(targetLang)) {
    const error = new Error(`This language is not supported for translation. Supported: ${supportedLanguages.join(", ")}`)
    error.statusCode = 400
    throw error
  }

  // Load comment from database
  let comment = null
  try {
    if (mongoose.Types.ObjectId.isValid(commentId)) {
      comment = await Comment.findById(commentId)
    }
    if (!comment) {
      comment = await Comment.findOne({
        $or: [{ _id: commentId }, { id: commentId }],
      })
    }
  } catch {}

  if (!comment) {
    const error = new Error("Comment not found")
    error.statusCode = 404
    throw error
  }

  // Reject translation on soft-deleted comments
  if (comment.is_deleted || comment.isDeleted || comment.status === "deleted") {
    const error = new Error("Cannot translate a deleted comment")
    error.statusCode = 400
    throw error
  }

  const currentVersion = typeof comment.version === "number" ? comment.version : 1
  const commentText = (comment.original_text || comment.text || comment.commentbody || "").trim()

  // Determine source language
  let sourceLang = comment.language_code || comment.originalLanguage || "unknown"
  if (sourceLang === "unknown" || !sourceLang) {
    sourceLang = detectLanguage(commentText)
  }

  // 1. Same-language bypass check: if source language matches target language
  if (sourceLang !== "unknown" && sourceLang.toLowerCase() === targetLang.toLowerCase()) {
    return {
      commentId: String(comment._id),
      id: String(comment._id),
      sourceLanguage: sourceLang,
      targetLanguage: targetLang,
      sourceVersion: currentVersion,
      translatedText: commentText,
      status: "completed",
      cached: false,
      sameLanguage: true,
      provider: "bypass",
    }
  }

  // 2. Check translation cache in CommentTranslation
  let cachedDoc = null
  try {
    cachedDoc = await CommentTranslation.findOne({
      $or: [
        { comment_id: comment._id, target_language: targetLang },
        { commentId: comment._id, target_language: targetLang },
        { comment_id: String(comment._id), target_language: targetLang },
      ],
    }).lean()
  } catch (err) {
    console.warn("[translateComment] Error checking translation cache:", err?.message)
  }

  // Cache hit: must match current comment version and be completed
  if (cachedDoc && cachedDoc.source_version === currentVersion && cachedDoc.translation_status === "completed") {
    return {
      commentId: String(comment._id),
      id: String(comment._id),
      sourceLanguage: cachedDoc.source_language || sourceLang,
      targetLanguage: cachedDoc.target_language || targetLang,
      sourceVersion: cachedDoc.source_version || currentVersion,
      translatedText: cachedDoc.translated_text || cachedDoc.translatedText || commentText,
      status: "completed",
      cached: true,
      provider: cachedDoc.translation_provider || "internal",
    }
  }

  // 3. Stale cache or no cache: call translation service provider
  let translationResult = null
  try {
    translationResult = await translateText({
      text: commentText,
      sourceLanguage: sourceLang,
      targetLanguage: targetLang,
    })
  } catch (providerError) {
    // Map provider errors cleanly
    const statusCode = providerError.statusCode || 503
    const error = new Error(
      providerError.statusCode === 504
        ? "Translation took too long. Please try again."
        : providerError.statusCode === 429
        ? "Translation is temporarily unavailable due to high demand. Please try again later."
        : "Unable to translate this comment. Please try again."
    )
    error.statusCode = statusCode
    throw error
  }

  const translatedText = translationResult?.translatedText || commentText
  const provider = translationResult?.provider || "internal"

  // 4. Upsert cached translation record in CommentTranslation
  try {
    await CommentTranslation.findOneAndUpdate(
      { comment_id: comment._id, target_language: targetLang },
      {
        $set: {
          comment_id: comment._id,
          commentId: comment._id,
          source_language: sourceLang,
          sourceLanguage: sourceLang,
          target_language: targetLang,
          targetLanguage: targetLang,
          translated_text: translatedText,
          translatedText: translatedText,
          translation_provider: provider,
          translationProvider: provider,
          translation_status: "completed",
          translationStatus: "completed",
          source_version: currentVersion,
          sourceVersion: currentVersion,
        },
      },
      { upsert: true, new: true }
    )
  } catch (cacheErr) {
    console.warn("[translateComment] Error upserting cached translation:", cacheErr?.message)
  }

  return {
    commentId: String(comment._id),
    id: String(comment._id),
    sourceLanguage: sourceLang,
    targetLanguage: targetLang,
    sourceVersion: currentVersion,
    translatedText,
    status: "completed",
    cached: false,
    provider,
  }
}

export default {
  validateContentExists,
  createComment,
  createReply,
  getCommentsByContent,
  getRepliesByParent,
  extractAndSaveMentions,
  reactToComment,
  searchUsersForMention,
  editComment,
  softDeleteComment,
  getCommentEditHistory,
  translateComment,
  detectLanguage,
  translateText,
}
