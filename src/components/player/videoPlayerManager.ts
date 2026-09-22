/**
 * Global Multi-Player Management Service for Phase 9
 * Tracks active video player instances and automatically pauses background players.
 */

export interface PlayerRegistration {
  playerId: string
  pause: () => void
  isPlaying: () => boolean
}

export class VideoPlayerManager {
  private players: Map<string, PlayerRegistration> = new Map()
  private activePlayerId: string | null = null
  private listeners: Set<(activeId: string | null) => void> = new Set()

  /**
   * Registers a player instance. Returns an unregister cleanup function.
   */
  public registerPlayer(playerId: string, registration: PlayerRegistration): () => void {
    if (!playerId) return () => {}
    this.players.set(playerId, registration)
    return () => this.unregisterPlayer(playerId)
  }

  /**
   * Unregisters a player instance when unmounted.
   */
  public unregisterPlayer(playerId: string): void {
    if (!playerId) return
    this.players.delete(playerId)
    if (this.activePlayerId === playerId) {
      this.activePlayerId = null
      this.notifyListeners()
    }
  }

  /**
   * Sets the specified player as active, automatically pausing all other players.
   */
  public setActivePlayer(playerId: string): void {
    if (!playerId) return
    this.activePlayerId = playerId
    this.pauseOtherPlayers(playerId)
    this.notifyListeners()
  }

  /**
   * Pauses all registered player instances except the specified active playerId.
   */
  public pauseOtherPlayers(activePlayerId: string): void {
    for (const [id, reg] of this.players.entries()) {
      if (id !== activePlayerId) {
        try {
          if (reg.isPlaying()) {
            reg.pause()
          }
        } catch {
          // Guard against stale refs or DOM access errors
        }
      }
    }
  }

  /**
   * Gets the currently active player ID, if any.
   */
  public getActivePlayer(): string | null {
    return this.activePlayerId
  }

  /**
   * Gets the count of currently registered players.
   */
  public getPlayerCount(): number {
    return this.players.size
  }

  /**
   * Subscribes to changes in the active player ID.
   */
  public subscribe(listener: (activeId: string | null) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * Cleans up all registered players and listeners.
   */
  public clear(): void {
    this.players.clear()
    this.activePlayerId = null
    this.listeners.clear()
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.activePlayerId)
      } catch {
        // Safe execution
      }
    }
  }
}

// Global singleton instance
export const videoPlayerManager = new VideoPlayerManager()
