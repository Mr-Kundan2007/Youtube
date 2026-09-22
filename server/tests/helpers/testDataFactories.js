import mongoose from "mongoose"
import User from "../../Modals/Auth.js"
import Subscription from "../../Modals/Subscription.js"
import PaymentTransaction from "../../Modals/PaymentTransaction.js"
import Invoice from "../../Modals/Invoice.js"
import SubscriptionSecurityEvent from "../../Modals/SubscriptionSecurityEvent.js"
import JobLock from "../../Modals/JobLock.js"
import Comment from "../../Modals/comment.js"
import CommentReaction from "../../Modals/CommentReaction.js"
import CommentReport from "../../Modals/CommentReport.js"
import CommentTranslation from "../../Modals/CommentTranslation.js"
import CommentEditHistory from "../../Modals/CommentEditHistory.js"
import { PLAN_CONFIGURATIONS } from "../../config/subscriptionConfig.js"

/**
 * Creates a unique test user in MongoDB.
 */
export const createTestUser = async ({
  role = "user",
  email = null,
  name = "Test Subscriber",
  status = "active",
} = {}) => {
  const uniqueId = new mongoose.Types.ObjectId()
  const randomEmail = email || `user_${Date.now()}_${Math.floor(Math.random() * 10000)}@test.com`

  const user = await User.create({
    _id: uniqueId,
    name,
    email: randomEmail,
    role,
    status,
  })

  return user
}

/**
 * Creates an administrative test user.
 */
export const createTestAdmin = async (overrides = {}) => {
  return createTestUser({
    role: "admin",
    name: "Test Admin",
    email: `admin_${Date.now()}_${Math.floor(Math.random() * 10000)}@test.com`,
    ...overrides,
  })
}

/**
 * Creates an authoritative subscription record for testing.
 */
export const createTestSubscription = async ({
  userId,
  plan = "free",
  status = "active",
  startDate = new Date(),
  expiresAt = null,
  billingCycle = "monthly",
} = {}) => {
  if (!userId) throw new Error("createTestSubscription requires a valid userId")

  const config = PLAN_CONFIGURATIONS[plan.toLowerCase()] || {}

  let calculatedExpiry = expiresAt
  if (plan !== "free" && !calculatedExpiry) {
    calculatedExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  }

  const sub = await Subscription.create({
    userId,
    user_id: userId,
    plan: plan.toLowerCase(),
    status,
    startDate,
    endDate: calculatedExpiry,
    expiresAt: calculatedExpiry,
    expiryDate: calculatedExpiry,
    billingCycle,
    download_limit: config.dailyDownloads ?? config.downloadLimit ?? 1,
    download_quota_type: config.downloadQuotaType || "daily",
    download_enabled: config.downloadEnabled !== false,
  })

  return sub
}

/**
 * Creates a test payment transaction.
 */
export const createTestPayment = async ({
  userId,
  orderId = null,
  paymentId = null,
  amount = 49900,
  currency = "INR",
  planKey = "silver",
  billingCycle = "monthly",
  status = "success",
  actionType = "new_subscription",
} = {}) => {
  if (!userId) throw new Error("createTestPayment requires a valid userId")

  const ordId = orderId || `order_${Date.now()}_${Math.floor(Math.random() * 10000)}`
  const payId = paymentId || (status === "success" ? `pay_${Date.now()}_${Math.floor(Math.random() * 10000)}` : null)
  const internalTxId = `PAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`

  const tx = await PaymentTransaction.create({
    userId,
    orderId: ordId,
    paymentId: payId,
    internalTransactionId: internalTxId,
    amount,
    currency,
    planKey,
    billingCycle,
    status,
    actionType,
    signatureVerified: status === "success",
    paymentVerifiedAt: status === "success" ? new Date() : null,
  })

  return tx
}

/**
 * Creates a test invoice.
 */
export const createTestInvoice = async ({
  userId,
  transactionId,
  orderId,
  planName = "Silver",
  amountPaid = 499,
  currency = "INR",
  status = "paid",
} = {}) => {
  const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, "")
  const randomSuffix = Math.floor(100000 + Math.random() * 900000).toString(16).toUpperCase()
  const invoiceNumber = `INV-${todayStr}-${randomSuffix}`

  const invoice = await Invoice.create({
    invoiceNumber,
    userId,
    transactionId,
    orderId: orderId || `ord_${Date.now()}`,
    planName,
    amountPaid,
    subtotal: Math.round((amountPaid / 1.18) * 100) / 100,
    taxAmount: Math.round((amountPaid - amountPaid / 1.18) * 100) / 100,
    cgst: Math.round(((amountPaid - amountPaid / 1.18) / 2) * 100) / 100,
    sgst: Math.round(((amountPaid - amountPaid / 1.18) / 2) * 100) / 100,
    currency,
    status,
  })

  return invoice
}

/**
 * Creates a test security event.
 */
export const createTestSecurityEvent = async ({
  eventType = "PAYMENT_ANOMALY_DETECTED",
  severity = "MEDIUM",
  riskScore = 40,
  userId = null,
  orderId = null,
  safeMetadata = {},
} = {}) => {
  const event = await SubscriptionSecurityEvent.create({
    eventType,
    severity,
    riskScore,
    userId,
    orderId,
    safeMetadata,
    status: "OPEN",
  })

  return event
}

/**
 * Creates a test background job lock.
 */
export const createTestJobLock = async ({
  jobName,
  isLocked = false,
  consecutiveFailures = 0,
  lastStatus = "idle",
  lockedAt = null,
} = {}) => {
  const name = jobName || `job_${Date.now()}_${Math.floor(Math.random() * 1000)}`
  const lock = await JobLock.create({
    jobName: name,
    isLocked,
    consecutiveFailures,
    lastStatus,
    lockedAt,
  })

  return lock
}

/**
 * Creates a test top-level comment.
 */
export const createTestComment = async ({
  contentId = "test_video_123",
  userId,
  text = "Test comment text",
  authorName = "Test User",
  authorAvatar = "",
  languageCode = "en",
  status = "visible",
  isPinned = false,
  likeCount = 0,
  replyCount = 0,
  version = 1,
} = {}) => {
  const uid = userId || new mongoose.Types.ObjectId()
  const comment = await Comment.create({
    content_id: String(contentId),
    contentId: String(contentId),
    videoId: String(contentId),
    videoid: String(contentId),
    user_id: String(uid),
    userId: String(uid),
    authorName,
    usercommented: authorName,
    authorAvatar,
    userimage: authorAvatar,
    original_text: text,
    text,
    commentbody: text,
    language_code: languageCode,
    status,
    isPinned,
    likeCount,
    replyCount,
    version,
    depth: 1,
  })
  return comment
}

/**
 * Creates a test threaded reply.
 */
export const createTestReply = async ({
  parentCommentId,
  contentId = "test_video_123",
  userId,
  text = "Test reply text",
  authorName = "Test Replier",
  depth = 2,
  languageCode = "en",
  status = "visible",
} = {}) => {
  if (!parentCommentId) throw new Error("createTestReply requires parentCommentId")
  const uid = userId || new mongoose.Types.ObjectId()
  const reply = await Comment.create({
    content_id: String(contentId),
    contentId: String(contentId),
    videoId: String(contentId),
    videoid: String(contentId),
    parent_comment_id: parentCommentId,
    parentId: parentCommentId,
    user_id: String(uid),
    userId: String(uid),
    authorName,
    usercommented: authorName,
    original_text: text,
    text,
    commentbody: text,
    depth,
    language_code: languageCode,
    status,
    version: 1,
  })
  return reply
}

/**
 * Creates a test comment reaction.
 */
export const createTestReaction = async ({
  commentId,
  userId,
  reactionType = "like",
} = {}) => {
  if (!commentId || !userId) throw new Error("createTestReaction requires commentId and userId")
  const reaction = await CommentReaction.create({
    comment_id: commentId,
    commentId,
    user_id: String(userId),
    userId: String(userId),
    reaction_type: reactionType,
    reactionType,
  })
  return reaction
}

/**
 * Creates a test comment report.
 */
export const createTestReport = async ({
  commentId,
  reporterUserId,
  reason = "spam",
  description = "Test spam report",
  status = "pending",
  priority = "medium",
} = {}) => {
  if (!commentId || !reporterUserId) throw new Error("createTestReport requires commentId and reporterUserId")
  const report = await CommentReport.create({
    comment_id: commentId,
    commentId,
    reported_by_user_id: String(reporterUserId),
    reporterUserId: String(reporterUserId),
    reason: String(reason).toLowerCase(),
    description,
    status,
    priority,
  })
  return report
}

/**
 * Creates a test comment translation.
 */
export const createTestTranslation = async ({
  commentId,
  sourceLanguage = "en",
  targetLanguage = "hi",
  sourceVersion = 1,
  translatedText = "अनुवादित टिप्पणी",
  provider = "internal",
  status = "completed",
} = {}) => {
  if (!commentId) throw new Error("createTestTranslation requires commentId")
  const translation = await CommentTranslation.create({
    comment_id: commentId,
    commentId,
    source_language: sourceLanguage,
    sourceLanguage,
    target_language: targetLanguage,
    targetLanguage,
    source_version: sourceVersion,
    sourceVersion,
    translated_text: translatedText,
    translatedText,
    provider,
    status,
  })
  return translation
}

export default {
  createTestUser,
  createTestAdmin,
  createTestSubscription,
  createTestPayment,
  createTestInvoice,
  createTestSecurityEvent,
  createTestJobLock,
  createTestComment,
  createTestReply,
  createTestReaction,
  createTestReport,
  createTestTranslation,
}

