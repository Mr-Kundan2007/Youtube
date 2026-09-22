import React, { useState, useEffect, useRef } from "react"
import { useRouter } from "next/router"
import Head from "next/head"
import { useAuth } from "@/lib/AuthContext"
import API from "@/lib/axiosinstance"
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  RotateCw,
  AlertCircle,
  Loader2,
  Mail,
  Smartphone,
  ArrowLeft,
} from "lucide-react"

export default function VerifyOtpPage() {
  const router = useRouter()
  const { login } = useAuth() as any
  const { pendingLoginId: queryPendingId } = router.query

  const [pendingLoginId, setPendingLoginId] = useState<string>("")
  const [userEmail, setUserEmail] = useState<string>("")
  const [maskedDestination, setMaskedDestination] = useState<string>("")
  const [methods, setMethods] = useState<any[]>([])
  const [selectedMethod, setSelectedMethod] = useState<"EMAIL" | "SMS">("EMAIL")
  const [step, setStep] = useState<"SELECT" | "ENTER">("SELECT")
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""])
  const [isSending, setIsSending] = useState<boolean>(false)
  const [isVerifying, setIsVerifying] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [expiresIn, setExpiresIn] = useState<number>(300)
  const [cooldown, setCooldown] = useState<number>(0)
  const [isLoadingMethods, setIsLoadingMethods] = useState<boolean>(true)

  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (queryPendingId && typeof queryPendingId === "string") {
      setPendingLoginId(queryPendingId)
      fetchMethods(queryPendingId)
    } else {
      setIsLoadingMethods(false)
    }
  }, [queryPendingId])

  useEffect(() => {
    if (step !== "ENTER") return
    const timer = setInterval(() => {
      setExpiresIn((p) => (p > 0 ? p - 1 : 0))
      setCooldown((p) => (p > 0 ? p - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [step])

  const fetchMethods = async (id: string) => {
    setIsLoadingMethods(true)
    setErrorMsg(null)
    try {
      const { data } = await API.get(`/api/auth/otp/methods/${id}`)
      setUserEmail(data.userEmail || "")
      setMethods(data.availableMethods || [])
      setMaskedDestination(data.availableMethods?.[0]?.masked || data.userEmail || "")
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || "Invalid or expired login challenge.")
    } finally {
      setIsLoadingMethods(false)
    }
  }

  const handleSend = async (method = selectedMethod) => {
    if (!pendingLoginId) {
      setErrorMsg("Missing pending login identifier.")
      return
    }

    setIsSending(true)
    setErrorMsg(null)
    try {
      const { data } = await API.post("/api/auth/otp/send", {
        pendingLoginId,
        deliveryMethod: method,
      })
      setMaskedDestination(data.destination)
      setExpiresIn(data.expiresIn || 300)
      setCooldown(data.resendCooldown || 60)
      setStep("ENTER")
      setDigits(["", "", "", "", "", ""])
      setTimeout(() => inputRefs.current[0]?.focus(), 100)
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || "Failed to send code. Please try again.")
    } finally {
      setIsSending(false)
    }
  }

  const handleDigitChange = (index: number, val: string) => {
    const clean = val.replace(/\D/g, "")
    if (!clean) {
      const next = [...digits]
      next[index] = ""
      setDigits(next)
      return
    }

    const char = clean.slice(-1)
    const next = [...digits]
    next[index] = char
    setDigits(next)

    if (index < 5 && char) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6)
    if (!pasted) return

    const next = [...digits]
    for (let i = 0; i < 6; i++) {
      next[i] = pasted[i] || ""
    }
    setDigits(next)
    inputRefs.current[Math.min(pasted.length, 5)]?.focus()
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    const code = digits.join("").trim()
    if (code.length !== 6) {
      setErrorMsg("Please enter all 6 digits.")
      return
    }

    setIsVerifying(true)
    setErrorMsg(null)
    try {
      const { data } = await API.post("/api/auth/otp/verify", {
        pendingLoginId,
        otp: code,
      })

      setSuccessMsg("Verification successful! Redirecting...")
      setTimeout(() => {
        login(data)
        router.push("/")
      }, 700)
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || "Invalid or expired verification code.")
    } finally {
      setIsVerifying(false)
    }
  }

  const isComplete = digits.every((d) => d.length === 1)

  return (
    <>
      <Head>
        <title>Security Verification - YouTube</title>
      </Head>
      <div className="min-h-screen bg-zinc-950 text-neutral-100 flex items-center justify-center p-3 sm:p-4">
        <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl p-5 sm:p-8 mx-auto">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3 mb-6 text-center sm:text-left">
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Two-Step Verification</h1>
              <p className="text-xs text-neutral-400">Account Security Check</p>
            </div>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/25 flex items-start gap-2.5 text-xs text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center gap-2.5 text-xs text-emerald-400">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span className="font-medium">{successMsg}</span>
            </div>
          )}

          {isLoadingMethods ? (
            <div className="py-12 flex flex-col items-center justify-center text-neutral-400 text-sm gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-red-500" />
              <span>Loading verification challenge...</span>
            </div>
          ) : !pendingLoginId ? (
            <div className="py-8 text-center text-neutral-400 text-sm">
              <p className="mb-4">No active verification challenge detected.</p>
              <button
                onClick={() => router.push("/")}
                className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium transition-colors"
              >
                Return to Home
              </button>
            </div>
          ) : step === "SELECT" ? (
            <div>
              <p className="text-sm text-neutral-300 mb-5 leading-relaxed">
                Choose where you would like to receive your 6-digit one-time passcode for{" "}
                <span className="font-semibold text-neutral-100">{userEmail || "your account"}</span>:
              </p>

              <div className="space-y-3 mb-6">
                <label
                  onClick={() => setSelectedMethod("EMAIL")}
                  className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all ${
                    selectedMethod === "EMAIL"
                      ? "bg-red-500/10 border-red-500/50 text-white"
                      : "bg-neutral-800/40 border-neutral-800 text-neutral-300 hover:bg-neutral-800/70"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-red-400" />
                    <div>
                      <div className="text-xs font-medium">Email Address</div>
                      <div className="text-[11px] text-neutral-400 font-mono">
                        {methods.find((m) => m.type === "EMAIL")?.masked || userEmail}
                      </div>
                    </div>
                  </div>
                  <input
                    type="radio"
                    name="method"
                    checked={selectedMethod === "EMAIL"}
                    onChange={() => setSelectedMethod("EMAIL")}
                    className="accent-red-600"
                  />
                </label>

                {methods.some((m) => m.type === "SMS") && (
                  <label
                    onClick={() => setSelectedMethod("SMS")}
                    className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all ${
                      selectedMethod === "SMS"
                        ? "bg-red-500/10 border-red-500/50 text-white"
                        : "bg-neutral-800/40 border-neutral-800 text-neutral-300 hover:bg-neutral-800/70"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Smartphone className="w-4 h-4 text-red-400" />
                      <div>
                        <div className="text-xs font-medium">SMS Mobile Number</div>
                        <div className="text-[11px] text-neutral-400 font-mono">
                          {methods.find((m) => m.type === "SMS")?.masked}
                        </div>
                      </div>
                    </div>
                    <input
                      type="radio"
                      name="method"
                      checked={selectedMethod === "SMS"}
                      onChange={() => setSelectedMethod("SMS")}
                      className="accent-red-600"
                    />
                  </label>
                )}
              </div>

              <button
                onClick={() => handleSend()}
                disabled={isSending}
                className="w-full py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium text-sm transition-colors flex items-center justify-center gap-2 shadow-lg shadow-red-600/20"
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending Code...
                  </>
                ) : (
                  "Send Code"
                )}
              </button>
            </div>
          ) : (
            <form onSubmit={handleVerify}>
              <p className="text-sm text-neutral-300 mb-5 leading-relaxed">
                Enter the 6-digit code sent to{" "}
                <span className="font-semibold text-neutral-100">{maskedDestination}</span>:
              </p>

              <div className="flex justify-between gap-1.5 sm:gap-2 mb-4" onPaste={handlePaste}>
                {digits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => {
                      inputRefs.current[idx] = el
                    }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleDigitChange(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    disabled={isVerifying || expiresIn === 0}
                    className="w-10 sm:w-12 h-12 sm:h-14 text-center text-lg sm:text-xl font-bold font-mono rounded-xl bg-neutral-950 border border-neutral-700 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 text-white outline-none transition-all disabled:opacity-50"
                  />
                ))}
              </div>

              <div className="flex items-center justify-between text-xs text-neutral-400 mb-6">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-neutral-500" />
                  <span>
                    Expires in:{" "}
                    <span className="font-mono font-medium text-neutral-200">
                      {Math.floor(expiresIn / 60)}:{String(expiresIn % 60).padStart(2, "0")}
                    </span>
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleSend()}
                  disabled={cooldown > 0 || isSending}
                  className="text-xs font-medium text-red-400 hover:text-red-300 disabled:text-neutral-500 flex items-center gap-1"
                >
                  <RotateCw className={`w-3 h-3 ${isSending ? "animate-spin" : ""}`} />
                  {cooldown > 0 ? `Resend (${cooldown}s)` : "Resend Code"}
                </button>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  type="submit"
                  disabled={!isComplete || isVerifying || expiresIn === 0}
                  className="w-full py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium text-sm transition-colors flex items-center justify-center gap-2 shadow-lg shadow-red-600/20"
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    "Verify Code"
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setStep("SELECT")}
                  className="w-full py-2 px-4 rounded-xl bg-transparent hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Choose Different Method
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  )
}
