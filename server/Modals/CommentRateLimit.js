import mongoose from "mongoose"

const commentRateLimitSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    identifier_type: {
      type: String,
      enum: ["user", "ip"],
      default: "user",
      index: true,
    },
    identifierType: {
      type: String,
    },
    identifier_value: {
      type: String,
      required: true,
      index: true,
    },
    identifierValue: {
      type: String,
    },
    timestamps: {
      type: [Date],
      default: [],
    },
    violation_count: {
      type: Number,
      default: 0,
    },
    violationCount: {
      type: Number,
    },
    risk_score: {
      type: Number,
      default: 0,
    },
    riskScore: {
      type: Number,
    },
    captcha_required: {
      type: Boolean,
      default: false,
      index: true,
    },
    captchaRequired: {
      type: Boolean,
    },
    captcha_unlocked_until: {
      type: Date,
      default: null,
    },
    captchaUnlockedUntil: {
      type: Date,
    },
    last_violation_at: {
      type: Date,
      default: null,
    },
    lastViolationAt: {
      type: Date,
    },
    expires_at: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 },
    },
    expiresAt: {
      type: Date,
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
    createdAt: {
      type: Date,
    },
    updated_at: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
)

// Pre-validate synchronization for camelCase / snake_case parity
commentRateLimitSchema.pre("validate", function (next) {
  const iType = this.identifier_type || this.identifierType || "user"
  this.identifier_type = iType
  this.identifierType = iType

  const iVal = this.identifier_value || this.identifierValue || ""
  this.identifier_value = iVal
  this.identifierValue = iVal

  const vCount = this.violation_count ?? this.violationCount ?? 0
  this.violation_count = vCount
  this.violationCount = vCount

  const rScore = this.risk_score ?? this.riskScore ?? 0
  this.risk_score = rScore
  this.riskScore = rScore

  const cReq = this.captcha_required ?? this.captchaRequired ?? false
  this.captcha_required = cReq
  this.captchaRequired = cReq

  const cUnlock = this.captcha_unlocked_until || this.captchaUnlockedUntil || null
  this.captcha_unlocked_until = cUnlock
  this.captchaUnlockedUntil = cUnlock

  const lVio = this.last_violation_at || this.lastViolationAt || null
  this.last_violation_at = lVio
  this.lastViolationAt = lVio

  const expAt = this.expires_at || this.expiresAt || new Date(Date.now() + 3600 * 1000)
  this.expires_at = expAt
  this.expiresAt = expAt

  next()
})

commentRateLimitSchema.index({ identifier_value: 1, action: 1 })
commentRateLimitSchema.index({ captcha_required: 1, updated_at: -1 })

const CommentRateLimit =
  mongoose.models.CommentRateLimit ||
  mongoose.model("CommentRateLimit", commentRateLimitSchema)

export default CommentRateLimit
