import mongoose from "mongoose"

/**
 * JobLock Schema
 * Provides atomic distributed locking and execution health tracking for background jobs,
 * preventing race conditions, multi-instance concurrency collisions, and deadlocks.
 */
const jobLockSchema = new mongoose.Schema(
  {
    jobName: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    isLocked: {
      type: Boolean,
      default: false,
      index: true,
    },
    lockedAt: {
      type: Date,
      default: null,
    },
    lockedBy: {
      type: String,
      default: null,
    },
    lockExpiresAt: {
      type: Date,
      default: null,
    },
    lastRunAt: {
      type: Date,
      default: null,
    },
    lastCompletedAt: {
      type: Date,
      default: null,
    },
    lastStatus: {
      type: String,
      enum: ["success", "failed", "running", "idle"],
      default: "idle",
    },
    lastError: {
      type: String,
      default: null,
    },
    stats: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    consecutiveFailures: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
)

const JobLock = mongoose.models.JobLock || mongoose.model("JobLock", jobLockSchema)

export default JobLock
