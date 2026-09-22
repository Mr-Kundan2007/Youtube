import React, { useEffect, useState } from "react"
import Head from "next/head"
import Link from "next/link"
import { useRouter } from "next/router"
import {
  CreditCard,
  FileText,
  Receipt,
  Download,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  ArrowLeft,
  Crown,
  ShieldCheck,
  Calendar,
  ExternalLink,
  Eye,
} from "lucide-react"
import {
  getTransactionDetails,
  downloadInvoicePdf,
  downloadReceiptPdf,
  BillingTransactionItem,
} from "@/services/billingService"
import { useAuth } from "@/lib/AuthContext"

export default function TransactionDetailsPage() {
  const router = useRouter()
  const { transactionId } = router.query
  const { user, isLoaded }: any = useAuth()

  const [transaction, setTransaction] = useState<BillingTransactionItem | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isDownloading, setIsDownloading] = useState<string | null>(null)

  useEffect(() => {
    if (isLoaded && user && transactionId) {
      setIsLoading(true)
      getTransactionDetails(String(transactionId))
        .then((data) => {
          setTransaction(data)
        })
        .catch((err) => {
          setErrorMessage(
            err.response?.data?.message || "Failed to load transaction details."
          )
        })
        .finally(() => setIsLoading(false))
    }
  }, [isLoaded, user, transactionId])

  const handleDownloadInvoice = async () => {
    if (!transaction?.invoice) return
    try {
      setIsDownloading("invoice")
      await downloadInvoicePdf(
        transaction.invoice.invoiceId,
        transaction.invoice.invoiceNumber
      )
    } catch {
      alert("Failed to download invoice.")
    } finally {
      setIsDownloading(null)
    }
  }

  const handleDownloadReceipt = async () => {
    if (!transaction) return
    try {
      setIsDownloading("receipt")
      await downloadReceiptPdf(
        transaction._id,
        transaction.receiptNumber || `rcpt_${transaction._id}`
      )
    } catch {
      alert("Failed to download receipt.")
    } finally {
      setIsDownloading(null)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
      case "successful":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-4 h-4" />
            <span>Successful</span>
          </span>
        )
      case "failed":
      case "verification_failed":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="w-4 h-4" />
            <span>Failed</span>
          </span>
        )
      case "cancelled":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-neutral-800 text-neutral-400 border border-neutral-700">
            <AlertCircle className="w-4 h-4" />
            <span>Cancelled</span>
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-4 h-4 animate-spin" />
            <span>Processing</span>
          </span>
        )
    }
  }

  return (
    <>
      <Head>
        <title>Transaction Details — YouTube Premium</title>
      </Head>

      <div className="min-h-screen bg-[#0f0f0f] text-neutral-100 pb-20 pt-6">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          {/* Back button */}
          <Link
            href="/billing"
            className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-400 hover:text-white mb-6 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Billing & Payments</span>
          </Link>

          {isLoading ? (
            <div className="p-16 text-center text-neutral-400 bg-neutral-900/60 rounded-3xl border border-neutral-800">
              <Clock className="w-8 h-8 animate-spin mx-auto mb-3 text-red-500" />
              <p className="text-sm font-semibold">Loading transaction records...</p>
            </div>
          ) : errorMessage || !transaction ? (
            <div className="p-12 text-center text-rose-400 bg-neutral-900/60 rounded-3xl border border-neutral-800">
              <AlertCircle className="w-10 h-10 mx-auto mb-3" />
              <h2 className="text-lg font-bold mb-2">Transaction Not Found</h2>
              <p className="text-sm text-neutral-400 max-w-sm mx-auto mb-6">
                {errorMessage || "We could not find the requested transaction record."}
              </p>
              <Link
                href="/billing"
                className="px-5 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white font-semibold rounded-xl text-sm"
              >
                Return to Billing
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Main Transaction Card */}
              <div className="p-6 sm:p-8 rounded-3xl bg-neutral-900/70 border border-neutral-800 backdrop-blur-md shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-6 mb-6">
                  <div>
                    <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                      Transaction Record
                    </span>
                    <h1 className="text-xl sm:text-2xl font-black text-white mt-1 font-mono">
                      {transaction.orderId || transaction._id}
                    </h1>
                  </div>
                  <div>{getStatusBadge(transaction.status)}</div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <span className="text-xs text-neutral-400 block mb-1">Amount Paid</span>
                    <span className="text-3xl font-extrabold text-white">
                      ₹{Number(transaction.amount || 0).toFixed(2)}
                    </span>
                    <span className="text-xs text-neutral-500 block mt-1">
                      {transaction.currency} &bull; GST Included
                    </span>
                  </div>

                  <div>
                    <span className="text-xs text-neutral-400 block mb-1">Plan & Billing Cycle</span>
                    <span className="text-lg font-bold text-white capitalize flex items-center gap-2">
                      <Crown className="w-5 h-5 text-amber-400" />
                      <span>{transaction.planName}</span>
                    </span>
                    <span className="text-xs text-neutral-400 block mt-1 capitalize">
                      Cycle: {transaction.billingCycle} &bull; {transaction.actionType.replace(/_/g, " ")}
                    </span>
                  </div>

                  <div>
                    <span className="text-xs text-neutral-400 block mb-1">Payment Method & Gateway</span>
                    <span className="text-sm font-semibold text-neutral-200">
                      {(transaction.paymentGateway || "Razorpay").toUpperCase()} &bull; Online
                    </span>
                    <span className="text-xs text-neutral-500 font-mono block mt-1">
                      Payment ID: {transaction.paymentId || "N/A"}
                    </span>
                  </div>

                  <div>
                    <span className="text-xs text-neutral-400 block mb-1">Transaction Timestamp</span>
                    <span className="text-sm font-semibold text-neutral-200">
                      {new Date(transaction.createdAt).toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Documents Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Tax Invoice Box */}
                <div className="p-6 rounded-3xl bg-neutral-900/60 border border-neutral-800">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="p-2.5 rounded-xl bg-red-500/10 text-red-400">
                      <FileText className="w-5 h-5" />
                    </span>
                    <div>
                      <h3 className="text-base font-bold text-white">Official Tax Invoice</h3>
                      <p className="text-xs text-neutral-400">
                        {transaction.invoice?.invoiceNumber || "Available for successful orders"}
                      </p>
                    </div>
                  </div>

                  {transaction.hasInvoice && transaction.invoice ? (
                    <div className="flex items-center gap-3 pt-2">
                      <button
                        onClick={handleDownloadInvoice}
                        disabled={isDownloading === "invoice"}
                        className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 font-semibold text-xs text-white flex items-center gap-1.5 transition"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download PDF</span>
                      </button>
                      <Link
                        href={`/billing/invoice/${transaction.invoice.invoiceId}`}
                        className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 font-semibold text-xs text-neutral-300 flex items-center gap-1.5 transition"
                      >
                        <Eye className="w-4 h-4" />
                        <span>View Invoice</span>
                      </Link>
                    </div>
                  ) : (
                    <p className="text-xs text-neutral-500 italic">
                      Tax invoices are generated exclusively for completed payments.
                    </p>
                  )}
                </div>

                {/* Payment Receipt Box */}
                <div className="p-6 rounded-3xl bg-neutral-900/60 border border-neutral-800">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
                      <Receipt className="w-5 h-5" />
                    </span>
                    <div>
                      <h3 className="text-base font-bold text-white">Payment Receipt</h3>
                      <p className="text-xs text-neutral-400">
                        {transaction.receiptNumber || "Official confirmation slip"}
                      </p>
                    </div>
                  </div>

                  {transaction.hasReceipt ? (
                    <div className="flex items-center gap-3 pt-2">
                      <button
                        onClick={handleDownloadReceipt}
                        disabled={isDownloading === "receipt"}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-semibold text-xs text-white flex items-center gap-1.5 transition"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download Receipt PDF</span>
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-neutral-500 italic">
                      Receipts are only issued for successfully verified transactions.
                    </p>
                  )}
                </div>
              </div>

              {/* Security Guarantee */}
              <div className="p-4 rounded-2xl bg-neutral-950/60 border border-neutral-800/80 flex items-center gap-3 text-xs text-neutral-400">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>
                  All transactions are verified using server-side HMAC SHA-256 cryptographic signatures. Payment secrets and card credentials are never stored on platform servers.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
