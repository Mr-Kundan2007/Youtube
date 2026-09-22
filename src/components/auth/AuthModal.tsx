import React, { useState, useEffect } from "react"
import { useAuth } from "@/lib/AuthContext"
import {
  X,
  Sparkles,
  Zap,
  Mail,
  User,
  ShieldCheck,
  AlertCircle,
  Loader2,
  ArrowRight,
  ExternalLink,
} from "lucide-react"
import Link from "next/link"

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, closeAuthModal, loginWithGoogle, loginWithDemo, loginWithCredentials } =
    useAuth() as any

  const [mode, setMode] = useState<"options" | "email">("options")
  const [name, setName] = useState("Kundan")
  const [email, setEmail] = useState("kundank82522@gmail.com")
  const [isLoading, setIsLoading] = useState(false)
  const [loadingType, setLoadingType] = useState<"google" | "demo" | "email" | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Reset state when modal is opened/closed
  useEffect(() => {
    if (!isAuthModalOpen) {
      setMode("options")
      setErrorMsg(null)
      setIsLoading(false)
      setLoadingType(null)
    }
  }, [isAuthModalOpen])

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isAuthModalOpen) {
        closeAuthModal()
      }
    }
    if (isAuthModalOpen) {
      window.addEventListener("keydown", handleKeyDown)
    }
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isAuthModalOpen, closeAuthModal])

  if (!isAuthModalOpen) return null

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true)
      setLoadingType("google")
      setErrorMsg(null)
      await loginWithGoogle()
    } catch (err: any) {
      const code = err?.code || ""
      let friendly = err?.message || "Google sign in could not be completed."

      if (code === "auth/popup-blocked") {
        friendly = "The Google sign-in popup was blocked by your browser. Please allow popups or use 1-Click Instant Login below."
      } else if (code === "auth/unauthorized-domain") {
        friendly = "This domain is not authorized in Firebase Console yet. Please use 1-Click Instant Login below for immediate access!"
      } else if (code === "auth/cancelled-popup-request" || code === "auth/popup-closed-by-user") {
        friendly = "Sign-in popup was closed before completing."
      }

      setErrorMsg(friendly)
    } finally {
      setIsLoading(false)
      setLoadingType(null)
    }
  }

  const handleDemoLogin = async () => {
    try {
      setIsLoading(true)
      setLoadingType("demo")
      setErrorMsg(null)
      await loginWithDemo()
    } catch (err: any) {
      setErrorMsg(err?.message || "Demo sign-in failed. Please try again.")
    } finally {
      setIsLoading(false)
      setLoadingType(null)
    }
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) {
      setErrorMsg("Please enter a valid email address.")
      return
    }

    try {
      setIsLoading(true)
      setLoadingType("email")
      setErrorMsg(null)
      await loginWithCredentials({ name: name.trim() || "User", email: email.trim() })
    } catch (err: any) {
      setErrorMsg(err?.message || "Sign-in failed. Please try again.")
    } finally {
      setIsLoading(false)
      setLoadingType(null)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          closeAuthModal()
        }
      }}
    >
      <div className="w-full max-w-md bg-[var(--card)] text-[var(--card-foreground)] rounded-3xl border border-[var(--border)] shadow-2xl p-6 sm:p-7 relative overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Subtle decorative background gradient */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={closeAuthModal}
          className="absolute top-4 right-4 text-[var(--muted-foreground)] hover:text-[var(--foreground)] p-2 rounded-full hover:bg-[var(--muted)] transition-colors cursor-pointer"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center space-y-2 mb-6">
          <div className="flex items-center justify-center gap-1.5 mb-2">
            <div className="relative flex h-7 w-9 items-center justify-center rounded-xl bg-[#FF0000] px-1 py-0.5 shadow-md shadow-red-600/30">
              <div className="h-0 w-0 border-y-[6px] border-y-transparent border-l-[10px] border-l-white ml-0.5" />
            </div>
            <span className="text-xl font-black tracking-tight text-[var(--foreground)] font-sans">
              YouTube
            </span>
          </div>

          <h2 id="auth-modal-title" className="text-xl font-bold text-[var(--foreground)] tracking-tight">
            Sign In to Continue
          </h2>
          <p className="text-xs text-[var(--muted-foreground)] max-w-xs mx-auto">
            Choose your preferred sign-in method to access subscriptions, upload videos, and stream live.
          </p>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/25 flex items-start gap-2.5 text-xs text-red-500 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">
              {errorMsg}
              {errorMsg.includes("Firebase") || errorMsg.includes("blocked") || errorMsg.includes("authorized") ? (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={handleDemoLogin}
                    className="inline-flex items-center gap-1.5 font-bold text-red-600 underline hover:no-underline cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5 fill-red-600" />
                    Click here to sign in with 1-Click Instant Access
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {mode === "options" ? (
          <div className="space-y-3">
            {/* Google Sign In Button */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl border border-[var(--border)] bg-[var(--background)] hover:bg-[var(--muted)] text-[var(--foreground)] text-sm font-semibold flex items-center justify-center gap-3 transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
            >
              {isLoading && loadingType === "google" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-red-600" />
                  <span>Connecting to Google...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
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
                  <span>Continue with Google</span>
                </>
              )}
            </button>

            {/* 1-Click Instant Demo Login (Recommended fallback) */}
            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white text-sm font-bold shadow-lg shadow-red-600/20 flex items-center justify-between transition-all cursor-pointer disabled:opacity-50 group"
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

            {/* Divider */}
            <div className="relative py-2 flex items-center justify-center">
              <div className="border-t border-[var(--border)] w-full absolute" />
              <span className="bg-[var(--card)] px-3 text-[11px] uppercase tracking-wider text-[var(--muted-foreground)] relative font-semibold">
                Or Custom Account
              </span>
            </div>

            {/* Custom Email Form Option */}
            <button
              type="button"
              onClick={() => setMode("email")}
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-[var(--muted)] hover:bg-[var(--muted-hover)] text-[var(--foreground)] text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Mail className="w-3.5 h-3.5 text-neutral-400" />
              <span>Sign in with Email & Name</span>
            </button>
          </div>
        ) : (
          /* Email & Name Form */
          <form onSubmit={handleEmailSubmit} className="space-y-3.5">
            <div>
              <label className="text-xs font-semibold text-[var(--foreground)] block mb-1">
                Your Name
              </label>
              <div className="relative flex items-center">
                <User className="w-4 h-4 text-[var(--muted-foreground)] absolute left-3" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Kundan"
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:border-red-600 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-[var(--foreground)] block mb-1">
                Email Address
              </label>
              <div className="relative flex items-center">
                <Mail className="w-4 h-4 text-[var(--muted-foreground)] absolute left-3" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. kundank82522@gmail.com"
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:border-red-600 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div className="pt-1 flex flex-col gap-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-red-600/20 transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoading && loadingType === "email" ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Signing In...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm Sign In</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setMode("options")}
                disabled={isLoading}
                className="w-full py-2 px-4 rounded-xl text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-xs font-medium transition-colors cursor-pointer"
              >
                ← Back to other options
              </button>
            </div>
          </form>
        )}

        {/* Footer Links & Trust Badge */}
        <div className="mt-5 pt-4 border-t border-[var(--border)] flex items-center justify-between text-[11px] text-[var(--muted-foreground)]">
          <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Secure 256-bit encryption</span>
          </div>

          <Link
            href="/auth/login"
            onClick={closeAuthModal}
            className="inline-flex items-center gap-1 hover:underline text-[var(--foreground)]"
          >
            Full page login
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  )
}

export default AuthModal
