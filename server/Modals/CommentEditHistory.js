import mongoose from "mongoose"

const commentEditHistorySchema = new mongoose.Schema(
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
    edited_by: {
      type: String,
      required: true,
      index: true,
    },
    editedBy: {
      type: String,
    },
    previous_text: {
      type: String,
      required: true,
    },
    previousText: {
      type: String,
    },
    new_text: {
      type: String,
      required: true,
    },
    newText: {
      type: String,
    },
    previous_language: {
      type: String,
      default: "en",
    },
    previousLanguage: {
      type: String,
    },
    new_language: {
      type: String,
      default: "en",
    },
    newLanguage: {
      type: String,
    },
    previous_version: {
      type: Number,
      required: true,
    },
    previousVersion: {
      type: Number,
    },
    new_version: {
      type: Number,
      required: true,
    },
    newVersion: {
      type: Number,
    },
    edited_at: {
      type: Date,
      default: Date.now,
      index: true,
    },
    editedAt: {
      type: Date,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
)

// Pre-validate synchronization
commentEditHistorySchema.pre("validate", function (next) {
  const cId = this.comment_id || this.commentId
  if (cId) {
    this.comment_id = cId
    this.commentId = cId
  }

  const eBy = this.edited_by || this.editedBy
  if (eBy) {
    this.edited_by = eBy
    this.editedBy = eBy
  }

  const pTxt = this.previous_text || this.previousText || ""
  this.previous_text = pTxt
  this.previousText = pTxt

  const nTxt = this.new_text || this.newText || ""
  this.new_text = nTxt
  this.newText = nTxt

  const pLang = this.previous_language || this.previousLanguage || "en"
  this.previous_language = pLang
  this.previousLanguage = pLang

  const nLang = this.new_language || this.newLanguage || "en"
  this.new_language = nLang
  this.newLanguage = nLang

  const pVer = this.previous_version !== undefined ? this.previous_version : (this.previousVersion !== undefined ? this.previousVersion : 1)
  this.previous_version = pVer
  this.previousVersion = pVer

  const nVer = this.new_version !== undefined ? this.new_version : (this.newVersion !== undefined ? this.newVersion : 2)
  this.new_version = nVer
  this.newVersion = nVer

  const eAt = this.edited_at || this.editedAt || new Date()
  this.edited_at = eAt
  this.editedAt = eAt

  next()
})

commentEditHistorySchema.index({ comment_id: 1, edited_at: -1 })

const CommentEditHistory =
  mongoose.models.CommentEditHistory ||
  mongoose.model("CommentEditHistory", commentEditHistorySchema)

export default CommentEditHistory
