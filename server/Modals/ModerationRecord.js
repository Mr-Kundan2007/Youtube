import mongoose from "mongoose"

const moderationRecordSchema = new mongoose.Schema(
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
    report_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CommentReport",
      default: null,
      index: true,
    },
    reportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CommentReport",
    },
    moderator_id: {
      type: String,
      required: true,
      index: true,
    },
    moderatorId: {
      type: String,
    },
    action: {
      type: String,
      enum: ["flag", "approve", "hide", "remove", "restore", "dismiss_report", "delete", "resolve"],
      required: true,
    },
    reason: {
      type: String,
      required: true,
    },
    previous_status: {
      type: String,
      default: "visible",
    },
    previousStatus: {
      type: String,
    },
    new_status: {
      type: String,
      default: "visible",
    },
    newStatus: {
      type: String,
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
moderationRecordSchema.pre("validate", function (next) {
  const cId = this.comment_id || this.commentId
  if (cId) {
    this.comment_id = cId
    this.commentId = cId
  }

  const rId = this.report_id || this.reportId || null
  this.report_id = rId
  this.reportId = rId

  const mId = this.moderator_id || this.moderatorId
  if (mId) {
    this.moderator_id = mId
    this.moderatorId = mId
  }

  const pStatus = this.previous_status || this.previousStatus || "visible"
  this.previous_status = pStatus
  this.previousStatus = pStatus

  const nStatus = this.new_status || this.newStatus || "visible"
  this.new_status = nStatus
  this.newStatus = nStatus

  const cAt = this.created_at || this.createdAt || new Date()
  this.created_at = cAt
  this.createdAt = cAt

  next()
})

moderationRecordSchema.index({ comment_id: 1, created_at: -1 })
moderationRecordSchema.index({ moderator_id: 1, created_at: -1 })
moderationRecordSchema.index({ report_id: 1, created_at: -1 })

const ModerationRecord =
  mongoose.models.ModerationRecord ||
  mongoose.model("ModerationRecord", moderationRecordSchema)

export default ModerationRecord
