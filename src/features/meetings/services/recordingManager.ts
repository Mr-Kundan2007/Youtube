/**
 * Client-Side Meeting Recording Engine
 *
 * Implements:
 * 1. Web Audio Context mixing for local mic + all remote participant audio
 * 2. Canvas-based video compositor (handles participant grid, screen share prominence, and avatars)
 * 3. MediaRecorder with automatic MIME type detection and chunk aggregation
 * 4. Safe resource lifecycle management (zero disruption to existing LiveKit room tracks)
 */

import { Room, Track, Participant } from "livekit-client"

export interface RecordingOptions {
  room: Room
  width?: number
  height?: number
  frameRate?: number
  bitrate?: number
  onDurationTick?: (durationSeconds: number) => void
  onError?: (error: Error) => void
}

export interface RecordingResult {
  blob: Blob
  durationSeconds: number
  mimeType: string
  fileSize: number
}

export class RecordingManager {
  private mediaRecorder: MediaRecorder | null = null
  private chunks: Blob[] = []
  private audioContext: AudioContext | null = null
  private audioDestination: MediaStreamAudioDestinationNode | null = null
  private canvas: HTMLCanvasElement | null = null
  private canvasCtx: CanvasRenderingContext2D | null = null
  private animationFrameId: number | null = null
  private timerIntervalId: NodeJS.Timeout | null = null
  private videoElementsMap: Map<string, HTMLVideoElement> = new Map()

  private isRecording = false
  private isPaused = false
  private durationSeconds = 0
  private selectedMimeType = "video/webm"
  private recordedStream: MediaStream | null = null

  /**
   * Detects the best supported video MIME type in the current browser.
   */
  public static getSupportedMimeType(): string {
    if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
      return "video/webm"
    }

    const types = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
      "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
      "video/mp4",
    ]

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type
      }
    }

    return "video/webm"
  }

  /**
   * Starts recording the meeting session.
   */
  public async start(options: RecordingOptions): Promise<void> {
    if (this.isRecording) {
      throw new Error("Recording is already in progress")
    }

    const {
      room,
      width = 1280,
      height = 720,
      frameRate = 30,
      bitrate = 2500000,
      onDurationTick,
      onError,
    } = options

    try {
      this.chunks = []
      this.durationSeconds = 0
      this.selectedMimeType = RecordingManager.getSupportedMimeType()

      // 1. Setup Audio Mixing via Web Audio API
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (AudioCtx) {
        this.audioContext = new AudioCtx()
        if (this.audioContext.state === "suspended") {
          await this.audioContext.resume()
        }
        this.audioDestination = this.audioContext.createMediaStreamDestination()
        this.connectAudioTracks(room)
      }

      // 2. Setup Canvas Compositor
      this.canvas = document.createElement("canvas")
      this.canvas.width = width
      this.canvas.height = height
      this.canvasCtx = this.canvas.getContext("2d")

      if (!this.canvasCtx) {
        throw new Error("Failed to initialize canvas 2D rendering context")
      }

      // Start drawing loop
      this.startCompositorLoop(room, width, height)

      // 3. Create Combined Stream
      const canvasStream = this.canvas.captureStream(frameRate)
      const videoTrack = canvasStream.getVideoTracks()[0]

      const tracks: MediaStreamTrack[] = []
      if (videoTrack) tracks.push(videoTrack)

      if (this.audioDestination && this.audioDestination.stream.getAudioTracks().length > 0) {
        tracks.push(this.audioDestination.stream.getAudioTracks()[0])
      }

      this.recordedStream = new MediaStream(tracks)

      // 4. Initialize MediaRecorder
      const recorderOptions: MediaRecorderOptions = {
        mimeType: this.selectedMimeType,
        videoBitsPerSecond: bitrate,
      }

      this.mediaRecorder = new MediaRecorder(this.recordedStream, recorderOptions)

      this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          this.chunks.push(event.data)
        }
      }

      this.mediaRecorder.onerror = (event: any) => {
        const err = event.error || new Error("MediaRecorder encountered an error")
        console.error("MediaRecorder error:", err)
        if (onError) onError(err)
      }

      // Request data chunks every 1000ms
      this.mediaRecorder.start(1000)
      this.isRecording = true
      this.isPaused = false

      // 5. Start Duration Timer Ticker
      this.timerIntervalId = setInterval(() => {
        if (this.isRecording && !this.isPaused) {
          this.durationSeconds += 1
          if (onDurationTick) {
            onDurationTick(this.durationSeconds)
          }
        }
      }, 1000)
    } catch (err: any) {
      this.cleanup()
      throw err
    }
  }

  /**
   * Connects all active audio tracks from local and remote participants into AudioContext.
   */
  private connectAudioTracks(room: Room): void {
    if (!this.audioContext || !this.audioDestination) return

    const addAudioTrack = (track: MediaStreamTrack | undefined) => {
      if (!track || track.readyState === "ended" || !this.audioContext || !this.audioDestination) {
        return
      }
      try {
        const stream = new MediaStream([track])
        const source = this.audioContext.createMediaStreamSource(stream)
        source.connect(this.audioDestination)
      } catch (e) {
        console.warn("Could not connect audio track to recording mixer", e)
      }
    }

    // Local participant audio
    room.localParticipant.audioTrackPublications.forEach((pub) => {
      if (pub.track?.mediaStreamTrack) {
        addAudioTrack(pub.track.mediaStreamTrack)
      }
    })

    // Remote participants audio
    room.remoteParticipants.forEach((p) => {
      p.audioTrackPublications.forEach((pub) => {
        if (pub.track?.mediaStreamTrack) {
          addAudioTrack(pub.track.mediaStreamTrack)
        }
      })
    })
  }

  /**
   * Synchronously manages hidden video elements for all video tracks to allow canvas drawImage.
   */
  private getOrCreateVideoElement(trackId: string, track: MediaStreamTrack): HTMLVideoElement {
    let video = this.videoElementsMap.get(trackId)
    if (!video) {
      video = document.createElement("video")
      video.muted = true
      video.playsInline = true
      video.autoplay = true
      video.srcObject = new MediaStream([track])
      video.play().catch(() => {})
      this.videoElementsMap.set(trackId, video)
    }
    return video
  }

  /**
   * Continuous Canvas Compositor Loop
   */
  private startCompositorLoop(room: Room, width: number, height: number): void {
    const renderFrame = () => {
      if (!this.isRecording) return

      const ctx = this.canvasCtx
      if (ctx) {
        // Clear background with dark slate tone
        ctx.fillStyle = "#09090b"
        ctx.fillRect(0, 0, width, height)

        // Gather all participants: local + remote
        const allParticipants: Participant[] = [
          room.localParticipant,
          ...Array.from(room.remoteParticipants.values()),
        ]

        // 1. Check if anyone is Screen Sharing
        let screenShareTrack: MediaStreamTrack | null = null
        let screenSharerName = ""

        for (const p of allParticipants) {
          const screenPub = p.getTrackPublication(Track.Source.ScreenShare)
          if (screenPub && screenPub.track?.mediaStreamTrack && !screenPub.isMuted) {
            screenShareTrack = screenPub.track.mediaStreamTrack
            screenSharerName = p.name || p.identity || "Participant"
            break
          }
        }

        if (screenShareTrack) {
          // Render Screen Share in prominence
          const videoEl = this.getOrCreateVideoElement(screenShareTrack.id, screenShareTrack)
          if (videoEl && videoEl.readyState >= 2) {
            ctx.drawImage(videoEl, 0, 0, width, height)
          }

          // Screen Sharer Banner
          ctx.fillStyle = "rgba(0, 0, 0, 0.7)"
          ctx.fillRect(20, 20, 320, 36)
          ctx.fillStyle = "#ffffff"
          ctx.font = "bold 14px Inter, sans-serif"
          ctx.fillText(`🖥️ ${screenSharerName} (Screen Share)`, 32, 44)
        } else {
          // 2. Render Participant Grid
          const count = Math.max(1, allParticipants.length)
          let cols = 1
          let rows = 1

          if (count === 2) {
            cols = 2
            rows = 1
          } else if (count <= 4) {
            cols = 2
            rows = 2
          } else if (count <= 6) {
            cols = 3
            rows = 2
          } else {
            cols = 3
            rows = 3
          }

          const tileGap = 12
          const padding = 20
          const availableW = width - padding * 2 - (cols - 1) * tileGap
          const availableH = height - padding * 2 - (rows - 1) * tileGap
          const tileW = availableW / cols
          const tileH = availableH / rows

          allParticipants.slice(0, cols * rows).forEach((participant, idx) => {
            const r = Math.floor(idx / cols)
            const c = idx % cols
            const x = padding + c * (tileW + tileGap)
            const y = padding + r * (tileH + tileGap)

            // Draw Tile Background
            ctx.fillStyle = "#18181b"
            ctx.beginPath()
            ctx.roundRect(x, y, tileW, tileH, 12)
            ctx.fill()

            // Find Camera Track
            const cameraPub = participant.getTrackPublication(Track.Source.Camera)
            const hasVideo =
              cameraPub &&
              cameraPub.track?.mediaStreamTrack &&
              !cameraPub.isMuted &&
              cameraPub.track.mediaStreamTrack.readyState === "live"

            let drewVideo = false
            if (hasVideo && cameraPub.track?.mediaStreamTrack) {
              const videoEl = this.getOrCreateVideoElement(
                cameraPub.track.mediaStreamTrack.id,
                cameraPub.track.mediaStreamTrack
              )
              if (videoEl && videoEl.readyState >= 2) {
                ctx.save()
                ctx.beginPath()
                ctx.roundRect(x, y, tileW, tileH, 12)
                ctx.clip()
                ctx.drawImage(videoEl, x, y, tileW, tileH)
                ctx.restore()
                drewVideo = true
              }
            }

            // Fallback Avatar if camera is off or not ready
            if (!drewVideo) {
              const name = participant.name || participant.identity || "User"
              const initial = name.charAt(0).toUpperCase()
              const avatarRadius = Math.min(tileW, tileH) * 0.2

              ctx.fillStyle = "#27272a"
              ctx.beginPath()
              ctx.arc(x + tileW / 2, y + tileH / 2, avatarRadius, 0, Math.PI * 2)
              ctx.fill()

              ctx.fillStyle = "#e4e4e7"
              ctx.font = `bold ${Math.round(avatarRadius)}px Inter, sans-serif`
              ctx.textAlign = "center"
              ctx.textBaseline = "middle"
              ctx.fillText(initial, x + tileW / 2, y + tileH / 2)
            }

            // Participant Name Badge
            const displayName = participant.name || participant.identity || "Participant"
            ctx.fillStyle = "rgba(0, 0, 0, 0.65)"
            ctx.beginPath()
            ctx.roundRect(x + 10, y + tileH - 36, Math.min(tileW - 20, 180), 26, 6)
            ctx.fill()

            ctx.fillStyle = "#ffffff"
            ctx.font = "12px Inter, sans-serif"
            ctx.textAlign = "left"
            ctx.textBaseline = "middle"
            ctx.fillText(
              displayName.length > 18 ? displayName.slice(0, 16) + "..." : displayName,
              x + 18,
              y + tileH - 23
            )
          })
        }

        // Top watermark & recording timer badge overlay
        const mins = Math.floor(this.durationSeconds / 60)
          .toString()
          .padStart(2, "0")
        const secs = (this.durationSeconds % 60).toString().padStart(2, "0")

        ctx.fillStyle = "rgba(220, 38, 38, 0.9)"
        ctx.beginPath()
        ctx.roundRect(width - 130, 20, 110, 32, 16)
        ctx.fill()

        ctx.fillStyle = "#ffffff"
        ctx.font = "bold 13px Inter, sans-serif"
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.fillText(`REC ${mins}:${secs}`, width - 75, 36)
      }

      this.animationFrameId = requestAnimationFrame(renderFrame)
    }

    this.animationFrameId = requestAnimationFrame(renderFrame)
  }

  /**
   * Pauses recording.
   */
  public pause(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === "recording") {
      this.mediaRecorder.pause()
      this.isPaused = true
    }
  }

  /**
   * Resumes recording.
   */
  public resume(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === "paused") {
      this.mediaRecorder.resume()
      this.isPaused = false
    }
  }

  /**
   * Stops recording and returns the aggregated video Blob.
   */
  public async stop(): Promise<RecordingResult> {
    if (!this.isRecording || !this.mediaRecorder) {
      throw new Error("No active recording to stop")
    }

    return new Promise<RecordingResult>((resolve, reject) => {
      const recorder = this.mediaRecorder!
      const totalDuration = this.durationSeconds

      recorder.onstop = () => {
        try {
          const baseMime = this.selectedMimeType.split(";")[0] || "video/webm"
          const finalBlob = new Blob(this.chunks, { type: baseMime })
          const result: RecordingResult = {
            blob: finalBlob,
            durationSeconds: Math.max(1, totalDuration),
            mimeType: baseMime,
            fileSize: finalBlob.size,
          }
          this.cleanup()
          resolve(result)
        } catch (err) {
          this.cleanup()
          reject(err)
        }
      }

      try {
        recorder.stop()
      } catch (e) {
        this.cleanup()
        reject(e)
      }
    })
  }

  /**
   * Cleans up all recording resources safely.
   */
  public cleanup(): void {
    this.isRecording = false
    this.isPaused = false

    if (this.timerIntervalId) {
      clearInterval(this.timerIntervalId)
      this.timerIntervalId = null
    }

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }

    // Stop recorded tracks without closing original meeting tracks
    if (this.recordedStream) {
      this.recordedStream.getTracks().forEach((t) => t.stop())
      this.recordedStream = null
    }

    // Clean video elements
    this.videoElementsMap.forEach((video) => {
      video.srcObject = null
      video.remove()
    })
    this.videoElementsMap.clear()

    // Close AudioContext
    if (this.audioContext && this.audioContext.state !== "closed") {
      this.audioContext.close().catch(() => {})
      this.audioContext = null
      this.audioDestination = null
    }

    this.mediaRecorder = null
    this.canvas = null
    this.canvasCtx = null
  }

  public getDuration(): number {
    return this.durationSeconds
  }

  public getIsRecording(): boolean {
    return this.isRecording
  }

  public getIsPaused(): boolean {
    return this.isPaused
  }
}

export const recordingManager = new RecordingManager()
