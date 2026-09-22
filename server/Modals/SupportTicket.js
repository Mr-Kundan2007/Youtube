import mongoose from "mongoose"

const supportMessageSchema = new mongoose.Schema(
  {
    sender: {
      type: String,
      enum: ["user", "support", "system"],
      required: true,
    },
    senderName: {
      type: String,
      default: "User",
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 3000,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
)

const supportTicketSchema = new mongoose.Schema(
  {
    ticketId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    downloadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DownloadRecord",
      default: null,
      index: true,
    },
    issueType: {
      type: String,
      required: true,
      enum: [
        "DOWNLOAD_FAILED",
        "DOWNLOAD_NOT_STARTING",
        "DOWNLOAD_INTERRUPTED",
        "FILE_PROBLEM",
        "QUOTA_PROBLEM",
        "DEVICE_PROBLEM",
        "OTHER",
      ],
      index: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 3000,
    },
    status: {
      type: String,
      enum: ["OPEN", "IN_PROGRESS", "WAITING_FOR_USER", "RESOLVED", "CLOSED"],
      default: "OPEN",
      index: true,
    },
    priority: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH"],
      default: "MEDIUM",
    },
    responses: [supportMessageSchema],
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
)

// Sync userId and user_id
supportTicketSchema.pre("save", function (next) {
  if (this.userId && !this.user_id) {
    this.user_id = this.userId
  } else if (this.user_id && !this.userId) {
    this.userId = this.user_id
  }
  next()
})

supportTicketSchema.index({ userId: 1, createdAt: -1 })
supportTicketSchema.index({ status: 1, createdAt: -1 })

const SupportTicket =
  mongoose.models.SupportTicket || mongoose.model("SupportTicket", supportTicketSchema)

export default SupportTicket
