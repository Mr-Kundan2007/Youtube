import PaymentTransaction from "../../Modals/PaymentTransaction.js"
import Subscription from "../../Modals/Subscription.js"
import SubscriptionPlan from "../../Modals/SubscriptionPlan.js"
import User from "../../Modals/Auth.js"
import { getAllPlansWithStats } from "./planManagementService.js"

/**
 * Escapes CSV field value according to RFC 4180
 */
const escapeCsvField = (val) => {
  if (val === null || val === undefined) return ""
  let str = String(val)
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    str = `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Convert array of objects to RFC 4180 CSV string
 */
const toCsv = (headers, rows) => {
  const headerLine = headers.map((h) => escapeCsvField(h.label)).join(",")
  const dataLines = rows.map((row) =>
    headers.map((h) => escapeCsvField(h.getter ? h.getter(row) : row[h.key])).join(",")
  )
  return [headerLine, ...dataLines].join("\r\n")
}

/**
 * Generates revenue report data & CSV
 */
export const generateRevenueReport = async ({ from, to } = {}) => {
  const query = {
    status: { $in: ["success", "successful"] },
  }

  if (from || to) {
    query.createdAt = {}
    if (from) query.createdAt.$gte = new Date(from)
    if (to) query.createdAt.$lte = new Date(to)
  }

  const transactions = await PaymentTransaction.find(query)
    .populate("userId", "name email")
    .sort({ createdAt: -1 })
    .lean()

  const formattedRows = transactions.map((t) => {
    let amt = Number(t.amount) || 0
    if (amt > 1000 && !t.amountInRupees) {
      amt = amt / 100
    }

    return {
      transactionId: t.transactionId || t._id.toString(),
      orderId: t.orderId || "",
      userName: t.userId?.name || t.metadata?.userName || "Unknown",
      userEmail: t.userId?.email || t.metadata?.userEmail || "",
      plan: (t.planKey || t.metadata?.planName || "").toUpperCase(),
      amount: Math.round(amt * 100) / 100,
      currency: t.currency || "INR",
      paymentMethod: t.paymentMethod || t.method || "card",
      status: t.status,
      date: t.createdAt ? new Date(t.createdAt).toISOString() : "",
    }
  })

  const headers = [
    { label: "Transaction ID", key: "transactionId" },
    { label: "Order ID", key: "orderId" },
    { label: "Customer Name", key: "userName" },
    { label: "Customer Email", key: "userEmail" },
    { label: "Plan", key: "plan" },
    { label: "Amount (INR)", key: "amount" },
    { label: "Currency", key: "currency" },
    { label: "Payment Method", key: "paymentMethod" },
    { label: "Status", key: "status" },
    { label: "Date & Time (UTC)", key: "date" },
  ]

  const totalRevenue = formattedRows.reduce((acc, r) => acc + r.amount, 0)

  return {
    reportType: "revenue",
    generatedAt: new Date().toISOString(),
    filter: { from, to },
    summary: {
      totalTransactions: formattedRows.length,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
    },
    rows: formattedRows,
    csv: toCsv(headers, formattedRows),
  }
}

/**
 * Generates subscriber report data & CSV
 */
export const generateSubscribersReport = async ({ plan, status } = {}) => {
  const query = {}
  if (plan && plan !== "all") {
    query.plan = plan.toLowerCase()
  }
  if (status && status !== "all") {
    query.status = status.toLowerCase()
  }

  const subscriptions = await Subscription.find(query)
    .populate("userId", "name email createdAt")
    .sort({ createdAt: -1 })
    .lean()

  const formattedRows = subscriptions.map((s) => {
    const u = s.userId && typeof s.userId === "object" ? s.userId : {}
    return {
      userId: u._id?.toString() || (s.userId ? s.userId.toString() : ""),
      name: u.name || "Unknown",
      email: u.email || "Unknown",
      plan: (s.plan || "").toUpperCase(),
      status: s.status,
      billingCycle: s.billingCycle || "monthly",
      startDate: s.startDate ? new Date(s.startDate).toISOString() : "",
      endDate: s.endDate ? new Date(s.endDate).toISOString() : "",
      autoRenew: s.autoRenew ? "Yes" : "No",
      lastRenewalDate: s.lastRenewalDate ? new Date(s.lastRenewalDate).toISOString() : "",
      cancelledAt: s.cancelledAt ? new Date(s.cancelledAt).toISOString() : "",
    }
  })

  const headers = [
    { label: "User ID", key: "userId" },
    { label: "Full Name", key: "name" },
    { label: "Email Address", key: "email" },
    { label: "Plan Tier", key: "plan" },
    { label: "Status", key: "status" },
    { label: "Billing Cycle", key: "billingCycle" },
    { label: "Start Date", key: "startDate" },
    { label: "Expiry Date", key: "endDate" },
    { label: "Auto Renew", key: "autoRenew" },
    { label: "Last Renewal", key: "lastRenewalDate" },
    { label: "Cancelled At", key: "cancelledAt" },
  ]

  return {
    reportType: "subscribers",
    generatedAt: new Date().toISOString(),
    filter: { plan, status },
    summary: {
      totalSubscribers: formattedRows.length,
      activeSubscribers: formattedRows.filter((r) => r.status === "active").length,
    },
    rows: formattedRows,
    csv: toCsv(headers, formattedRows),
  }
}

/**
 * Generates plan performance report data & CSV
 */
export const generatePlanPerformanceReport = async () => {
  const plansWithStats = await getAllPlansWithStats()

  const formattedRows = plansWithStats.map((p) => ({
    name: p.name,
    slug: p.slug,
    price: p.price,
    currency: p.currency,
    isActive: p.isActive ? "Active" : "Inactive",
    activeSubscribers: p.stats?.activeSubscribers || 0,
    totalSubscribers: p.stats?.totalSubscribers || 0,
    cancelledSubscribers: p.stats?.cancelledSubscribers || 0,
    totalRevenue: p.stats?.totalRevenue || 0,
    transactionsCount: p.stats?.transactionsCount || 0,
  }))

  const headers = [
    { label: "Plan Name", key: "name" },
    { label: "Identifier / Slug", key: "slug" },
    { label: "Price", key: "price" },
    { label: "Currency", key: "currency" },
    { label: "Status", key: "isActive" },
    { label: "Active Subscribers", key: "activeSubscribers" },
    { label: "Total Subscribers", key: "totalSubscribers" },
    { label: "Cancelled Subscribers", key: "cancelledSubscribers" },
    { label: "Total Revenue (INR)", key: "totalRevenue" },
    { label: "Total Transactions", key: "transactionsCount" },
  ]

  return {
    reportType: "plans",
    generatedAt: new Date().toISOString(),
    summary: {
      totalPlans: formattedRows.length,
    },
    rows: formattedRows,
    csv: toCsv(headers, formattedRows),
  }
}
