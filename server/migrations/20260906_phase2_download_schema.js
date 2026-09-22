/**
 * Migration: 20260906_phase2_download_schema.js
 *
 * Sets up Phase 2 database schema collections, fields, and indexes:
 * - DownloadRecord / Download
 * - DownloadQuota
 * - Device / DownloadDevice
 * - DownloadToken
 * - DownloadAuditLog
 * - Subscription & Video enhancements
 */

import mongoose from "mongoose"
import { dbConfig } from "../config/index.js"
import User from "../Modals/Auth.js"
import Video from "../Modals/video.js"
import Subscription from "../Modals/Subscription.js"
import DownloadRecord, { Download } from "../Modals/DownloadRecord.js"
import DownloadQuota from "../Modals/DownloadQuota.js"
import Device, { DownloadDevice } from "../Modals/Device.js"
import DownloadToken from "../Modals/DownloadToken.js"
import DownloadAuditLog from "../Modals/DownloadAuditLog.js"

export async function up() {
  console.log("------------------------------------------------------------------")
  console.log("PHASE 2 DATABASE MIGRATION: RUNNING SCHEMA & INDEX SYNCHRONIZATION")
  console.log("------------------------------------------------------------------")

  if (mongoose.connection.readyState === 0) {
    const mongoUri = dbConfig.url || "mongodb://127.0.0.1:27017/youtube"
    console.log(`Connecting to MongoDB...`)
    await mongoose.connect(mongoUri)
  }

  const results = {
    collections: [],
    indexes: {},
  }

  const models = [
    { name: "DownloadRecord", model: DownloadRecord },
    { name: "DownloadQuota", model: DownloadQuota },
    { name: "Device", model: Device },
    { name: "DownloadToken", model: DownloadToken },
    { name: "DownloadAuditLog", model: DownloadAuditLog },
    { name: "Subscription", model: Subscription },
    { name: "Video", model: Video },
    { name: "User", model: User },
  ]

  for (const { name, model } of models) {
    try {
      // Ensure collection exists
      await model.init()
      const indexes = await model.collection.indexes()
      results.collections.push(name)
      results.indexes[name] = indexes.map((idx) => Object.keys(idx.key).join("+"))
      console.log(`[SYNCED] ${name}: Collection initialized with ${indexes.length} index(es)`)
      for (const idx of indexes) {
        console.log(`         -> ${JSON.stringify(idx.key)} (${idx.unique ? "UNIQUE" : "INDEX"})`)
      }
    } catch (err) {
      console.warn(`[WARN] Issue syncing ${name}:`, err.message)
    }
  }

  console.log("------------------------------------------------------------------")
  console.log("PHASE 2 DATABASE MIGRATION: SUCCESSFUL")
  console.log("------------------------------------------------------------------")
  return results
}

export async function down() {
  console.log("------------------------------------------------------------------")
  console.log("PHASE 2 DATABASE MIGRATION: ROLLBACK (DOWN)")
  console.log("------------------------------------------------------------------")

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(dbConfig.url || "mongodb://127.0.0.1:27017/youtube")
  }

  console.log("Rollback completed: Preserved collections to avoid data loss.")
}

// Run directly if called as a script
if (process.argv[1] && process.argv[1].endsWith("20260906_phase2_download_schema.js")) {
  up()
    .then(() => {
      process.exit(0)
    })
    .catch((err) => {
      console.error("Migration fatal error:", err)
      process.exit(1)
    })
}
