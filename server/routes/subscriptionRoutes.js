import express from "express"
import { requireAuth } from "../middleware/authMiddleware.js"
import {
  getSubscriptionPlansHandler,
  getCurrentSubscriptionHandler,
  planChangeRequestHandler,
  cancelSubscriptionHandler,
  reactivateSubscriptionHandler,
  renewSubscriptionHandler,
  getBillingHistoryHandler,
  getInvoiceHandler,
  getInvoiceHtmlHandler,
  processExpiriesMaintenanceHandler,
  restoreCancellationHandler,
  adminLifecycleRecheckHandler,
  adminLifecycleMonitoringHandler,
} from "../controllers/subscriptionController.js"
import { getDownloadEntitlement } from "../controllers/downloadEntitlementController.js"

const router = express.Router()

// Public route: Plan comparison & pricing
router.get("/plans", getSubscriptionPlansHandler)

// Entitlement query
router.get("/entitlement", requireAuth, getDownloadEntitlement)

// Authenticated customer subscription routes
router.get("/me", requireAuth, getCurrentSubscriptionHandler)
router.get("/current", requireAuth, getCurrentSubscriptionHandler)
router.post("/change-plan", requireAuth, planChangeRequestHandler)
router.post("/upgrade", requireAuth, planChangeRequestHandler) // backward-compatible alias
router.post("/cancel", requireAuth, cancelSubscriptionHandler)
router.post("/reactivate", requireAuth, reactivateSubscriptionHandler) // backward-compatible alias
router.post("/restore-cancellation", requireAuth, restoreCancellationHandler)
router.post("/renew", requireAuth, renewSubscriptionHandler)

// Customer billing history & invoices
router.get("/billing-history", requireAuth, getBillingHistoryHandler)
router.get("/invoices/:invoiceId", requireAuth, getInvoiceHandler)
router.get("/invoices/:invoiceId/html", requireAuth, getInvoiceHtmlHandler)

// Maintenance & Lifecycle endpoints
router.post("/process-expiries", requireAuth, processExpiriesMaintenanceHandler)
router.post("/lifecycle/recheck", requireAuth, adminLifecycleRecheckHandler)
router.get("/lifecycle/monitoring", requireAuth, adminLifecycleMonitoringHandler)

export default router
