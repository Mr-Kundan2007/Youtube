import mongoose from "mongoose"

const commentReportSchema = new mongoose.Schema(
  {
    comment_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      required: true,
      index: true,
    },
    commentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
    },
    reported_by: {
      type: String,
      required: true,
      index: true,
    },
    reportedBy: {
      type: String,
    },
    reason: {
      type: String,
      enum: [
        "spam",
        "harassment",
        "offensive",
        "hateful_or_abusive",
        "malicious_link",
        "malicious_content",
        "misinformation",
        "impersonation",
        "other",
      ],
      required: true,
      index: true,
    },
    description: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "reviewing", "under_review", "resolved", "dismissed"],
      default: "pending",
      index: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "low",
      index: true,
    },
    moderator_notes: {
      type: String,
      default: "",
    },
    moderatorNotes: {
      type: String,
    },
    resolution_action: {
      type: String,
      default: null,
    },
    resolutionAction: {
      type: String,
    },
    resolved_at: {
      type: Date,
      default: null,
    },
    resolvedAt: {
      type: Date,
    },
    resolved_by: {
      type: String,
      default: null,
    },
    resolvedBy: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
)

// Pre-validate synchronization
commentReportSchema.pre("validate", function (next) {
  const cId = this.comment_id || this.commentId
  if (cId) {
    this.comment_id = cId
    this.commentId = cId
  }

  const rBy = this.reported_by || this.reportedBy
  if (rBy) {
    this.reported_by = rBy
    this.reportedBy = rBy
  }

  const mNotes = this.moderator_notes || this.moderatorNotes || ""
  this.moderator_notes = mNotes
  this.moderatorNotes = mNotes

  const rAct = this.resolution_action || this.resolutionAction || null
  this.resolution_action = rAct
  this.resolutionAction = rAct

  const resAt = this.resolved_at || this.resolvedAt || null
  this.resolved_at = resAt
  this.resolvedAt = resAt

  const resBy = this.resolved_by || this.resolvedBy || null
  this.resolved_by = resBy
  this.resolvedBy = resBy

  next()
})

// Duplicate report prevention: A user can only submit one active report per comment
commentReportSchema.index({ comment_id: 1, reported_by: 1 }, { unique: true })
commentReportSchema.index({ status: 1, priority: -1, createdAt: -1 })
commentReportSchema.index({ reason: 1, status: 1 })

const CommentReport =
  mongoose.models.CommentReport ||
  mongoose.model("CommentReport", commentReportSchema)

export default CommentReport
