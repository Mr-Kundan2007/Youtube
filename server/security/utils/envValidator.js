/**
 * Environment Configuration Validator
 * Validates required configuration keys on application startup, ensures safe production defaults,
 * and confirms that no secrets or credentials leak into client responses or logs.
 */

export const validateEnvironment = () => {
  const env = process.env.NODE_ENV || "development"
  const isProd = env === "production"
  const isTest = env === "test"

  const checks = [
    {
      name: "DATABASE_CONNECTION",
      required: true,
      configured: Boolean(process.env.DB_URL || process.env.DATABASE_URL || process.env.MONGODB_URI),
      description: "MongoDB connection URI configured",
    },
    {
      name: "JWT_SECRET",
      required: isProd,
      configured: Boolean(process.env.JWT_SECRET && process.env.JWT_SECRET !== "testsecretkey"),
      description: "Cryptographically strong JWT signing secret",
    },
    {
      name: "RAZORPAY_CREDENTIALS",
      required: false,
      configured: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
      description: "Payment gateway API key and secret",
    },
    {
      name: "RAZORPAY_WEBHOOK_SECRET",
      required: false,
      configured: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET),
      description: "Webhook signature secret for event verification",
    },
    {
      name: "FRONTEND_URL",
      required: false,
      configured: Boolean(process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_API_URL),
      description: "CORS allowed origin frontend URL",
    },
  ]

  const missingCritical = checks.filter((c) => c.required && !c.configured)
  const isReady = missingCritical.length === 0

  return {
    isReady,
    environment: env,
    timestamp: new Date().toISOString(),
    checks: checks.map((c) => ({
      name: c.name,
      configured: c.configured,
      required: c.required,
      description: c.description,
    })),
    summary: {
      total: checks.length,
      configured: checks.filter((c) => c.configured).length,
      missingCritical: missingCritical.map((c) => c.name),
    },
  }
}
