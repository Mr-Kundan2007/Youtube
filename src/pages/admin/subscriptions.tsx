import React, { useState, useEffect } from "react"
import Head from "next/head"
import Link from "next/link"
import {
  TrendingUp,
  DollarSign,
  Users,
  CreditCard,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  Crown,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Calendar,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/AuthContext"
import AdminSubscriptionNav from "@/components/admin/AdminSubscriptionNav"
import {
  adminSubscriptionService,
  SubscriptionKPIs,
  RevenueTrendsData,
} from "@/services/adminSubscriptionService"

export default function AdminSubscriptionsPage() {
  const { user, loading: authLoading }: any = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [kpis, setKpis] = useState<SubscriptionKPIs | null>(null)
  const [trendPeriod, setTrendPeriod] = useState<"daily" | "monthly" | "yearly">("monthly")
  const [trends, setTrends] = useState<RevenueTrendsData | null>(null)
  const [trendLoading, setTrendLoading] = useState(false)

  const isAdmin = user?.role === "admin" || user?.result?.role === "admin"

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [overviewData, trendsData] = await Promise.all([
        adminSubscriptionService.getAnalyticsOverview(),
        adminSubscriptionService.getRevenueTrends(trendPeriod),
      ])
      setKpis(overviewData)
      setTrends(trendsData)
    } catch (err: any) {
      console.error("Failed to load admin subscription analytics:", err)
      setError(err.response?.data?.message || err.message || "Failed to load analytics data")
    } finally {
      setLoading(false)
    }
  }

  const handlePeriodChange = async (period: "daily" | "monthly" | "yearly") => {
    setTrendPeriod(period)
    setTrendLoading(true)
    try {
      const trendsData = await adminSubscriptionService.getRevenueTrends(period)
      setTrends(trendsData)
    } catch (err) {
      console.error("Failed to load revenue trends:", err)
    } finally {
      setTrendLoading(false)
    }
  }

  useEffect(() => {
    if (!authLoading && isAdmin) {
      loadData()
    }
  }, [authLoading, isAdmin])

  if (authLoading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Verifying admin authentication...</span>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mb-4">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-neutral-900 mb-1">Access Restricted</h1>
        <p className="text-sm text-neutral-500 max-w-md mb-4">
          You must have administrative privileges to access the subscription analytics and management dashboard.
        </p>
        <Link href="/">
          <Button variant="outline" className="rounded-xl">Return to Homepage</Button>
        </Link>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Subscription Analytics & Platform Controls — Admin Suite</title>
      </Head>

      <div className="min-h-screen bg-neutral-50/60 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
        <AdminSubscriptionNav
          title="Subscription & Revenue Analytics"
          description="Real-time telemetry on subscriber growth, verified ARR/MRR revenue streams, plan distribution, and platform health."
          actionSlot={
            <Button
              onClick={loadData}
              variant="outline"
              size="sm"
              disabled={loading}
              className="rounded-xl bg-white hover:bg-neutral-100 text-xs font-medium cursor-pointer border-neutral-200"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              Refresh Analytics
            </Button>
          }
        />

        {error && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <div className="flex-1">{error}</div>
            <Button size="sm" variant="outline" onClick={loadData} className="text-xs">Retry</Button>
          </div>
        )}

        {/* System Health Alerts */}
        {kpis?.alerts && kpis.alerts.length > 0 && (
          <div className="space-y-2">
            {kpis.alerts.map((a, idx) => (
              <div
                key={idx}
                className={`p-3.5 rounded-xl border text-xs flex items-start gap-3 ${
                  a.type === "error"
                    ? "bg-red-50 border-red-200 text-red-800"
                    : a.type === "warning"
                    ? "bg-amber-50 border-amber-200 text-amber-800"
                    : "bg-blue-50 border-blue-200 text-blue-800"
                }`}
              >
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold mr-2">{a.title}:</span>
                  <span>{a.message}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TOP METRIC CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Lifetime Revenue */}
          <div className="p-5 rounded-2xl bg-white border border-neutral-200/80 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-xs font-medium uppercase tracking-wider">Lifetime Revenue</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-neutral-900 tracking-tight">
              ₹{(kpis?.revenue?.lifetime || 0).toLocaleString("en-IN")}
            </div>
            <div className="text-[11px] text-neutral-500 flex items-center gap-1">
              <span>{kpis?.revenue?.transactionCount || 0} verified transactions</span>
            </div>
          </div>

          {/* Monthly Revenue (MRR) */}
          <div className="p-5 rounded-2xl bg-white border border-neutral-200/80 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-xs font-medium uppercase tracking-wider">Revenue This Month</span>
              <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-neutral-900 tracking-tight">
              ₹{(kpis?.revenue?.monthly || 0).toLocaleString("en-IN")}
            </div>
            <div className="text-[11px] text-emerald-600 flex items-center gap-1 font-medium">
              <span>Today: ₹{(kpis?.revenue?.today || 0).toLocaleString("en-IN")}</span>
            </div>
          </div>

          {/* Paid Subscribers */}
          <div className="p-5 rounded-2xl bg-white border border-neutral-200/80 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-xs font-medium uppercase tracking-wider">Paid Subscribers</span>
              <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                <Crown className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-neutral-900 tracking-tight">
              {(kpis?.subscribers?.paidSubscribers || 0).toLocaleString()}
            </div>
            <div className="text-[11px] text-neutral-500 flex items-center justify-between">
              <span>Active: {kpis?.subscribers?.activeSubscriptions || 0}</span>
              <span>Free: {kpis?.subscribers?.freeSubscribers || 0}</span>
            </div>
          </div>

          {/* Conversion & Renewal */}
          <div className="p-5 rounded-2xl bg-white border border-neutral-200/80 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-xs font-medium uppercase tracking-wider">Renewal Health</span>
              <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                <Activity className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-neutral-900 tracking-tight">
              {kpis?.rates?.renewalRate || 0}%
            </div>
            <div className="text-[11px] text-neutral-500 flex items-center justify-between">
              <span>Conversion: {kpis?.rates?.conversionRate || 0}%</span>
              <span>Cancel: {kpis?.rates?.cancellationRate || 0}%</span>
            </div>
          </div>
        </div>

        {/* INTERACTIVE REVENUE TRENDS */}
        <div className="p-6 rounded-2xl bg-white border border-neutral-200/80 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-neutral-900">Revenue Trends & Time-Series</h2>
              <p className="text-xs text-neutral-500">
                Verified subscription revenue collections over selected time horizon
              </p>
            </div>
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-neutral-100 border border-neutral-200">
              {(["daily", "monthly", "yearly"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handlePeriodChange(p)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium capitalize cursor-pointer transition-all ${
                    trendPeriod === p
                      ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-2xs font-semibold"
                      : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {trendLoading ? (
            <div className="h-64 flex items-center justify-center text-xs text-neutral-400">
              <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              Loading {trendPeriod} revenue trends...
            </div>
          ) : trends?.data && trends.data.length > 0 ? (
            <div className="space-y-4">
              {/* Responsive SVG / CSS Bar Chart */}
              <div className="h-60 flex items-end gap-2 sm:gap-3 pt-6 pb-2 border-b border-neutral-100 overflow-x-auto">
                {(() => {
                  const maxVal = Math.max(...trends.data.map((d) => d.revenue), 1)
                  return trends.data.map((point, idx) => {
                    const heightPercent = Math.max(8, Math.round((point.revenue / maxVal) * 100))
                    return (
                      <div key={idx} className="flex-1 min-w-[36px] flex flex-col items-center gap-2 group relative">
                        {/* Tooltip */}
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-10 bg-neutral-900 text-white text-[10px] rounded-lg py-1 px-2 pointer-events-none whitespace-nowrap z-10 shadow-lg">
                          ₹{point.revenue.toLocaleString()} ({point.transactions} tx)
                        </div>
                        <div
                          className="w-full rounded-t-lg bg-emerald-500/80 group-hover:bg-emerald-600 transition-all"
                          style={{ height: `${heightPercent}%` }}
                        />
                        <span className="text-[10px] text-neutral-500 font-medium truncate w-full text-center">
                          {point.label}
                        </span>
                      </div>
                    )
                  })
                })()}
              </div>

              {/* Summary beneath chart */}
              <div className="flex flex-wrap items-center justify-between text-xs text-neutral-500 pt-2 gap-4">
                <div>
                  Period Total:{" "}
                  <span className="font-bold text-neutral-900">
                    ₹{(trends?.summary?.totalRevenue || 0).toLocaleString()}
                  </span>
                </div>
                <div>
                  Transactions:{" "}
                  <span className="font-bold text-neutral-900">
                    {trends?.summary?.totalTransactions || 0}
                  </span>
                </div>
                <div>
                  Avg Transaction:{" "}
                  <span className="font-bold text-neutral-900">
                    ₹{Math.round(trends?.summary?.averageTransactionValue || 0)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-xs text-neutral-400">
              No revenue transactions recorded for this period yet.
            </div>
          )}
        </div>

        {/* PLAN DISTRIBUTION & BREAKDOWN */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Plan Distribution */}
          <div className="p-6 rounded-2xl bg-white border border-neutral-200/80 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-neutral-900">Plan Tier Distribution</h2>
            <p className="text-xs text-neutral-500">Active subscriber spread across tier levels</p>

            <div className="space-y-3 pt-2">
              {kpis?.distribution && kpis.distribution.length > 0 ? (
                kpis.distribution.map((d) => (
                  <div key={d.plan} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className="capitalize font-bold text-neutral-800">{d.plan}</span>
                      <span className="text-neutral-500">
                        {d.count} ({d.percentage}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-neutral-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          d.plan === "gold"
                            ? "bg-amber-500"
                            : d.plan === "silver"
                            ? "bg-slate-400"
                            : d.plan === "bronze"
                            ? "bg-amber-700"
                            : "bg-neutral-400"
                        }`}
                        style={{ width: `${d.percentage}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-neutral-400">No subscribers registered yet.</div>
              )}
            </div>
          </div>

          {/* Revenue by Plan */}
          <div className="p-6 rounded-2xl bg-white border border-neutral-200/80 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-neutral-900">Revenue by Plan Tier</h2>
            <p className="text-xs text-neutral-500">Cumulative verified earnings generated per tier</p>

            <div className="space-y-3 pt-2">
              {kpis?.revenue?.byPlan && kpis.revenue.byPlan.length > 0 ? (
                kpis.revenue.byPlan.map((p) => (
                  <div key={p.plan} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className="capitalize font-bold text-neutral-800">{p.plan}</span>
                      <span className="text-neutral-500">
                        ₹{p.revenue.toLocaleString()} ({p.percentage}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-neutral-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${p.percentage}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-neutral-400">No plan revenue transactions yet.</div>
              )}
            </div>
          </div>
        </div>

        {/* BUSINESS RATIOS & HEALTH */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl bg-white border border-neutral-200/80 shadow-xs space-y-2">
            <span className="text-xs font-medium text-neutral-500 uppercase">ARPU (All Users)</span>
            <div className="text-xl font-bold text-neutral-900">
              ₹{kpis?.rates?.arpu || 0}
            </div>
            <p className="text-[11px] text-neutral-400">Average Revenue Per Total User</p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-neutral-200/80 shadow-xs space-y-2">
            <span className="text-xs font-medium text-neutral-500 uppercase">ARPPU (Paid Users)</span>
            <div className="text-xl font-bold text-neutral-900">
              ₹{kpis?.rates?.arppu || 0}
            </div>
            <p className="text-[11px] text-neutral-400">Average Revenue Per Paying Subscriber</p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-neutral-200/80 shadow-xs space-y-2">
            <span className="text-xs font-medium text-neutral-500 uppercase">Gateway Health</span>
            <div className="text-xl font-bold text-emerald-600">
              {kpis?.paymentHealth?.successRate || 100}%
            </div>
            <p className="text-[11px] text-neutral-400">
              Payment success rate ({kpis?.paymentHealth?.failedPayments || 0} failures)
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
