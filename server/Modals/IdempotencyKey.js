import mongoose from "mongoose"

/**
 * IdempotencyKey Schema
 * Ensures idempotent processing of payment order creation, payment verification,
 * subscription activation, and webhooks without race conditions or duplicate execution.
 */
const idempotencyKeySchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["processing", "completed", "failed"],
      default: "processing",
      index: true,
    },
    requestHash: {
      type: String,
      default: null,
    },
    responsePayload: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    statusCode: {
      type: Number,
      default: 200,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // TTL index: MongoDB auto-removes documents once expiresAt is reached
    },
  },
  {
    timestamps: true,
  }
)

const IdempotencyKey =
  mongoose.models.IdempotencyKey ||
  mongoose.model("IdempotencyKey", idempotencyKeySchema)

export default IdempotencyKey
