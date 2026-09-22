import mongoose from "mongoose"

const meetingSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    title: {
      type: String,
      default: "Quick Meeting",
      trim: true,
      maxlength: 120,
    },
    hostId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    hostName: {
      type: String,
      required: true,
      trim: true,
    },
    coHosts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    status: {
      type: String,
      enum: [
        "SCHEDULED",
        "WAITING",
        "LIVE",
        "ENDED",
        "CANCELLED",
        "scheduled",
        "active",
        "ended",
      ],
      default: "LIVE",
      index: true,
    },
    isLocked: {
      type: Boolean,
      default: false,
    },
    accessPolicy: {
      type: String,
      enum: ["LINK_ACCESS", "AUTHENTICATED_ONLY", "INVITE_ONLY", "HOST_APPROVAL"],
      default: "LINK_ACCESS",
    },
    bannedParticipants: {
      type: [String],
      default: [],
    },
    maxParticipants: {
      type: Number,
      default: 25,
      min: 2,
      max: 100,
    },
    permissions: {
      allowChat: { type: Boolean, default: true },
      allowScreenShare: { type: Boolean, default: true },
      allowFileSharing: { type: Boolean, default: true },
      allowCamera: { type: Boolean, default: true },
      allowMicrophone: { type: Boolean, default: true },
      allowRecording: { type: Boolean, default: true },
    },
    securityMode: {
      type: String,
      enum: ["STANDARD", "E2EE"],
      default: "STANDARD",
    },
    e2eeKeyVersion: {
      type: Number,
      default: 1,
    },
    scheduledStartAt: {
      type: Date,
    },
    scheduledEndAt: {
      type: Date,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    endedAt: {
      type: Date,
    },
    recording: {
      enabled: { type: Boolean, default: false },
      status: {
        type: String,
        enum: ["idle", "recording", "processing", "completed", "failed"],
        default: "idle",
      },
      activeRecordingId: { type: mongoose.Schema.Types.ObjectId, ref: "MeetingRecording" },
      fileUrl: { type: String, default: "" },
      startedAt: { type: Date },
      endedAt: { type: Date },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
)

meetingSchema.virtual("publicRoomId").get(function () {
  return this.roomId
})

const Meeting =
  mongoose.models.Meeting || mongoose.model("Meeting", meetingSchema)

export default Meeting

