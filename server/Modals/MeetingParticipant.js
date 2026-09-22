import mongoose from "mongoose"

const meetingParticipantSchema = new mongoose.Schema(
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
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    providerParticipantId: {
      type: String,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    image: {
      type: String,
      default: "",
    },
    role: {
      type: String,
      enum: ["HOST", "CO_HOST", "PARTICIPANT"],
      default: "PARTICIPANT",
    },
    status: {
      type: String,
      enum: [
        "WAITING",
        "JOINED",
        "LEFT",
        "REMOVED",
        "connected",
        "disconnected",
        "kicked",
      ],
      default: "JOINED",
      index: true,
    },
    isMuted: {
      type: Boolean,
      default: false,
    },
    cameraEnabled: {
      type: Boolean,
      default: true,
    },
    connectionState: {
      type: String,
      enum: ["idle", "connecting", "connected", "reconnecting", "disconnected"],
      default: "idle",
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    leftAt: {
      type: Date,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
    isRemoved: {
      type: Boolean,
      default: false,
      index: true,
    },
    removedAt: {
      type: Date,
    },
    removedBy: {
      type: String,
    },
    isHandRaised: {
      type: Boolean,
      default: false,
      index: true,
    },
    handRaisedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
)

const MeetingParticipant =
  mongoose.models.MeetingParticipant ||
  mongoose.model("MeetingParticipant", meetingParticipantSchema)

export default MeetingParticipant
