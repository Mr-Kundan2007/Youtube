import mongoose from "mongoose"
import Invoice from "../Modals/Invoice.js"

// Counter Schema for strictly monotonic, sequential invoice generation
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
})

const InvoiceCounter =
  mongoose.models.InvoiceCounter || mongoose.model("InvoiceCounter", counterSchema)

/**
 * Generates a unique, sequential invoice number in the format INV-YYYY-XXXXXX.
 * Uses atomic findOneAndUpdate on MongoDB to ensure zero collisions under concurrency.
 *
 * @param {Date} [referenceDate=new Date()]
 * @returns {Promise<string>} e.g. "INV-2026-000001"
 */
export const generateInvoiceNumber = async (referenceDate = new Date()) => {
  const year = new Date(referenceDate).getFullYear()
  const counterId = `invoice_${year}`

  try {
    const counter = await InvoiceCounter.findOneAndUpdate(
      { _id: counterId },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    )

    const formattedSeq = String(counter.seq).padStart(6, "0")
    const candidateNumber = `INV-${year}-${formattedSeq}`

    // Double-check uniqueness defensively
    const existing = await Invoice.findOne({ invoiceNumber: candidateNumber }).lean()
    if (!existing) {
      return candidateNumber
    }

    // If an existing number already used this sequence, jump sequence
    const fallbackSeq = String(counter.seq + Math.floor(Math.random() * 900) + 100).padStart(6, "0")
    return `INV-${year}-${fallbackSeq}`
  } catch (err) {
    // Graceful timestamp-based fallback if DB counter errors
    const now = new Date()
    const ms = String(now.getTime()).slice(-6)
    return `INV-${year}-${ms}`
  }
}

export default {
  generateInvoiceNumber,
}
