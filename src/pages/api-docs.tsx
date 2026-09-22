import React, { useState } from "react"
import Head from "next/head"
import Link from "next/link"
import {
  Code,
  Search,
  Lock,
  Globe,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Terminal,
  BookOpen,
  ArrowRight,
} from "lucide-react"

interface EndpointDoc {
  id: string
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH"
  path: string
  title: string
  category: string
  auth: "Public" | "User" | "Admin"
  description: string
  headers?: Record<string, string>
  params?: { name: string; type: string; required: boolean; description: string }[]
  body?: Record<string, unknown>
  response: Record<string, unknown>
  errors: { code: number; description: string }[]
}

const API_ENDPOINTS: EndpointDoc[] = [
  // 1. Subscription Plans
  {
    id: "sub-plans",
    method: "GET",
    path: "/api/subscription/plans",
    title: "Retrieve Public Subscription Plans",
    category: "Subscription Plans",
    auth: "Public",
    description: "Fetches all active subscription tiers (Free, Bronze, Silver, Gold), pricing options (Monthly, Quarterly, Yearly), and feature limits.",
    response: {
      success: true,
      data: {
        plans: [
          {
            key: "free",
            name: "Free",
            price: 0,
            features: { maxResolution: "720p", downloadLimitPerDay: 1, maxDevices: 1, adFree: false }
          },
          {
            key: "silver",
            name: "Silver",
            price: 499,
            features: { maxResolution: "1440p", downloadLimitPerDay: 15, maxDevices: 5, adFree: true }
          }
        ]
      }
    },
    errors: [
      { code: 500, description: "Internal server or database error" }
    ]
  },
  // 2. User Subscription Status
  {
    id: "sub-me",
    method: "GET",
    path: "/api/subscription/me",
    title: "Get Current User Subscription",
    category: "Customer Subscriptions",
    auth: "User",
    description: "Retrieves the authenticated user's current subscription tier, active validity, expiry date, and remaining allowances.",
    headers: { Authorization: "Bearer <JWT_TOKEN>" },
    response: {
      success: true,
      data: {
        planKey: "silver",
        planName: "Silver",
        status: "active",
        expiresAt: "2026-10-07T18:00:00.000Z",
        autoRenew: true,
        features: { maxResolution: "1440p", adFree: true, offlineDownloads: true }
      }
    },
    errors: [
      { code: 401, description: "Missing or expired Bearer authentication token" }
    ]
  },
  {
    id: "sub-change-plan",
    method: "POST",
    path: "/api/subscription/change-plan",
    title: "Request Plan Upgrade / Downgrade",
    category: "Customer Subscriptions",
    auth: "User",
    description: "Initiates an upgrade calculation or schedules a downgrade effective at the end of the current billing cycle.",
    headers: { Authorization: "Bearer <JWT_TOKEN>" },
    body: {
      targetPlanKey: "gold"
    },
    response: {
      success: true,
      data: {
        action: "UPGRADE",
        currentPlan: "silver",
        targetPlan: "gold",
        requiresPayment: true
      }
    },
    errors: [
      { code: 400, description: "Invalid target plan key or already on requested tier" },
      { code: 401, description: "Authentication required" }
    ]
  },
  {
    id: "sub-cancel",
    method: "POST",
    path: "/api/subscription/cancel",
    title: "Cancel Subscription Auto-Renewal",
    category: "Customer Subscriptions",
    auth: "User",
    description: "Schedules subscription cancellation. The user retains all paid benefits until their current expiration date.",
    headers: { Authorization: "Bearer <JWT_TOKEN>" },
    body: {
      reason: "No longer needed"
    },
    response: {
      success: true,
      message: "Your subscription cancellation has been scheduled.",
      data: {
        status: "cancel_scheduled",
        retainsAccessUntil: "2026-10-07T18:00:00.000Z"
      }
    },
    errors: [
      { code: 400, description: "User does not possess an active paid subscription to cancel" },
      { code: 401, description: "Authentication required" }
    ]
  },
  // 3. Payment Orders
  {
    id: "pay-create-order",
    method: "POST",
    path: "/api/payment/create-order",
    title: "Create Razorpay Payment Order",
    category: "Razorpay Payments",
    auth: "User",
    description: "Authoritatively computes subscription pricing in paise on the server and generates a trackable Razorpay order in Test Mode.",
    headers: { Authorization: "Bearer <JWT_TOKEN>" },
    body: {
      planId: "silver",
      billingCycle: "monthly"
    },
    response: {
      success: true,
      data: {
        orderId: "order_mock9234851234",
        transactionId: "PAY-20260908-AB12CD",
        amount: 49900,
        currency: "INR",
        keyId: "rzp_test_mockkey12345678"
      }
    },
    errors: [
      { code: 400, description: "Invalid plan identifier or unsupported billing cycle" },
      { code: 401, description: "Authentication required" },
      { code: 429, description: "Rate limit threshold reached for payment order creation" }
    ]
  },
  {
    id: "pay-verify",
    method: "POST",
    path: "/api/payment/verify",
    title: "Verify Razorpay Payment Signature",
    category: "Razorpay Payments",
    auth: "User",
    description: "Cryptographically validates Razorpay HMAC-SHA256 signature, prevents replay attacks, and activates subscription immediately.",
    headers: { Authorization: "Bearer <JWT_TOKEN>" },
    body: {
      orderId: "order_mock9234851234",
      paymentId: "pay_test_9876543210",
      signature: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    response: {
      success: true,
      message: "Payment verified successfully. Subscription activated.",
      data: {
        paymentStatus: "success",
        plan: "silver",
        billingCycle: "monthly",
        invoiceNumber: "INV-20260908-X8Y9Z0"
      }
    },
    errors: [
      { code: 400, description: "Cryptographic signature verification failed" },
      { code: 403, description: "Transaction belongs to a different user account" },
      { code: 409, description: "Replay attack detected: Payment has already been verified" }
    ]
  },
  {
    id: "pay-webhook",
    method: "POST",
    path: "/api/payment/webhook",
    title: "Razorpay Webhook Handler",
    category: "Razorpay Payments",
    auth: "Public",
    description: "Processes asynchronous gateway notifications (payment.captured) with automatic idempotency deduplication via x-razorpay-event-id.",
    headers: {
      "x-razorpay-signature": "<HMAC_SHA256_HEX>",
      "x-razorpay-event-id": "<UNIQUE_EVENT_ID>"
    },
    body: {
      event: "payment.captured",
      payload: { payment: { entity: { id: "pay_test_001", amount: 49900 } } }
    },
    response: {
      status: "ok"
    },
    errors: [
      { code: 400, description: "Tampered or invalid webhook signature" }
    ]
  },
  // 4. Invoices & Billing
  {
    id: "bill-history",
    method: "GET",
    path: "/api/billing/history",
    title: "Get User Billing & Payment History",
    category: "Billing & Invoices",
    auth: "User",
    description: "Returns paginated transaction records and tax invoices for the authenticated user.",
    headers: { Authorization: "Bearer <JWT_TOKEN>" },
    params: [
      { name: "page", type: "number", required: false, description: "Page number (default: 1)" },
      { name: "limit", type: "number", required: false, description: "Records per page (default: 10)" }
    ],
    response: {
      success: true,
      data: {
        invoices: [
          {
            invoiceNumber: "INV-20260908-A1B2C3",
            amountPaid: 499,
            currency: "INR",
            planName: "Silver",
            status: "paid"
          }
        ],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 }
      }
    },
    errors: [
      { code: 401, description: "Authentication required" }
    ]
  },
  {
    id: "bill-invoice-pdf",
    method: "GET",
    path: "/api/billing/invoices/:invoiceId/pdf",
    title: "Download Invoice PDF Document",
    category: "Billing & Invoices",
    auth: "User",
    description: "Streams a tax-compliant, binary PDF receipt with 18% GST calculation (CGST/SGST split).",
    headers: { Authorization: "Bearer <JWT_TOKEN>" },
    params: [
      { name: "invoiceId", type: "string", required: true, description: "MongoDB ID of the invoice" }
    ],
    response: {
      description: "Binary application/pdf file payload (%PDF-1.4 header)"
    },
    errors: [
      { code: 403, description: "Unauthorized to access invoice belonging to another user" },
      { code: 404, description: "Invoice record not found" }
    ]
  },
  // 5. Admin Subscription Management
  {
    id: "admin-analytics",
    method: "GET",
    path: "/api/admin/subscriptions/analytics",
    title: "Subscription & Revenue Analytics",
    category: "Admin Management",
    auth: "Admin",
    description: "Provides platform-wide subscriber totals, tier distributions (Free/Bronze/Silver/Gold), and MRR revenue breakdown.",
    headers: { Authorization: "Bearer <ADMIN_JWT_TOKEN>" },
    response: {
      success: true,
      data: {
        totalSubscribers: 1540,
        activePaidSubscribers: 890,
        tierCounts: { free: 650, bronze: 320, silver: 410, gold: 160 },
        mrrEstimateInr: 418500
      }
    },
    errors: [
      { code: 401, description: "Authentication token missing" },
      { code: 403, description: "Forbidden: User does not possess administrator role" }
    ]
  },
  {
    id: "admin-extend",
    method: "POST",
    path: "/api/admin/subscriptions/subscribers/:userId/extend",
    title: "Admin Validity Extension",
    category: "Admin Management",
    auth: "Admin",
    description: "Extends a subscriber's paid validity period with a mandatory administrative audit log entry.",
    headers: { Authorization: "Bearer <ADMIN_JWT_TOKEN>" },
    body: {
      additionalDays: 30,
      reason: "Compensation for scheduled platform maintenance"
    },
    response: {
      success: true,
      data: {
        userId: "6a9f07...",
        daysAdded: 30,
        newExpiry: "2026-11-06T18:00:00.000Z"
      }
    },
    errors: [
      { code: 400, description: "Reason must be at least 5 characters" },
      { code: 403, description: "Requires administrator privileges" }
    ]
  },
  // 6. Security & Health Probes
  {
    id: "sec-health",
    method: "GET",
    path: "/api/security/health",
    title: "Operational Healthcheck Probe",
    category: "Security & Monitoring",
    auth: "Public",
    description: "Telemetry liveness probe confirming Express backend is operational, connected to MongoDB Atlas, and enforcing security headers.",
    response: {
      status: "ok",
      timestamp: "2026-09-08T00:00:00.000Z",
      database: "connected",
      uptime: 3600
    },
    errors: []
  },
  {
    id: "sec-ready",
    method: "GET",
    path: "/api/security/ready",
    title: "Deployment Readiness Probe",
    category: "Security & Monitoring",
    auth: "Public",
    description: "Verifies that all required secrets (JWT, Razorpay) are configured and that background job schedulers are active.",
    response: {
      status: "ready",
      checksPassed: 10,
      checksTotal: 10
    },
    errors: [
      { code: 503, description: "Service not ready: Database or critical configuration offline" }
    ]
  }
]

export default function ApiDocumentationPage() {
  const [search, setSearch] = useState("")
  const [selectedMethod, setSelectedMethod] = useState<string>("ALL")
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL")
  const [expandedId, setExpandedId] = useState<string | null>("sub-plans")
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const categories = Array.from(new Set(API_ENDPOINTS.map((e) => e.category)))

  const filteredEndpoints = API_ENDPOINTS.filter((e) => {
    const matchesSearch =
      e.path.toLowerCase().includes(search.toLowerCase()) ||
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      e.description.toLowerCase().includes(search.toLowerCase())
    const matchesMethod = selectedMethod === "ALL" || e.method === selectedMethod
    const matchesCategory = selectedCategory === "ALL" || e.category === selectedCategory
    return matchesSearch && matchesMethod && matchesCategory
  })

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const getMethodBadge = (method: string) => {
    switch (method) {
      case "GET":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
      case "POST":
        return "bg-sky-500/10 text-sky-400 border-sky-500/20"
      case "PUT":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20"
      case "DELETE":
        return "bg-rose-500/10 text-rose-400 border-rose-500/20"
      default:
        return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
    }
  }

  const getAuthBadge = (auth: string) => {
    switch (auth) {
      case "Public":
        return (
          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
            <Globe className="w-3 h-3 text-zinc-400" /> Public
          </span>
        )
      case "User":
        return (
          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
            <Lock className="w-3 h-3 text-indigo-400" /> User Token
          </span>
        )
      case "Admin":
        return (
          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">
            <ShieldCheck className="w-3 h-3 text-purple-400" /> Admin Role
          </span>
        )
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
      <Head>
        <title>API Reference & Documentation - YouTube Subscription Platform</title>
        <meta
          name="description"
          content="Interactive REST API specifications, request payloads, response envelopes, and authentication schemas."
        />
      </Head>

      <main className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full">
          {/* Hero Banner */}
          <div className="mb-8 border-b border-zinc-800 pb-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold uppercase tracking-wider mb-2">
                  <Terminal className="w-3.5 h-3.5" /> API Reference v1.0
                </div>
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white">
                  Subscription Platform API Documentation
                </h1>
                <p className="text-zinc-400 text-sm mt-1 max-w-2xl">
                  Comprehensive reference for subscription lifecycle, Razorpay checkout, tax invoices, content entitlements, and administrative oversight.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Link
                  href="/subscriptions"
                  className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-medium text-zinc-300 transition flex items-center gap-1.5"
                >
                  <BookOpen className="w-3.5 h-3.5 text-zinc-400" /> Pricing Catalog
                </Link>
                <Link
                  href="/billing"
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-xs font-medium text-white transition flex items-center gap-1.5"
                >
                  Billing Portal <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="relative md:col-span-1">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Search endpoints or descriptions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-red-500 transition"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
              {["ALL", "GET", "POST", "PUT", "DELETE"].map((m) => (
                <button
                  key={m}
                  onClick={() => setSelectedMethod(m)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                    selectedMethod === m
                      ? "bg-zinc-100 text-zinc-900 border-zinc-100"
                      : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            <div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-zinc-300 focus:outline-none focus:border-red-500 transition"
              >
                <option value="ALL">All Categories ({API_ENDPOINTS.length})</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Endpoints List */}
          <div className="space-y-4">
            {filteredEndpoints.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-zinc-800 rounded-xl bg-zinc-900/30">
                <Code className="w-8 h-8 mx-auto text-zinc-600 mb-2" />
                <p className="text-zinc-400 text-sm">No matching API endpoints found.</p>
              </div>
            ) : (
              filteredEndpoints.map((ep) => {
                const isExpanded = expandedId === ep.id
                return (
                  <div
                    key={ep.id}
                    className="border border-zinc-800 rounded-xl bg-zinc-900/40 backdrop-blur-sm overflow-hidden transition-all hover:border-zinc-700"
                  >
                    {/* Header Row */}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : ep.id)}
                      className="w-full text-left px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`text-xs font-bold px-2.5 py-1 rounded border tracking-wider uppercase font-mono ${getMethodBadge(
                            ep.method
                          )}`}
                        >
                          {ep.method}
                        </span>
                        <code className="text-sm font-semibold text-zinc-200 font-mono">{ep.path}</code>
                        <span className="hidden md:inline text-xs text-zinc-500">• {ep.title}</span>
                      </div>

                      <div className="flex items-center gap-3">
                        {getAuthBadge(ep.auth)}
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-zinc-500" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-zinc-500" />
                        )}
                      </div>
                    </button>

                    {/* Collapsible Details */}
                    {isExpanded && (
                      <div className="border-t border-zinc-800 p-5 bg-zinc-950/60 space-y-5 text-sm">
                        <p className="text-zinc-300 leading-relaxed">{ep.description}</p>

                        {/* Request Headers */}
                        {ep.headers && (
                          <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                              Required Headers
                            </h4>
                            <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-3 font-mono text-xs space-y-1">
                              {Object.entries(ep.headers).map(([k, v]) => (
                                <div key={k} className="flex gap-2">
                                  <span className="text-zinc-400">{k}:</span>
                                  <span className="text-emerald-400">{v}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Query / Path Parameters */}
                        {ep.params && ep.params.length > 0 && (
                          <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                              Parameters
                            </h4>
                            <div className="border border-zinc-800 rounded-lg overflow-hidden">
                              <table className="w-full text-xs text-left">
                                <thead className="bg-zinc-900 text-zinc-400">
                                  <tr>
                                    <th className="p-2.5">Parameter</th>
                                    <th className="p-2.5">Type</th>
                                    <th className="p-2.5">Required</th>
                                    <th className="p-2.5">Description</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-800 font-mono">
                                  {ep.params.map((param) => (
                                    <tr key={param.name} className="hover:bg-zinc-900/50">
                                      <td className="p-2.5 text-zinc-200">{param.name}</td>
                                      <td className="p-2.5 text-sky-400">{param.type}</td>
                                      <td className="p-2.5">
                                        {param.required ? (
                                          <span className="text-red-400">Yes</span>
                                        ) : (
                                          <span className="text-zinc-500">Optional</span>
                                        )}
                                      </td>
                                      <td className="p-2.5 text-zinc-400 font-sans">{param.description}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Request Body Payload */}
                        {ep.body && (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                                Request Body (JSON)
                              </h4>
                              <button
                                onClick={() => copyToClipboard(JSON.stringify(ep.body, null, 2), `req-${ep.id}`)}
                                className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1"
                              >
                                {copiedId === `req-${ep.id}` ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                                Copy
                              </button>
                            </div>
                            <pre className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 font-mono text-xs text-zinc-300 overflow-x-auto">
                              {JSON.stringify(ep.body, null, 2)}
                            </pre>
                          </div>
                        )}

                        {/* Response Example */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                              Standard 200 OK Response Envelope
                            </h4>
                            <button
                              onClick={() => copyToClipboard(JSON.stringify(ep.response, null, 2), `res-${ep.id}`)}
                              className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1"
                            >
                              {copiedId === `res-${ep.id}` ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                              Copy
                            </button>
                          </div>
                          <pre className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 font-mono text-xs text-emerald-400 overflow-x-auto">
                            {JSON.stringify(ep.response, null, 2)}
                          </pre>
                        </div>

                        {/* Status Codes */}
                        {ep.errors.length > 0 && (
                          <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                              Error Responses
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {ep.errors.map((err) => (
                                <div
                                  key={err.code}
                                  className="px-3 py-1 rounded bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 flex items-center gap-1.5"
                                >
                                  <span className="font-mono font-bold text-red-400">HTTP {err.code}</span>
                                  <span className="text-zinc-500">•</span>
                                  <span>{err.description}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </main>
    </div>
  )
}
