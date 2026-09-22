import React, { useState } from "react"
import { cn } from "@/lib/utils"

const CATEGORIES = [
  "All",
  "Music",
  "Gaming",
  "Movies",
  "News",
  "Sports",
  "Technology",
  "Comedy",
  "Education",
  "Science",
  "Travel",
  "Food",
  "Fashion",
]

interface CategoryTabsProps {
  selectedCategory?: string
  onSelectCategory?: (category: string) => void
}

export default function CategoryTabs({
  selectedCategory: propSelected,
  onSelectCategory,
}: CategoryTabsProps) {
  const [selected, setSelected] = useState(propSelected || "All")

  const handleSelect = (category: string) => {
    setSelected(category)
    if (onSelectCategory) {
      onSelectCategory(category)
    }
  }

  return (
    <div className="sticky top-14 z-30 bg-[var(--background)]/95 backdrop-blur-md px-3 py-2 sm:px-6 sm:py-3 border-b border-[var(--border)] transition-colors duration-200">
      <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto no-scrollbar scroll-smooth">
        {CATEGORIES.map((category) => {
          const isActive = (propSelected || selected) === category
          return (
            <button
              key={category}
              onClick={() => handleSelect(category)}
              className={cn(
                "rounded-lg sm:rounded-xl px-3 sm:px-3.5 py-1.5 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap cursor-pointer shrink-0 min-h-[32px] sm:min-h-[36px]",
                isActive
                  ? "bg-[var(--foreground)] text-[var(--background)] font-semibold shadow-sm"
                  : "bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--muted-hover)]"
              )}
            >
              {category}
            </button>
          )
        })}
      </div>
    </div>
  )
}
