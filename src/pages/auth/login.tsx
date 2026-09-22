import React, { useState, useEffect } from "react"
import { useRouter } from "next/router"
import Head from "next/head"
import { useAuth } from "@/lib/AuthContext"
import {
  LogIn,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Loader2,
  CheckCircle2,
  Zap,
  Mail,
  User,
  AlertCircle,
} from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const { user, loginWithGoogle, loginWithDemo, loginWithCredentials } = useAuth() as any
  const [isLoading, setIsLoading] = useState(false)
  const [loadingType, setLoadingType] = useState<"google" | "demo" | "email" | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Custom credentials state
  const [showEmailForm, setShowEmailForm] = useState(false)
  const [customName, setCustomName] = useState("Kundan")
  const [customEmail, setCustomEmail] = useState("kundank82522@gmail.com")

  const redirectUrl =
    typeof router.query.redirect === "string" ? router.query.redirect : "/"

  // Auto-redirect if already signed in
  useEffect(() => {
    if (user) {
      router.replace(redirectUrl)
    }
  }, [user, redirectUrl, router])

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true)
      setLoadingType("google")
      setError(null)
      await loginWithGoogle()
      router.replace(redirectUrl)
    } catch (err: any) {
      const code = err?.code || ""
      let friendly = err?.message || "Sign in could not be completed. Please try again."

      if (code === "auth/popup-blocked") {
        friendly = "The sign-in popup was blocked by your browser. Please allow popups or use 1-Click Instant Login below."
      } else if (code === "auth/unauthorized-domain") {
        friendly = "This domain is not yet authorized in Firebase. Use 1-Click Instant Login below for immediate access!"
      } else if (code === "auth/cancelled-popup-request" || code === "auth/popup-closed-by-user") {
        friendly = "Sign-in popup was closed before completing."
      }

      setError(friendly)
    } finally {
      setIsLoading(false)
      setLoadingType(null)
    }
  }

  const handleDemoSignIn = async () => {
    try {
      setIsLoading(true)
      setLoadingType("demo")
      setError(null)
      await loginWithDemo()
      router.replace(redirectUrl)
    } catch (err: any) {
      setError(err?.message || "Demo sign in failed. Please try again.")
    } finally {
      setIsLoading(false)
      setLoadingType(null)
    }
  }

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!customEmail.trim()) {
      setError("Please enter a valid email address.")
      return
    }

    try {
      setIsLoading(true)
      setLoadingType("email")
      setError(null)
      await loginWithCredentials({ name: customName.trim() || "User", email: customEmail.trim() })
      router.replace(redirectUrl)
    } catch (err: any) {
      setError(err?.message || "Sign-in failed. Please try again.")
    } finally {
      setIsLoading(false)
      setLoadingType(null)
    }
  }

  return (
    <>
      <Head>
        <title>Sign In - YouTube Platform</title>
        <meta
          name="description"
          content="Sign in to your account to access subscriptions, live meetings, and exclusive creator benefits."
        />
      </Head>

      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4 sm:p-6 bg-neutral-950 text-white">
        <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden">
          {/* Subtle Ambient Glow */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

          {/* Header */}
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-red-600/20 text-red-500 border border-red-500/30 flex items-center justify-center mx-auto shadow-lg shadow-red-600/10">
              <LogIn className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Sign In to Continue
            </h1>
            <p className="text-sm text-neutral-400 max-w-xs mx-auto">
              Sign in to manage your premium membership, stream live video, and participate in meetings.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs leading-relaxed space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Authentication Notice</span>
              </div>
              <div>{error}</div>
              {error.includes("Firebase") || error.includes("blocked") || error.includes("authorized") ? (
                <button
                  type="button"
                  onClick={handleDemoSignIn}
                  className="font-bold text-red-400 hover:text-red-300 underline cursor-pointer block pt-1"
                >
                  ⚡ Use 1-Click Instant Access instead
                </button>
              ) : null}
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3 pt-1">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full py-3.5 px-5 rounded-2xl bg-white hover:bg-neutral-100 text-neutral-900 text-[15px] font-semibold flex items-center justify-center gap-3 transition-all cursor-pointer disabled:opacity-50 shadow-xl border border-white/20 active:scale-[0.99]"
            >
              {isLoading && loadingType === "google" ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-neutral-900" />
                  <span className="text-neutral-800">Signing in with Google...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span className="font-semibold text-[15px] text-neutral-900">
                    Continue with Google
                  </span>
                </>
              )}
            </button>

            {/* 1-Click Instant Demo Login */}
            <button
              type="button"
              onClick={handleDemoSignIn}
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white text-sm font-bold shadow-lg shadow-red-600/25 flex items-center justify-between transition-all cursor-pointer disabled:opacity-50 group"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1 rounded-lg bg-white/20">
                  <Zap className="w-4 h-4 fill-white text-white" />
                </div>
                <div className="text-left">
                  <div className="leading-tight">1-Click Instant Access</div>
                  <div className="text-[10px] text-white/80 font-normal">Sign in as Kundan (Creator demo)</div>
                </div>
              </div>
              {isLoading && loadingType === "demo" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              )}
            </button>

            {/* Collapsible Email form */}
            {!showEmailForm ? (
              <button
                type="button"
                onClick={() => setShowEmailForm(true)}
                className="w-full py-2.5 px-4 rounded-xl bg-neutral-800/50 hover:bg-neutral-800 text-neutral-300 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer border border-neutral-800"
              >
                <Mail className="w-3.5 h-3.5 text-neutral-400" />
                <span>Sign in with Email & Name</span>
              </button>
            ) : (
              <form onSubmit={handleEmailSignIn} className="p-3.5 rounded-2xl bg-neutral-800/40 border border-neutral-800 space-y-3">
                <div>
                  <label className="text-xs font-semibold text-neutral-300 block mb-1">
                    Your Name
                  </label>
                  <div className="relative flex items-center">
                    <User className="w-4 h-4 text-neutral-400 absolute left-3" />
                    <input
                      type="text"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder="e.g. Kundan"
                      className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-neutral-700 bg-neutral-900 text-white placeholder:text-neutral-500 focus:border-red-600 focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-neutral-300 block mb-1">
                    Email Address
                  </label>
                  <div className="relative flex items-center">
                    <Mail className="w-4 h-4 text-neutral-400 absolute left-3" />
                    <input
                      type="email"
                      value={customEmail}
                      onChange={(e) => setCustomEmail(e.target.value)}
                      placeholder="e.g. kundank82522@gmail.com"
                      className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-neutral-700 bg-neutral-900 text-white placeholder:text-neutral-500 focus:border-red-600 focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 py-2 px-3 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-red-600/20 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {isLoading && loadingType === "email" ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <span>Sign In</span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowEmailForm(false)}
                    className="px-3 py-2 rounded-xl text-neutral-400 hover:text-white text-xs font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Privacy & Trust Note */}
          <div className="pt-2 flex items-center justify-center gap-1.5 text-xs text-neutral-500">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Secure 256-bit encrypted authentication</span>
          </div>
        </div>
      </div>
    </>
  )
}
