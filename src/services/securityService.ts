/**
 * Account Security Service (Phase 8)
 *
 * Client-side interface for managing trusted devices, querying login audit history,
 * and fetching the account security activity feed.
 */

import apiClient from "./apiClient"

export interface TrustedDeviceBrowser {
  name: string
  version: string
}

export interface TrustedDeviceOS {
  name: string
  version: string
}

export interface TrustedDeviceHardware {
  type: string
  model: string
}

export interface TrustedDeviceLocation {
  city: string | null
  state: string | null
  country: string | null
  countryCode: string | null
}

export interface TrustedDevice {
  id: string
  _id?: string
  deviceName: string
  customName?: string
  browser: TrustedDeviceBrowser
  operatingSystem: TrustedDeviceOS
  device: TrustedDeviceHardware
  location: TrustedDeviceLocation
  lastKnownIP: string | null
  firstVerifiedAt: string
  lastUsedAt: string
  trustedAt: string
  trustExpiresAt: string
  status: "ACTIVE" | "EXPIRED" | "REVOKED" | "SUSPENDED"
  isCurrentDevice?: boolean
}

export interface TrustedDevicesResponse {
  success: boolean
  devices: TrustedDevice[]
  count: number
  maxLimit: number
  durationDays: number
}

export interface LoginHistoryItem {
  id: string
  _id?: string
  status: "SUCCESS" | "FAILED" | "OTP_REQUIRED" | "OTP_FAILED" | "BLOCKED" | "EXPIRED"
  authenticationMethod: string
  browser: TrustedDeviceBrowser
  operatingSystem: TrustedDeviceOS
  device: TrustedDeviceHardware
  maskedIP: string
  location: TrustedDeviceLocation
  loginAt: string
  verificationRequired: boolean
  verificationMethod?: string
  trustedDeviceId?: string | null
}

export interface LoginHistoryResponse {
  success: boolean
  history: LoginHistoryItem[]
  total: number
  page: number
  totalPages: number
}

export interface SecurityActivityItem {
  id: string
  _id?: string
  eventType: string
  title: string
  description: string
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  ip: string
  timestamp: string
  metadata?: Record<string, any>
}

export interface SecurityActivityResponse {
  success: boolean
  activities: SecurityActivityItem[]
  total: number
  page: number
  totalPages: number
}

export const securityService = {
  /**
   * Fetches all trusted devices for the authenticated user.
   */
  async getTrustedDevices(): Promise<TrustedDevicesResponse> {
    return apiClient.get<TrustedDevicesResponse>("/api/security/trusted-devices")
  },

  /**
   * Updates the friendly custom display name of a trusted device.
   */
  async renameTrustedDevice(deviceId: string, customName: string): Promise<{ success: boolean; message: string }> {
    return apiClient.patch<{ success: boolean; message: string }>(
      `/api/security/trusted-devices/${deviceId}`,
      { customName }
    )
  },

  /**
   * Soft-revokes trust for a device, mandating re-verification on next login.
   */
  async revokeTrustedDevice(deviceId: string): Promise<{ success: boolean; message: string }> {
    return apiClient.delete<{ success: boolean; message: string }>(
      `/api/security/trusted-devices/${deviceId}`
    )
  },

  /**
   * Fetches paginated login history with optional status and device type filters.
   */
  async getLoginHistory(params?: {
    page?: number
    limit?: number
    status?: string
    deviceType?: string
  }): Promise<LoginHistoryResponse> {
    const query = new URLSearchParams()
    if (params?.page) query.set("page", String(params.page))
    if (params?.limit) query.set("limit", String(params.limit))
    if (params?.status) query.set("status", params.status)
    if (params?.deviceType) query.set("deviceType", params.deviceType)

    const endpoint = `/api/security/login-history${query.toString() ? `?${query.toString()}` : ""}`
    return apiClient.get<LoginHistoryResponse>(endpoint)
  },

  /**
   * Fetches the paginated account security activity feed.
   */
  async getSecurityActivity(params?: {
    page?: number
    limit?: number
    severity?: string
  }): Promise<SecurityActivityResponse> {
    const query = new URLSearchParams()
    if (params?.page) query.set("page", String(params.page))
    if (params?.limit) query.set("limit", String(params.limit))
    if (params?.severity) query.set("severity", params.severity)

    const endpoint = `/api/security/activity${query.toString() ? `?${query.toString()}` : ""}`
    return apiClient.get<SecurityActivityResponse>(endpoint)
  },
}

export default securityService
