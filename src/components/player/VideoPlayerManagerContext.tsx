import React, { createContext, useContext, useEffect, useState } from "react"
import {
  VideoPlayerManager,
  videoPlayerManager,
  type PlayerRegistration,
} from "./videoPlayerManager"

export interface VideoPlayerManagerContextValue {
  manager: VideoPlayerManager
  activePlayerId: string | null
  registerPlayer: (playerId: string, reg: PlayerRegistration) => () => void
  unregisterPlayer: (playerId: string) => void
  setActivePlayer: (playerId: string) => void
  pauseOtherPlayers: (activePlayerId: string) => void
  playerCount: number
}

export const VideoPlayerManagerContext = createContext<VideoPlayerManagerContextValue | null>(null)

export const VideoPlayerManagerProvider: React.FC<{
  children: React.ReactNode
  manager?: VideoPlayerManager
}> = ({ children, manager = videoPlayerManager }) => {
  const [activePlayerId, setActivePlayerId] = useState<string | null>(manager.getActivePlayer())
  const [playerCount, setPlayerCount] = useState<number>(manager.getPlayerCount())

  useEffect(() => {
    const unsub = manager.subscribe((id) => {
      setActivePlayerId(id)
      setPlayerCount(manager.getPlayerCount())
    })
    return unsub
  }, [manager])

  const value: VideoPlayerManagerContextValue = {
    manager,
    activePlayerId,
    registerPlayer: (id, reg) => {
      const cleanup = manager.registerPlayer(id, reg)
      setPlayerCount(manager.getPlayerCount())
      return () => {
        cleanup()
        setPlayerCount(manager.getPlayerCount())
      }
    },
    unregisterPlayer: (id) => {
      manager.unregisterPlayer(id)
      setPlayerCount(manager.getPlayerCount())
    },
    setActivePlayer: (id) => manager.setActivePlayer(id),
    pauseOtherPlayers: (id) => manager.pauseOtherPlayers(id),
    playerCount,
  }

  return (
    <VideoPlayerManagerContext.Provider value={value}>
      {children}
    </VideoPlayerManagerContext.Provider>
  )
}

/**
 * Hook to access the VideoPlayerManagerContext, falling back to the singleton manager.
 */
export function usePlayerManager(): VideoPlayerManagerContextValue {
  const context = useContext(VideoPlayerManagerContext)
  if (context) return context

  return {
    manager: videoPlayerManager,
    activePlayerId: videoPlayerManager.getActivePlayer(),
    registerPlayer: (id, reg) => videoPlayerManager.registerPlayer(id, reg),
    unregisterPlayer: (id) => videoPlayerManager.unregisterPlayer(id),
    setActivePlayer: (id) => videoPlayerManager.setActivePlayer(id),
    pauseOtherPlayers: (id) => videoPlayerManager.pauseOtherPlayers(id),
    playerCount: videoPlayerManager.getPlayerCount(),
  }
}
