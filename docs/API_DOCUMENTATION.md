# REST API Specification & Endpoint Reference

This document provides complete documentation for all HTTP REST API endpoints powering the Subscription Management System.

Interactive documentation with real-time payload testing is also available at the `/api-docs` frontend page.

---

## 1. Authentication & Headers

Protected endpoints require a JSON Web Token (JWT) provided in the HTTP `Authorization` header:

```http
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

---

## 2. Public & Subscriber Endpoints

### 1. Get Available Plans & Pricing
* **Endpoint**: `GET /api/subscriptions/plans`
* **Auth**: Public
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "plans": [
      {
        "id": "bronze",
        "name": "Bronze",
        "monthlyPrice": 199,
        "quarterlyPrice": 537,
        "yearlyPrice": 1910,
        "downloadLimit": 5,
        "maxQuality": "720p",
        "features": ["720p HD", "5 downloads/day", "2 devices"]
      },
      {
        "id": "silver",
        "name": "Silver",
        "monthlyPrice": 499,
        "quarterlyPrice": 1347,
        "yearlyPrice": 4790,
        "downloadLimit": 15,
        "maxQuality": "1080p",
        "features": ["1080p Full HD", "15 downloads/day", "3 devices", "Zero Ads"]
      },
      {
        "id": "gold",
        "name": "Gold",
        "monthlyPrice": 999,
        "quarterlyPrice": 2697,
        "yearlyPrice": 9590,
        "downloadLimit": 50,
        "maxQuality": "4k",
        "features": ["4K Ultra HD", "50 downloads/day", "5 devices", "VIP Support"]
      }
    ]
  }
  ```

---

### 2. Get User Current Subscription
* **Endpoint**: `GET /api/subscriptions/current`
* **Auth**: Bearer JWT Required
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "subscription": {
      "plan": "silver",
      "status": "active",
      "billingCycle": "monthly",
      "startDate": "2026-09-08T00:00:00.000Z",
      "endDate": "2026-10-08T00:00:00.000Z",
      "downloadQuota": {
        "used": 3,
        "limit": 15,
        "remaining": 12
      },
      "cancelScheduled": false
    }
  }
  ```

---

### 3. Create Checkout Order
* **Endpoint**: `POST /api/subscriptions/create-order`
* **Auth**: Bearer JWT Required
* **Request Body**:
  ```json
  {
    "plan": "gold",
    "billingCycle": "yearly"
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "order": {
      "id": "order_N1x892KL98",
      "amount": 959000,
      "currency": "INR",
      "plan": "gold",
      "billingCycle": "yearly",
      "keyId": "rzp_test_sampleKeyId"
    }
  }
  ```

---

### 4. Verify Payment & Activate Plan
* **Endpoint**: `POST /api/subscriptions/verify-payment`
* **Auth**: Bearer JWT Required
* **Request Body**:
  ```json
  {
    "razorpay_order_id": "order_N1x892KL98",
    "razorpay_payment_id": "pay_N1x897KL99",
    "razorpay_signature": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "plan": "gold",
    "billingCycle": "yearly"
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Payment verified and subscription activated successfully",
    "subscription": {
      "plan": "gold",
      "status": "active",
      "endDate": "2027-09-08T00:00:00.000Z"
    }
  }
  ```

---

### 5. Cancel Recurring Subscription
* **Endpoint**: `POST /api/subscriptions/cancel`
* **Auth**: Bearer JWT Required
* **Request Body**:
  ```json
  {
    "reason": "Not using the service often enough"
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Cancellation scheduled. Paid features remain active until 2026-10-08T00:00:00.000Z",
    "status": "cancel_scheduled"
  }
  ```

---

### 6. Download Tax Invoice PDF
* **Endpoint**: `GET /api/subscriptions/invoices/:invoiceId/download`
* **Auth**: Bearer JWT Required
* **Response (200 OK)**:
  - Header: `Content-Type: application/pdf`
  - Body: Binary stream starting with `%PDF-1.3`

---

## 3. Administrative Endpoints

### 1. Master Subscriber Search
* **Endpoint**: `GET /api/admin/subscriptions/subscribers?search=alex&status=active&page=1&limit=20`
* **Auth**: Admin JWT Required
* **Response (200 OK)**: Paginated array of subscriber records with lifetime spend and usage metrics.

### 2. Extend Validity
* **Endpoint**: `POST /api/admin/subscriptions/subscribers/:userId/extend`
* **Auth**: Admin JWT Required
* **Request Body**:
  ```json
  {
    "days": 15,
    "reason": "Compensation for outage"
  }
  ```
* **Response (200 OK)**: Updated expiration timestamp and audit log confirmation.

### 3. Master Analytics KPIs
* **Endpoint**: `GET /api/admin/subscriptions/analytics`
* **Auth**: Admin JWT Required
* **Response (200 OK)**: Consolidated object with active subscribers, plan distribution, MRR, churn rate, and payment health.
