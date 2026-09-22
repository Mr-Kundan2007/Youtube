import mongoose from "mongoose"

export const ExportReportTypes = [
  "downloads",
  "users",
  "videos",
  "subscriptions",
  "devices",
  "security",
  "audit",
]

const reportExportJobSchema = new mongoose.Schema(
  {
    jobId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    reportType: {
      type: String,
      enum: ExportReportTypes,
      required: true,
      index: true,
    },
    dateRange: {
      type: String,
      default: "30d",
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
    filters: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    format: {
      type: String,
      enum: ["csv", "json"],
      default: "csv",
    },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed", "expired"],
      default: "pending",
      index: true,
    },
    filePath: {
      type: String,
      default: "",
    },
    fileName: {
      type: String,
      default: "",
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    rowCount: {
      type: Number,
      default: 0,
    },
    downloadToken: {
      type: String,
      default: "",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    adminEmail: {
      type: String,
      default: "",
    },
    error: {
      type: String,
      default: "",
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
)

reportExportJobSchema.index({ status: 1, expiresAt: 1 })
reportExportJobSchema.index({ createdBy: 1, createdAt: -1 })

export const ReportExportJob =
  mongoose.models.ReportExportJob || mongoose.model("ReportExportJob", reportExportJobSchema)

export default ReportExportJob
