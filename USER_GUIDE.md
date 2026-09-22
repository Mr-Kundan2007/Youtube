# End-User Platform & Subscription Self-Service Guide

Welcome to the **Video Streaming & Subscription Platform**. This guide explains how to manage your subscription tier, choose plans, stream content in HD/4K, utilize offline video downloads, manage authorized devices, and view official tax invoices.

> 📖 **Comprehensive Documentation**: For extended technical specifications, see [docs/USER_GUIDE.md](docs/USER_GUIDE.md) and [docs/SUBSCRIPTION_GUIDE.md](docs/SUBSCRIPTION_GUIDE.md).

---

## 1. Subscription Tiers & Feature Matrix

| Feature / Benefit | Free Tier | Bronze Tier | Silver Tier | Gold Tier |
| :--- | :---: | :---: | :---: | :---: |
| **Pricing (Monthly)** | ₹0 | ₹199 / mo | ₹499 / mo | ₹999 / mo |
| **Pricing (Quarterly - 10% off)** | ₹0 | ₹537 | ₹1,347 | ₹2,697 |
| **Pricing (Yearly - 20% off)** | ₹0 | ₹1,910 | ₹4,790 | ₹9,590 |
| **Streaming Quality** | 360p / 480p | 720p HD | 1080p Full HD | 4K Ultra HD + HDR |
| **Daily Offline Downloads**| 1 video / day | 5 videos / day | 15 videos / day | 50 videos / day |
| **Daily Watch Time** | 60 minutes | Unlimited | Unlimited | Unlimited |
| **Allowed Concurrent Devices**| 1 device | 2 devices | 3 devices | 5 devices |
| **Ad Experience** | Standard Ads | Reduced Ads | Zero Ads | Zero Ads |
| **Premium Video Access** | Standard only | Standard only | Full Access | Full Access |
| **Official GST Tax Invoice**| N/A | Included | Included | Included |

---

## 2. Choosing & Subscribing to a Plan

1. **Visit the Pricing Matrix**: Navigate to `/pricing` in the top navigation bar.
2. **Select Frequency**: Toggle between **Monthly**, **Quarterly (Save 10%)**, or **Yearly (Save 20%)**.
3. **Initiate Checkout**: Click **Subscribe Now** on your desired tier.
4. **Complete Payment**: Authenticate via UPI (Google Pay, PhonePe, Paytm), Credit/Debit Card, or Net Banking in the secure Razorpay overlay.
5. **Instant Activation**: Your account upgrades immediately within 1-2 seconds of successful payment.

---

## 3. Managing Active Subscriptions (`/subscription`)

Visit `/subscription` to manage your account:
* **Current Tier & Expiration**: View your active tier and renewal date.
* **Usage Quota Meters**: Monitor consumed daily downloads and streaming time.
* **Tax Invoices**: Download official PDF invoices with GST details for all payments.
* **Plan Upgrades**: Upgrade immediately to a higher tier with automatic proration.
* **Cancellations**: Cancel recurring renewal anytime. You retain all paid benefits until the current period concludes.

---

## 4. Video Downloads & Device Management (`/downloads`)

* **Daily Quota Reset**: Your download allowance resets automatically every night at 00:00 UTC.
* **24-Hour Free Re-Downloads**: Re-downloading the same title within 24 hours consumes zero additional daily quota.
* **Device Binding**: Offline downloads are tied to registered devices according to your tier limit (1 to 5 devices). Remove unused devices anytime under `/downloads`.

---

## 5. Support & Troubleshooting

* **Payment Debited but Plan Not Upgraded**: Refresh `/subscription`. Our automated Razorpay webhook listener synchronizes transactions within 60 seconds.
* **Failed Downloads**: Select **Retry Download** under `/downloads` to resume without consuming additional quota.
