# End-to-End System Flows & Architectural Sequence Diagrams

This document illustrates the critical data flows and user journeys across the Subscription Management System using Mermaid sequence diagrams.

---

## 1. User Registration to Free Tier Flow

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Web as Next.js Frontend
    participant API as Express API Server
    participant DB as MongoDB Atlas

    User->>Web: Submits Registration / Google Sign-In
    Web->>API: POST /api/auth/register
    API->>DB: User.create({ name, email, role: "viewer" })
    DB-->>API: User Document Created
    API->>DB: Subscription.create({ userId, plan: "free", status: "active", downloadLimit: 1 })
    DB-->>API: Subscription Initialized
    API->>DB: SubscriptionHistory.create({ action: "account_created" })
    API-->>Web: Returns JWT Token & User Profile
    Web-->>User: Redirects to Home (Free Plan Active)
```

---

## 2. Plan Upgrade & Payment Verification Flow

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Web as Next.js Frontend
    participant API as Express API Server
    participant Razorpay as Razorpay Gateway
    participant DB as MongoDB Atlas

    User->>Web: Selects Silver Yearly & clicks "Subscribe"
    Web->>API: POST /api/subscriptions/create-order
    API->>API: Computes authoritative price: ₹4,790 (20% off)
    API->>Razorpay: orders.create({ amount: 479000, currency: "INR" })
    Razorpay-->>API: Returns order_id
    API->>DB: PaymentTransaction.create({ orderId, amount, status: "created" })
    API-->>Web: Returns order_id & Razorpay options
    Web->>Razorpay: Opens Razorpay Checkout Modal
    User->>Razorpay: Authorizes Payment (UPI / Card)
    Razorpay-->>Web: Returns { razorpay_payment_id, razorpay_signature }
    Web->>API: POST /api/subscriptions/verify-payment
    API->>API: Validates HMAC-SHA256 Signature
    API->>DB: Updates PaymentTransaction -> status: "success"
    API->>DB: Updates Subscription -> plan: "silver", endDate: (now + 1y)
    API->>DB: SubscriptionHistory.create({ action: "plan_upgraded" })
    API->>API: Generates Tax Invoice PDF via PDFKit
    API->>DB: Invoice.create({ invoiceNumber, subtotal, taxAmount })
    API-->>Web: 200 OK (Upgrade Confirmed)
    Web-->>User: Displays Success Screen & Unlocks 1080p Access
```

---

## 3. Premium Video Streaming Access Control Flow

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Web as Next.js Frontend
    participant API as Express API Server
    participant AuthMW as Subscription Middleware
    participant Media as Media Storage Service

    User->>Web: Clicks 1080p Premium Lecture
    Web->>API: GET /api/videos/:id/stream?quality=1080p
    API->>AuthMW: requirePlan("silver")
    AuthMW->>AuthMW: Verifies User Plan from JWT / DB
    alt Plan is Free or Bronze
        AuthMW-->>Web: HTTP 403 Forbidden ("Requires Silver or Gold Tier")
        Web-->>User: Shows Upgrade Modal
    else Plan is Silver or Gold
        AuthMW->>API: Next()
        API->>Media: Generates secure media stream chunks
        Media-->>Web: Streams 1080p Video Buffer
        Web-->>User: Plays HD Video
    end
```

---

## 4. Automated Subscription Expiration & Demotion Flow

```mermaid
sequenceDiagram
    autonumber
    participant Cron as Subscription Expiration Cron
    participant DB as MongoDB Atlas
    participant Email as Notification Service

    Cron->>DB: Query Subscriptions where endDate <= now AND status == "active"
    DB-->>Cron: Returns Lapsed Subscription List
    loop For each lapsed subscription
        Cron->>DB: Updates status -> "expired", plan -> "free"
        Cron->>DB: SubscriptionHistory.create({ action: "subscription_expired" })
        Cron->>DB: Resets downloadLimit -> 1, streamingQuality -> 480p
        Cron->>Email: Dispatches "Your Subscription Has Expired" Email
    end
```
