# Developer & Codebase Extension Guide

This guide assists software engineers in navigating the codebase, understanding directory structures, adding new subscription tiers, and extending middleware guards.

---

## 1. Project Directory Structure

```
youtube/
├── docs/                       # Complete operational and architectural guides
├── server/                     # Express.js REST API & WebSocket Backend
│   ├── config/                 # Plan pricing constants, database connection
│   │   ├── plans.js            # Authoritative pricing, tiers, features
│   │   └── db.js               # Mongoose connection pool
│   ├── controllers/            # Request handlers
│   │   ├── subscriptionsController.js # Core subscription & checkout logic
│   │   └── adminSubscriptionManagementController.js # Back-office APIs
│   ├── middleware/             # Express middleware guards
│   │   ├── auth.js             # JWT bearer verification
│   │   ├── subscriptionAuth.js # Tier-based route access controls
│   │   └── rateLimiter.js      # Rate limiters & circuit breakers
│   ├── models/                 # Mongoose schemas
│   │   ├── Subscription.js     # User subscription state
│   │   ├── PaymentTransaction.js # Payment receipts & gateway orders
│   │   ├── Invoice.js          # Tax-compliant invoice data
│   │   └── AdminSubscriptionAuditLog.js # Immutable admin action trail
│   ├── routes/                 # Express routers
│   │   ├── subscriptions.js    # Public & subscriber endpoints
│   │   └── adminSubscriptions.js # Back-office administrative routes
│   ├── services/               # Reusable business logic
│   │   ├── invoiceService.js   # PDFKit generation engine
│   │   ├── paymentService.js   # Razorpay API wrapper
│   │   └── subscriptionService.js # State transitions and renewals
│   └── tests/                  # Automated integration and unit tests
└── src/                        # Next.js 16 + React 19 Frontend
    ├── components/             # Reusable UI components
    │   ├── subscription/       # Pricing matrix, checkout modal, invoices
    │   └── ui/                 # Accessible Radix UI primitives
    └── pages/                  # Next.js Pages router
        ├── api-docs.tsx        # Interactive API documentation explorer
        ├── pricing.tsx         # Plan comparison & checkout launcher
        └── subscription.tsx    # Subscriber self-service dashboard
```

---

## 2. Plan Configuration & Adding a New Plan

All subscription plans, feature quotas, and pricing logic are centrally governed in `server/config/plans.js`.

### Adding a New Tier (e.g. "Platinum"):
1. **Define Plan Metadata**:
   ```javascript
   // In server/config/plans.js
   export const SUBSCRIPTION_PLANS = {
     // ... existing plans
     platinum: {
       id: "platinum",
       name: "Platinum",
       monthlyPrice: 1499,
       downloadLimit: 100,
       maxQuality: "4k",
       allowOffline: true,
       premiumAccess: true,
       deviceLimit: 10,
     }
   };
   ```
2. **Update Mongoose Enum**:
   Update `plan` enum in `server/models/Subscription.js` and `server/models/PaymentTransaction.js`:
   ```javascript
   enum: ["free", "bronze", "silver", "gold", "platinum"]
   ```
3. **Add Frontend Tier Card**:
   Update `src/components/subscription/PlanCard.tsx` with color palette and benefits list.

---

## 3. Protecting Endpoints with Subscription Middleware

Use `requirePlan` and `requireFeature` middleware in backend routes to enforce tier-based access:

```javascript
import { requirePlan, requireFeature } from "../middleware/subscriptionAuth.js";

// Require at least Silver tier for 1080p stream
router.get("/video/:id/stream-1080p", requirePlan("silver"), (req, res) => {
  // Stream handler...
});

// Require offline download permissions
router.post("/video/:id/download", requireFeature("allowOffline"), (req, res) => {
  // Download handler...
});
```

---

## 4. Running Test Suites

Run automated test runners directly using standard npm commands:

```bash
# Run Master Phase 12 End-to-End Integration Suite (20 stages)
npm run test:e2e

# Run Master Phase 11 Automated Test Suite (206 assertions)
npm run test:phase11

# Run Pre-Deployment Validation Script (10 checks)
npm run check:readiness

# Run Post-Deployment Verification (4 critical checks)
node server/scripts/postDeploymentValidation.js

# Run Next.js production build verification
npm run build
```
