import JobLock from "../../Modals/JobLock.js"
import securityAlertService from "./securityAlertService.js"
import { logger } from "../../utils/logger.js"

export class BackgroundJobMonitorService {
  /**
   * Retrieves telemetry and operational status for all registered background jobs.
   */
  async getJobHealthReport() {
    const jobs = await JobLock.find({}).sort({ updatedAt: -1 }).lean().catch(() => [])

    let healthyCount = 0
    let degradedCount = 0
    let failedCount = 0

    const enrichedJobs = jobs.map((job) => {
      const consecutiveFailures = Number(job.consecutiveFailures) || 0
      let health = "HEALTHY"

      if (consecutiveFailures >= 3 || job.lastStatus === "failed") {
        health = "FAILED"
        failedCount++
      } else if (consecutiveFailures > 0 || (job.isLocked && job.lockExpiresAt && new Date(job.lockExpiresAt) < new Date())) {
        health = "DEGRADED"
        degradedCount++
      } else {
        healthyCount++
      }

      return {
        jobName: job.jobName,
        isLocked: job.isLocked,
        lockedAt: job.lockedAt,
        lockedBy: job.lockedBy,
        lockExpiresAt: job.lockExpiresAt,
        lastRunAt: job.lastRunAt,
        lastCompletedAt: job.lastCompletedAt,
        lastStatus: job.lastStatus || "idle",
        lastError: job.lastError || null,
        consecutiveFailures,
        health,
        stats: job.stats || {},
      }
    })

    const overallStatus =
      failedCount > 0 ? "DEGRADED" : degradedCount > 0 ? "WARNING" : "HEALTHY"

    return {
      overallStatus,
      totalJobs: jobs.length,
      healthyCount,
      degradedCount,
      failedCount,
      checkedAt: new Date(),
      jobs: enrichedJobs,
    }
  }

  /**
   * Records job completion telemetry and triggers alerts on repeated failures.
   */
  async recordJobExecution(jobName, { status = "success", error = null, stats = {} }) {
    if (!jobName) return

    try {
      const lock = await JobLock.findOne({ jobName })
      if (!lock) return

      if (status === "success") {
        lock.consecutiveFailures = 0
        lock.lastStatus = "success"
        lock.lastError = null
      } else {
        lock.consecutiveFailures = (lock.consecutiveFailures || 0) + 1
        lock.lastStatus = "failed"
        lock.lastError = error ? String(error.message || error) : "Execution failed"

        if (lock.consecutiveFailures >= 3) {
          logger.error(
            `[BackgroundJobMonitor] Job '${jobName}' failed ${lock.consecutiveFailures} consecutive times: ${lock.lastError}`
          )

          await securityAlertService.dispatchAlert({
            alertType: "JOB_FAILURE_ALERT",
            title: `Background Job Failed: ${jobName}`,
            message: `Job '${jobName}' failed with error: ${lock.lastError}. Consecutive failures: ${lock.consecutiveFailures}.`,
            severity: "HIGH",
            metadata: {
              jobName,
              consecutiveFailures: lock.consecutiveFailures,
              lastError: lock.lastError,
            },
            dedupeKey: `job_fail_${jobName}`,
          }).catch(() => {})
        }
      }

      if (stats && Object.keys(stats).length > 0) {
        lock.stats = { ...(lock.stats || {}), ...stats }
      }

      await lock.save()
    } catch (err) {
      logger.warn(`[BackgroundJobMonitor] Error recording job telemetry for ${jobName}:`, err.message)
    }
  }

  /**
   * Identifies stale or orphaned locks and releases them safely.
   */
  async cleanStaleLocks(maxLockAgeMinutes = 30) {
    const cutoff = new Date(Date.now() - maxLockAgeMinutes * 60 * 1000)
    const result = await JobLock.updateMany(
      {
        isLocked: true,
        lockedAt: { $lt: cutoff },
      },
      {
        $set: {
          isLocked: false,
          lockedAt: null,
          lockedBy: null,
          lockExpiresAt: null,
          lastStatus: "failed",
          lastError: `Lock automatically cleared after ${maxLockAgeMinutes}m of inactivity`,
        },
      }
    ).catch(() => ({ modifiedCount: 0 }))

    return { clearedCount: result.modifiedCount || 0 }
  }
}

const backgroundJobMonitorService = new BackgroundJobMonitorService()
export default backgroundJobMonitorService
