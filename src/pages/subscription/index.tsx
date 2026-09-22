import React from "react"
import Head from "next/head"
import Link from "next/link"
import { useRouter } from "next/router"
import {
  Crown,
  Sparkles,
  RefreshCw,
  AlertCircle,
  ArrowRight,
  Sliders,
  HelpCircle,
} from "lucide-react"

import { useAuth } from "@/lib/AuthContext"
import { useSubscription } from "@/hooks/useSubscription"
import SubscriptionOverview from "@/components/subscription/dashboard/SubscriptionOverview"
import SubscriptionStatusIndicator from "@/components/subscription/dashboard/SubscriptionStatusIndicator"
import SubscriptionValidity from "@/components/subscription/dashboard/SubscriptionValidity"
import SubscriptionFeatures from "@/components/subscription/dashboard/SubscriptionFeatures"
import SubscriptionUsage from "@/components/subscription/dashboard/SubscriptionUsage"
import PlanManagement from "@/components/subscription/dashboard/PlanManagement"
import SubscriptionHistory from "@/components/subscription/dashboard/SubscriptionHistory"
import BillingSummary from "@/components/subscription/dashboard/BillingSummary"
import SubscriptionNotification from "@/components/subscription/dashboard/SubscriptionNotification"

export default function UserSubscriptionDashboardPage() {
  const router = useRouter()
  const { user } = (useAuth() as any) || {}

  const {
    subscription,
    plan,
    status,
    isActive,
    isExpired,
    isCancelled,
    isFree,
    features,
    limits,
    usage,
    history,
    availablePlans,
    isLoading,
    error,
    refreshSubscription,
  } = useSubscription()

  // Unauthenticated view
  if (!user && !isLoading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-4 sm:p-6 text-center">
        <Head>
          <title>Subscription Dashboard | Stream & Learn</title>
        </Head>
        <div className="p-6 sm:p-8 rounded-3xl bg-neutral-900 border border-neutral-800 shadow-2xl max-w-md w-full mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-red-600/20 text-red-400 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
            <Crown className="w-8 h-8" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white">Sign In to Your Account</h2>
          <p className="text-xs sm:text-sm text-neutral-400 mt-2 leading-relaxed">
            Log in to inspect your active subscription plan, download allowances, daily streaming watch time, and plan management.
          </p>
          <div className="mt-6 space-y-2.5">
            <Link
              href="/auth/login?redirect=/subscription"
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-sm shadow-lg shadow-red-600/30 transition flex items-center justify-center gap-2"
            >
              <span>Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/subscriptions"
              className="w-full py-2.5 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold text-xs transition flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Browse All Plans</span>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const currentSlug = plan?.slug || "free"

  return (
    <div className="w-full min-h-screen bg-[var(--background)] text-[var(--foreground)] p-3 sm:p-6 md:p-8">
      <Head>
        <title>Subscription Dashboard | Stream & Learn</title>
        <meta
          name="description"
          content="Manage your video streaming subscription, track daily download quotas, monitor streaming quality, and explore plan upgrades."
        />
      </Head>

      <div className="max-w-6xl mx-auto w-full space-y-6 sm:space-y-8">
        {/* Dashboard Header Bar - Centered on Mobile */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4 text-center sm:text-left">
          <div>
            <div className="flex items-center justify-center sm:justify-start gap-2 text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1">
              <Link href="/" className="hover:text-white transition">Home</Link>
              <span>/</span>
              <span>My Account</span>
              <span>/</span>
              <span className="text-red-400">Subscription Dashboard</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 dark:text-white tracking-tight flex items-center justify-center sm:justify-start gap-2.5">
              <Crown className="w-7 h-7 text-red-500" />
              <span>Subscription Management</span>
            </h1>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-center">
            <button
              type="button"
              onClick={() => refreshSubscription()}
              disabled={isLoading}
              className="px-3.5 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:text-black dark:hover:text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-red-500" : ""}`} />
              <span>Refresh</span>
            </button>

            <Link
              href="/subscriptions"
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs shadow-md shadow-red-600/30 transition flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Compare Plans</span>
            </Link>
          </div>
        </div>

          {/* Contextual Notification Banner */}
          <SubscriptionNotification
            status={status}
            isExpired={isExpired}
            isCancelled={isCancelled}
            remainingDays={subscription?.remainingDays}
            expiryDate={subscription?.expiryDate}
            isFree={isFree}
          />

          {/* Error Banner */}
          {error && (
            <div className="p-4 rounded-2xl bg-red-950/40 border border-red-500/50 flex items-center justify-between gap-4 text-xs sm:text-sm text-red-200">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                <span>{error}</span>
              </div>
              <button
                type="button"
                onClick={() => refreshSubscription()}
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold text-xs flex items-center gap-1 transition"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retry</span>
              </button>
            </div>
          )}

          {/* Loading Skeleton State */}
          {isLoading && !subscription ? (
            <div className="space-y-6 animate-pulse">
              <div className="h-64 rounded-3xl bg-neutral-900/60 border border-neutral-800" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="h-48 rounded-3xl bg-neutral-900/60 border border-neutral-800" />
                <div className="h-48 rounded-3xl bg-neutral-900/60 border border-neutral-800" />
              </div>
            </div>
          ) : (
            <>
              {/* Current Plan Overview Hero */}
              <SubscriptionOverview subscription={subscription} />

              {/* Status Explanation Card */}
              <SubscriptionStatusIndicator
                status={status}
                isExpired={isExpired}
                isCancelled={isCancelled}
                isFree={isFree}
                expiryDate={subscription?.expiryDate}
              />

              {/* Validity & Progress Timeline */}
              <SubscriptionValidity
                startDate={subscription?.startDate}
                expiryDate={subscription?.expiryDate}
                remainingDays={subscription?.remainingDays}
                nextRenewalDate={subscription?.nextRenewalDate}
                isFree={isFree}
                isExpired={isExpired}
                autoRenew={subscription?.autoRenew}
              />

              {/* Feature Privileges Matrix */}
              <SubscriptionFeatures
                features={features}
                limits={limits}
                currentPlanSlug={currentSlug}
              />

              {/* Today's Usage Metrics */}
              <SubscriptionUsage
                usage={usage}
                limits={limits}
                currentPlanSlug={currentSlug}
              />

              {/* Plan Management (Upgrade/Downgrade/Renew/Cancel) */}
              <PlanManagement
                subscription={subscription}
                availablePlans={availablePlans}
                onRenewSuccess={refreshSubscription}
              />

              {/* Subscription Activity History */}
              <SubscriptionHistory history={history} />

              {/* Billing Summary */}
              <BillingSummary subscription={subscription} />
            </>
          )}
        </div>
      </div>
    )
  }
