import React, { useState } from "react"
import Head from "next/head"
import { Compass, Flame, Music2, Gamepad2, Newspaper, Trophy, Radio } from "lucide-react"
import Videogrid from "@/components/Videogrid"

const exploreCategories = [
  { id: "trending", label: "Trending", icon: Flame, color: "from-orange-500 to-red-500" },
  { id: "music", label: "Music", icon: Music2, color: "from-pink-500 to-rose-500" },
  { id: "gaming", label: "Gaming", icon: Gamepad2, color: "from-emerald-500 to-teal-500" },
  { id: "news", label: "News", icon: Newspaper, color: "from-blue-500 to-cyan-500" },
  { id: "sports", label: "Sports", icon: Trophy, color: "from-amber-500 to-yellow-500" },
  { id: "podcasts", label: "Podcasts", icon: Radio, color: "from-purple-500 to-indigo-500" },
]

export default function Explore() {
  const [selectedCategory, setSelectedCategory] = useState("trending")

  return (
    <>
      <Head>
        <title>Explore - YouTube</title>
        <meta name="description" content="Discover trending videos, music, gaming, news, and more." />
      </Head>

      <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] p-3 sm:p-6 max-w-7xl mx-auto">
        {/* Header - Centered on Mobile */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3 mb-6 text-center sm:text-left">
          <div className="p-2.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400">
            <Compass className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Explore</h1>
            <p className="text-xs sm:text-sm text-[var(--muted-foreground)]">
              Discover what is trending worldwide right now
            </p>
          </div>
        </div>

        {/* Category Cards Grid - Centered & Responsive */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mb-8">
          {exploreCategories.map((cat) => {
            const Icon = cat.icon
            const isSelected = selectedCategory === cat.id
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? "border-red-600 bg-red-500/10 shadow-sm"
                    : "border-[var(--border,#e5e7eb)] hover:bg-neutral-100 dark:hover:bg-neutral-800"
                }`}
              >
                <div className={`w-10 h-10 rounded-full bg-gradient-to-tr ${cat.color} flex items-center justify-center text-white mb-2 shadow-sm`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold">{cat.label}</span>
              </button>
            )
          })}
        </div>

        {/* Trending Videos Section */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold">Trending Videos</h2>
        </div>

        <Videogrid category={selectedCategory} />
      </div>
    </>
  )
}
