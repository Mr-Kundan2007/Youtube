import React, { useEffect, useState, useCallback } from "react"
import Head from "next/head"
import Link from "next/link"
import { useRouter } from "next/router"
import {
  CreditCard,
  FileText,
  Receipt,
  Download,
  Search,
  Filter,
  ArrowUpDown,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Crown,
  Calendar,
  Layers,
  ArrowRight,
  Printer,
  Eye,
} from "lucide-react"
import {
  getBillingSummary,
  getBillingHistory,
  getUserInvoices,
  downloadInvoicePdf,
  downloadReceiptPdf,
  BillingSummaryData,
  BillingTransactionItem,
  InvoiceDetails,
} from "@/services/billingService"
import { useAuth } from "@/lib/AuthContext"

export default function BillingDashboardPage() {
  const router = useRouter()
  const { user, isLoaded }: any = useAuth()

  const [activeTab, setActiveTab] = useState<"transactions" | "invoices">("transactions")
  const [summary, setSummary] = useState<BillingSummaryData | null>(null)
  const [transactions, setTransactions] = useState<BillingTransactionItem[]>([])
  const [invoices, setInvoices] = useState<InvoiceDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDownloading, setIsDownloading] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Filters & Pagination State
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [planFilter, setPlanFilter] = useState("all")
  const [dateRangeFilter, setDateRangeFilter] = useState("all")
  const [sortBy, setSortBy] = useState<"date" | "amount" | "plan">("date")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")

  // Load summary & initial data
  const loadSummary = useCallback(async () => {
    try {
      const data = await getBillingSummary()
      setSummary(data)
    } catch (err: any) {
      console.warn("Failed to load billing summary:", err.message)
    }
  }, [])

  const loadTransactions = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage(null)
    try {
      const res = await getBillingHistory({
        page,
        limit: 10,
        status: statusFilter,
        plan: planFilter,
        dateRange: dateRangeFilter,
        search: searchTerm,
        sortBy,
        sortOrder,
      })
      setTransactions(res.transactions)
      setTotalPages(res.pagination.totalPages)
      setTotalCount(res.pagination.total)
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || "Failed to load transaction history.")
    } finally {
      setIsLoading(false)
    }
  }, [page, statusFilter, planFilter, dateRangeFilter, searchTerm, sortBy, sortOrder])

  const loadInvoices = useCallback(async () => {
    try {
      const res = await getUserInvoices(1, 20, searchTerm)
      setInvoices(res.invoices)
    } catch (err: any) {
      console.warn("Failed to load invoices:", err.message)
    }
  }, [searchTerm])

  useEffect(() => {
    if (isLoaded && user) {
      loadSummary()
      if (activeTab === "transactions") {
        loadTransactions()
      } else {
        loadInvoices()
      }
    } else if (isLoaded && !user) {
      setIsLoading(false)
    }
  }, [isLoaded, user, activeTab, loadSummary, loadTransactions, loadInvoices])

  const handleDownloadInvoice = async (invoiceId: string, invoiceNumber: string) => {
    try {
      setIsDownloading(`inv_${invoiceId}`)
      await downloadInvoicePdf(invoiceId, invoiceNumber)
    } catch (err: any) {
      alert("Failed to download invoice PDF. Please try again.")
    } finally {
      setIsDownloading(null)
    }
  }

  const handleDownloadReceipt = async (transactionId: string, receiptNumber: string) => {
    try {
      setIsDownloading(`rcpt_${transactionId}`)
      await downloadReceiptPdf(transactionId, receiptNumber || `rcpt_${transactionId}`)
    } catch (err: any) {
      alert("Failed to download payment receipt. Please try again.")
    } finally {
      setIsDownloading(null)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
      case "successful":
      case "paid":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Success</span>
          </span>
        )
      case "pending":
      case "processing":
      case "verification_pending":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3.5 h-3.5 animate-spin" />
            <span>Processing</span>
          </span>
        )
      case "failed":
      case "verification_failed":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="w-3.5 h-3.5" />
            <span>Failed</span>
          </span>
        )
      case "cancelled":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-neutral-800 text-neutral-400 border border-neutral-700">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Cancelled</span>
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-neutral-800 text-neutral-300">
            {status}
          </span>
        )
    }
  }

  const getActionTypeBadge = (action: string) => {
    switch (action) {
      case "upgrade":
        return <span className="text-xs text-amber-400 font-semibold">Upgrade</span>
      case "renew":
        return <span className="text-xs text-cyan-400 font-semibold">Renewal</span>
      case "downgrade":
        return <span className="text-xs text-neutral-400 font-semibold">Adjustment</span>
      default:
        return <span className="text-xs text-indigo-400 font-semibold">New Subscription</span>
    }
  }

  if (isLoaded && !user) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full p-8 rounded-3xl bg-neutral-900 border border-neutral-800 text-center">
          <CreditCard className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Sign in to View Billing</h2>
          <p className="text-sm text-neutral-400 mb-6">
            Please log in to view your billing history, tax invoices, and payment receipts.
          </p>
          <Link
            href="/"
            className="inline-block w-full py-3 bg-red-600 hover:bg-red-500 font-semibold rounded-xl transition"
          >
            Return Home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Billing & Invoices — YouTube Premium</title>
        <meta
          name="description"
          content="Manage your subscription billing, download tax invoices, view payment receipts, and search past transactions."
        />
      </Head>

      <div className="min-h-screen bg-[#0f0f0f] text-neutral-100 pb-20 pt-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header breadcrumb & title */}
          <div className="mb-8">
            <div className="flex items-center gap-2 text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
              <Link href="/subscription/dashboard" className="hover:text-white transition">
                Subscription
              </Link>
              <span>/</span>
              <span className="text-red-400">Billing & Payments</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
                  <CreditCard className="w-8 h-8 text-red-500" />
                  <span>Billing & Payment Management</span>
                </h1>
                <p className="text-sm text-neutral-400 mt-1">
                  View payment history, download official GST tax invoices, and access payment receipts.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Link
                  href="/subscriptions"
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-sm font-semibold rounded-xl border border-neutral-700 transition flex items-center gap-2"
                >
                  <span>Compare Plans</span>
                  <ExternalLink className="w-4 h-4" />
                </Link>
                <Link
                  href="/subscription/dashboard"
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-sm font-semibold rounded-xl shadow-lg shadow-red-900/30 transition flex items-center gap-2 text-white"
                >
                  <Crown className="w-4 h-4" />
                  <span>Dashboard</span>
                </Link>
              </div>
            </div>
          </div>

          {/* SUMMARY METRICS CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {/* Current Plan Card */}
            <div className="p-5 rounded-2xl bg-neutral-900/70 border border-neutral-800 backdrop-blur-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-400 uppercase">Active Plan</span>
                <span className="p-2 rounded-xl bg-red-500/10 text-red-400">
                  <Crown className="w-4 h-4" />
                </span>
              </div>
              <p className="text-2xl font-black text-white mt-2 capitalize">
                {summary?.currentPlan?.name || "Free"}
              </p>
              <div className="mt-2 flex items-center gap-2 text-xs">
                {getStatusBadge(summary?.status || "free")}
                <span className="text-neutral-400 capitalize">
                  {summary?.currentPlan?.validityType || "Lifetime"}
                </span>
              </div>
            </div>

            {/* Next Renewal Date */}
            <div className="p-5 rounded-2xl bg-neutral-900/70 border border-neutral-800 backdrop-blur-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-400 uppercase">Next Billing</span>
                <span className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
                  <Calendar className="w-4 h-4" />
                </span>
              </div>
              <p className="text-xl font-bold text-white mt-2">
                {summary?.expiryDate
                  ? new Date(summary.expiryDate).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "Lifetime Free"}
              </p>
              <p className="text-xs text-neutral-400 mt-2">
                {summary?.cancelScheduled
                  ? "Cancellation active (ends on date)"
                  : summary?.autoRenew
                  ? "Auto-renewal enabled"
                  : "One-time period"}
              </p>
            </div>

            {/* Last Payment */}
            <div className="p-5 rounded-2xl bg-neutral-900/70 border border-neutral-800 backdrop-blur-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-400 uppercase">Last Payment</span>
                <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                  <Receipt className="w-4 h-4" />
                </span>
              </div>
              <p className="text-2xl font-black text-white mt-2">
                {summary?.lastPayment ? summary.lastPayment.formattedAmount : "₹0.00"}
              </p>
              <p className="text-xs text-neutral-400 mt-2">
                {summary?.lastPayment?.paidAt
                  ? new Date(summary.lastPayment.paidAt).toLocaleDateString("en-IN")
                  : "No recent payments"}
              </p>
            </div>

            {/* Total Spent / Invoices */}
            <div className="p-5 rounded-2xl bg-neutral-900/70 border border-neutral-800 backdrop-blur-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-400 uppercase">Total Invoices</span>
                <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                  <FileText className="w-4 h-4" />
                </span>
              </div>
              <p className="text-2xl font-black text-white mt-2">
                {summary?.metrics?.invoiceCount ?? 0}
              </p>
              <p className="text-xs text-neutral-400 mt-2">
                Lifetime spend: {summary?.metrics?.formattedTotalSpent || "₹0.00"}
              </p>
            </div>
          </div>

          {/* TABS SELECTOR */}
          <div className="flex items-center gap-4 border-b border-neutral-800 mb-6">
            <button
              onClick={() => {
                setActiveTab("transactions")
                setPage(1)
              }}
              className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition ${
                activeTab === "transactions"
                  ? "border-red-500 text-white"
                  : "border-transparent text-neutral-400 hover:text-white"
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>Payment History</span>
              <span className="px-2 py-0.5 rounded-full text-xs bg-neutral-800 text-neutral-300">
                {totalCount}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveTab("invoices")
                setPage(1)
              }}
              className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition ${
                activeTab === "invoices"
                  ? "border-red-500 text-white"
                  : "border-transparent text-neutral-400 hover:text-white"
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Tax Invoices</span>
              <span className="px-2 py-0.5 rounded-full text-xs bg-neutral-800 text-neutral-300">
                {summary?.metrics?.invoiceCount || invoices.length}
              </span>
            </button>
          </div>

          {/* SEARCH & FILTERS BAR */}
          <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800 mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setPage(1)
                }}
                placeholder={
                  activeTab === "transactions"
                    ? "Search ID, Invoice, Plan..."
                    : "Search Invoice Number..."
                }
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-red-500"
              />
            </div>

            {/* Filter Dropdowns for Transactions */}
            {activeTab === "transactions" && (
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                {/* Status */}
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value)
                    setPage(1)
                  }}
                  className="bg-neutral-950 border border-neutral-800 text-xs font-semibold text-neutral-300 rounded-xl px-3 py-2 focus:outline-none focus:border-red-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="success">Successful</option>
                  <option value="pending">Processing / Pending</option>
                  <option value="failed">Failed</option>
                  <option value="cancelled">Cancelled</option>
                </select>

                {/* Plan */}
                <select
                  value={planFilter}
                  onChange={(e) => {
                    setPlanFilter(e.target.value)
                    setPage(1)
                  }}
                  className="bg-neutral-950 border border-neutral-800 text-xs font-semibold text-neutral-300 rounded-xl px-3 py-2 focus:outline-none focus:border-red-500"
                >
                  <option value="all">All Plans</option>
                  <option value="bronze">Bronze</option>
                  <option value="silver">Silver</option>
                  <option value="gold">Gold</option>
                </select>

                {/* Date range */}
                <select
                  value={dateRangeFilter}
                  onChange={(e) => {
                    setDateRangeFilter(e.target.value)
                    setPage(1)
                  }}
                  className="bg-neutral-950 border border-neutral-800 text-xs font-semibold text-neutral-300 rounded-xl px-3 py-2 focus:outline-none focus:border-red-500"
                >
                  <option value="all">All Time</option>
                  <option value="30d">Last 30 Days</option>
                  <option value="90d">Last 3 Months</option>
                  <option value="1y">Last Year</option>
                </select>

                {/* Sort */}
                <select
                  value={`${sortBy}_${sortOrder}`}
                  onChange={(e) => {
                    const [by, order] = e.target.value.split("_")
                    setSortBy(by as any)
                    setSortOrder(order as any)
                    setPage(1)
                  }}
                  className="bg-neutral-950 border border-neutral-800 text-xs font-semibold text-neutral-300 rounded-xl px-3 py-2 focus:outline-none focus:border-red-500"
                >
                  <option value="date_desc">Newest First</option>
                  <option value="date_asc">Oldest First</option>
                  <option value="amount_desc">Amount (High to Low)</option>
                  <option value="amount_asc">Amount (Low to High)</option>
                </select>
              </div>
            )}
          </div>

          {/* MAIN TAB CONTENT */}
          {activeTab === "transactions" ? (
            <div className="rounded-2xl bg-neutral-900/60 border border-neutral-800 overflow-hidden backdrop-blur-md">
              {isLoading ? (
                <div className="p-12 text-center text-neutral-400">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-red-500" />
                  <p className="text-sm font-semibold">Loading billing history...</p>
                </div>
              ) : errorMessage ? (
                <div className="p-12 text-center text-rose-400">
                  <AlertCircle className="w-8 h-8 mx-auto mb-3" />
                  <p className="text-sm">{errorMessage}</p>
                </div>
              ) : transactions.length === 0 ? (
                <div className="p-12 text-center">
                  <CreditCard className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
                  <h3 className="text-lg font-bold text-white mb-1">No Billing History Found</h3>
                  <p className="text-sm text-neutral-400 max-w-sm mx-auto mb-6">
                    {searchTerm || statusFilter !== "all" || planFilter !== "all"
                      ? "No records match your active search filters. Try clearing your filters."
                      : "You have not made any subscription payments yet. Explore our premium tiers."}
                  </p>
                  <Link
                    href="/subscriptions"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl transition"
                  >
                    <span>View Subscription Plans</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              ) : (
                <>
                  {/* Desktop Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left text-sm text-neutral-300">
                      <thead className="text-xs uppercase bg-neutral-950/80 text-neutral-400 border-b border-neutral-800">
                        <tr>
                          <th className="px-5 py-3.5">Date</th>
                          <th className="px-5 py-3.5">Transaction ID</th>
                          <th className="px-5 py-3.5">Plan</th>
                          <th className="px-5 py-3.5">Type</th>
                          <th className="px-5 py-3.5">Amount</th>
                          <th className="px-5 py-3.5">Status</th>
                          <th className="px-5 py-3.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-800/60">
                        {transactions.map((tx) => (
                          <tr key={tx._id} className="hover:bg-neutral-800/30 transition">
                            <td className="px-5 py-4 whitespace-nowrap text-xs text-neutral-400">
                              {new Date(tx.createdAt).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </td>
                            <td className="px-5 py-4 font-mono text-xs text-neutral-200">
                              <Link
                                href={`/billing/transaction/${tx._id}`}
                                className="hover:text-red-400 transition underline underline-offset-4"
                              >
                                {tx.orderId ? tx.orderId.slice(-8) : tx._id.slice(-8)}
                              </Link>
                            </td>
                            <td className="px-5 py-4 whitespace-nowrap">
                              <span className="font-bold text-white capitalize">{tx.planName}</span>
                              <span className="text-xs text-neutral-500 block capitalize">
                                {tx.billingCycle}
                              </span>
                            </td>
                            <td className="px-5 py-4 whitespace-nowrap">
                              {getActionTypeBadge(tx.actionType)}
                            </td>
                            <td className="px-5 py-4 whitespace-nowrap font-bold text-white">
                              ₹{Number(tx.amount || 0).toFixed(2)}
                            </td>
                            <td className="px-5 py-4 whitespace-nowrap">
                              {getStatusBadge(tx.status)}
                            </td>
                            <td className="px-5 py-4 whitespace-nowrap text-right space-x-2">
                              {tx.hasInvoice && tx.invoice?.invoiceId && (
                                <button
                                  onClick={() =>
                                    handleDownloadInvoice(
                                      tx.invoice!.invoiceId,
                                      tx.invoiceNumber || "INV"
                                    )
                                  }
                                  disabled={isDownloading === `inv_${tx.invoice.invoiceId}`}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-200 border border-neutral-700 transition"
                                  title="Download Tax Invoice PDF"
                                >
                                  <Download className="w-3.5 h-3.5 text-red-400" />
                                  <span>Invoice</span>
                                </button>
                              )}

                              {tx.hasReceipt && (
                                <button
                                  onClick={() =>
                                    handleDownloadReceipt(
                                      tx._id,
                                      tx.receiptNumber || `rcpt_${tx._id}`
                                    )
                                  }
                                  disabled={isDownloading === `rcpt_${tx._id}`}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-200 border border-neutral-700 transition"
                                  title="Download Payment Receipt PDF"
                                >
                                  <Receipt className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>Receipt</span>
                                </button>
                              )}

                              <Link
                                href={`/billing/transaction/${tx._id}`}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-300 transition"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Details</span>
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card List */}
                  <div className="block md:hidden divide-y divide-neutral-800">
                    {transactions.map((tx) => (
                      <div key={tx._id} className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-neutral-400">
                            {new Date(tx.createdAt).toLocaleDateString("en-IN")}
                          </span>
                          {getStatusBadge(tx.status)}
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-bold text-white text-base capitalize">
                              {tx.planName}
                            </span>
                            <span className="text-xs text-neutral-400 block">
                              {getActionTypeBadge(tx.actionType)} &bull; {tx.billingCycle}
                            </span>
                          </div>
                          <span className="text-lg font-extrabold text-white">
                            ₹{Number(tx.amount || 0).toFixed(2)}
                          </span>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-1">
                          {tx.hasInvoice && tx.invoice?.invoiceId && (
                            <button
                              onClick={() =>
                                handleDownloadInvoice(
                                  tx.invoice!.invoiceId,
                                  tx.invoiceNumber || "INV"
                                )
                              }
                              className="px-3 py-1.5 rounded-lg bg-neutral-800 text-xs font-semibold text-neutral-200 flex items-center gap-1"
                            >
                              <Download className="w-3.5 h-3.5 text-red-400" />
                              <span>Invoice</span>
                            </button>
                          )}
                          <Link
                            href={`/billing/transaction/${tx._id}`}
                            className="px-3 py-1.5 rounded-lg bg-neutral-800 text-xs font-semibold text-neutral-300 flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Details</span>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pagination Bar */}
                  {totalPages > 1 && (
                    <div className="p-4 bg-neutral-950/60 border-t border-neutral-800 flex items-center justify-between text-xs text-neutral-400">
                      <span>
                        Showing Page {page} of {totalPages} ({totalCount} total)
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={page <= 1}
                          className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-white flex items-center gap-1"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                          <span>Prev</span>
                        </button>
                        <button
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                          disabled={page >= totalPages}
                          className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-white flex items-center gap-1"
                        >
                          <span>Next</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            /* TAX INVOICES TAB */
            <div className="rounded-2xl bg-neutral-900/60 border border-neutral-800 overflow-hidden backdrop-blur-md">
              {invoices.length === 0 ? (
                <div className="p-12 text-center">
                  <FileText className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
                  <h3 className="text-lg font-bold text-white mb-1">No Invoices Available</h3>
                  <p className="text-sm text-neutral-400 max-w-sm mx-auto mb-6">
                    Invoices are automatically generated following successful subscription payments.
                  </p>
                  <Link
                    href="/subscriptions"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl transition"
                  >
                    <span>Upgrade to Premium</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-neutral-300">
                    <thead className="text-xs uppercase bg-neutral-950/80 text-neutral-400 border-b border-neutral-800">
                      <tr>
                        <th className="px-5 py-3.5">Invoice Number</th>
                        <th className="px-5 py-3.5">Date</th>
                        <th className="px-5 py-3.5">Plan</th>
                        <th className="px-5 py-3.5">Amount (GST Incl.)</th>
                        <th className="px-5 py-3.5">Status</th>
                        <th className="px-5 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800/60">
                      {invoices.map((inv) => (
                        <tr key={inv._id} className="hover:bg-neutral-800/30 transition">
                          <td className="px-5 py-4 font-mono font-bold text-white text-xs">
                            <Link
                              href={`/billing/invoice/${inv._id}`}
                              className="hover:text-red-400 transition underline underline-offset-4"
                            >
                              {inv.invoiceNumber}
                            </Link>
                          </td>
                          <td className="px-5 py-4 text-xs text-neutral-400">
                            {new Date(inv.createdAt).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </td>
                          <td className="px-5 py-4 font-semibold text-white">
                            {inv.planName}
                            <span className="text-xs text-neutral-500 block capitalize">
                              {inv.billingCycle}
                            </span>
                          </td>
                          <td className="px-5 py-4 font-bold text-white">
                            ₹{Number(inv.amountPaid || inv.amount).toFixed(2)}
                          </td>
                          <td className="px-5 py-4">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>PAID</span>
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right space-x-2">
                            <button
                              onClick={() => handleDownloadInvoice(inv._id, inv.invoiceNumber)}
                              disabled={isDownloading === `inv_${inv._id}`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-white border border-neutral-700 transition"
                            >
                              <Download className="w-3.5 h-3.5 text-red-400" />
                              <span>Download PDF</span>
                            </button>
                            <Link
                              href={`/billing/invoice/${inv._id}`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-300 transition"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View</span>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
