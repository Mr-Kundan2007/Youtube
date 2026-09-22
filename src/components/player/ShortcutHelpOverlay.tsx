import React, { useEffect, useRef } from "react"
import { useVideoPlayer } from "./VideoPlayerContext"
import { KEYBOARD_SHORTCUTS_LIST } from "./keyboardShortcuts"

export const ShortcutHelpOverlay: React.FC = () => {
  const { state, actions } = useVideoPlayer()
  const closeBtnRef = useRef<HTMLButtonElement | null>(null)

  const isVisible = state.isShortcutHelpOpen

  // Focus close button on mount
  useEffect(() => {
    if (isVisible && closeBtnRef.current) {
      closeBtnRef.current.focus()
    }
  }, [isVisible])

  // Close on Escape
  useEffect(() => {
    if (!isVisible) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        actions.closeShortcutHelp()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isVisible, actions])

  if (!isVisible) return null

  // Deduplicate and group shortcuts for clean presentation
  const categories = [
    { id: "playback", label: "Playback" },
    { id: "seeking", label: "Seeking" },
    { id: "volume", label: "Audio & Volume" },
    { id: "display", label: "Display & Subtitles" },
    { id: "general", label: "General" },
  ] as const

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md transition-all duration-300 animate-fadeIn select-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcut-help-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          actions.closeShortcutHelp()
        }
      }}
    >
      <div className="relative w-full max-w-lg max-h-[90vh] bg-neutral-900/95 border border-white/15 rounded-2xl shadow-2xl backdrop-blur-2xl flex flex-col text-white overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-red-600/20 text-red-500 flex items-center justify-center font-bold text-sm">
              ⌨
            </div>
            <h3 id="shortcut-help-title" className="text-base font-bold text-white tracking-wide">
              Keyboard Shortcuts
            </h3>
          </div>

          <button
            ref={closeBtnRef}
            type="button"
            onClick={actions.closeShortcutHelp}
            className="text-white/60 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors focus:ring-2 focus:ring-white/40 focus:outline-none cursor-pointer"
            aria-label="Close keyboard shortcuts help"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Shortcuts Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 text-sm custom-scrollbar">
          {categories.map((cat) => {
            const items = KEYBOARD_SHORTCUTS_LIST.filter((s) => s.category === cat.id)
            if (items.length === 0) return null

            return (
              <div key={cat.id} className="space-y-2">
                <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                  {cat.label}
                </h4>
                <div className="grid grid-cols-1 gap-2">
                  {items.map((item, index) => (
                    <div
                      key={`${item.action}-${index}`}
                      className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/5 transition-colors"
                    >
                      <span className="text-neutral-300 text-xs sm:text-sm">
                        {item.description}
                      </span>
                      <kbd className="min-w-7 text-center px-2 py-1 rounded bg-neutral-800 text-neutral-200 border border-white/10 font-mono text-xs font-semibold shadow-inner">
                        {item.displayKey}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-5 py-3 border-t border-white/10 bg-neutral-950/40">
          <button
            type="button"
            onClick={actions.closeShortcutHelp}
            className="px-4 py-1.5 text-xs font-medium text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors focus:ring-2 focus:ring-white/40 focus:outline-none cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
