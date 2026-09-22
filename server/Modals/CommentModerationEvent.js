import mongoose from "mongoose"

const commentModerationEventSchema = new mongoose.Schema(
  {
    comment_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      index: true,
      default: null,
    },
    commentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
    },
    event_type: {
      type: String,
      enum: [
        "profanity_detected",
        "spam_detected",
        "duplicate_detected",
        "malicious_link_detected",
        "flood_detected",
        "rate_limit_triggered",
        "captcha_required",
      ],
      required: true,
      index: true,
    },
    eventType: {
      type: String,
    },
    detected_reason: {
      type: String,
      default: "",
    },
    detectedReason: {
      type: String,
    },
    confidence: {
      type: Number,
      default: 1.0,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    created_at: {
      type: Date,
      default: Date.now,
      index: true,
    },
    createdAt: {
      type: Date,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
)

// Pre-validate synchronization
commentModerationEventSchema.pre("validate", function (next) {
  const cId = this.comment_id || this.commentId || null
  this.comment_id = cId
  this.commentId = cId

  const eType = this.event_type || this.eventType
  if (eType) {
    this.event_type = eType
    this.eventType = eType
  }

  const dReason = this.detected_reason || this.detectedReason || ""
  this.detected_reason = dReason
  this.detectedReason = dReason

  const cAt = this.created_at || this.createdAt || new Date()
  this.created_at = cAt
  this.createdAt = cAt

  next()
})

commentModerationEventSchema.index({ comment_id: 1, event_type: 1 })
commentModerationEventSchema.index({ event_type: 1, created_at: -1 })

const CommentModerationEvent =
  mongoose.models.CommentModerationEvent ||
  mongoose.model("CommentModerationEvent", commentModerationEventSchema)

export default CommentModerationEvent
