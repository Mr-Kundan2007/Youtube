import React from "react"
import { Sun, Moon, Clock, Check } from "lucide-react"
import { useTheme } from "@/context/ThemeContext"
import { ThemeMode } from "@/utils/themeUtils"
import { cn } from "@/lib/utils"

export interface ThemeToggleProps {
  className?: string
  variant?: "segmented" | "list" | "compact"
  showDetails?: boolean
  onSelection?: (mode: ThemeMode) => void
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  className,
  variant = "segmented",
  showDetails = true,
  onSelection,
}) => {
  const { themeMode, activeTheme, istTime, isMorning, setThemeMode } = useTheme()

  const handleSelect = (mode: ThemeMode) => {
    setThemeMode(mode)
    if (onSelection) {
      onSelection(mode)
    }
  }

  const options: {
    mode: ThemeMode
    label: string
    shortLabel: string
    icon: React.ReactNode
    desc: string
  }[] = [
    {
      mode: "light",
      label: "Light",
      shortLabel: "Light",
      icon: <Sun className="w-3.5 h-3.5 text-amber-500 shrink-0" />,
      desc: "Always use light appearance",
    },
    {
      mode: "dark",
      label: "Dark",
      shortLabel: "Dark",
      icon: <Moon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />,
      desc: "Always use dark appearance",
    },
    {
      mode: "automatic",
      label: "Automatic",
      shortLabel: "Auto",
      icon: <Clock className="w-3.5 h-3.5 text-blue-500 shrink-0" />,
      desc: "IST time-based (5 AM–12 PM: Light; 12 PM–5 AM: Dark)",
    },
  ]

  // Compact icon button cycling through modes
  if (variant === "compact") {
    const cycleTheme = () => {
      if (themeMode === "light") handleSelect("dark")
      else if (themeMode === "dark") handleSelect("automatic")
      else handleSelect("light")
    }

    return (
      <button
        type="button"
        onClick={cycleTheme}
        className={cn(
          "inline-flex items-center justify-center h-9 w-9 rounded-full transition-colors cursor-pointer",
          "hover:bg-[var(--muted)] text-[var(--foreground)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600",
          className
        )}
        aria-label={`Current appearance: ${themeMode} (${activeTheme}). Click to cycle.`}
        title={`Appearance: ${themeMode} (${activeTheme})`}
      >
        {themeMode === "light" && <Sun className="w-5 h-5 text-amber-500" />}
        {themeMode === "dark" && <Moon className="w-5 h-5 text-indigo-400" />}
        {themeMode === "automatic" && (
          <div className="relative flex items-center justify-center">
            {activeTheme === "light" ? (
              <Sun className="w-4 h-4 text-amber-500" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-400" />
            )}
            <span
              className="absolute -top-1 -right-1 flex h-2 w-2 rounded-full bg-blue-500"
              title="Automatic IST Mode active"
            />
          </div>
        )}
      </button>
    )
  }

  // List variant for dropdowns or settings menus
  if (variant === "list") {
    return (
      <div
        role="radiogroup"
        aria-label="Theme preference selection"
        className={cn("w-full py-1 space-y-1", className)}
      >
        {options.map((opt) => {
          const isSelected = themeMode === opt.mode
          return (
            <button
              key={opt.mode}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => handleSelect(opt.mode)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-left transition-colors cursor-pointer",
                "hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600",
                isSelected
                  ? "bg-[var(--muted)] text-[var(--foreground)] font-medium"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              )}
            >
              <div className="flex items-center gap-3">
                <span className="shrink-0">{opt.icon}</span>
                <div className="flex flex-col">
                  <span>{opt.label}</span>
                  {opt.mode === "automatic" && (
                    <span className="text-[11px] text-[var(--muted-foreground)]">
                      {isMorning ? "Currently Light (Morning IST)" : "Currently Dark (Evening/Night IST)"}
                    </span>
                  )}
                </div>
              </div>
              {isSelected && <Check className="w-4 h-4 text-red-600 shrink-0" />}
            </button>
          )
        })}

        {showDetails && istTime && (
          <div className="mt-2 pt-2 border-t border-[var(--border)] px-3 text-[11px] text-[var(--muted-foreground)] flex items-center justify-between">
            <span>Reference: Asia/Kolkata</span>
            <span className="font-mono font-medium">{istTime}</span>
          </div>
        )}
      </div>
    )
  }

  // Segmented control (default)
  return (
    <div className={cn("flex flex-col space-y-2 w-full", className)}>
      <div
        role="radiogroup"
        aria-label="Theme Mode Selection"
        className="flex items-center p-1 rounded-xl bg-[var(--muted)] border border-[var(--border)] gap-1 select-none w-full"
      >
        {options.map((opt) => {
          const isSelected = themeMode === opt.mode
          return (
            <button
              key={opt.mode}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => handleSelect(opt.mode)}
              title={`${opt.label}: ${opt.desc}`}
              className={cn(
                "flex-1 min-w-0 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs transition-all duration-200 cursor-pointer select-none",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600",
                isSelected
                  ? "bg-[var(--card)] text-[var(--foreground)] shadow-sm font-semibold ring-1 ring-[var(--border)]"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted-hover)] font-medium"
              )}
            >
              {opt.icon}
              <span className="truncate tracking-tight">{opt.shortLabel}</span>
            </button>
          )
        })}
      </div>

      {showDetails && (
        <div className="mt-1 px-2.5 py-1.5 rounded-lg bg-[var(--muted)]/60 border border-[var(--border)]/60 text-[11px] space-y-1 w-full">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full shrink-0",
                  themeMode === "automatic"
                    ? isMorning
                      ? "bg-amber-500"
                      : "bg-indigo-400"
                    : themeMode === "light"
                    ? "bg-amber-500"
                    : "bg-indigo-400"
                )}
              />
              <span className="font-medium text-[var(--foreground)] truncate">
                {themeMode === "automatic"
                  ? isMorning
                    ? "Auto: Light (Morning)"
                    : "Auto: Dark (Evening)"
                  : themeMode === "light"
                  ? "Manual: Always Light"
                  : "Manual: Always Dark"}
              </span>
            </div>
            {istTime && (
              <span className="font-mono text-[10px] text-[var(--muted-foreground)] shrink-0 font-medium">
                {istTime}
              </span>
            )}
          </div>

          {themeMode === "automatic" && (
            <div className="text-[10px] text-[var(--muted-foreground)] flex items-center justify-between pt-1 border-t border-[var(--border)]/40 leading-tight">
              <span className="shrink-0 font-medium">IST Rule</span>
              <span className="truncate ml-1.5 text-right font-medium">5 AM–12 PM ☀️ • 12 PM–5 AM 🌙</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ThemeToggle
