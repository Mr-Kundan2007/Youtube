# Platform Administrator & Operations Guide

This guide provides operational procedures for administrators managing subscriptions, billing, tax invoicing, security, download quotas, and system health.

> 📖 **Comprehensive Guides**: For complete technical specifications, see [docs/ADMIN_GUIDE.md](docs/ADMIN_GUIDE.md) and [docs/SYSTEM_ADMIN_GUIDE.md](docs/SYSTEM_ADMIN_GUIDE.md).

---

## 1. Administrative Portals & Role Requirements

Administrative features require an authenticated user with `role: "admin"` or `role: "superadmin"`.
* **Subscription & Billing Console**: `/admin/subscriptions`
* **Download & Media Operations**: `/admin/downloads`
* **Interactive API Documentation**: `/api-docs`

---

## 2. Subscriber Operations & Overrides

### A. Subscriber Search & Inspection
* Search by User ID, Email, Name, Plan Tier, or Subscription Status.
* Inspect active validity, remaining daily download quotas, total spend, and linked devices.

### B. Administrative Overrides
1. **Extend Validity (Complimentary Days)**:
   - Endpoint: `POST /api/admin/subscriptions/subscribers/:userId/extend`
   - *Requirement*: `reason` parameter is mandatory (minimum 5 characters).
   - Extends the user's expiration date and creates an entry in `AdminSubscriptionAuditLog`.
2. **Plan Tier Override**:
   - Endpoint: `PUT /api/admin/subscriptions/subscribers/:userId/plan`
   - Instantly adjusts a user's plan without processing payment gateway transactions.
3. **Suspension & Restoration**:
   - Endpoint: `PUT /api/admin/subscriptions/subscribers/:userId/status`
   - Freeze access for fraudulent accounts or restore accounts upon dispute clearance.

---

## 3. Financial Analytics & Performance KPIs

Navigate to `/admin/subscriptions` to view real-time metrics:
* **Monthly Recurring Revenue (MRR)**: Active revenue annualized across all paid subscribers.
* **Plan Distribution**: Percentage breakdown across Bronze, Silver, and Gold tiers.
* **Churn & Renewal Rates**: Ratio of successful renewals vs. cancellations.
* **Payment Gateway Health**: Success-to-failure ratio across Razorpay checkouts.

---

## 4. Download Operations & Quota Adjustments

* **Live Stream Abort**: Abort abusive or stuck streams with one click; quota is automatically restored to the user.
* **Manual Quota Intervention**: Add credits, remove credits, or reset quotas for customer service resolution.
* **Audit Trail**: All actions produce immutable audit entries in `AdminSubscriptionAuditLog`.
