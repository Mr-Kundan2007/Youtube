/**
 * Central Authentication & Device Integration Service (Phase 4)
 *
 * Encapsulates login authentication requests and securely decorates payloads
 * with non-blocking client device metadata.
 */

import API from "@/lib/axiosinstance"
import { getDeviceInfo, ClientDeviceInfo } from "@/utils/deviceUtils"

export interface LoginPayload {
  email: string
  name?: string
  image?: string
  password?: string
  deviceInfo?: ClientDeviceInfo
}

export interface LoginResponse {
  result?: any
  user?: any
  token?: string
  deviceMetadata?: any
  [key: string]: any
}

class AuthService {
  /**
   * Submits login request bundled with client device metadata.
   * If deviceInfo is not provided, it is automatically collected non-blockingly.
   * If metadata collection encounters an error, login proceeds regardless.
   */
  async login(payload: LoginPayload, explicitDeviceInfo?: ClientDeviceInfo): Promise<LoginResponse> {
    let deviceInfo = explicitDeviceInfo || payload.deviceInfo

    if (!deviceInfo) {
      try {
        deviceInfo = await getDeviceInfo()
      } catch (err) {
        console.warn("[AuthService] Non-fatal device collection warning:", err)
      }
    }

    const requestData: LoginPayload = {
      ...payload,
      deviceInfo,
    }

    const { data } = await API.post<LoginResponse>("/user/login", requestData)
    return data
  }
}

export const authService = new AuthService()
export default authService
