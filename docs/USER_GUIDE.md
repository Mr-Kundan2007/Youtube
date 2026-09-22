# Comprehensive End-User Subscription & Learning Portal Guide

Welcome to the **Video Streaming & Learning Platform Subscription Management Guide**. This documentation provides end-to-end instructions for discovering plans, completing secure checkouts, streaming high-definition content, downloading courses for offline viewing, downloading tax invoices, and managing your subscription lifecycle.

---

## 1. Subscription Tiers & Feature Matrix

The platform provides 4 tiered membership levels tailored to individual learning and streaming requirements:

| Feature / Benefit | Free Tier | Bronze Tier | Silver Tier | Gold Tier |
| :--- | :---: | :---: | :---: | :---: |
| **Pricing (Monthly)** | ₹0 | ₹199 / mo | ₹499 / mo | ₹999 / mo |
| **Pricing (Quarterly)** | ₹0 | ₹537 (10% off) | ₹1,347 (10% off) | ₹2,697 (10% off) |
| **Pricing (Yearly)** | ₹0 | ₹1,910 (20% off) | ₹4,790 (20% off) | ₹9,590 (20% off) |
| **Streaming Quality** | Up to 360p / 480p | Up to 720p HD | Up to 1080p Full HD | Up to 4K Ultra HD + HDR |
| **Daily Offline Downloads**| 1 video / day | 5 videos / day | 15 videos / day | 50 videos / day |
| **Daily Watch Time Limit** | 60 mins / day | Unlimited | Unlimited | Unlimited |
| **Concurrent Devices** | 1 device | 2 devices | 3 devices | 5 devices |
| **Premium Video Access** | Standard catalog | Standard catalog | All Premium Videos | All Premium Videos |
| **Premium Course Access**| Intro modules only | Intro modules only | Full Course Library | Full Courses + Mentorship |
| **Ad Experience** | Standard Ads | Reduced Ads | Zero Ads | Zero Ads |
| **Offline Expiration** | 24 hours | 7 days | 30 days | 30 days |
| **Customer Support** | Community Forums | Email Support (48h) | Priority Support (12h)| Dedicated VIP Concierge |

---

## 2. Choosing & Subscribing to a Plan

### Step 1: Navigating to the Pricing Matrix
1. Log in to your account using Google OAuth or email credentials.
2. Click the **Upgrade to Premium** badge in the navigation bar or visit `/pricing`.
3. Toggle between **Monthly**, **Quarterly (Save 10%)**, and **Yearly (Save 20%)** billing frequencies to see prorated savings.

### Step 2: Initiating Checkout
1. Select your desired plan (e.g. **Silver** or **Gold**) and click **Subscribe Now**.
2. The checkout modal will present an itemized breakdown including:
   - Base membership fee
   - Applied billing discount (10% or 20%)
   - Applicable Goods & Services Tax (GST 18%)
   - Total payable amount in Indian Rupees (₹ INR)

### Step 3: Completing Secure Payment
1. Click **Proceed to Payment** to launch the secure Razorpay Checkout overlay.
2. Choose your preferred payment method:
   - **UPI**: Google Pay, PhonePe, Paytm, or any UPI ID / QR code
   - **Credit / Debit Cards**: Visa, MasterCard, RuPay, American Express
   - **Net Banking**: All major Indian banks
   - **Wallets & PayLater**: Supported partner wallets
3. Authenticate the transaction with your banking provider's OTP / UPI PIN.
4. Upon approval, you will be redirected to the **Payment Confirmation** screen. Your account upgrades immediately within 1-2 seconds.

---

## 3. Managing Your Active Subscription

Access your dedicated account management hub at `/subscription`:

* **Plan Status & Expiry**: Displays your current tier, active renewal date, and billing frequency.
* **Usage Quota Meters**:
  - **Downloads**: Displays consumed downloads vs. daily allowance (resets at 00:00 UTC).
  - **Watch Time**: Displays elapsed daily streaming minutes (Free users only).
* **Payment History & Receipts**: Complete list of all historical billing transactions.
* **Tax Invoices**: Instant PDF download for every successful transaction.

---

## 4. Upgrades, Downgrades & Plan Modifications

### Upgrading to a Higher Tier (e.g. Silver to Gold)
* Navigate to `/pricing` while logged in.
* Select the higher plan and choose your billing cycle.
* When you upgrade:
  - Your new limits (such as 50 daily downloads and 4K streaming) take effect immediately.
  - A prorated invoice is created accounting for the remainder of your active subscription.

### Downgrading to a Lower Tier (e.g. Gold to Silver)
* Select the lower tier from `/pricing` or click **Change Plan** in `/subscription`.
* Your existing Gold perks remain active until the end of the current paid billing cycle.
* On the scheduled renewal date, your account transitions automatically to Silver without disruption or unexpected charges.

---

## 5. Cancelling Your Subscription

We believe in flexible, hassle-free subscription management:
1. Navigate to `/subscription`.
2. Scroll to the **Subscription Controls** section and click **Cancel Subscription**.
3. Select an optional reason to help us improve our catalog.
4. Click **Confirm Cancellation**.
5. **No Immediate Lockout**: You retain all paid benefits (1080p/4K streaming, downloads, premium catalog) through the expiration of your already-paid period.
6. Once the date expires, your account safely reverts to the **Free** tier. Your saved playlists, watch history, and account data are always preserved.

---

## 6. Accessing Offline Downloads

1. Browse to any video or course lecture.
2. Click the **Download** button located below the player.
3. Select your preferred resolution (up to your tier's allowed maximum).
4. View progress and manage saved files under `/downloads`.
5. Note: Re-downloading the same title within 24 hours consumes zero additional daily quota.

---

## 7. Troubleshooting & Frequently Asked Questions

* **My payment succeeded but my account hasn't upgraded:**
  Refresh `/subscription`. If your bank debited funds but network issues interrupted your redirect, our background Razorpay Webhook processor automatically credits your account within 60 seconds.
* **Can I get an official GST tax invoice?**
  Yes! Visit `/subscription`, navigate to the **Invoices** tab, and click **Download PDF**.
* **What happens if my renewal payment fails?**
  You enter a 3-day **Grace Period** where all paid privileges remain unlocked while you update your payment method.
