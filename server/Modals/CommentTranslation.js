import mongoose from "mongoose"

const commentTranslationSchema = new mongoose.Schema(
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
    source_language: {
      type: String,
      required: true,
    },
    sourceLanguage: {
      type: String,
    },
    target_language: {
      type: String,
      required: true,
      index: true,
    },
    targetLanguage: {
      type: String,
    },
    translated_text: {
      type: String,
      required: true,
    },
    translatedText: {
      type: String,
    },
    translation_provider: {
      type: String,
      default: "internal",
    },
    translationProvider: {
      type: String,
      default: "internal",
    },
    translation_status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "completed",
    },
    translationStatus: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "completed",
    },
    // Source version tracking for translation cache staleness
    source_version: {
      type: Number,
      required: true,
      default: 1,
    },
    sourceVersion: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
  }
)

// Pre-validate synchronization
commentTranslationSchema.pre("validate", function (next) {
  const cId = this.comment_id || this.commentId
  if (cId) {
    this.comment_id = cId
    this.commentId = cId
  }

  const sLang = this.source_language || this.sourceLanguage || "en"
  this.source_language = sLang
  this.sourceLanguage = sLang

  const tLang = this.target_language || this.targetLanguage || "en"
  this.target_language = tLang
  this.targetLanguage = tLang

  const tTxt = this.translated_text || this.translatedText || ""
  this.translated_text = tTxt
  this.translatedText = tTxt

  const sVer = this.source_version !== undefined ? this.source_version : (this.sourceVersion !== undefined ? this.sourceVersion : 1)
  this.source_version = sVer
  this.sourceVersion = sVer

  const tProv = this.translation_provider || this.translationProvider || "internal"
  this.translation_provider = tProv
  this.translationProvider = tProv

  const tStat = this.translation_status || this.translationStatus || "completed"
  this.translation_status = tStat
  this.translationStatus = tStat

  next()
})

// Unique constraint per comment and target language
commentTranslationSchema.index({ comment_id: 1, target_language: 1 }, { unique: true })
commentTranslationSchema.index({ comment_id: 1, target_language: 1, source_version: 1 })

const CommentTranslation =
  mongoose.models.CommentTranslation ||
  mongoose.model("CommentTranslation", commentTranslationSchema)

export default CommentTranslation
