import React, { useState } from "react"
import Head from "next/head"

export default function TestPay() {
  const [logs, setLogs] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const addLog = (msg: string) => {
    console.log(msg)
    setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`])
  }

  const handlePay = async () => {
    setLoading(true)
    addLog("1. Requesting /api/payment/create-order...")

    try {
      const res = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planKey: "bronze", validityType: "monthly" }),
      })

      const json = await res.json()
      addLog("2. Received response: " + JSON.stringify(json))

      if (!json.success || !json.data?.orderId) {
        addLog("ERROR: No orderId returned!")
        setLoading(false)
        return
      }

      addLog(`3. Order ID: ${json.data.orderId}, Key ID: ${json.data.keyId}`)
      addLog("4. Checking window.Razorpay...")

      if (typeof (window as any).Razorpay === "undefined") {
        addLog("ERROR: window.Razorpay is NOT loaded!")
        setLoading(false)
        return
      }

      const options = {
        key: json.data.keyId,
        amount: json.data.amount,
        currency: json.data.currency || "INR",
        name: "Video Platform Test",
        description: "Bronze Subscription (Monthly)",
        order_id: json.data.orderId,
        prefill: {
          name: "Test User",
          email: "test@example.com",
          contact: "9999999999",
        },
        theme: { color: "#e11d48" },
        handler: function (response: any) {
          addLog("SUCCESS! Payment completed: " + JSON.stringify(response))
        },
        modal: {
          ondismiss: function () {
            addLog("MODAL DISMISSED by user or closed")
          },
        },
      }

      addLog("5. Creating new Razorpay(options)...")
      const rzp = new (window as any).Razorpay(options)

      rzp.on("payment.failed", function (resp: any) {
        addLog("PAYMENT FAILED event: " + JSON.stringify(resp))
      })

      addLog("6. Calling rzp.open()...")
      rzp.open()
      addLog("7. rzp.open() called! Check for Razorpay checkout popup.")
    } catch (err: any) {
      addLog("EXCEPTION: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", padding: "40px", fontFamily: "sans-serif" }}>
      <Head>
        <title>Razorpay Test</title>
        <script src="https://checkout.razorpay.com/v1/checkout.js" async />
      </Head>

      <div style={{ maxWidth: "600px", margin: "0 auto" }}>
        <h1>Razorpay Live Test Page</h1>
        <p style={{ color: "#aaa" }}>Click the button below to test opening Razorpay directly with real API order.</p>

        <button
          onClick={handlePay}
          disabled={loading}
          style={{
            padding: "14px 28px",
            background: "#e11d48",
            color: "#fff",
            border: "none",
            borderRadius: "12px",
            fontSize: "16px",
            fontWeight: "bold",
            cursor: "pointer",
            marginTop: "16px",
          }}
        >
          {loading ? "Creating Order..." : "Open Razorpay Checkout"}
        </button>

        <div
          style={{
            marginTop: "30px",
            padding: "20px",
            background: "#18181b",
            borderRadius: "12px",
            border: "1px solid #27272a",
            fontFamily: "monospace",
            fontSize: "13px",
            minHeight: "150px",
            whiteSpace: "pre-wrap",
          }}
        >
          <div style={{ color: "#71717a", marginBottom: "8px" }}>=== Diagnostic Logs ===</div>
          {logs.map((l, i) => (
            <div key={i} style={{ marginBottom: "4px" }}>
              {l}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
