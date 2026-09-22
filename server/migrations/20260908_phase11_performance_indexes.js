import mongoose from "mongoose"
import dotenv from "dotenv"

dotenv.config()

const DB_URI = process.env.DB_URL || "mongodb://localhost:27017/youtube"

/**
 * Migration: Phase 11 Database Query Performance Optimization Indexes
 * Creates compound and filtered indexes on core subscription collections.
 */
export async function runPerformanceIndexMigration() {
  console.log("=========================================================================")
  console.log("  MIGRATION: PHASE 11 DATABASE QUERY PERFORMANCE INDEXES")
  console.log("=========================================================================\n")

  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(DB_URI)
      console.log("Connected to MongoDB for index migration.\n")
    }

    const db = mongoose.connection.db

    const safeCreateIndex = async (collectionName, spec, options) => {
      try {
        await db.collection(collectionName).createIndex(spec, options)
      } catch (err) {
        if (err.message?.includes("already exists") || err.code === 85 || err.codeName === "IndexOptionsConflict") {
          // Index already exists with same keys under another name; safe to proceed
          return
        }
        throw err
      }
    }

    // 1. Subscription Indexes
    console.log("Creating optimized compound indexes for 'subscriptions'...")
    await safeCreateIndex("subscriptions", { status: 1, expiresAt: 1 }, { background: true })
    await safeCreateIndex("subscriptions", { plan: 1, status: 1 }, { background: true })
    await safeCreateIndex("subscriptions", { userId: 1, status: 1 }, { background: true })
    console.log("  ✓ Subscriptions compound indexes active.")

    // 2. PaymentTransaction Indexes
    console.log("Creating optimized compound indexes for 'paymenttransactions'...")
    await safeCreateIndex("paymenttransactions", { userId: 1, status: 1, createdAt: -1 }, { background: true })
    await safeCreateIndex("paymenttransactions", { orderId: 1, status: 1 }, { background: true })
    await safeCreateIndex("paymenttransactions", { paymentId: 1, status: 1 }, { background: true })
    console.log("  ✓ PaymentTransactions compound indexes active.")

    // 3. Invoice Indexes
    console.log("Creating optimized compound indexes for 'invoices'...")
    await safeCreateIndex("invoices", { userId: 1, status: 1, createdAt: -1 }, { background: true })
    await safeCreateIndex("invoices", { invoiceNumber: 1 }, { background: true, unique: true })
    console.log("  ✓ Invoices indexes active.")

    // 4. SubscriptionSecurityEvent Indexes
    console.log("Creating optimized compound indexes for 'subscriptionsecurityevents'...")
    await safeCreateIndex("subscriptionsecurityevents", { severity: 1, status: 1, createdAt: -1 }, { background: true })
    await safeCreateIndex("subscriptionsecurityevents", { eventType: 1, createdAt: -1 }, { background: true })
    console.log("  ✓ Security Events compound indexes active.")

    // 5. SubscriptionHistory Indexes
    console.log("Creating optimized compound indexes for 'subscriptionhistories'...")
    await safeCreateIndex("subscriptionhistories", { userId: 1, performedAt: -1 }, { background: true })
    await safeCreateIndex("subscriptionhistories", { action: 1, performedAt: -1 }, { background: true })
    console.log("  ✓ Subscription History compound indexes active.")

    // 6. JobLock Indexes
    console.log("Creating optimized compound indexes for 'joblocks'...")
    await safeCreateIndex("joblocks", { isLocked: 1, lockExpiresAt: 1 }, { background: true })
    console.log("  ✓ JobLock compound indexes active.")

    console.log("\n=========================================================================")
    console.log("  PHASE 11 INDEX MIGRATION COMPLETED SUCCESSFULLY")
    console.log("=========================================================================\n")

    return { success: true }
  } catch (err) {
    console.error("Index migration failed:", err.message)
    throw err
  }
}

if (process.argv[1]?.endsWith("20260908_phase11_performance_indexes.js")) {
  runPerformanceIndexMigration()
    .then(async () => {
      await mongoose.disconnect()
      process.exit(0)
    })
    .catch(async () => {
      await mongoose.disconnect().catch(() => {})
      process.exit(1)
    })
}

export default runPerformanceIndexMigration
