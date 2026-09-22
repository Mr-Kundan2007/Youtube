import React from "react"
import { useVideoPlayer } from "./VideoPlayerContext"
import type { SubtitleTrackSource } from "./subtitleUtils"

export interface VideoSource {
  src: string
  type?: string
}

export interface VideoElementProps {
  sources: VideoSource[]
  tracks?: SubtitleTrackSource[]
  poster?: string
  preload?: "none" | "metadata" | "auto"
  autoPlay?: boolean
  loop?: boolean
  playsInline?: boolean
  crossOrigin?: "anonymous" | "use-credentials"
  onEnded?: () => void
  onClick?: (e: React.MouseEvent<HTMLVideoElement>) => void
}

export const VideoElement: React.FC<VideoElementProps> = ({
  sources,
  tracks,
  poster,
  preload = "metadata",
  autoPlay = false,
  loop = false,
  playsInline = true,
  crossOrigin,
  onClick,
}) => {
  const { registerVideo, videoRef, state } = useVideoPlayer()
  const isFirstRender = React.useRef(true)
  const primarySrc = sources[0]?.src

  // Trigger HTML5 video reload whenever the sources list changes
  React.useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      if (videoRef && videoRef.current && autoPlay) {
        const playPromise = videoRef.current.play()
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            // Autoplay with audio may require user gesture; BigPlayOverlay handles click
          })
        }
      }
      return
    }
    if (videoRef && videoRef.current) {
      try {
        videoRef.current.load()
        videoRef.current.currentTime = 0
        videoRef.current.volume = state.volume
        videoRef.current.muted = state.isMuted
        if (autoPlay) {
          const playPromise = videoRef.current.play()
          if (playPromise !== undefined) {
            playPromise.catch(() => {})
          }
        }
      } catch {
        // Safe execution
      }
    }
  }, [primarySrc, sources, videoRef, autoPlay])

  return (
    <video
      ref={registerVideo}
      src={primarySrc}
      className="w-full h-full object-contain cursor-pointer"
      poster={poster}
      preload={preload}
      autoPlay={autoPlay}
      loop={loop}
      playsInline={playsInline}
      crossOrigin={crossOrigin}
      onClick={onClick}
      onError={(e) => {
        const target = e.currentTarget
        if (target && !target.src.endsWith("/video/vdo.mp4")) {
          target.src = "/video/vdo.mp4"
          target.load()
          if (autoPlay) {
            target.play().catch(() => {})
          }
        }
      }}
      tabIndex={-1}
    >
      {sources.map((source, index) => (
        <source
          key={`${source.src}-${index}`}
          src={source.src}
          type={source.type || "video/mp4"}
        />
      ))}
      {tracks &&
        tracks.map((track, index) => (
          <track
            key={`${track.src}-${index}`}
            kind={track.kind || "subtitles"}
            src={track.src}
            srcLang={track.srcLang}
            label={track.label}
            default={track.default}
          />
        ))}
      Your browser does not support the video tag.
    </video>
  )
}

