import React, { useState } from "react"
import { cn } from "@/lib/utils"

const TABS = ["Home", "Videos", "Downloads", "Shorts", "Playlists", "Community", "About"]

interface ChannelTabsProps {
  activeTab?: string
  onTabChange?: (tab: string) => void
}

export default function Channeltabs({
  activeTab: propActiveTab = "Videos",
  onTabChange,
}: ChannelTabsProps) {
  const [activeTab, setActiveTab] = useState(propActiveTab)

  const handleTabClick = (tab: string) => {
    setActiveTab(tab)
    if (onTabChange) {
      onTabChange(tab)
    }
  }

  return (
    <div className="w-full border-b border-[var(--border)] px-4 sm:px-8 max-w-7xl mx-auto">
      <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar">
        {TABS.map((tab) => {
          const isActive = activeTab === tab
          return (
            <button
              key={tab}
              onClick={() => handleTabClick(tab)}
              className={cn(
                "relative py-3 px-3 sm:px-4 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap cursor-pointer",
                isActive
                  ? "text-[var(--foreground)] font-bold"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              )}
            >
              {tab}
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--foreground)]" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export { Channeltabs }
