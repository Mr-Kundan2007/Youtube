import mongoose from "mongoose"

const securityEventSchema = new mongoose.Schema(
  {
    eventType: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: String,
      index: true,
      default: null,
    },
    meetingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      index: true,
      default: null,
    },
    roomId: {
      type: String,
      index: true,
      default: null,
    },
    targetId: {
      type: String,
      default: null,
    },
    severity: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL", "INFO", "WARN"],
      default: "LOW",
      index: true,
    },
    ip: {
      type: String,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
)

securityEventSchema.index({ roomId: 1, createdAt: -1 })
securityEventSchema.index({ eventType: 1, createdAt: -1 })

const SecurityEvent =
  mongoose.models.SecurityEvent ||
  mongoose.model("SecurityEvent", securityEventSchema)

export default SecurityEvent
