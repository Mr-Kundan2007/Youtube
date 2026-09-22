import React, { useState, useEffect, useRef } from "react"
import { useAuth } from "@/lib/AuthContext"
import API from "@/lib/axiosinstance"
import {
  ShieldAlert,
  Globe,
  Monitor,
  MapPin,
  X,
  CheckCircle2,
  Clock,
  Mail,
  Smartphone,
  ArrowRight,
  RotateCw,
  AlertCircle,
  Loader2,
} from "lucide-react"

export const VerificationPendingModal: React.FC = () => {
  const { pendingLogin, clearPendingLogin, login } = useAuth() as any

  const [step, setStep] = useState<"SELECT_METHOD" | "ENTER_OTP">("SELECT_METHOD")
  const [selectedMethod, setSelectedMethod] = useState<"EMAIL" | "SMS">("EMAIL")
  const [destination, setDestination] = useState<string>("")
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""])
  const [isSending, setIsSending] = useState<boolean>(false)
  const [isVerifying, setIsVerifying] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [expiresIn, setExpiresIn] = useState<number>(300) // 5 minutes
  const [cooldown, setCooldown] = useState<number>(0)
  const [devOtp, setDevOtp] = useState<string | null>(null)

  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Reset state whenever a new pendingLogin challenge arrives
  useEffect(() => {
    if (pendingLogin) {
      setStep("SELECT_METHOD")
      setSelectedMethod("EMAIL")
      setDigits(["", "", "", "", "", ""])
      setErrorMsg(null)
      setSuccessMsg(null)
      setCooldown(0)
    }
  }, [pendingLogin?.pendingLoginId])

  // Expiration and Cooldown Timers
  useEffect(() => {
    if (step !== "ENTER_OTP") return

    const interval = setInterval(() => {
      setExpiresIn((prev) => (prev > 0 ? prev - 1 : 0))
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)

    return () => clearInterval(interval)
  }, [step])

  if (!pendingLogin) return null

  const {
    maskedIP = "xxx.xxx.xxx.xxx",
    securityDecision = {},
    securitySignals = {},
    reasons = [],
    userEmail = "",
    availableMethods = [],
  } = pendingLogin

  const riskLevel = securityDecision?.riskLevel || "MEDIUM"
  const riskScore = securityDecision?.riskScore ?? 0

  const signalBadges = []
  if (securitySignals.isNewDevice || reasons.includes("NEW_DEVICE")) {
    signalBadges.push({ label: "New Device", icon: Monitor })
  }
  if (securitySignals.isNewBrowser || reasons.includes("NEW_BROWSER")) {
    signalBadges.push({ label: "New Browser", icon: Globe })
  }
  if (securitySignals.isNewIP || reasons.includes("NEW_IP") || reasons.includes("NEW_IP_ADDRESS")) {
    signalBadges.push({ label: "New IP Address", icon: Globe })
  }
  if (
    securitySignals.isNewCity ||
    securitySignals.isNewState ||
    securitySignals.isNewCountry ||
    reasons.includes("NEW_CITY") ||
    reasons.includes("NEW_STATE") ||
    reasons.includes("NEW_COUNTRY")
  ) {
    signalBadges.push({ label: "New Location", icon: MapPin })
  }

  const getRiskColor = (level: string) => {
    switch (level.toUpperCase()) {
      case "HIGH":
        return "bg-red-500/15 text-red-500 border-red-500/30"
      case "MEDIUM":
        return "bg-amber-500/15 text-amber-500 border-amber-500/30"
      default:
        return "bg-blue-500/15 text-blue-500 border-blue-500/30"
    }
  }

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
  }

  // Send or Resend OTP
  const handleSendOTP = async (methodToUse = selectedMethod) => {
    setIsSending(true)
    setErrorMsg(null)
    try {
      const { data } = await API.post("/api/auth/otp/send", {
        pendingLoginId: pendingLogin.pendingLoginId,
        deliveryMethod: methodToUse,
      })

      setDestination(data.destination || userEmail)
      setExpiresIn(data.expiresIn || 300)
      setCooldown(data.resendCooldown || 60)
      if (data.devOtp || data.testCode) {
        setDevOtp(data.devOtp || data.testCode)
      }
      setStep("ENTER_OTP")
      setDigits(["", "", "", "", "", ""])

      // Focus first digit box after step change
      setTimeout(() => {
        inputRefs.current[0]?.focus()
      }, 100)
    } catch (err: any) {
      setErrorMsg(
        err.response?.data?.message || err.message || "Failed to send verification code. Please try again."
      )
    } finally {
      setIsSending(false)
    }
  }

  // Handle single digit input
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

    // Auto-advance to next input cell
    if (index < 5 && char) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  // Handle backspace navigation
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  // Handle full 6-digit paste
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6)
    if (!pasted) return

    const next = [...digits]
    for (let i = 0; i < 6; i++) {
      next[i] = pasted[i] || ""
    }
    setDigits(next)

    const nextFocus = Math.min(pasted.length, 5)
    inputRefs.current[nextFocus]?.focus()
  }

  // Verify OTP submission
  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const otpCode = digits.join("").trim()

    if (otpCode.length !== 6) {
      setErrorMsg("Please enter all 6 digits of the verification code.")
      return
    }

    setIsVerifying(true)
    setErrorMsg(null)

    try {
      const { data } = await API.post("/api/auth/otp/verify", {
        pendingLoginId: pendingLogin.pendingLoginId,
        otp: otpCode,
      })

      setSuccessMsg("Verification successful! Authenticating...")

      // Complete session authentication
      setTimeout(() => {
        login(data)
        clearPendingLogin()
      }, 700)
    } catch (err: any) {
      setErrorMsg(
        err.response?.data?.message || err.message || "Invalid or expired verification code."
      )
    } finally {
      setIsVerifying(false)
    }
  }

  const isOtpComplete = digits.every((d) => d.length === 1)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-[var(--background, #121212)] text-[var(--foreground, #ffffff)] rounded-2xl border border-neutral-800 shadow-2xl p-6 relative overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <button
          onClick={clearPendingLogin}
          className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-100 p-1.5 rounded-full hover:bg-neutral-800/60 transition-colors"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 id="modal-title" className="text-lg font-semibold tracking-tight">
              Security Verification
            </h2>
            <p className="text-xs text-neutral-400">
              {step === "SELECT_METHOD" ? "Unrecognized login environment" : "Enter one-time code"}
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/25 flex items-start gap-2.5 text-xs text-red-400 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="leading-relaxed">{errorMsg}</div>
          </div>
        )}

        {/* Success Alert */}
        {successMsg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center gap-2.5 text-xs text-emerald-400 animate-in fade-in duration-150">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <div className="font-medium">{successMsg}</div>
          </div>
        )}

        {/* STEP 1: Overview & Delivery Selection */}
        {step === "SELECT_METHOD" && (
          <div>
            <p className="text-sm text-neutral-300 mb-4 leading-relaxed">
              We noticed a sign-in attempt to{" "}
              <span className="font-semibold text-neutral-100">{userEmail || "your account"}</span>{" "}
              from an unfamiliar setup. An extra layer of verification is required before granting access.
            </p>

            {/* Assessment Details */}
            <div className="space-y-3 p-3.5 rounded-xl bg-neutral-900/60 border border-neutral-800/80 mb-5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-400">Assessment Risk:</span>
                <span
                  className={`px-2 py-0.5 rounded-full font-medium border text-[11px] uppercase tracking-wider ${getRiskColor(
                    riskLevel
                  )}`}
                >
                  {riskLevel} ({riskScore} pts)
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-400">Request IP:</span>
                <span className="font-mono text-neutral-200">{maskedIP}</span>
              </div>

              {signalBadges.length > 0 && (
                <div className="pt-2 border-t border-neutral-800/60">
                  <span className="text-xs text-neutral-400 block mb-2">
                    Identified Security Signals:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {signalBadges.map((badge, idx) => {
                      const Icon = badge.icon
                      return (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-neutral-800 text-neutral-200 text-xs font-medium border border-neutral-700/60"
                        >
                          <Icon className="w-3.5 h-3.5 text-amber-400" />
                          {badge.label}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Method Selection */}
            <div className="mb-5">
              <label className="text-xs font-medium text-neutral-300 block mb-2">
                Choose where to receive your verification code:
              </label>
              <div className="space-y-2">
                <label
                  onClick={() => setSelectedMethod("EMAIL")}
                  className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                    selectedMethod === "EMAIL"
                      ? "bg-red-500/10 border-red-500/50 text-white"
                      : "bg-neutral-900/40 border-neutral-800 text-neutral-300 hover:bg-neutral-800/40"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-red-400" />
                    <div>
                      <div className="text-xs font-medium">Email Address</div>
                      <div className="text-[11px] text-neutral-400 font-mono">
                        {availableMethods.find((m: any) => m.type === "EMAIL")?.masked || userEmail}
                      </div>
                    </div>
                  </div>
                  <input
                    type="radio"
                    name="deliveryMethod"
                    checked={selectedMethod === "EMAIL"}
                    onChange={() => setSelectedMethod("EMAIL")}
                    className="accent-red-600"
                  />
                </label>

                {availableMethods.some((m: any) => m.type === "SMS") && (
                  <label
                    onClick={() => setSelectedMethod("SMS")}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                      selectedMethod === "SMS"
                        ? "bg-red-500/10 border-red-500/50 text-white"
                        : "bg-neutral-900/40 border-neutral-800 text-neutral-300 hover:bg-neutral-800/40"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Smartphone className="w-4 h-4 text-red-400" />
                      <div>
                        <div className="text-xs font-medium">SMS Mobile Number</div>
                        <div className="text-[11px] text-neutral-400 font-mono">
                          {availableMethods.find((m: any) => m.type === "SMS")?.masked}
                        </div>
                      </div>
                    </div>
                    <input
                      type="radio"
                      name="deliveryMethod"
                      checked={selectedMethod === "SMS"}
                      onChange={() => setSelectedMethod("SMS")}
                      className="accent-red-600"
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleSendOTP()}
                disabled={isSending}
                className="w-full py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium text-sm transition-colors flex items-center justify-center gap-2 shadow-lg shadow-red-600/20 cursor-pointer"
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending Code...
                  </>
                ) : (
                  <>
                    Send Verification Code
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
              <button
                onClick={clearPendingLogin}
                className="w-full py-2 px-4 rounded-xl bg-transparent hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 text-sm font-medium transition-colors cursor-pointer"
              >
                Cancel & Return to Guest
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: 6-Digit OTP Entry */}
        {step === "ENTER_OTP" && (
          <form onSubmit={handleVerify}>
            <p className="text-sm text-neutral-300 mb-4 leading-relaxed">
              We sent a 6-digit verification code to{" "}
              <span className="font-semibold text-neutral-100">{destination || "your contact"}</span>.
            </p>

            {/* Dev / Test Mode Callout & Quick Auto-Fill */}
            <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between text-xs text-amber-300">
              <div className="flex items-center gap-2">
                <span className="font-semibold px-1.5 py-0.5 rounded bg-amber-500/20 text-[10px] uppercase tracking-wider text-amber-400">
                  Dev Mode
                </span>
                <span>
                  Code: <strong className="font-mono text-white text-sm tracking-wider">{devOtp || "123456"}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const codeToFill = (devOtp || "123456").slice(0, 6).split("")
                  setDigits(codeToFill)
                  setErrorMsg(null)
                  setTimeout(() => {
                    inputRefs.current[5]?.focus()
                  }, 50)
                }}
                className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-medium transition-colors cursor-pointer border border-amber-500/30"
              >
                Auto-fill Code
              </button>
            </div>

            {/* 6 Digit Input Cells */}
            <div className="flex justify-between gap-2 mb-4" onPaste={handlePaste}>
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
                  className="w-12 h-14 text-center text-xl font-bold font-mono rounded-xl bg-neutral-900 border border-neutral-700 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 text-white outline-none transition-all disabled:opacity-50"
                  aria-label={`Digit ${idx + 1}`}
                />
              ))}
            </div>

            {/* Countdown & Expiration */}
            <div className="flex items-center justify-between text-xs text-neutral-400 mb-5">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-neutral-500" />
                <span>
                  {expiresIn > 0 ? (
                    <>
                      Code expires in:{" "}
                      <span className="font-mono font-medium text-neutral-200">
                        {formatCountdown(expiresIn)}
                      </span>
                    </>
                  ) : (
                    <span className="text-red-400 font-medium">Code expired</span>
                  )}
                </span>
              </div>

              {/* Resend button */}
              <button
                type="button"
                onClick={() => handleSendOTP()}
                disabled={cooldown > 0 || isSending}
                className="text-xs font-medium text-red-400 hover:text-red-300 disabled:text-neutral-500 disabled:cursor-not-allowed flex items-center gap-1 transition-colors cursor-pointer"
              >
                <RotateCw className={`w-3 h-3 ${isSending ? "animate-spin" : ""}`} />
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend Code"}
              </button>
            </div>

            {/* Verify Actions */}
            <div className="flex flex-col gap-2">
              <button
                type="submit"
                disabled={!isOtpComplete || isVerifying || expiresIn === 0}
                className="w-full py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium text-sm transition-colors flex items-center justify-center gap-2 shadow-lg shadow-red-600/20 cursor-pointer"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Verifying Code...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Verify & Authenticate
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setStep("SELECT_METHOD")}
                className="w-full py-2 px-4 rounded-xl bg-transparent hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 text-sm font-medium transition-colors cursor-pointer"
              >
                Change Delivery Method
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default VerificationPendingModal
