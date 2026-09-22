/**
 * Security Alert Client Service (Phase 10)
 *
 * Client API methods for querying security alerts, unread counts,
 * responding to alerts, executing emergency lockdowns, and managing preferences.
 */

import apiClient from "./apiClient"

export interface SecurityAlertMetadata {
  browser?: string
  device?: string
  location?: string
  maskedIP?: string
  timestamp?: string
  attemptCount?: number
  [key: string]: any
}

export interface SecurityAlert {
  id: string
  _id?: string
  userId: string
  type: string
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  title: string
  message: string
  status: "UNREAD" | "READ" | "ACTION_REQUIRED" | "RESOLVED" | "DISMISSED" | "EXPIRED"
  actionRequired: boolean
  actionStatus: "NONE" | "PENDING" | "CONFIRMED" | "REPORTED" | "DISMISSED"
  deliveryStatus?: {
    inApp?: string
    email?: string
    sms?: string
  }
  metadata: SecurityAlertMetadata
  createdAt: string
  readAt?: string | null
  resolvedAt?: string | null
}

export interface SecurityAlertsResponse {
  success: boolean
  alerts: SecurityAlert[]
  total: number
  page: number
  totalPages: number
}

export interface UnreadCountResponse {
  success: boolean
  count: number
  hasActionRequired: boolean
  hasCritical: boolean
}

export interface AccountProtectionStatusResponse {
  success: boolean
  status: "NORMAL" | "MONITORING" | "PROTECTED" | "TEMPORARILY_RESTRICTED" | "SECURITY_REVIEW"
  message: string
  reason?: string | null
  updatedAt?: string | null
}

export interface NotificationPreferences {
  inAppEnabled: boolean
  emailNewLoginEnabled: boolean
  emailHighRiskEnabled: boolean
  smsCriticalEnabled: boolean
}

export const securityAlertService = {
  /**
   * Fetches paginated security alerts.
   */
  async getAlerts(params?: {
    page?: number
    limit?: number
    status?: string
    severity?: string
    unreadOnly?: boolean
  }): Promise<SecurityAlertsResponse> {
    const query = new URLSearchParams()
    if (params?.page) query.set("page", String(params.page))
    if (params?.limit) query.set("limit", String(params.limit))
    if (params?.status) query.set("status", params.status)
    if (params?.severity) query.set("severity", params.severity)
    if (params?.unreadOnly) query.set("unreadOnly", "true")

    const endpoint = `/api/security/alerts${query.toString() ? `?${query.toString()}` : ""}`
    return apiClient.get<SecurityAlertsResponse>(endpoint)
  },

  /**
   * Fetches unread alert counter and urgency badges.
   */
  async getUnreadCount(): Promise<UnreadCountResponse> {
    return apiClient.get<UnreadCountResponse>("/api/security/alerts/unread-count")
  },

  /**
   * Marks an individual alert as READ.
   */
  async markAsRead(alertId: string): Promise<{ success: boolean; alert: SecurityAlert }> {
    return apiClient.patch<{ success: boolean; alert: SecurityAlert }>(
      `/api/security/alerts/${alertId}/read`
    )
  },

  /**
   * Marks all UNREAD alerts as READ in bulk.
   */
  async markAllAsRead(): Promise<{ success: boolean; updatedCount: number }> {
    return apiClient.patch<{ success: boolean; updatedCount: number }>("/api/security/alerts/read-all")
  },

  /**
   * User confirmation action: "This Was Me".
   */
  async confirmAlert(alertId: string): Promise<{ success: boolean; message: string; alert: SecurityAlert }> {
    return apiClient.post<{ success: boolean; message: string; alert: SecurityAlert }>(
      `/api/security/alerts/${alertId}/confirm`
    )
  },

  /**
   * User suspicious report action: "Not Me".
   */
  async reportSuspicious(alertId: string): Promise<{
    success: boolean
    message: string
    protectionStatus: string
    sessionsRevoked: number
    alert: SecurityAlert
  }> {
    return apiClient.post<{
      success: boolean
      message: string
      protectionStatus: string
      sessionsRevoked: number
      alert: SecurityAlert
    }>(`/api/security/alerts/${alertId}/report-suspicious`)
  },

  /**
   * Emergency Lockdown: "Secure My Account".
   */
  async secureAccount(reason?: string): Promise<{
    success: boolean
    status: string
    sessionsRevoked: number
    message: string
  }> {
    return apiClient.post<{
      success: boolean
      status: string
      sessionsRevoked: number
      message: string
    }>("/api/security/secure-account", { reason })
  },

  /**
   * Retrieves account protection status (NORMAL, PROTECTED, etc.).
   */
  async getProtectionStatus(): Promise<AccountProtectionStatusResponse> {
    return apiClient.get<AccountProtectionStatusResponse>("/api/security/protection-status")
  },

  /**
   * Retrieves user notification preferences.
   */
  async getNotificationPreferences(): Promise<{ success: boolean; preferences: NotificationPreferences }> {
    return apiClient.get<{ success: boolean; preferences: NotificationPreferences }>(
      "/api/security/preferences/notifications"
    )
  },

  /**
   * Updates user notification preferences.
   */
  async updateNotificationPreferences(
    prefs: Partial<NotificationPreferences>
  ): Promise<{ success: boolean; message: string; preferences: NotificationPreferences }> {
    return apiClient.put<{ success: boolean; message: string; preferences: NotificationPreferences }>(
      "/api/security/preferences/notifications",
      prefs
    )
  },
}

export default securityAlertService
