import { formatCurrency } from "../billing/billingUtils.js"

/**
 * Base email wrapper providing responsive HTML, consistent YouTube Premium branding,
 * and high compatibility with email clients.
 */
function emailWrapper({ title, preheader = "", bodyContent, ctaText = "", ctaUrl = "" }) {
  const currentYear = new Date().getFullYear()
  const ctaBlock =
    ctaText && ctaUrl
      ? `<div style="text-align: center; margin: 32px 0;">
          <a href="${ctaUrl}" style="background-color: #dc2626; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 700; font-size: 15px; display: inline-block;">${ctaText}</a>
        </div>`
      : ""

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #18181b;">
  <div style="display: none; max-height: 0px; overflow: hidden;">${preheader}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f4f4f5; padding: 40px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" max-width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); border: 1px solid #e4e4e7;">
          <!-- Header -->
          <tr>
            <td style="background-color: #09090b; padding: 24px 32px; border-bottom: 3px solid #dc2626;">
              <table width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td>
                    <span style="color: #dc2626; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">YOUTUBE</span>
                    <span style="color: #ffffff; font-size: 18px; font-weight: 600; margin-left: 6px;">PREMIUM</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 36px 32px;">
              ${bodyContent}
              ${ctaBlock}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #fafafa; padding: 24px 32px; border-top: 1px solid #f4f4f5; text-align: center; color: #71717a; font-size: 12px; line-height: 1.5;">
              <p style="margin: 0 0 8px 0;">This email was sent regarding your YouTube Premium account.</p>
              <p style="margin: 0;">For inquiries or billing assistance, visit your <a href="http://localhost:3000/subscription/dashboard" style="color: #dc2626; text-decoration: underline;">Subscription Dashboard</a> or contact support@youtube.local.</p>
              <p style="margin: 12px 0 0 0; color: #a1a1aa;">&copy; ${currentYear} YouTube Streaming & Learning Platform. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/**
 * 1. Payment Successful Confirmation Email
 */
export function paymentSuccessfulTemplate(data) {
  const {
    userName = "Valued Customer",
    planName = "Premium",
    billingPeriod = "Monthly",
    amount = 0,
    currency = "INR",
    transactionId = "N/A",
    invoiceNumber = "N/A",
    expiryDate = "",
    dashboardUrl = "http://localhost:3000/billing",
  } = data

  const bodyContent = `
    <h2 style="color: #09090b; font-size: 22px; margin: 0 0 16px 0;">Your Payment Was Successful</h2>
    <p style="color: #52525b; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
      Hello <strong>${userName}</strong>, we have received your payment for the <strong>${planName}</strong> plan. Your premium benefits are active!
    </p>

    <div style="background-color: #f4f4f5; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
      <table width="100%" cellspacing="0" cellpadding="6" border="0" style="font-size: 14px;">
        <tr>
          <td style="color: #71717a;">Plan:</td>
          <td style="font-weight: 600; text-align: right; color: #09090b;">${planName}</td>
        </tr>
        <tr>
          <td style="color: #71717a;">Billing Period:</td>
          <td style="font-weight: 600; text-align: right; color: #09090b; text-transform: capitalize;">${billingPeriod}</td>
        </tr>
        <tr>
          <td style="color: #71717a;">Amount Paid:</td>
          <td style="font-weight: 700; text-align: right; color: #dc2626; font-size: 16px;">${formatCurrency(amount, currency)}</td>
        </tr>
        <tr>
          <td style="color: #71717a;">Transaction ID:</td>
          <td style="font-family: monospace; text-align: right; color: #09090b;">${transactionId}</td>
        </tr>
        <tr>
          <td style="color: #71717a;">Invoice Number:</td>
          <td style="font-family: monospace; text-align: right; color: #09090b;">${invoiceNumber}</td>
        </tr>
        ${expiryDate ? `<tr><td style="color: #71717a;">Valid Until:</td><td style="font-weight: 600; text-align: right; color: #09090b;">${new Date(expiryDate).toLocaleDateString("en-IN", { dateStyle: "long" })}</td></tr>` : ""}
      </table>
    </div>
  `

  return {
    subject: `Payment Successful — Your ${planName} Plan is Active`,
    html: emailWrapper({
      title: "Payment Successful",
      preheader: `Payment of ${formatCurrency(amount, currency)} received for ${planName}.`,
      bodyContent,
      ctaText: "View Invoices & Billing",
      ctaUrl: dashboardUrl,
    }),
  }
}

/**
 * 2. Subscription Activation Welcome Email
 */
export function subscriptionActivatedTemplate(data) {
  const {
    userName = "Valued Customer",
    planName = "Silver",
    expiryDate = "",
    billingPeriod = "monthly",
    dashboardUrl = "http://localhost:3000/subscription/dashboard",
  } = data

  const bodyContent = `
    <h2 style="color: #09090b; font-size: 22px; margin: 0 0 16px 0;">Welcome to ${planName} 🎉</h2>
    <p style="color: #52525b; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
      Hello <strong>${userName}</strong>, thank you for joining YouTube Premium! Your subscription is now fully active.
    </p>

    <div style="background-color: #fdf2f2; border: 1px solid #fee2e2; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
      <h3 style="color: #991b1b; font-size: 15px; margin: 0 0 12px 0;">You now have access to:</h3>
      <ul style="color: #4b5563; font-size: 14px; margin: 0; padding-left: 20px; line-height: 1.8;">
        <li>High definition and 4K Ultra HD streaming</li>
        <li>100% Ad-free viewing experience</li>
        <li>Increased daily offline download quotas</li>
        <li>Full access to exclusive premium courses</li>
        <li>Multi-device playback support</li>
      </ul>
    </div>

    <p style="color: #71717a; font-size: 13px;">
      Billing Cycle: <strong style="text-transform: capitalize;">${billingPeriod}</strong> | Expiration: <strong>${expiryDate ? new Date(expiryDate).toLocaleDateString("en-IN", { dateStyle: "long" }) : "Active"}</strong>
    </p>
  `

  return {
    subject: `Welcome to ${planName} — Your Premium Features Are Active!`,
    html: emailWrapper({
      title: `Welcome to ${planName}`,
      preheader: `Start enjoying ad-free streaming and 4K playback.`,
      bodyContent,
      ctaText: "Open Subscription Dashboard",
      ctaUrl: dashboardUrl,
    }),
  }
}

/**
 * 3. Subscription Renewed Confirmation Email
 */
export function subscriptionRenewedTemplate(data) {
  const {
    userName = "Valued Customer",
    planName = "Silver",
    newExpiry = "",
    amount = 0,
    currency = "INR",
    transactionId = "N/A",
    invoiceNumber = "N/A",
    dashboardUrl = "http://localhost:3000/billing",
  } = data

  const bodyContent = `
    <h2 style="color: #09090b; font-size: 22px; margin: 0 0 16px 0;">Your Subscription Has Been Renewed</h2>
    <p style="color: #52525b; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
      Hello <strong>${userName}</strong>, your <strong>${planName}</strong> plan renewal was completed successfully. Your continuous access is guaranteed.
    </p>

    <div style="background-color: #f4f4f5; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
      <table width="100%" cellspacing="0" cellpadding="6" border="0" style="font-size: 14px;">
        <tr>
          <td style="color: #71717a;">Plan:</td>
          <td style="font-weight: 600; text-align: right; color: #09090b;">${planName}</td>
        </tr>
        <tr>
          <td style="color: #71717a;">New Expiry Date:</td>
          <td style="font-weight: 700; text-align: right; color: #16a34a;">${newExpiry ? new Date(newExpiry).toLocaleDateString("en-IN", { dateStyle: "long" }) : "Extended"}</td>
        </tr>
        <tr>
          <td style="color: #71717a;">Amount:</td>
          <td style="font-weight: 700; text-align: right; color: #dc2626;">${formatCurrency(amount, currency)}</td>
        </tr>
        <tr>
          <td style="color: #71717a;">Invoice Number:</td>
          <td style="font-family: monospace; text-align: right; color: #09090b;">${invoiceNumber}</td>
        </tr>
      </table>
    </div>
  `

  return {
    subject: `Your ${planName} Subscription Has Been Renewed`,
    html: emailWrapper({
      title: "Subscription Renewed",
      preheader: `Your subscription has been renewed until ${newExpiry ? new Date(newExpiry).toLocaleDateString() : ""}.`,
      bodyContent,
      ctaText: "View Billing History",
      ctaUrl: dashboardUrl,
    }),
  }
}

/**
 * 4. Subscription Upgraded Confirmation Email
 */
export function subscriptionUpgradedTemplate(data) {
  const {
    userName = "Valued Customer",
    previousPlan = "Bronze",
    newPlan = "Silver",
    amount = 0,
    currency = "INR",
    newExpiry = "",
    invoiceNumber = "N/A",
    dashboardUrl = "http://localhost:3000/subscription/dashboard",
  } = data

  const bodyContent = `
    <h2 style="color: #09090b; font-size: 22px; margin: 0 0 16px 0;">Your Subscription Has Been Upgraded!</h2>
    <p style="color: #52525b; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
      Hello <strong>${userName}</strong>, congratulations on upgrading from <strong>${previousPlan}</strong> to <strong>${newPlan}</strong>.
    </p>

    <div style="text-align: center; padding: 20px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 24px;">
      <span style="font-size: 16px; font-weight: 600; color: #64748b;">${previousPlan}</span>
      <span style="font-size: 20px; color: #dc2626; margin: 0 12px;">&rarr;</span>
      <span style="font-size: 18px; font-weight: 800; color: #dc2626;">${newPlan}</span>
    </div>

    <p style="color: #52525b; font-size: 14px; line-height: 1.6;">
      All higher tier perks, increased daily download limits, and higher streaming resolutions have taken effect immediately.
    </p>
  `

  return {
    subject: `Upgraded to ${newPlan}! New Benefits Active`,
    html: emailWrapper({
      title: "Subscription Upgraded",
      preheader: `You are now on the ${newPlan} plan.`,
      bodyContent,
      ctaText: "Explore New Features",
      ctaUrl: dashboardUrl,
    }),
  }
}

/**
 * 5. Payment Failed Notification Email
 */
export function paymentFailedTemplate(data) {
  const {
    userName = "Valued Customer",
    planAttempted = "Subscription",
    safeFailureMessage = "Transaction was declined or interrupted",
    retryUrl = "http://localhost:3000/subscriptions",
  } = data

  const bodyContent = `
    <h2 style="color: #991b1b; font-size: 22px; margin: 0 0 16px 0;">We Could Not Complete Your Payment</h2>
    <p style="color: #52525b; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
      Hello <strong>${userName}</strong>, we attempted to process your payment for the <strong>${planAttempted}</strong> plan, but the transaction could not be completed.
    </p>

    <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin-bottom: 24px; color: #991b1b; font-size: 14px;">
      <strong>Reason:</strong> ${safeFailureMessage}
    </div>

    <p style="color: #52525b; font-size: 14px; line-height: 1.6;">
      No charges were confirmed for your account. You can safely retry with an alternative card, UPI, or net banking method.
    </p>
  `

  return {
    subject: `Payment Issue — Could Not Complete Your Subscription`,
    html: emailWrapper({
      title: "Payment Failed",
      preheader: `Payment for ${planAttempted} could not be completed.`,
      bodyContent,
      ctaText: "Try Payment Again",
      ctaUrl: retryUrl,
    }),
  }
}

/**
 * 6. Payment Cancelled Email
 */
export function paymentCancelledTemplate(data) {
  const {
    userName = "Valued Customer",
    planAttempted = "Subscription",
    plansUrl = "http://localhost:3000/subscriptions",
  } = data

  const bodyContent = `
    <h2 style="color: #09090b; font-size: 22px; margin: 0 0 16px 0;">Your Payment Was Cancelled</h2>
    <p style="color: #52525b; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
      Hello <strong>${userName}</strong>, your payment checkout for <strong>${planAttempted}</strong> was cancelled. No subscription changes were applied.
    </p>
    <p style="color: #52525b; font-size: 14px; line-height: 1.6;">
      If you changed your mind or encountered an issue, our plans and comparison guides remain available at any time.
    </p>
  `

  return {
    subject: `Payment Cancelled — No Charges Applied`,
    html: emailWrapper({
      title: "Payment Cancelled",
      preheader: `Your checkout was cancelled.`,
      bodyContent,
      ctaText: "Browse All Plans",
      ctaUrl: plansUrl,
    }),
  }
}

/**
 * 7. Tax Invoice Created Email
 */
export function invoiceCreatedTemplate(data) {
  const {
    userName = "Valued Customer",
    planName = "Premium",
    invoiceNumber = "INV-000",
    amount = 0,
    currency = "INR",
    invoiceUrl = "http://localhost:3000/billing",
  } = data

  const bodyContent = `
    <h2 style="color: #09090b; font-size: 22px; margin: 0 0 16px 0;">Your Tax Invoice is Ready</h2>
    <p style="color: #52525b; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
      Hello <strong>${userName}</strong>, tax invoice <strong>${invoiceNumber}</strong> for your <strong>${planName}</strong> subscription has been generated and is now available for download.
    </p>
    <div style="background-color: #f4f4f5; border-radius: 8px; padding: 16px; margin-bottom: 24px; font-size: 14px;">
      <div>Invoice: <strong>${invoiceNumber}</strong></div>
      <div style="margin-top: 6px;">Total Paid: <strong>${formatCurrency(amount, currency)}</strong> (GST Included)</div>
    </div>
  `

  return {
    subject: `Tax Invoice ${invoiceNumber} Ready for Download`,
    html: emailWrapper({
      title: "Invoice Ready",
      preheader: `Tax invoice ${invoiceNumber} is ready.`,
      bodyContent,
      ctaText: "View & Download Invoice",
      ctaUrl: invoiceUrl,
    }),
  }
}

/**
 * 8. Subscription Expired Email
 */
export function subscriptionExpiredTemplate(data) {
  const {
    userName = "Valued Customer",
    planName = "Silver",
    renewUrl = "http://localhost:3000/subscriptions",
  } = data

  const bodyContent = `
    <h2 style="color: #09090b; font-size: 22px; margin: 0 0 16px 0;">Your ${planName} Subscription Has Expired</h2>
    <p style="color: #52525b; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
      Hello <strong>${userName}</strong>, your ${planName} subscription period has concluded, and your account has returned to the Free tier.
    </p>
    <p style="color: #52525b; font-size: 14px; line-height: 1.6;">
      Your watch history, saved playlists, and account profile remain completely safe. You can renew at any time to immediately restore ad-free viewing and 4K quality.
    </p>
  `

  return {
    subject: `Your ${planName} Subscription Has Expired`,
    html: emailWrapper({
      title: "Subscription Expired",
      preheader: `Your ${planName} plan has ended.`,
      bodyContent,
      ctaText: "Renew Premium Access",
      ctaUrl: renewUrl,
    }),
  }
}
