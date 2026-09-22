import mongoose from "mongoose"

const commentMentionSchema = new mongoose.Schema(
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
    mentioned_user_id: {
      type: String,
      required: true,
      index: true,
    },
    mentionedUserId: {
      type: String,
    },
    mentioned_username: {
      type: String,
      default: "",
    },
    mentionedUsername: {
      type: String,
      default: "",
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
)

// Pre-validate synchronization
commentMentionSchema.pre("validate", function (next) {
  const cId = this.comment_id || this.commentId
  if (cId) {
    this.comment_id = cId
    this.commentId = cId
  }

  const uId = this.mentioned_user_id || this.mentionedUserId
  if (uId) {
    this.mentioned_user_id = uId
    this.mentionedUserId = uId
  }

  const uName = this.mentioned_username || this.mentionedUsername || ""
  this.mentioned_username = uName
  this.mentionedUsername = uName

  next()
})

// Unique constraint: Prevent duplicate mention records for the same user in a comment
commentMentionSchema.index({ comment_id: 1, mentioned_user_id: 1 }, { unique: true })

const CommentMention =
  mongoose.models.CommentMention ||
  mongoose.model("CommentMention", commentMentionSchema)

export default CommentMention
