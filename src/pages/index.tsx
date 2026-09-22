import React, { useState } from "react"
import CategoryTabs from "@/components/category-tabs"
import VideoGrid from "@/components/Videogrid"

export default function Home() {
  const [selectedCategory, setSelectedCategory] = useState("All")

  return (
    <div className="flex flex-col min-h-full bg-[var(--background)] text-[var(--foreground)]">
      <CategoryTabs
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
      />
      <VideoGrid category={selectedCategory} />
    </div>
  )
}
