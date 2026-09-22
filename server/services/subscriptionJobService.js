import JobLock from "../Modals/JobLock.js"
import subscriptionLifecycleService from "./subscriptionLifecycleService.js"
import backgroundJobMonitorService from "../security/services/backgroundJobMonitorService.js"
import { logger } from "../utils/logger.js"
import crypto from "crypto"

export class SubscriptionJobService {
  constructor() {
    this.jobName = "subscription_lifecycle_sweep"
    this.instanceId = `worker_${process.pid}_${crypto.randomBytes(4).toString("hex")}`
    this.timer = null
    this.isShuttingDown = false
    this.lockTtlMs = 10 * 60 * 1000 // 10 minutes lock timeout
  }

  /**
   * Attempts to acquire an atomic lock in MongoDB for the lifecycle job.
   */
  async acquireLock() {
    const now = new Date()
    const lockExpiresAt = new Date(now.getTime() + this.lockTtlMs)

    // Ensure job lock document exists first
    await JobLock.updateOne(
      { jobName: this.jobName },
      {
        $setOnInsert: {
          jobName: this.jobName,
          isLocked: false,
          lastStatus: "idle",
        },
      },
      { upsert: true }
    )

    // Atomic conditional lock acquisition without upsert to prevent E11000 collision
    const lock = await JobLock.findOneAndUpdate(
      {
        jobName: this.jobName,
        $or: [
          { isLocked: false },
          { lockExpiresAt: { $lt: now } },
          { lockExpiresAt: null },
        ],
      },
      {
        $set: {
          isLocked: true,
          lockedAt: now,
          lockedBy: this.instanceId,
          lockExpiresAt,
          lastStatus: "running",
          lastRunAt: now,
        },
      },
      {
        new: true,
      }
    )

    // Verify this instance actually owns the lock
    return Boolean(lock && lock.lockedBy === this.instanceId)
  }

  /**
   * Releases the atomic lock upon job completion or failure.
   */
  async releaseLock(status = "success", error = null, stats = {}) {
    const now = new Date()
    await JobLock.findOneAndUpdate(
      {
        jobName: this.jobName,
        lockedBy: this.instanceId,
      },
      {
        $set: {
          isLocked: false,
          lockedBy: null,
          lockExpiresAt: null,
          lastCompletedAt: now,
          lastStatus: status,
          lastError: error ? (error.message || String(error)) : null,
          stats,
        },
        $inc: {
          consecutiveFailures: status === "failed" ? 1 : 0,
        },
      }
    ).catch((err) => logger.error("Failed to release JobLock:", err.message))

    // Record job telemetry for health monitoring & alerts
    backgroundJobMonitorService
      .recordJobExecution(this.jobName, {
        status,
        error,
        stats,
      })
      .catch(() => {})
  }

  /**
   * Runs the subscription lifecycle job with concurrency locking and failure recovery.
   *
   * @param {object} options
   * @param {boolean} options.force - If true, bypasses lock acquisition (for manual admin testing)
   */
  async runLifecycleJob({ force = false, gracePeriodDays = 0, reminderDays = [7, 3, 1, 0] } = {}) {
    if (!force) {
      const acquired = await this.acquireLock()
      if (!acquired) {
        logger.info(`[SubscriptionJob] Job "${this.jobName}" is currently locked by another worker. Skipping run.`)
        return {
          skipped: true,
          reason: "JOB_LOCKED",
          instanceId: this.instanceId,
        }
      }
    }

    logger.info(`[SubscriptionJob] Starting subscription lifecycle sweep (Instance: ${this.instanceId})...`)
    const startTime = Date.now()

    try {
      const stats = await subscriptionLifecycleService.processSubscriptionLifecycle({
        gracePeriodDays,
        reminderDays,
      })

      const durationMs = Date.now() - startTime
      const executionStats = {
        ...stats,
        durationMs,
        executedAt: new Date(),
      }

      logger.info(`[SubscriptionJob] Lifecycle sweep completed in ${durationMs}ms: ${JSON.stringify(stats)}`)

      if (!force) {
        await this.releaseLock("success", null, executionStats)
      }

      return {
        success: true,
        stats: executionStats,
        instanceId: this.instanceId,
      }
    } catch (err) {
      logger.error(`[SubscriptionJob] Lifecycle sweep failed: ${err.message}`, err)
      if (!force) {
        await this.releaseLock("failed", err)
      }
      return {
        success: false,
        error: err.message,
        instanceId: this.instanceId,
      }
    }
  }

  /**
   * Starts recurring background scheduler.
   */
  startScheduler(intervalMs = 60 * 60 * 1000) { // Default: Every hour
    if (this.timer) return

    logger.info(`[SubscriptionJob] Initializing recurring lifecycle scheduler (Interval: ${intervalMs}ms)`)

    // Run initial sweep after 10 seconds to warm up
    setTimeout(() => {
      this.runLifecycleJob().catch((err) => logger.error("Error in initial lifecycle run:", err))
    }, 10000).unref()

    this.timer = setInterval(() => {
      if (this.isShuttingDown) return
      this.runLifecycleJob().catch((err) => logger.error("Error in recurring lifecycle run:", err))
    }, intervalMs)

    this.timer.unref()
  }

  /**
   * Graceful stop for test tear-downs or server shutdown.
   */
  stopScheduler() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.isShuttingDown = true
  }

  /**
   * Retrieves current job status and metrics for admin monitoring.
   */
  async getJobStatus() {
    const lock = await JobLock.findOne({ jobName: this.jobName }).lean()
    return {
      jobName: this.jobName,
      isLocked: lock?.isLocked || false,
      lastRunAt: lock?.lastRunAt || null,
      lastCompletedAt: lock?.lastCompletedAt || null,
      lastStatus: lock?.lastStatus || "idle",
      lastError: lock?.lastError || null,
      consecutiveFailures: lock?.consecutiveFailures || 0,
      stats: lock?.stats || {},
    }
  }
}

export const subscriptionJobService = new SubscriptionJobService()
export default subscriptionJobService
