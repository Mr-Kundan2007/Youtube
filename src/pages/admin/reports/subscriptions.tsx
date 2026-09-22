import React, { useState, useEffect } from "react"
import Head from "next/head"
import Link from "next/link"
import {
  FileSpreadsheet,
  Download,
  Calendar,
  Filter,
  RefreshCw,
  DollarSign,
  Users,
  Layers,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/lib/AuthContext"
import AdminSubscriptionNav from "@/components/admin/AdminSubscriptionNav"
import {
  adminSubscriptionService,
  ReportResponseData,
} from "@/services/adminSubscriptionService"

export default function AdminSubscriptionReportsPage() {
  const { user, loading: authLoading }: any = useAuth()
  const [reportType, setReportType] = useState<"revenue" | "subscribers" | "plans">("revenue")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [planFilter, setPlanFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [reportData, setReportData] = useState<ReportResponseData | null>(null)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isAdmin = user?.role === "admin" || user?.result?.role === "admin"

  const handleGenerateReport = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await adminSubscriptionService.getReport({
        type: reportType,
        from: fromDate || undefined,
        to: toDate || undefined,
        plan: planFilter !== "all" ? planFilter : undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
      })
      setReportData(data)
    } catch (err: any) {
      console.error("Failed to generate report:", err)
      setError(err.response?.data?.message || err.message || "Failed to generate report.")
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadCsv = async () => {
    setExporting(true)
    try {
      await adminSubscriptionService.downloadReportCsv(reportType, {
        from: fromDate || undefined,
        to: toDate || undefined,
        plan: planFilter !== "all" ? planFilter : undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
      })
    } catch (err: any) {
      console.error("CSV download error:", err)
      alert("Failed to download CSV: " + (err.response?.data?.message || err.message))
    } finally {
      setExporting(false)
    }
  }

  useEffect(() => {
    if (!authLoading && isAdmin) {
      handleGenerateReport()
    }
  }, [authLoading, isAdmin, reportType])

  if (authLoading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <RefreshCw className="w-5 h-5 animate-spin text-neutral-400" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-xl font-bold text-neutral-900 mb-2">Access Denied</h1>
        <p className="text-sm text-neutral-500 mb-4">Admin credentials required to view subscription reports.</p>
        <Link href="/"><Button variant="outline">Home</Button></Link>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Subscription Reports & CSV Export — Admin Suite</title>
      </Head>

      <div className="min-h-screen bg-neutral-50/60 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
        <AdminSubscriptionNav
          title="Subscription Reports & CSV Export"
          description="Generate RFC 4180-compliant administrative reports for financial auditing, executive summaries, and subscriber cohorts."
          actionSlot={
            <Button
              onClick={handleDownloadCsv}
              disabled={exporting || loading}
              className="rounded-xl text-xs bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs"
            >
              <Download className={`w-3.5 h-3.5 mr-1.5 ${exporting ? "animate-spin" : ""}`} />
              {exporting ? "Generating CSV..." : "Export to CSV"}
            </Button>
          }
        />

        {error && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* REPORT TYPE TABS & FILTER BAR */}
        <div className="p-5 rounded-2xl bg-white border border-neutral-200/80 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-neutral-500 mr-1">Report Category:</span>
              {(
                [
                  { id: "revenue", label: "Revenue & Billing", icon: DollarSign },
                  { id: "subscribers", label: "Subscriber Cohorts", icon: Users },
                  { id: "plans", label: "Plan Performance", icon: Layers },
                ] as const
              ).map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setReportType(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                      reportType === tab.id
                        ? "bg-neutral-900 text-white shadow-2xs"
                        : "text-neutral-600 hover:bg-neutral-100"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                )
              })}
            </div>

            <Button
              onClick={handleGenerateReport}
              size="sm"
              variant="outline"
              disabled={loading}
              className="rounded-xl text-xs cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
              Run Query
            </Button>
          </div>

          {/* Date & Filter parameters */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {reportType === "revenue" && (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="text-neutral-500 font-medium">From:</span>
                  <Input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="rounded-xl text-xs h-8 px-2.5 py-1"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-neutral-500 font-medium">To:</span>
                  <Input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="rounded-xl text-xs h-8 px-2.5 py-1"
                  />
                </div>
              </>
            )}

            {reportType === "subscribers" && (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="text-neutral-500 font-medium">Plan:</span>
                  <select
                    value={planFilter}
                    onChange={(e) => setPlanFilter(e.target.value)}
                    className="p-1.5 border border-neutral-200 rounded-lg text-xs"
                  >
                    <option value="all">All Plans</option>
                    <option value="free">Free</option>
                    <option value="bronze">Bronze</option>
                    <option value="silver">Silver</option>
                    <option value="gold">Gold</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-neutral-500 font-medium">Status:</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="p-1.5 border border-neutral-200 rounded-lg text-xs"
                  >
                    <option value="all">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="expired">Expired</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </>
            )}

            {reportData?.summary && (
              <div className="ml-auto flex items-center gap-3 text-neutral-600 font-semibold">
                {reportType === "revenue" && (
                  <>
                    <span>Total Volume: ₹{(reportData.summary.totalRevenue || 0).toLocaleString()}</span>
                    <span>Transactions: {reportData.summary.totalTransactions || 0}</span>
                  </>
                )}
                {reportType === "subscribers" && (
                  <>
                    <span>Total: {reportData.summary.totalSubscribers || 0}</span>
                    <span>Active: {reportData.summary.activeSubscribers || 0}</span>
                  </>
                )}
                {reportType === "plans" && (
                  <span>Configured Tiers: {reportData.summary.totalPlans || 0}</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* REPORT DATA TABLE PREVIEW */}
        <div className="rounded-2xl bg-white border border-neutral-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-neutral-900">
              Report Data Preview ({reportData?.rows?.length || 0} rows)
            </h3>
            <span className="text-[11px] text-neutral-400">
              RFC 4180 Compliant • Generated {reportData?.generatedAt ? new Date(reportData.generatedAt).toLocaleTimeString() : ""}
            </span>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="py-16 text-center text-xs text-neutral-400">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                Generating report data...
              </div>
            ) : !reportData?.rows || reportData.rows.length === 0 ? (
              <div className="py-16 text-center text-xs text-neutral-400">
                No data points found for this report scope.
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                {/* Revenue Report Table */}
                {reportType === "revenue" && (
                  <>
                    <thead>
                      <tr className="border-b bg-neutral-50/70 text-neutral-500 uppercase text-[10px]">
                        <th className="py-2.5 px-3">Tx ID</th>
                        <th className="py-2.5 px-3">Customer</th>
                        <th className="py-2.5 px-3">Plan</th>
                        <th className="py-2.5 px-3">Amount (INR)</th>
                        <th className="py-2.5 px-3">Method</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {reportData.rows.slice(0, 50).map((r, i) => (
                        <tr key={i} className="hover:bg-neutral-50/50">
                          <td className="py-2.5 px-3 font-mono text-neutral-800">{r.transactionId}</td>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-neutral-900">{r.userName}</div>
                            <div className="text-[10px] text-neutral-500">{r.userEmail}</div>
                          </td>
                          <td className="py-2.5 px-3 font-bold uppercase">{r.plan}</td>
                          <td className="py-2.5 px-3 font-black text-neutral-900">₹{r.amount}</td>
                          <td className="py-2.5 px-3 capitalize">{r.paymentMethod}</td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                              {r.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right text-neutral-500">
                            {r.date ? new Date(r.date).toLocaleDateString() : ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}

                {/* Subscribers Report Table */}
                {reportType === "subscribers" && (
                  <>
                    <thead>
                      <tr className="border-b bg-neutral-50/70 text-neutral-500 uppercase text-[10px]">
                        <th className="py-2.5 px-3">User</th>
                        <th className="py-2.5 px-3">Plan</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Cycle</th>
                        <th className="py-2.5 px-3">Start Date</th>
                        <th className="py-2.5 px-3">Expiry Date</th>
                        <th className="py-2.5 px-3 text-right">Auto Renew</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {reportData.rows.slice(0, 50).map((r, i) => (
                        <tr key={i} className="hover:bg-neutral-50/50">
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-neutral-900">{r.name}</div>
                            <div className="text-[10px] text-neutral-500">{r.email}</div>
                          </td>
                          <td className="py-2.5 px-3 font-bold uppercase">{r.plan}</td>
                          <td className="py-2.5 px-3 capitalize">{r.status}</td>
                          <td className="py-2.5 px-3 capitalize">{r.billingCycle}</td>
                          <td className="py-2.5 px-3 text-neutral-500">
                            {r.startDate ? new Date(r.startDate).toLocaleDateString() : "—"}
                          </td>
                          <td className="py-2.5 px-3 text-neutral-500">
                            {r.endDate ? new Date(r.endDate).toLocaleDateString() : "Lifetime"}
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold">{r.autoRenew}</td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}

                {/* Plan Performance Table */}
                {reportType === "plans" && (
                  <>
                    <thead>
                      <tr className="border-b bg-neutral-50/70 text-neutral-500 uppercase text-[10px]">
                        <th className="py-2.5 px-3">Plan Name</th>
                        <th className="py-2.5 px-3">Price</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Active Subscribers</th>
                        <th className="py-2.5 px-3">Total Registered</th>
                        <th className="py-2.5 px-3">Total Revenue</th>
                        <th className="py-2.5 px-3 text-right">Transactions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {reportData.rows.map((r, i) => (
                        <tr key={i} className="hover:bg-neutral-50/50">
                          <td className="py-2.5 px-3 font-bold text-neutral-900">{r.name}</td>
                          <td className="py-2.5 px-3 font-semibold">₹{r.price}</td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-100 text-neutral-700">
                              {r.isActive}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-bold text-neutral-800">{r.activeSubscribers}</td>
                          <td className="py-2.5 px-3 text-neutral-600">{r.totalSubscribers}</td>
                          <td className="py-2.5 px-3 font-black text-emerald-700">
                            ₹{r.totalRevenue.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold">{r.transactionsCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
