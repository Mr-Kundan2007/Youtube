import React from "react"
import SubscriptionsPricingPage from "./subscriptions/index"

/**
 * /pricing route
 * Seamlessly renders the comprehensive SubscriptionsPricingPage to maintain
 * 100% backward compatibility for all existing links across Header, Sidebar, and Modals.
 */
export default function Pricing() {
  return <SubscriptionsPricingPage />
}
