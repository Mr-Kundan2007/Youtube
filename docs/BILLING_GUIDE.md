# Billing, Tax Compliance & Invoicing Architecture Guide

This guide describes the billing engine, GST tax calculations, automated PDF invoice generation, SAC code classification, and self-service receipt retrieval.

---

## 1. Indian GST Compliance & SAC Classification

All digital subscriptions processed on the platform comply with Indian Goods & Services Tax (GST) laws for Online Information Database Access and Retrieval (OIDAR) services.

### Tax Configuration Parameters:
* **Service Accounting Code (SAC)**: `998439` (Online audio, video and streaming services).
* **Tax Rate**: Flat 18% GST.
* **Intra-State Supply** (Subscriber in same state as company):
  - Central GST (CGST): 9%
  - State GST (SGST): 9%
* **Inter-State Supply** (Subscriber in different state):
  - Integrated GST (IGST): 18%

---

## 2. Tax Computation Formula

Prices displayed on marketing cards can be inclusive or exclusive based on configuration. By default, checkout items are calculated as follows:

$$\text{Base Amount} = \text{Plan Fee} \times (1 - \text{Discount Rate})$$
$$\text{GST Amount} = \text{Base Amount} \times 0.18$$
$$\text{Total Invoice Amount} = \text{Base Amount} + \text{GST Amount}$$

### Example: Silver Plan (Quarterly with 10% Discount)
* **Base List Price**: ₹1,497
* **Discount (10%)**: -₹150
* **Taxable Value**: ₹1,347.00
* **GST (18%)**: ₹242.46
* **Total Paid**: ₹1,589.46

---

## 3. PDF Invoice Generation Engine

The system uses `pdfkit` to compile high-resolution, vector-crisp PDF documents dynamically stored and streamed to authorized users.

### Invoice Data Model (`Invoice` Collection in MongoDB):
```json
{
  "_id": "6a9f0a54266efaede76fc46e",
  "invoiceNumber": "INV-202609-842B10",
  "userId": "6a9f0a54266efaede76fc46c",
  "transactionId": "PAY-20260907-279F44",
  "plan": "silver",
  "billingCycle": "monthly",
  "subtotal": 499.00,
  "discount": 0.00,
  "taxAmount": 89.82,
  "totalAmount": 588.82,
  "currency": "INR",
  "status": "paid",
  "customer": {
    "name": "Alex Subscriber",
    "email": "alex@example.com",
    "gstin": "27AAAAA0000A1Z5"
  },
  "company": {
    "name": "Video Streaming Platforms Pvt Ltd",
    "gstin": "27ABCDE1234F1Z5",
    "address": "Tech Park, Cyber Hub, Bengaluru, India",
    "sacCode": "998439"
  },
  "issuedAt": "2026-09-08T00:30:00.000Z"
}
```

### Invoice Features:
1. **Official Header**: Organization branding, GSTIN, registered corporate address.
2. **Customer Information**: Full name, masked email, optional user GSTIN.
3. **Line Items**: Itemized table specifying plan name, validity interval, unit price, and discount.
4. **Tax Summary**: Clear breakdown of CGST, SGST, or IGST.
5. **Security**: Verifiable invoice serial number and digital timestamp.

---

## 4. Invoice Retrieval Endpoints

* **User Invoices**: `GET /api/subscriptions/invoices`
  Returns paginated list of invoice summaries for the authenticated user.
* **Download PDF**: `GET /api/subscriptions/invoices/:invoiceId/download`
  Streams the compiled `%PDF` binary document with header `Content-Disposition: attachment; filename="invoice-INV-XXXXXX.pdf"`.
* **Admin Invoices**: `GET /api/admin/subscriptions/invoices`
  Enables administrative search across all customer invoices with date, plan, and status filtering.
