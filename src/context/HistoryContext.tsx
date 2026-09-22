import React, { createContext, useContext, useState, useEffect } from "react"
import { sampleVideos } from "@/pages/watch/[id]/index"

export interface HistoryVideoItem {
  _id?: string | number
  id?: string | number
  videotitle: string
  videochanel: string
  views: number
  createdAt: string | Date
  duration?: string
  thumbnailUrl?: string
  videoUrl?: string
  description?: string
  subscribers?: string
}

export interface HistoryRecord {
  _id: string | number
  video: HistoryVideoItem
  watchedon: string | Date
}

const defaultHistoryRecords: HistoryRecord[] = [
  {
    _id: "h1",
    video: sampleVideos[0], // Amazing Nature Documentary
    watchedon: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
  },
  {
    _id: "h2",
    video: sampleVideos[1], // Cooking Tutorial: Perfect Pasta
    watchedon: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
  },
  {
    _id: "h3",
    video: sampleVideos[2], // Building a Fullstack Web App
    watchedon: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago
  },
  {
    _id: "h4",
    video: sampleVideos[3], // Lo-Fi Beats
    watchedon: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
  },
]

interface HistoryContextType {
  history: HistoryRecord[]
  addToHistory: (video: HistoryVideoItem) => void
  removeFromHistory: (historyId: string | number) => void
  clearHistory: () => void
}

const HistoryContext = createContext<HistoryContextType>({
  history: [],
  addToHistory: () => {},
  removeFromHistory: () => {},
  clearHistory: () => {},
})

export const HistoryProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [history, setHistory] = useState<HistoryRecord[]>(defaultHistoryRecords)
  const [isLoaded, setIsLoaded] = useState(false)

  // Load from localStorage on client side
  useEffect(() => {
    try {
      const saved = localStorage.getItem("youtube_watch_history")
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setHistory(parsed)
        }
      }
    } catch {
      // Ignore localStorage errors
    } finally {
      setIsLoaded(true)
    }
  }, [])

  // Save to localStorage when updated
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem("youtube_watch_history", JSON.stringify(history))
      } catch {
        // Ignore localStorage errors
      }
    }
  }, [history, isLoaded])

  const addToHistory = (video: HistoryVideoItem) => {
    const videoId = String(video._id || video.id)
    setHistory((prev) => {
      // Remove any previous record of this video so it moves to top
      const filtered = prev.filter(
        (item) => String(item.video._id || item.video.id) !== videoId
      )
      const newRecord: HistoryRecord = {
        _id: `h_${Date.now()}`,
        video,
        watchedon: new Date().toISOString(),
      }
      return [newRecord, ...filtered]
    })
  }

  const removeFromHistory = (historyId: string | number) => {
    setHistory((prev) => prev.filter((item) => item._id !== historyId))
  }

  const clearHistory = () => {
    setHistory([])
  }

  return (
    <HistoryContext.Provider
      value={{ history, addToHistory, removeFromHistory, clearHistory }}
    >
      {children}
    </HistoryContext.Provider>
  )
}

export const useHistory = () => useContext(HistoryContext)
