import mongoose from "mongoose"

const meetingChatMessageSchema = new mongoose.Schema(
  {
    meetingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      index: true,
    },
    roomId: {
      type: String,
      required: true,
      index: true,
    },
    messageType: {
      type: String,
      enum: ["TEXT", "FILE", "SYSTEM"],
      default: "TEXT",
      index: true,
    },
    senderId: {
      type: String,
      required: true,
      index: true,
    },
    senderName: {
      type: String,
      required: true,
      trim: true,
    },
    senderImage: {
      type: String,
      default: "",
    },
    text: {
      type: String,
      default: "",
      maxlength: 2000,
    },
    attachment: {
      filename: { type: String },
      originalName: { type: String },
      fileUrl: { type: String },
      filesize: { type: Number },
      filetype: { type: String },
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

const MeetingChatMessage =
  mongoose.models.MeetingChatMessage ||
  mongoose.model("MeetingChatMessage", meetingChatMessageSchema)

export default MeetingChatMessage
