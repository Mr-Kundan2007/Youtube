import mongoose from "mongoose"

const meetingRecordingSchema = new mongoose.Schema(
  {
    meetingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      required: true,
      index: true,
    },
    roomId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    title: {
      type: String,
      trim: true,
      maxlength: 200,
      default: "Meeting Recording",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    creatorName: {
      type: String,
      default: "Host",
      trim: true,
    },
    filename: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    originalName: {
      type: String,
      trim: true,
    },
    storagePath: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      default: "video/webm",
      trim: true,
    },
    fileSize: {
      type: Number,
      default: 0, // In bytes
    },
    duration: {
      type: Number,
      default: 0, // In seconds
    },
    resolution: {
      type: String,
      default: "1280x720",
    },
    status: {
      type: String,
      enum: ["PROCESSING", "READY", "FAILED", "DELETED"],
      default: "PROCESSING",
      index: true,
    },
    startedAt: {
      type: Date,
    },
    endedAt: {
      type: Date,
    },
    accessPolicy: {
      type: String,
      enum: ["HOST_ONLY", "PARTICIPANTS", "PUBLIC"],
      default: "HOST_ONLY",
    },
    downloadCount: {
      type: Number,
      default: 0,
    },
    playbackCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
)

meetingRecordingSchema.index({ roomId: 1, createdAt: -1 })
meetingRecordingSchema.index({ createdBy: 1, createdAt: -1 })

const MeetingRecording =
  mongoose.models.MeetingRecording ||
  mongoose.model("MeetingRecording", meetingRecordingSchema)

export default MeetingRecording
