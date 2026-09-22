import { useState, useEffect, useCallback } from "react"
import {
  ClientDeviceInfo,
  getDeviceInfo,
  formatDeviceName,
  FormatDeviceOptions,
} from "@/utils/deviceUtils"

export interface UseDeviceInfoResult {
  deviceInfo: ClientDeviceInfo | null
  loading: boolean
  formattedDeviceName: string
  refreshDeviceInfo: () => Promise<ClientDeviceInfo>
  formatName: (options?: FormatDeviceOptions) => string
}

/**
 * Reusable React Hook for accessing current client device metadata.
 */
export function useDeviceInfo(): UseDeviceInfoResult {
  const [deviceInfo, setDeviceInfo] = useState<ClientDeviceInfo | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  const refreshDeviceInfo = useCallback(async (): Promise<ClientDeviceInfo> => {
    setLoading(true)
    try {
      const info = await getDeviceInfo()
      setDeviceInfo(info)
      return info
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    getDeviceInfo()
      .then((info) => {
        if (isMounted) {
          setDeviceInfo(info)
          setLoading(false)
        }
      })
      .catch(() => {
        if (isMounted) {
          setLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  const formattedDeviceName = deviceInfo
    ? formatDeviceName(deviceInfo)
    : "Detecting device..."

  const formatName = useCallback(
    (options?: FormatDeviceOptions) => {
      if (!deviceInfo) return "Detecting device..."
      return formatDeviceName(deviceInfo, options)
    },
    [deviceInfo]
  )

  return {
    deviceInfo,
    loading,
    formattedDeviceName,
    refreshDeviceInfo,
    formatName,
  }
}

export default useDeviceInfo
