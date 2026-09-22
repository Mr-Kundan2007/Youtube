import React from "react"
import { Sun, Moon, Clock, Check, Loader2, AlertCircle, CheckCircle2 } from "lucide-react"
import { useTheme } from "@/context/ThemeContext"
import { ThemeMode } from "@/utils/themeUtils"
import { cn } from "@/lib/utils"

export const AppearanceSettings: React.FC = () => {
  const {
    themeMode,
    activeTheme,
    isThemeSyncing,
    lastSyncedAt,
    syncError,
    istTime,
    isMorning,
    setThemeMode,
    dismissSyncError,
  } = useTheme()

  const options: {
    mode: ThemeMode
    title: string
    icon: React.ReactNode
    description: string
  }[] = [
    {
      mode: "light",
      title: "Light",
      icon: <Sun className="w-5 h-5 text-amber-500" />,
      description: "Use light appearance.",
    },
    {
      mode: "dark",
      title: "Dark",
      icon: <Moon className="w-5 h-5 text-indigo-400" />,
      description: "Use dark appearance.",
    },
    {
      mode: "automatic",
      title: "Automatic",
      icon: <Clock className="w-5 h-5 text-blue-500" />,
      description: "Automatically choose based on login time in IST.",
    },
  ]

  return (
    <div className="w-full max-w-2xl bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 shadow-sm space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-[var(--foreground)]">Appearance</h2>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Choose how the application looks for your account.
        </p>
      </div>

      {/* Sync Status Notifications */}
      {isThemeSyncing && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-medium border border-blue-200 dark:border-blue-800"
        >
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          <span>Saving preference...</span>
        </div>
      )}

      {syncError && (
        <div
          role="alert"
          className="flex items-center justify-between px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 text-xs font-medium border border-amber-200 dark:border-amber-800"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{syncError}</span>
          </div>
          <button
            type="button"
            onClick={dismissSyncError}
            className="text-xs text-amber-700 dark:text-amber-400 underline hover:no-underline ml-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {!isThemeSyncing && !syncError && lastSyncedAt && (
        <div
          role="status"
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 text-xs font-medium border border-emerald-200 dark:border-emerald-800/40"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Theme preference saved</span>
        </div>
      )}

      {/* Options Radio List */}
      <div
        role="radiogroup"
        aria-label="Theme mode selection"
        className="space-y-3"
      >
        {options.map((opt) => {
          const isSelected = themeMode === opt.mode
          return (
            <button
              key={opt.mode}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => setThemeMode(opt.mode)}
              disabled={isThemeSyncing}
              className={cn(
                "w-full flex items-start justify-between p-4 rounded-xl border text-left transition-all duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600",
                isSelected
                  ? "border-red-600 bg-red-50/10 dark:bg-red-950/10 ring-1 ring-red-600 shadow-sm"
                  : "border-[var(--border)] bg-[var(--background)] hover:border-[var(--muted-foreground)] hover:bg-[var(--muted)]/50",
                isThemeSyncing && "opacity-75 cursor-wait"
              )}
            >
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    "p-2.5 rounded-xl border shrink-0 transition-colors",
                    isSelected
                      ? "border-red-500 bg-red-100 dark:bg-red-950/40 text-red-600"
                      : "border-[var(--border)] bg-[var(--muted)] text-[var(--foreground)]"
                  )}
                >
                  {opt.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-[var(--foreground)]">{opt.title}</span>
                    {isSelected && (
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300">
                        Selected
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)] mt-1">{opt.description}</p>

                  {opt.mode === "automatic" && (
                    <div className="mt-3 p-2.5 rounded-lg bg-[var(--muted)] border border-[var(--border)] text-xs text-[var(--foreground)] space-y-1">
                      <p className="font-medium">Automatic mode uses IST (Asia/Kolkata).</p>
                      <div className="flex items-center gap-2 text-[11px] text-[var(--muted-foreground)]">
                        <span>• 5:00 AM–11:59 AM → Light</span>
                        <span>• All other times → Dark</span>
                      </div>
                      {istTime && (
                        <p className="text-[11px] font-mono text-[var(--muted-foreground)] pt-0.5">
                          Current IST: {istTime} (Resolved: {isMorning ? "Light" : "Dark"})
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="shrink-0 mt-1">
                <div
                  className={cn(
                    "w-5 h-5 rounded-full border flex items-center justify-center transition-colors",
                    isSelected
                      ? "border-red-600 bg-red-600 text-white"
                      : "border-[var(--border)] bg-[var(--background)]"
                  )}
                >
                  {isSelected && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Footer Diagnostic Info */}
      <div className="pt-4 border-t border-[var(--border)] flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-[var(--muted-foreground)] gap-2">
        <div className="flex items-center gap-2">
          <span>Currently active:</span>
          <span className="font-semibold text-[var(--foreground)] capitalize">
            {activeTheme} Theme
          </span>
        </div>
        {lastSyncedAt && (
          <span className="text-[11px]">
            Last synchronized: {new Date(lastSyncedAt).toLocaleTimeString()}
          </span>
        )}
      </div>
    </div>
  )
}

export default AppearanceSettings
