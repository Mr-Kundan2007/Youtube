import mongoose from "mongoose"
import { assertTestEnvironmentSafety } from "./testEnv.js"

const DB_URI =
  process.env.DB_URL ||
  "mongodb+srv://kundank82522_db_user:kZPAyo7MflLEh3UW@cluster0.oeaqyqq.mongodb.net/youtube_test?retryWrites=true&w=majority&appName=Cluster0"

/**
 * Connects to MongoDB in test mode with environment safety checks.
 */
export const connectTestDb = async () => {
  assertTestEnvironmentSafety()

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection
  }

  await mongoose.connect(DB_URI, { serverSelectionTimeoutMS: 2500 })
  return mongoose.connection
}

/**
 * Gracefully closes test database connection.
 */
export const disconnectTestDb = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect().catch(() => {})
  }
}

/**
 * Purges only documents explicitly tagged with test identifiers, protecting historical data.
 */
export const cleanTestFixtures = async ({ userIds = [], orderIds = [], jobNames = [] } = {}) => {
  assertTestEnvironmentSafety()

  const models = mongoose.models
  const promises = []

  if (userIds.length > 0) {
    if (models.User) promises.push(models.User.deleteMany({ _id: { $in: userIds } }))
    if (models.Subscription) promises.push(models.Subscription.deleteMany({ userId: { $in: userIds } }))
    if (models.SubscriptionHistory) promises.push(models.SubscriptionHistory.deleteMany({ userId: { $in: userIds } }))
    if (models.PaymentTransaction) promises.push(models.PaymentTransaction.deleteMany({ userId: { $in: userIds } }))
    if (models.Invoice) promises.push(models.Invoice.deleteMany({ userId: { $in: userIds } }))
    if (models.SubscriptionSecurityEvent) promises.push(models.SubscriptionSecurityEvent.deleteMany({ userId: { $in: userIds } }))
    if (models.AdminSubscriptionAuditLog) promises.push(models.AdminSubscriptionAuditLog.deleteMany({ userId: { $in: userIds } }))
  }

  if (orderIds.length > 0) {
    if (models.PaymentTransaction) promises.push(models.PaymentTransaction.deleteMany({ orderId: { $in: orderIds } }))
    if (models.IdempotencyKey) promises.push(models.IdempotencyKey.deleteMany({ key: { $in: orderIds } }))
  }

  if (jobNames.length > 0) {
    if (models.JobLock) promises.push(models.JobLock.deleteMany({ jobName: { $in: jobNames } }))
  }

  await Promise.allSettled(promises)
}

export default {
  connectTestDb,
  disconnectTestDb,
  cleanTestFixtures,
}
