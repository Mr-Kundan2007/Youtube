# Administrative Operations & Subscriber Management Guide

This guide details the administrative dashboard, subscriber search, manual plan adjustments, audit logging requirements, fraud mitigation, and revenue reporting.

---

## 1. Accessing the Admin Management Console

Administrators with role `admin` or `superadmin` can access the comprehensive back-office interface at:
* **Web UI**: `/admin/subscriptions`
* **API Endpoints**: `/api/admin/subscriptions/*`

---

## 2. Subscriber Search & Inspection

The admin console supports multi-criteria queries across the customer base:
* Search by **User ID**, **Email**, **Full Name**, or **Phone**.
* Filter by **Tier** (`free`, `bronze`, `silver`, `gold`), **Status** (`active`, `cancel_scheduled`, `grace_period`, `expired`, `suspended`), or **Billing Cycle** (`monthly`, `quarterly`, `yearly`).
* Sort by **Sign-up Date**, **Last Active**, or **Expiry Date**.

For every subscriber, administrators can view:
1. Current active plan and remaining validity days.
2. Lifetime transaction count and total spend.
3. Daily quota usage (downloads consumed today and watch time).
4. List of linked devices with IP history and hardware fingerprints.
5. Chronological audit history of all plan modifications.

---

## 3. Manual Plan Modifications & Overrides

Administrators possess elevated privileges to perform targeted overrides on user accounts.

### 1. Plan Upgrade / Downgrade Override
* **Endpoint**: `PUT /api/admin/subscriptions/subscribers/:userId/plan`
* **Parameters**: `{ "plan": "gold", "reason": "Customer loyalty reward voucher" }`
* **Effect**: Updates subscription tier immediately without triggering payment gateway transactions.

### 2. Extend Validity (Complimentary Days)
* **Endpoint**: `POST /api/admin/subscriptions/subscribers/:userId/extend`
* **Parameters**: `{ "days": 30, "reason": "Compensation for service interruption" }`
* **Mandatory Constraint**: The `reason` field is **strictly required** (minimum 5 characters). Requests omitting `reason` are rejected with HTTP 400.
* **Effect**: Adds $N$ days to the user's `endDate` and records an entry in `AdminSubscriptionAuditLog`.

### 3. Account Suspension & Restoration
* **Suspend**: `PUT /api/admin/subscriptions/subscribers/:userId/status` with `{ "status": "suspended", "reason": "Payment dispute investigation" }`
  - Immediately blocks high-resolution streaming, premium video catalog, and offline downloads.
* **Restore**: `PUT /api/admin/subscriptions/subscribers/:userId/status` with `{ "status": "active", "reason": "Chargeback resolved" }`
  - Restores previous tier and entitlements.

---

## 4. Immutable Audit Trail Requirements

Every administrative override triggers an immutable entry in the `AdminSubscriptionAuditLog` collection:

```json
{
  "_id": "6a9f0a54266efaede76fc47a",
  "adminId": "admin_user_id",
  "adminEmail": "admin@platform.com",
  "targetUserId": "customer_user_id",
  "action": "extend_validity",
  "details": {
    "daysAdded": 14,
    "previousEndDate": "2026-10-01T00:00:00.000Z",
    "newEndDate": "2026-10-15T00:00:00.000Z"
  },
  "reason": "Customer compensation ticket #4912",
  "ipAddress": "192.168.1.100",
  "createdAt": "2026-09-08T00:30:00.000Z"
}
```

Audit logs cannot be updated or deleted via API endpoints, ensuring total accountability for regulatory compliance.

---

## 5. Analytics & KPIs

The Admin Analytics Service (`/api/admin/subscriptions/analytics`) aggregates core business metrics:
* **Monthly Recurring Revenue (MRR)**: Current annualized MRR based on active recurring subscriptions.
* **Churn Rate**: Ratio of cancellations and lapsed accounts over active subscriptions.
* **Conversion Rate**: Percentage of Free users who upgrade to a paid tier.
* **Plan Popularity Distribution**: Percentage distribution of Bronze, Silver, and Gold members.
* **Payment Health Score**: Real-time ratio of successful checkouts vs. declined or failed transactions.
