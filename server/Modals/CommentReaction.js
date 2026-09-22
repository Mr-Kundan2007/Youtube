import mongoose from "mongoose"

const commentReactionSchema = new mongoose.Schema(
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
    user_id: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: String,
    },
    reaction_type: {
      type: String,
      enum: ["like", "dislike"],
      required: true,
    },
    reactionType: {
      type: String,
      enum: ["like", "dislike"],
    },
  },
  {
    timestamps: true,
  }
)

commentReactionSchema.methods.syncFields = function () {
  const cId = this.comment_id || this.commentId
  if (cId) {
    this.comment_id = cId
    this.commentId = cId
  }

  const uId = this.user_id || this.userId
  if (uId) {
    this.user_id = uId
    this.userId = uId
  }

  const rType = this.reaction_type || this.reactionType
  if (rType) {
    this.reaction_type = rType
    this.reactionType = rType
  }

  return this
}

// Pre-validate synchronization
commentReactionSchema.pre("validate", function (next) {
  this.syncFields()
  if (typeof next === "function") next()
})

// Unique constraint: A user can only have one active reaction per comment
commentReactionSchema.index({ comment_id: 1, user_id: 1 }, { unique: true })
commentReactionSchema.index({ comment_id: 1, reaction_type: 1 })

const CommentReaction =
  mongoose.models.CommentReaction ||
  mongoose.model("CommentReaction", commentReactionSchema)

export default CommentReaction
