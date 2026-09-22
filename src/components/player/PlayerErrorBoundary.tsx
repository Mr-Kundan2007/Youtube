import React, { Component, type ErrorInfo, type ReactNode } from "react"

export interface PlayerErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  onReset?: () => void
}

interface PlayerErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * PlayerErrorBoundary
 * Catches uncaught runtime and rendering exceptions within the video player tree,
 * displaying a graceful player-contained fallback UI rather than crashing the page.
 */
export class PlayerErrorBoundary extends Component<
  PlayerErrorBoundaryProps,
  PlayerErrorBoundaryState
> {
  constructor(props: PlayerErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
    }
  }

  static getDerivedStateFromError(error: Error): PlayerErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    if (this.props.onError) {
      try {
        this.props.onError(error, errorInfo)
      } catch {
        // Prevent recursive error in logging handler
      }
    }
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null })
    if (this.props.onReset) {
      this.props.onReset()
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div
          role="alert"
          aria-live="assertive"
          className="relative w-full aspect-video min-h-[240px] bg-[#0c0d14] border border-red-500/20 rounded-xl flex flex-col items-center justify-center p-6 text-center text-white select-none shadow-xl"
        >
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-3 text-red-400">
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          <h3 className="text-base sm:text-lg font-semibold text-gray-100 mb-1">
            Player Display Error
          </h3>

          <p className="text-xs sm:text-sm text-gray-400 max-w-sm mb-5 leading-relaxed">
            An unexpected error occurred while rendering the video interface.
            {process.env.NODE_ENV !== "production" && this.state.error?.message && (
              <span className="block mt-1 font-mono text-xs text-red-300">
                {this.state.error.message}
              </span>
            )}
          </p>

          <button
            type="button"
            onClick={this.handleReset}
            className="px-4 py-2 rounded-lg text-xs sm:text-sm font-medium bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-red-500/40"
          >
            Reload Player
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

export default PlayerErrorBoundary
