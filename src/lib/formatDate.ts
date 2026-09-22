import { useState, useEffect } from "react"
import { formatDistanceToNow } from "date-fns"

export function useIsMounted() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])
  return mounted
}

export function formatRelativeTime(dateInput: string | Date, fallback: string = "recently"): string {
  try {
    return `${formatDistanceToNow(new Date(dateInput))} ago`
  } catch {
    return fallback
  }
}
