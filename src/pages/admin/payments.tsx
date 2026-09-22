import React, { useState, useEffect } from "react"
import Head from "next/head"
import Link from "next/link"
import {
  CreditCard,
  Search,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  AlertCircle,
  Crown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/lib/AuthContext"
import AdminSubscriptionNav from "@/components/admin/AdminSubscriptionNav"
import {
  adminSubscriptionService,
  AdminPaymentItem,
} from "@/services/adminSubscriptionService"

export default function AdminPaymentsPage() {
  const { user, loading: authLoading }: any = useAuth()
  const [payments, setPayments] = useState<AdminPaymentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [planFilter, setPlanFilter] = useState("all")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  const isAdmin = user?.role === "admin" || user?.result?.role === "admin"

  const fetchPayments = async () => {
    setLoading(true)
    try {
      const res = await adminSubscriptionService.getPaymentsList({
        page,
        limit: 20,
        search: search.trim() || undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        plan: planFilter !== "all" ? planFilter : undefined,
      })
      if (res) {
        setPayments(res.payments || [])
        setTotalPages(res.pagination?.totalPages || 1)
        setTotalCount(res.pagination?.total || 0)
      }
    } catch (err) {
      console.error("Failed to load payments list:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!authLoading && isAdmin) {
      fetchPayments()
    }
  }, [authLoading, isAdmin, page, statusFilter, planFilter])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    fetchPayments()
  }

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
        <p className="text-sm text-neutral-500 mb-4">Admin credentials required to view transactions.</p>
        <Link href="/"><Button variant="outline">Home</Button></Link>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Payment Transactions Oversight — Admin Suite</title>
      </Head>

      <div className="min-h-screen bg-neutral-50/60 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
        <AdminSubscriptionNav
          title="Payment Transactions Oversight"
          description="Live stream of verified subscription billing charges, gateway responses, payment attempts, and transaction states."
          actionSlot={
            <Button
              onClick={() => {
                setPage(1)
                fetchPayments()
              }}
              variant="outline"
              size="sm"
              className="rounded-xl bg-white hover:bg-neutral-100 text-xs font-medium cursor-pointer border-neutral-200"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          }
        />

        {/* SEARCH & FILTERS */}
        <div className="p-4 rounded-2xl bg-white border border-neutral-200/80 shadow-xs space-y-3">
          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
              <Input
                type="text"
                placeholder="Search transaction ID, order ID, customer name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 rounded-xl text-xs bg-neutral-50/50 border-neutral-200 w-full"
              />
            </div>
            <Button type="submit" size="sm" className="rounded-xl text-xs cursor-pointer">
              Search
            </Button>
          </form>

          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-neutral-100 text-xs">
            <span className="text-neutral-400 flex items-center gap-1 font-medium">
              <Filter className="w-3.5 h-3.5" /> Filters:
            </span>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
              className="px-2.5 py-1 rounded-lg border border-neutral-200 bg-white text-xs font-medium cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="success">Successful (Verified)</option>
              <option value="failed">Failed</option>
              <option value="pending">Pending</option>
            </select>

            {/* Plan Filter */}
            <select
              value={planFilter}
              onChange={(e) => {
                setPlanFilter(e.target.value)
                setPage(1)
              }}
              className="px-2.5 py-1 rounded-lg border border-neutral-200 bg-white text-xs font-medium cursor-pointer"
            >
              <option value="all">All Plans</option>
              <option value="bronze">Bronze</option>
              <option value="silver">Silver</option>
              <option value="gold">Gold</option>
            </select>

            <div className="ml-auto text-neutral-500 font-medium">
              Total {totalCount} transaction{totalCount === 1 ? "" : "s"}
            </div>
          </div>
        </div>

        {/* PAYMENTS TABLE */}
        <div className="rounded-2xl bg-white border border-neutral-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-neutral-200/80 bg-neutral-50/70 text-neutral-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Transaction ID</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Plan Tier</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4 text-right">Date & Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-neutral-400">
                      <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2" />
                      Loading transactions...
                    </td>
                  </tr>
                ) : payments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-neutral-400">
                      No payment transactions found matching criteria.
                    </td>
                  </tr>
                ) : (
                  payments.map((p) => {
                    const isSuccess = p.status === "success" || p.status === "successful"
                    const isFailed = p.status === "failed"

                    return (
                      <tr key={p._id} className="hover:bg-neutral-50/50 transition-colors">
                        <td className="py-3 px-4 font-mono font-medium text-neutral-900 select-all">
                          {p.transactionId}
                          {p.orderId && (
                            <div className="text-[10px] text-neutral-400 truncate max-w-[140px]">
                              {p.orderId}
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-bold text-neutral-900">{p.user?.name || "Customer"}</div>
                          <div className="text-[11px] text-neutral-500 truncate max-w-[160px]">
                            {p.user?.email || "—"}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1 font-bold text-neutral-800 uppercase text-[11px]">
                            <Crown className="w-3 h-3 text-amber-500" />
                            {p.plan}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <span className="text-sm font-black text-neutral-900">
                            ₹{p.amount.toLocaleString()}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${
                              isSuccess
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : isFailed
                                ? "bg-red-50 text-red-700 border border-red-200"
                                : "bg-neutral-100 text-neutral-600 border border-neutral-200"
                            }`}
                          >
                            {isSuccess ? (
                              <CheckCircle2 className="w-2.5 h-2.5" />
                            ) : isFailed ? (
                              <XCircle className="w-2.5 h-2.5" />
                            ) : (
                              <Clock className="w-2.5 h-2.5" />
                            )}
                            {p.status}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-neutral-600 capitalize">
                          {p.paymentMethod || "card"}
                        </td>

                        <td className="py-3 px-4 text-right text-neutral-500">
                          {p.createdAt ? new Date(p.createdAt).toLocaleString() : "—"}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* PAGINATION */}
          <div className="flex items-center justify-between p-4 border-t border-neutral-100 text-xs text-neutral-500">
            <div>
              Page {page} of {totalPages} ({totalCount} total)
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-8 px-2.5 rounded-lg cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
                className="h-8 px-2.5 rounded-lg cursor-pointer"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
