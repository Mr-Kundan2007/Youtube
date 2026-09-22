"use client"

import { useEffect, useCallback } from "react"
import { useAnnouncer } from "../components/LiveAnnouncer"

interface UseAccessibilityShortcutsProps {
  onToggleMic: () => void
  onToggleCamera: () => void
  onToggleChat: () => void
  onToggleParticipants: () => void
  onToggleHandRaise: () => void
  onCloseModals: () => void
  isMicOn: boolean
  isCameraOn: boolean
  isHandRaised: boolean
  isChatOpen?: boolean
  isParticipantsOpen?: boolean
}

export function useAccessibilityShortcuts({
  onToggleMic,
  onToggleCamera,
  onToggleChat,
  onToggleParticipants,
  onToggleHandRaise,
  onCloseModals,
  isMicOn,
  isCameraOn,
  isHandRaised,
  isChatOpen = false,
  isParticipantsOpen = false,
}: UseAccessibilityShortcutsProps) {
  const { announce } = useAnnouncer()

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const isInput =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable

      // Escape always closes open panels/modals regardless of active input
      if (e.key === "Escape") {
        onCloseModals()
        return
      }

      // If user is currently typing in an input field, do not trigger single-key or Alt shortcuts
      if (isInput) return

      const key = e.key.toLowerCase()

      // Alt + Key combinations or single letter keys when not in an input
      if (key === "m" || (e.altKey && key === "m")) {
        e.preventDefault()
        onToggleMic()
        announce(isMicOn ? "Microphone muted" : "Microphone unmuted", "assertive")
      } else if (key === "v" || (e.altKey && key === "v")) {
        e.preventDefault()
        onToggleCamera()
        announce(isCameraOn ? "Camera turned off" : "Camera turned on", "assertive")
      } else if (key === "c" || (e.altKey && key === "c")) {
        e.preventDefault()
        onToggleChat()
        announce(isChatOpen ? "Chat panel closed" : "Chat panel opened", "polite")
      } else if (key === "p" || (e.altKey && key === "p")) {
        e.preventDefault()
        onToggleParticipants()
        announce(isParticipantsOpen ? "Participants panel closed" : "Participants panel opened", "polite")
      } else if (key === "h" || (e.altKey && key === "h")) {
        e.preventDefault()
        onToggleHandRaise()
        announce(isHandRaised ? "Hand lowered" : "Hand raised", "polite")
      }
    },
    [
      onToggleMic,
      onToggleCamera,
      onToggleChat,
      onToggleParticipants,
      onToggleHandRaise,
      onCloseModals,
      isMicOn,
      isCameraOn,
      isHandRaised,
      isChatOpen,
      isParticipantsOpen,
      announce,
    ]
  )

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [handleKeyDown])
}
