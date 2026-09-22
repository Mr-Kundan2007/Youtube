import React from "react"
import { BigPlayOverlay } from "./BigPlayOverlay"
import { PlayerErrorOverlay } from "./PlayerErrorOverlay"

export interface PlayerOverlayProps {
  className?: string
}

export const PlayerOverlay: React.FC<PlayerOverlayProps> = ({ className = "" }) => {
  return (
    <div className={`pointer-events-none ${className}`}>
      <BigPlayOverlay />
      <PlayerErrorOverlay />
    </div>
  )
}

export default PlayerOverlay
