import mongoose from "mongoose"

const commentSchema = new mongoose.Schema(
  {
    // Content / Video Reference (Polymorphic & Dual-Compatible)
    content_id: {
      type: String,
      index: true,
    },
    contentId: {
      type: String,
    },
    videoid: {
      type: String,
      index: true,
    },
    videoId: {
      type: String,
      index: true,
    },

    // Author Reference
    user_id: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: String,
    },
    userid: {
      type: String,
    },
    authorName: {
      type: String,
      default: "User",
    },
    usercommented: {
      type: String,
      default: "User",
    },
    userCommented: {
      type: String,
      default: "User",
    },
    authorAvatar: {
      type: String,
      default: "",
    },
    userimage: {
      type: String,
      default: "",
    },
    userImage: {
      type: String,
      default: "",
    },

    // Content & Original Text
    original_text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    text: {
      type: String,
      default: "",
    },
    commentbody: {
      type: String,
      default: "",
    },
    commentBody: {
      type: String,
      default: "",
    },

    // Self-Referencing Parent Relationship (2-Level Hierarchy)
    parent_comment_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
      index: true,
    },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
      index: true,
    },
    depth: {
      type: Number,
      default: 1,
      min: 1,
      max: 10,
      index: true,
    },

    // Aggregate Counts & Engagements
    replyCount: {
      type: Number,
      default: 0,
    },
    likeCount: {
      type: Number,
      default: 0,
      index: true,
    },
    dislikeCount: {
      type: Number,
      default: 0,
    },
    likes: {
      type: [String],
      default: [],
    },
    dislikes: {
      type: [String],
      default: [],
    },
    isPinned: {
      type: Boolean,
      default: false,
      index: true,
    },
    pinnedAt: {
      type: Date,
      default: null,
    },
    creatorHeart: {
      type: Boolean,
      default: false,
    },

    // Multilingual Identification
    language_code: {
      type: String,
      default: "en",
      index: true,
    },
    originalLanguage: {
      type: String,
      default: "en",
    },

    // Moderation & Lifecycle State
    status: {
      type: String,
      enum: ["visible", "pending_review", "flagged", "hidden", "deleted", "removed"],
      default: "visible",
      index: true,
    },
    reportCount: {
      type: Number,
      default: 0,
    },
    moderationReason: {
      type: String,
      default: null,
    },

    // Safety & Content Protection Metadata (Phase 8)
    duplicate_hash: {
      type: String,
      default: "",
      index: true,
    },
    duplicateHash: {
      type: String,
    },
    safety_decision: {
      type: String,
      enum: ["allow", "flag", "reject"],
      default: "allow",
      index: true,
    },
    safetyDecision: {
      type: String,
    },
    safety_score: {
      type: Number,
      default: 0,
    },
    safetyScore: {
      type: Number,
    },
    safety_reasons: {
      type: [String],
      default: [],
    },
    safetyReasons: {
      type: [String],
      default: [],
    },

    // Soft Deletion
    is_deleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deleted_at: {
      type: Date,
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
    },

    // Revisions & Optimistic Concurrency Control
    is_edited: {
      type: Boolean,
      default: false,
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
    edited_at: {
      type: Date,
      default: null,
    },
    editedAt: {
      type: Date,
      default: null,
    },
    version: {
      type: Number,
      default: 1,
    },

    // Legacy Date Mirror
    commentedon: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
)

// Synchronize all dual-compatible aliases
commentSchema.methods.syncFields = function () {
  // Sync Content IDs
  const cId = this.content_id || this.contentId || this.videoid || this.videoId || ""
  if (cId) {
    this.content_id = cId
    this.contentId = cId
    this.videoid = cId
    this.videoId = cId
  }

  // Sync User IDs
  const uId = this.user_id || this.userId || this.userid || ""
  if (uId) {
    this.user_id = uId
    this.userId = uId
    this.userid = uId
  }

  // Sync Author Names
  const aName = this.authorName || this.usercommented || this.userCommented || "User"
  this.authorName = aName
  this.usercommented = aName
  this.userCommented = aName

  // Sync Author Avatars
  const aAvatar = this.authorAvatar || this.userimage || this.userImage || ""
  this.authorAvatar = aAvatar
  this.userimage = aAvatar
  this.userImage = aAvatar

  // Sync Texts
  const txt = (this.original_text || this.text || this.commentbody || this.commentBody || "").trim()
  this.original_text = txt
  this.text = txt
  this.commentbody = txt
  this.commentBody = txt

  // Sync Parent IDs
  const pId = this.parent_comment_id || this.parentId || null
  this.parent_comment_id = pId
  this.parentId = pId

  // Sync Language Codes
  const lang = this.language_code || this.originalLanguage || "en"
  this.language_code = lang
  this.originalLanguage = lang

  // Sync Soft Deletes
  const del = this.is_deleted || this.isDeleted || false
  this.is_deleted = del
  this.isDeleted = del

  const delAt = this.deleted_at || this.deletedAt || null
  this.deleted_at = delAt
  this.deletedAt = delAt

  // Sync Edited status
  const edt = this.is_edited || this.isEdited || false
  this.is_edited = edt
  this.isEdited = edt

  const edtAt = this.edited_at || this.editedAt || null
  this.edited_at = edtAt
  this.editedAt = edtAt

  // Sync Depth
  if (!this.depth || this.depth < 1) {
    this.depth = this.parent_comment_id ? 2 : 1
  }

  // Sync Reaction Counts from legacy arrays if applicable
  if (Array.isArray(this.likes) && this.likeCount === 0 && this.likes.length > 0) {
    this.likeCount = this.likes.length
  }
  if (Array.isArray(this.dislikes) && this.dislikeCount === 0 && this.dislikes.length > 0) {
    this.dislikeCount = this.dislikes.length
  }

  // Sync Safety Metadata (Phase 8)
  const dHash = this.duplicate_hash || this.duplicateHash || ""
  this.duplicate_hash = dHash
  this.duplicateHash = dHash

  const sDecision = this.safety_decision || this.safetyDecision || "allow"
  this.safety_decision = sDecision
  this.safetyDecision = sDecision

  const sScore = typeof this.safety_score === "number" ? this.safety_score : (this.safetyScore || 0)
  this.safety_score = sScore
  this.safetyScore = sScore

  const sReasons = this.safety_reasons || this.safetyReasons || []
  this.safety_reasons = sReasons
  this.safetyReasons = sReasons

  return this
}

// Pre-validate synchronization hook
commentSchema.pre("validate", function (next) {
  this.syncFields()
  if (typeof next === "function") next()
})

// Compound Indexes for high-performance sorting & retrieval (Phase 11 Keyset & Filtering)
commentSchema.index({ content_id: 1, parent_comment_id: 1, status: 1, createdAt: -1, _id: -1 })
commentSchema.index({ content_id: 1, parent_comment_id: 1, status: 1, createdAt: 1, _id: 1 })
commentSchema.index({ content_id: 1, parent_comment_id: 1, status: 1, likeCount: -1, createdAt: -1, _id: -1 })
commentSchema.index({ parent_comment_id: 1, status: 1, createdAt: 1, _id: 1 })
commentSchema.index({ videoId: 1, parentId: 1, is_deleted: 1, createdAt: -1 })
commentSchema.index({ user_id: 1, status: 1, createdAt: -1 })
commentSchema.index({ user_id: 1, duplicate_hash: 1, createdAt: -1 })

const Comment =
  mongoose.models.Comment ||
  mongoose.models.comment ||
  mongoose.model("Comment", commentSchema)

export default Comment
