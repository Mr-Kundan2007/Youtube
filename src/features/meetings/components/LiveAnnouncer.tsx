"use client"

import React, { useState, useEffect, useCallback, createContext, useContext } from "react"

interface AnnouncerContextType {
  announce: (message: string, priority?: "polite" | "assertive") => void
}

const AnnouncerContext = createContext<AnnouncerContextType>({
  announce: () => {},
})

export const useAnnouncer = () => useContext(AnnouncerContext)

interface LiveAnnouncerProviderProps {
  children: React.ReactNode
}

export const LiveAnnouncerProvider: React.FC<LiveAnnouncerProviderProps> = ({ children }) => {
  const [politeMessage, setPoliteMessage] = useState<string>("")
  const [assertiveMessage, setAssertiveMessage] = useState<string>("")

  const announce = useCallback((message: string, priority: "polite" | "assertive" = "polite") => {
    if (!message) return

    if (priority === "assertive") {
      setAssertiveMessage("")
      setTimeout(() => setAssertiveMessage(message), 50)
    } else {
      setPoliteMessage("")
      setTimeout(() => setPoliteMessage(message), 50)
    }
  }, [])

  // Auto-clear messages after announcement duration to allow re-announcing identical text
  useEffect(() => {
    if (!politeMessage) return
    const timer = setTimeout(() => setPoliteMessage(""), 5000)
    return () => clearTimeout(timer)
  }, [politeMessage])

  useEffect(() => {
    if (!assertiveMessage) return
    const timer = setTimeout(() => setAssertiveMessage(""), 5000)
    return () => clearTimeout(timer)
  }, [assertiveMessage])

  return (
    <AnnouncerContext.Provider value={{ announce }}>
      {children}
      {/* Accessible Screen Reader Live Regions */}
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {politeMessage}
      </div>
      <div
        className="sr-only"
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
      >
        {assertiveMessage}
      </div>
    </AnnouncerContext.Provider>
  )
}
