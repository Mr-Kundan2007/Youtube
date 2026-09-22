import DownloadNotification from "../Modals/DownloadNotification.js"
import { logger } from "../utils/logger.js"

export class SubscriptionNotificationService {
  /**
   * Helper to safely create an in-app notification without blocking lifecycle operations.
   */
  async _createNotification(payload, retries = 2) {
    let attempt = 0
    while (attempt <= retries) {
      try {
        return await DownloadNotification.create({
          userId: payload.userId,
          user_id: payload.userId,
          type: payload.type,
          title: payload.title,
          message: payload.message,
          actionUrl: payload.actionUrl || "/subscription/dashboard",
          status: "unread",
          read: false,
          metadata: payload.metadata || {},
        })
      } catch (err) {
        attempt++
        logger.warn(`Notification delivery attempt ${attempt} failed: ${err.message}`)
        if (attempt > retries) {
          logger.error(`Notification failed permanently for user ${payload.userId} [${payload.type}]`)
          return null
        }
      }
    }
  }

  /**
   * Dispatches payment successful and subscription activated confirmation.
   */
  async notifyPaymentSuccess({ userId, planName, amount, currency = "INR", invoiceNumber }) {
    return this._createNotification({
      userId,
      type: "PAYMENT_SUCCESSFUL",
      title: `Payment Successful - Welcome to ${planName}!`,
      message: `Your payment of ${currency === "INR" ? "₹" : "$"}${amount} for ${planName} was successful. Invoice: ${invoiceNumber}.`,
      actionUrl: "/subscription/dashboard",
      metadata: {
        planName,
        amount,
        currency,
        invoiceNumber,
      },
    })
  }

  /**
   * Dispatches upcoming expiry reminders (e.g. 7 days, 3 days, 1 day, today).
   */
  async notifyExpiryReminder({ userId, planName, daysRemaining, expiryDate }) {
    let title = ""
    let message = ""
    let type = "EXPIRY_REMINDER"

    const formattedDate = expiryDate ? new Date(expiryDate).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }) : "soon"

    if (daysRemaining <= 0) {
      type = "SUBSCRIPTION_EXPIRING_TODAY"
      title = `Your ${planName} Subscription Expires Today!`
      message = `Your ${planName} membership ends today. Renew now to avoid losing 4K streaming, offline downloads, and ad-free viewing.`
    } else if (daysRemaining === 1) {
      title = `Your ${planName} Subscription Expires Tomorrow`
      message = `Your subscription will expire tomorrow on ${formattedDate}. Renew now to maintain uninterrupted access.`
    } else {
      title = `Your ${planName} Subscription Expires in ${daysRemaining} Days`
      message = `Your ${planName} membership concludes on ${formattedDate}. Renew now to keep all your premium features.`
    }

    return this._createNotification({
      userId,
      type,
      title,
      message,
      actionUrl: "/subscriptions",
      metadata: {
        planName,
        daysRemaining,
        expiryDate,
      },
    })
  }

  /**
   * Dispatches renewal reminder notification.
   */
  async notifyRenewalUpcoming({ userId, planName, daysRemaining, nextBillingDate }) {
    return this.notifyExpiryReminder({
      userId,
      planName,
      daysRemaining,
      expiryDate: nextBillingDate,
    })
  }

  /**
   * Dispatches plan expiration and downgrade notice.
   */
  async notifySubscriptionExpired({ userId, planName }) {
    return this._createNotification({
      userId,
      type: "SUBSCRIPTION_EXPIRED",
      title: "Your Subscription Has Ended",
      message: `Your ${planName} subscription period has concluded. Your account has transitioned to the Free tier. Your watch history and saved videos remain 100% safe. Upgrade anytime to restore premium features.`,
      actionUrl: "/subscriptions",
      metadata: {
        planName,
        downgradedTo: "free",
        expiredAt: new Date(),
      },
    })
  }

  /**
   * Dispatches subscription cancellation scheduled notice.
   */
  async notifyCancellationScheduled({ userId, planName, accessUntilDate }) {
    const formattedDate = accessUntilDate ? new Date(accessUntilDate).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }) : "the end of your billing cycle"

    return this._createNotification({
      userId,
      type: "CANCELLATION_SCHEDULED",
      title: "Subscription Cancellation Scheduled",
      message: `Auto-renewal for your ${planName} plan is turned off. You retain all premium benefits until ${formattedDate}. You can restore your subscription anytime before expiry.`,
      actionUrl: "/subscription/dashboard",
      metadata: {
        planName,
        accessUntilDate,
      },
    })
  }

  /**
   * Dispatches cancellation reversal / restoration notice.
   */
  async notifyCancellationRestored({ userId, planName, expiryDate }) {
    const formattedDate = expiryDate ? new Date(expiryDate).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }) : "the end of your billing cycle"

    return this._createNotification({
      userId,
      type: "CANCELLATION_RESTORED",
      title: "Subscription Cancellation Reversed",
      message: `Great news! Your ${planName} plan cancellation has been reversed. Auto-renewal is active and your benefits continue seamlessly until ${formattedDate}.`,
      actionUrl: "/subscription/dashboard",
      metadata: {
        planName,
        expiryDate,
      },
    })
  }

  /**
   * Dispatches grace period notice.
   */
  async notifyGracePeriodStarted({ userId, planName, graceEndDate }) {
    const formattedDate = graceEndDate ? new Date(graceEndDate).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }) : "2 days"

    return this._createNotification({
      userId,
      type: "GRACE_PERIOD_STARTED",
      title: "Subscription in Grace Period",
      message: `Your ${planName} subscription expired, but you have grace access until ${formattedDate}. Please renew now to prevent service interruption.`,
      actionUrl: "/subscriptions",
      metadata: {
        planName,
        graceEndDate,
      },
    })
  }
}

export const subscriptionNotificationService = new SubscriptionNotificationService()
export default subscriptionNotificationService
