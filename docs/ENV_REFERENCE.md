# Environment Variables Reference & Configuration Guide

This reference document catalogs all environment variables used by backend and frontend services, their default values, security sensitivity, and validation rules.

---

## 1. Core Server Variables

| Variable | Type | Default | Sensitivity | Description |
| :--- | :---: | :---: | :---: | :--- |
| `NODE_ENV` | String | `development` | Public | Application execution mode (`development`, `production`, `test`). |
| `PORT` | Integer | `5001` | Public | TCP port for Express.js HTTP backend server. |
| `FRONTEND_URL` | URL | `http://localhost:3000` | Public | Allowed origin for Cross-Origin Resource Sharing (CORS). |

---

## 2. Database Connection

| Variable | Type | Example | Sensitivity | Description |
| :--- | :---: | :--- | :---: | :--- |
| `DB_URL` | String | `mongodb+srv://...` | **CRITICAL SECRET** | MongoDB Atlas or replica set connection string. |

---

## 3. Cryptography & Authentication

| Variable | Type | Min Length | Sensitivity | Description |
| :--- | :---: | :---: | :---: | :--- |
| `JWT_SECRET` | String | 32 chars | **CRITICAL SECRET** | HMAC-SHA256 signing key for user authentication tokens. |
| `JWT_EXPIRES_IN` | String | `7d` | Config | Token lifespan duration (`7d`, `24h`). |
| `DOWNLOAD_TOKEN_SECRET` | String | 32 chars | **CRITICAL SECRET** | HMAC signing key for single-use download tokens. |
| `DOWNLOAD_TOKEN_EXPIRY` | Integer | `600` | Config | Token expiration time in seconds (10 minutes). |

---

## 4. Payment Gateway (Razorpay)

| Variable | Type | Example / Format | Sensitivity | Description |
| :--- | :---: | :--- | :---: | :--- |
| `RAZORPAY_KEY_ID` | String | `rzp_test_...` or `rzp_live_...` | Public/Config | Razorpay public key ID used by client and backend SDK. |
| `RAZORPAY_KEY_SECRET` | String | `SecretKeyString` | **CRITICAL SECRET** | Razorpay private key secret used for server-side signing. |
| `RAZORPAY_WEBHOOK_SECRET`| String | `WebhookSecretString` | **CRITICAL SECRET** | Shared secret used to verify webhook event signatures. |
| `SUBSCRIPTION_CURRENCY` | String | `INR` | Config | Default currency code for payment transactions. |

---

## 5. Subscription & Invoicing Policy

| Variable | Type | Default | Description |
| :--- | :---: | :---: | :--- |
| `GRACE_PERIOD_DAYS` | Integer | `3` | Number of days to maintain paid benefits after renewal failure. |
| `RENEWAL_REMINDER_DAYS_BEFORE` | String | `3,1` | Comma-separated days before expiry to dispatch renewal emails. |
| `COMPANY_NAME` | String | Corporate Name | Business name printed on generated tax PDF invoices. |
| `COMPANY_GSTIN` | String | GST Number | Organization GST identification number for tax invoices. |
| `COMPANY_SAC_CODE` | String | `998439` | Service Accounting Code for digital streaming services. |
| `TAX_PERCENTAGE` | Integer | `18` | Goods & Services Tax (GST) rate applied to checkouts. |

---

## 6. Frontend Public Variables (Next.js)

All variables exposed to the client browser must be prefixed with `NEXT_PUBLIC_`:

| Variable | Description |
| :--- | :--- |
| `NEXT_PUBLIC_SERVER_URL` | Base HTTP URL to the backend API cluster. |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Razorpay public key for initializing the client checkout modal. |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Client SDK API key for Google OAuth authentication. |
