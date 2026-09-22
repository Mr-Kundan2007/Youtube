import React, { useState, useEffect } from "react"
import { useAuth } from "@/lib/AuthContext"
import {
  X,
  ShieldCheck,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ExternalLink,
  Lock,
  ArrowRight,
} from "lucide-react"
import Link from "next/link"

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, closeAuthModal, loginWithGoogle, loginWithDemo } =
    useAuth() as any

  const [isLoading, setIsLoading] = useState(false)
  const [loadingType, setLoadingType] = useState<"google" | "demo" | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)

  // Reset state when modal is opened/closed
  useEffect(() => {
    if (!isAuthModalOpen) {
      setErrorMsg(null)
      setIsLoading(false)
      setLoadingType(null)
      setIsSuccess(false)
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
      setIsSuccess(true)
      setTimeout(() => {
        closeAuthModal()
      }, 500)
    } catch (err: any) {
      const code = err?.code || ""
      let friendly = err?.message || "Google sign-in could not be completed."

      if (code === "auth/popup-blocked") {
        friendly = "The sign-in popup was blocked by your browser. Please allow popups or use the demo login."
      } else if (code === "auth/unauthorized-domain") {
        friendly = "Domain not added to Firebase Authorized Domains yet. Add your current URL in Firebase Console -> Auth -> Settings -> Authorized Domains."
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
      setIsSuccess(true)
      setTimeout(() => {
        closeAuthModal()
      }, 500)
    } catch (err: any) {
      setErrorMsg(err?.message || "Demo sign-in failed. Please try again.")
    } finally {
      setIsLoading(false)
      setLoadingType(null)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          closeAuthModal()
        }
      }}
    >
      <div className="w-full max-w-[420px] bg-neutral-900 text-white rounded-3xl border border-neutral-800 shadow-2xl p-7 relative overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Subtle Ambient Radial Glows */}
        <div className="absolute -top-20 -right-20 w-44 h-44 bg-red-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-44 h-44 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={closeAuthModal}
          className="absolute top-4 right-4 text-neutral-400 hover:text-white p-2 rounded-full hover:bg-neutral-800/80 transition-colors cursor-pointer"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand Header */}
        <div className="text-center space-y-3 mb-6 pt-1">
          <div className="flex items-center justify-center gap-2">
            <div className="relative flex h-8 w-11 items-center justify-center rounded-xl bg-[#FF0000] px-1 py-0.5 shadow-lg shadow-red-600/30">
              <div className="h-0 w-0 border-y-[6.5px] border-y-transparent border-l-[11px] border-l-white ml-0.5" />
            </div>
            <span className="text-2xl font-black tracking-tight text-white font-sans">
              YouTube
            </span>
          </div>

          <div className="space-y-1">
            <h2 id="auth-modal-title" className="text-xl font-bold text-white tracking-tight">
              Sign in with Google
            </h2>
            <p className="text-xs text-neutral-400 max-w-[280px] mx-auto leading-relaxed">
              Use your Google Account to access subscriptions, upload videos, and join live meetings.
            </p>
          </div>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div className="mb-4 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/25 flex items-start gap-2.5 text-xs text-red-400 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
            <div className="flex-1 leading-relaxed space-y-1.5">
              <div>{errorMsg}</div>
              <button
                type="button"
                onClick={handleDemoLogin}
                className="font-bold text-red-300 hover:text-white underline cursor-pointer text-[11px] block"
              >
                Sign in with 1-Click Instant Demo instead →
              </button>
            </div>
          </div>
        )}

        {/* Success Feedback */}
        {isSuccess && (
          <div className="mb-4 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center gap-2 text-xs text-emerald-400 animate-in fade-in duration-150">
            <CheckCircle2 className="w-4 h-4" />
            <span className="font-semibold">Signed in successfully!</span>
          </div>
        )}

        {/* Primary Action: Google Sign In Button */}
        <div className="space-y-3.5 pt-1">
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isLoading || isSuccess}
            className="w-full h-13 py-3 px-5 rounded-2xl bg-white hover:bg-neutral-100 text-neutral-900 font-semibold text-sm shadow-xl flex items-center justify-center gap-3 transition-all transform active:scale-[0.99] cursor-pointer disabled:opacity-50 group border border-white/20"
          >
            {isLoading && loadingType === "google" ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-neutral-900" />
                <span className="text-neutral-800">Signing in with Google...</span>
              </>
            ) : (
              <>
                {/* Official 4-Color Google "G" Icon */}
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
                <span className="font-semibold text-[15px] tracking-tight text-neutral-900">
                  Continue with Google
                </span>
              </>
            )}
          </button>

          {/* Quick 1-Click Demo Option for seamless testing */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={isLoading || isSuccess}
              className="w-full py-2.5 px-4 rounded-xl bg-neutral-800/60 hover:bg-neutral-800 text-neutral-300 hover:text-white text-xs font-medium border border-neutral-700/50 flex items-center justify-between transition-colors cursor-pointer"
            >
              <span>⚡ Fast demo test (Sign in as Kundan)</span>
              {isLoading && loadingType === "demo" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ArrowRight className="w-3.5 h-3.5 text-neutral-400" />
              )}
            </button>
          </div>
        </div>

        {/* Security & Privacy Footer */}
        <div className="mt-6 pt-4 border-t border-neutral-800/80 flex items-center justify-between text-[11px] text-neutral-400">
          <div className="flex items-center gap-1.5 text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Encrypted OAuth 2.0</span>
          </div>

          <Link
            href="/auth/login"
            onClick={closeAuthModal}
            className="inline-flex items-center gap-1 text-neutral-400 hover:text-white transition-colors"
          >
            <span>More options</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  )
}

export default AuthModal
