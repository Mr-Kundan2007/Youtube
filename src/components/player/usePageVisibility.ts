import { useEffect, useState, useRef } from "react"

export interface UsePageVisibilityOptions {
  onHidden?: () => void
  onVisible?: () => void
  onPageHide?: (persisted: boolean) => void
}

/**
 * Hook to monitor tab/window visibility changes and page unload events cleanly.
 */
export function usePageVisibility({
  onHidden,
  onVisible,
  onPageHide,
}: UsePageVisibilityOptions = {}): { isPageVisible: boolean } {
  const [isPageVisible, setIsPageVisible] = useState<boolean>(() => {
    if (typeof document !== "undefined") {
      return document.visibilityState !== "hidden"
    }
    return true
  })

  const callbacksRef = useRef({ onHidden, onVisible, onPageHide })
  callbacksRef.current = { onHidden, onVisible, onPageHide }

  useEffect(() => {
    if (typeof document === "undefined") return

    const handleVisibilityChange = () => {
      const visible = document.visibilityState !== "hidden"
      setIsPageVisible(visible)

      if (visible) {
        callbacksRef.current.onVisible?.()
      } else {
        callbacksRef.current.onHidden?.()
      }
    }

    const handlePageHide = (e: PageTransitionEvent) => {
      callbacksRef.current.onPageHide?.(e.persisted)
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("pagehide", handlePageHide)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("pagehide", handlePageHide)
    }
  }, [])

  return { isPageVisible }
}
