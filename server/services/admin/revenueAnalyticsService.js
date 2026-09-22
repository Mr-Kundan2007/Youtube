import PaymentTransaction from "../../Modals/PaymentTransaction.js"

export class RevenueAnalyticsService {
  /**
   * Helper: Calculates rupee amount from transaction document (handles paise vs rupees safely).
   */
  _normalizeAmount(t) {
    if (!t) return 0
    const amt = Number(t.amount) || 0
    return amt > 1000 && !t.amountInRupees ? amt / 100 : amt
  }

  /**
   * Returns lifetime total verified revenue in INR.
   */
  async getTotalRevenue() {
    const transactions = await PaymentTransaction.find({
      status: { $in: ["success", "successful"] },
    })
      .select("amount amountInRupees currency")
      .lean()

    let total = 0
    transactions.forEach((t) => {
      total += this._normalizeAmount(t)
    })

    return {
      totalRevenue: Math.round(total * 100) / 100,
      currency: "INR",
      transactionCount: transactions.length,
    }
  }

  /**
   * Returns revenue for today (from midnight UTC to now).
   */
  async getTodayRevenue() {
    const startOfToday = new Date()
    startOfToday.setUTCHours(0, 0, 0, 0)

    const transactions = await PaymentTransaction.find({
      status: { $in: ["success", "successful"] },
      createdAt: { $gte: startOfToday },
    })
      .select("amount amountInRupees")
      .lean()

    let total = 0
    transactions.forEach((t) => {
      total += this._normalizeAmount(t)
    })

    return {
      todayRevenue: Math.round(total * 100) / 100,
      currency: "INR",
      transactionCount: transactions.length,
    }
  }

  /**
   * Returns revenue for the current month (from 1st of month to now).
   */
  async getMonthlyRevenue() {
    const startOfMonth = new Date()
    startOfMonth.setUTCDate(1)
    startOfMonth.setUTCHours(0, 0, 0, 0)

    const transactions = await PaymentTransaction.find({
      status: { $in: ["success", "successful"] },
      createdAt: { $gte: startOfMonth },
    })
      .select("amount amountInRupees")
      .lean()

    let total = 0
    transactions.forEach((t) => {
      total += this._normalizeAmount(t)
    })

    return {
      monthlyRevenue: Math.round(total * 100) / 100,
      currency: "INR",
      transactionCount: transactions.length,
    }
  }

  /**
   * Returns revenue for the current quarter (last 90 days).
   */
  async getQuarterlyRevenue() {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)

    const transactions = await PaymentTransaction.find({
      status: { $in: ["success", "successful"] },
      createdAt: { $gte: cutoff },
    })
      .select("amount amountInRupees")
      .lean()

    let total = 0
    transactions.forEach((t) => {
      total += this._normalizeAmount(t)
    })

    return {
      quarterlyRevenue: Math.round(total * 100) / 100,
      currency: "INR",
      transactionCount: transactions.length,
    }
  }

  /**
   * Returns revenue for the current year (from Jan 1st UTC to now).
   */
  async getYearlyRevenue() {
    const startOfYear = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1))

    const transactions = await PaymentTransaction.find({
      status: { $in: ["success", "successful"] },
      createdAt: { $gte: startOfYear },
    })
      .select("amount amountInRupees")
      .lean()

    let total = 0
    transactions.forEach((t) => {
      total += this._normalizeAmount(t)
    })

    return {
      yearlyRevenue: Math.round(total * 100) / 100,
      currency: "INR",
      transactionCount: transactions.length,
    }
  }

  /**
   * Aggregates revenue breakdown by plan (Bronze, Silver, Gold).
   */
  async getRevenueByPlan() {
    const transactions = await PaymentTransaction.find({
      status: { $in: ["success", "successful"] },
    })
      .select("planKey amount amountInRupees")
      .lean()

    const planRevenue = {
      bronze: { revenue: 0, count: 0 },
      silver: { revenue: 0, count: 0 },
      gold: { revenue: 0, count: 0 },
    }

    let overallTotal = 0

    transactions.forEach((t) => {
      const plan = (t.planKey || "bronze").toLowerCase()
      const amt = this._normalizeAmount(t)
      overallTotal += amt

      if (!planRevenue[plan]) {
        planRevenue[plan] = { revenue: 0, count: 0 }
      }
      planRevenue[plan].revenue += amt
      planRevenue[plan].count += 1
    })

    // Compute percentages
    const breakdown = Object.entries(planRevenue).map(([plan, data]) => {
      const rev = Math.round(data.revenue * 100) / 100
      const percentage =
        overallTotal > 0 ? Math.round((data.revenue / overallTotal) * 1000) / 10 : 0
      return {
        plan,
        name: plan.toUpperCase(),
        revenue: rev,
        count: data.count,
        percentage,
      }
    })

    return {
      breakdown,
      overallTotal: Math.round(overallTotal * 100) / 100,
    }
  }

  /**
   * Returns revenue trend time-series data for charting.
   */
  async getRevenueTrend({ period = "monthly", dateRange = "30d", from = null, to = null } = {}) {
    let startDate
    let endDate = to ? new Date(to) : new Date()

    if (from) {
      startDate = new Date(from)
    } else {
      let days = 30
      if (period === "daily" || dateRange === "7d") days = 14
      else if (period === "monthly" || dateRange === "90d") days = 180
      else if (period === "yearly" || dateRange === "1y") days = 365 * 3
      startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    }

    const transactions = await PaymentTransaction.find({
      status: { $in: ["success", "successful"] },
      createdAt: { $gte: startDate, $lte: endDate },
    })
      .select("amount amountInRupees createdAt")
      .sort({ createdAt: 1 })
      .lean()

    const pointsMap = new Map()

    if (period === "monthly") {
      // Group by month YYYY-MM
      for (let i = 5; i >= 0; i--) {
        const d = new Date()
        d.setMonth(d.getMonth() - i)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
        const monthName = d.toLocaleString("default", { month: "short" })
        pointsMap.set(key, { date: key, label: `${monthName} ${d.getFullYear()}`, revenue: 0, transactions: 0 })
      }
    } else if (period === "yearly") {
      // Group by year YYYY
      const currentYear = new Date().getFullYear()
      for (let y = currentYear - 2; y <= currentYear; y++) {
        const key = String(y)
        pointsMap.set(key, { date: key, label: String(y), revenue: 0, transactions: 0 })
      }
    } else {
      // Group by daily YYYY-MM-DD
      const diffDays = Math.min(30, Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)))
      for (let i = 0; i <= diffDays; i++) {
        const d = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000)
        const key = d.toISOString().slice(0, 10)
        const label = `${d.getDate()} ${d.toLocaleString("default", { month: "short" })}`
        pointsMap.set(key, { date: key, label, revenue: 0, transactions: 0 })
      }
    }

    transactions.forEach((t) => {
      let key
      const txDate = new Date(t.createdAt)
      if (period === "monthly") {
        key = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, "0")}`
      } else if (period === "yearly") {
        key = String(txDate.getFullYear())
      } else {
        key = txDate.toISOString().slice(0, 10)
      }

      const amt = this._normalizeAmount(t)
      if (!pointsMap.has(key)) {
        pointsMap.set(key, { date: key, label: key, revenue: 0, transactions: 0 })
      }
      const pt = pointsMap.get(key)
      pt.revenue += amt
      pt.transactions += 1
    })

    const points = Array.from(pointsMap.values()).map((p) => ({
      date: p.date,
      label: p.label || p.date,
      revenue: Math.round(p.revenue * 100) / 100,
      transactions: p.transactions,
    }))

    const totalRev = points.reduce((acc, p) => acc + p.revenue, 0)
    const totalTx = points.reduce((acc, p) => acc + p.transactions, 0)

    return {
      points,
      data: points,
      summary: {
        totalRevenue: Math.round(totalRev * 100) / 100,
        totalTransactions: totalTx,
        averageTransactionValue: totalTx > 0 ? Math.round(totalRev / totalTx) : 0,
      },
      totalPeriodRevenue: Math.round(totalRev * 100) / 100,
      totalPeriodTransactions: totalTx,
      from: startDate.toISOString(),
      to: endDate.toISOString(),
    }
  }

  async getRevenueTimeSeries(opts = {}) {
    return this.getRevenueTrend(opts)
  }

  /**
   * Aggregates comprehensive revenue summary cards.
   */
  async getRevenueSummary() {
    const [total, today, monthly, quarterly, yearly, byPlan] = await Promise.all([
      this.getTotalRevenue(),
      this.getTodayRevenue(),
      this.getMonthlyRevenue(),
      this.getQuarterlyRevenue(),
      this.getYearlyRevenue(),
      this.getRevenueByPlan(),
    ])

    return {
      today: today.todayRevenue,
      monthly: monthly.monthlyRevenue,
      quarterly: quarterly.quarterlyRevenue,
      yearly: yearly.yearlyRevenue,
      lifetime: total.totalRevenue,
      transactionCount: total.transactionCount,
      currency: "INR",
      byPlan: byPlan.breakdown,
    }
  }
}

export const revenueAnalyticsService = new RevenueAnalyticsService()
export const getPlatformRevenueStats = () => revenueAnalyticsService.getRevenueSummary()
export const getRevenueSummary = () => revenueAnalyticsService.getRevenueSummary()
export const getRevenueTimeSeries = (opts) => revenueAnalyticsService.getRevenueTimeSeries(opts)
export const getTotalRevenue = () => revenueAnalyticsService.getTotalRevenue()
export const getTodayRevenue = () => revenueAnalyticsService.getTodayRevenue()
export const getMonthlyRevenue = () => revenueAnalyticsService.getMonthlyRevenue()
export const getQuarterlyRevenue = () => revenueAnalyticsService.getQuarterlyRevenue()
export const getYearlyRevenue = () => revenueAnalyticsService.getYearlyRevenue()
export const getRevenueByPlan = () => revenueAnalyticsService.getRevenueByPlan()
export default revenueAnalyticsService
