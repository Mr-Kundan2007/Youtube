import React, { useEffect, useState } from "react"
import Head from "next/head"
import Link from "next/link"
import { useRouter } from "next/router"
import {
  FileText,
  Download,
  Printer,
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertCircle,
  ShieldCheck,
} from "lucide-react"
import {
  getInvoiceDetails,
  downloadInvoicePdf,
  InvoiceDetails,
} from "@/services/billingService"
import { useAuth } from "@/lib/AuthContext"

export default function InvoiceViewerPage() {
  const router = useRouter()
  const { invoiceId } = router.query
  const { user, isLoaded }: any = useAuth()

  const [invoice, setInvoice] = useState<InvoiceDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)

  useEffect(() => {
    if (isLoaded && user && invoiceId) {
      setIsLoading(true)
      getInvoiceDetails(String(invoiceId))
        .then((data) => {
          setInvoice(data)
        })
        .catch((err) => {
          setErrorMessage(
            err.response?.data?.message || "Failed to load the requested invoice."
          )
        })
        .finally(() => setIsLoading(false))
    }
  }, [isLoaded, user, invoiceId])

  const handleDownloadPdf = async () => {
    if (!invoice) return
    try {
      setIsDownloading(true)
      await downloadInvoicePdf(invoice._id, invoice.invoiceNumber)
    } catch {
      alert("Failed to download PDF. Please try again.")
    } finally {
      setIsDownloading(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <>
      <Head>
        <title>
          {invoice ? `Invoice ${invoice.invoiceNumber}` : "Tax Invoice"} — YouTube Premium
        </title>
      </Head>

      <div className="min-h-screen bg-[#0f0f0f] text-neutral-100 pb-20 pt-6 print:bg-white print:text-neutral-900 print:p-0">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          {/* Top navigation actions (hidden during print) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 print:hidden">
            <Link
              href="/billing"
              className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-400 hover:text-white transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Billing</span>
            </Link>

            {invoice && (
              <div className="flex items-center gap-3">
                <button
                  onClick={handlePrint}
                  className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-sm font-semibold text-neutral-200 border border-neutral-700 transition flex items-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Invoice</span>
                </button>
                <button
                  onClick={handleDownloadPdf}
                  disabled={isDownloading}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-sm font-semibold text-white shadow-lg shadow-red-900/30 transition flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>{isDownloading ? "Generating PDF..." : "Download PDF"}</span>
                </button>
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="p-16 text-center text-neutral-400 bg-neutral-900/60 rounded-3xl border border-neutral-800">
              <Clock className="w-8 h-8 animate-spin mx-auto mb-3 text-red-500" />
              <p className="text-sm font-semibold">Loading official invoice...</p>
            </div>
          ) : errorMessage || !invoice ? (
            <div className="p-12 text-center text-rose-400 bg-neutral-900/60 rounded-3xl border border-neutral-800">
              <AlertCircle className="w-10 h-10 mx-auto mb-3" />
              <h2 className="text-lg font-bold mb-2">Invoice Not Found</h2>
              <p className="text-sm text-neutral-400 max-w-sm mx-auto mb-6">
                {errorMessage || "The requested invoice could not be located or you lack authorization."}
              </p>
              <Link
                href="/billing"
                className="px-5 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white font-semibold rounded-xl text-sm"
              >
                Return to Billing
              </Link>
            </div>
          ) : (
            /* PRINTABLE INVOICE CARD */
            <div className="p-8 sm:p-12 rounded-3xl bg-white text-neutral-900 shadow-2xl print:shadow-none print:p-0 print:border-none">
              {/* Header */}
              <div className="flex justify-between items-start border-b-2 border-neutral-200 pb-8 mb-8">
                <div>
                  <div className="text-2xl font-black text-red-600 tracking-tight">
                    YOUTUBE PREMIUM
                  </div>
                  <div className="text-xs text-neutral-500 mt-1">
                    Digital Streaming, Offline Downloads & Learning Services
                  </div>
                </div>

                <div className="text-right">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>TAX INVOICE - PAID</span>
                  </span>
                  <div className="font-mono font-bold text-base mt-2 text-neutral-900">
                    {invoice.invoiceNumber}
                  </div>
                  <div className="text-xs text-neutral-500 mt-0.5">
                    {new Date(invoice.createdAt || invoice.issuedAt).toLocaleDateString("en-IN", {
                      dateStyle: "long",
                    })}
                  </div>
                </div>
              </div>

              {/* Customer & Payment Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-8">
                <div>
                  <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">
                    Billed To
                  </h4>
                  <p className="text-base font-bold text-neutral-900">
                    {invoice.customerName || "Valued Subscriber"}
                  </p>
                  <p className="text-sm text-neutral-600 mt-0.5">{invoice.customerEmail || "N/A"}</p>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">
                    Payment Information
                  </h4>
                  <p className="text-sm font-semibold text-neutral-800">
                    Method: Razorpay ({(invoice.paymentGateway || "ONLINE").toUpperCase()})
                  </p>
                  <p className="text-xs font-mono text-neutral-500 mt-0.5">
                    Payment ID: {invoice.paymentId || "N/A"}
                  </p>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="overflow-x-auto mb-8">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-neutral-100 text-neutral-700 text-xs uppercase font-bold">
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3">Validity Period</th>
                      <th className="px-4 py-3">Cycle</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    <tr>
                      <td className="px-4 py-4">
                        <span className="font-bold text-neutral-900">
                          YouTube {invoice.planName} Plan
                        </span>
                        <span className="text-xs text-neutral-500 block">
                          Ad-free playback, 4K Ultra HD & Course Access
                        </span>
                      </td>
                      <td className="px-4 py-4 text-xs text-neutral-600">
                        {new Date(invoice.billingPeriodStart).toLocaleDateString()} -{" "}
                        {new Date(invoice.billingPeriodEnd).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-4 capitalize text-neutral-800">
                        {invoice.billingCycle}
                      </td>
                      <td className="px-4 py-4 text-right font-bold text-neutral-900">
                        ₹{Number(invoice.subtotal).toFixed(2)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Tax & Total Summary */}
              <div className="flex justify-end mb-8">
                <div className="w-full sm:w-72 space-y-2 text-sm">
                  <div className="flex justify-between text-neutral-600">
                    <span>Subtotal (Excl. Tax):</span>
                    <span>₹{Number(invoice.subtotal).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-neutral-600">
                    <span>GST ({invoice.taxRatePercent || 18}% Standard):</span>
                    <span>₹{Number(invoice.taxAmount).toFixed(2)}</span>
                  </div>
                  <div className="border-t-2 border-neutral-300 pt-2 flex justify-between font-black text-lg text-red-600">
                    <span>Total Paid:</span>
                    <span>₹{Number(invoice.amountPaid).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Footer Notice */}
              <div className="border-t border-neutral-200 pt-6 text-center text-xs text-neutral-400">
                <p>
                  This is a computer-generated tax invoice and requires no physical signature.
                </p>
                <p className="mt-1">
                  For support inquiries, contact billing@youtube.local or access your online dashboard.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
