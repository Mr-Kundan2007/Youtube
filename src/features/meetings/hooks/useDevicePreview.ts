import { useState, useEffect, useRef, useCallback } from "react"

export interface UseDevicePreviewReturn {
  stream: MediaStream | null
  isCameraEnabled: boolean
  isMicEnabled: boolean
  isPreparing: boolean
  error: string | null
  hasPermissions: boolean
  audioLevel: number
  toggleCamera: () => void
  toggleMic: () => void
  retryPermissions: () => void
}

export function useDevicePreview(
  initialCamera: boolean = true,
  initialMic: boolean = true
): UseDevicePreviewReturn {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [isCameraEnabled, setIsCameraEnabled] = useState<boolean>(initialCamera)
  const [isMicEnabled, setIsMicEnabled] = useState<boolean>(initialMic)
  const [isPreparing, setIsPreparing] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [hasPermissions, setHasPermissions] = useState<boolean>(false)
  const [audioLevel, setAudioLevel] = useState<number>(0)

  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animFrameRef = useRef<number | null>(null)

  const stopAllTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop()
        } catch (e) {}
      })
      streamRef.current = null
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      try {
        audioContextRef.current.close()
      } catch (e) {}
      audioContextRef.current = null
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
    setAudioLevel(0)
  }, [])

  const setupAudioMeter = useCallback((mediaStream: MediaStream) => {
    try {
      const audioTracks = mediaStream.getAudioTracks()
      if (audioTracks.length === 0) return

      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext
      if (!AudioContextClass) return

      const audioCtx = new AudioContextClass()
      audioContextRef.current = audioCtx
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 64
      analyserRef.current = analyser

      const source = audioCtx.createMediaStreamSource(mediaStream)
      source.connect(analyser)

      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)

      const checkVolume = () => {
        if (!analyserRef.current) return
        analyserRef.current.getByteFrequencyData(dataArray)
        let sum = 0
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i]
        }
        const avg = sum / bufferLength
        const normalized = Math.min(Math.round((avg / 128) * 100), 100)
        setAudioLevel(normalized)
        animFrameRef.current = requestAnimationFrame(checkVolume)
      }

      checkVolume()
    } catch (e) {
      console.warn("Audio meter setup skipped:", e)
    }
  }, [])

  const startPreview = useCallback(async () => {
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setIsPreparing(false)
      setError("Media devices are not supported in this environment.")
      return
    }

    try {
      setIsPreparing(true)
      setError(null)
      stopAllTracks()

      let mediaStream: MediaStream
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
          audio: true,
        })
      } catch (firstErr: any) {
        // Fallback: try video only or audio only
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          })
        } catch {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: true,
          })
        }
      }

      streamRef.current = mediaStream
      setStream(mediaStream)
      setHasPermissions(true)

      // Sync initial track states
      mediaStream.getVideoTracks().forEach((track) => {
        track.enabled = isCameraEnabled
      })
      mediaStream.getAudioTracks().forEach((track) => {
        track.enabled = isMicEnabled
      })

      if (isMicEnabled) {
        setupAudioMeter(mediaStream)
      }
    } catch (err: any) {
      console.warn("Device preview initialization notice:", err?.name || err?.message)
      setHasPermissions(false)
      if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
        setError("Camera and microphone permissions were denied. Please allow access in your browser.")
      } else if (err?.name === "NotFoundError" || err?.name === "DevicesNotFoundError") {
        setError("No camera or microphone found on this device.")
      } else {
        setError("Unable to access camera or microphone preview.")
      }
    } finally {
      setIsPreparing(false)
    }
  }, [isCameraEnabled, isMicEnabled, setupAudioMeter, stopAllTracks])

  useEffect(() => {
    startPreview()
    return () => {
      stopAllTracks()
    }
  }, [startPreview, stopAllTracks])

  const toggleCamera = useCallback(() => {
    setIsCameraEnabled((prev) => {
      const next = !prev
      if (streamRef.current) {
        streamRef.current.getVideoTracks().forEach((track) => {
          track.enabled = next
        })
      }
      return next
    })
  }, [])

  const toggleMic = useCallback(() => {
    setIsMicEnabled((prev) => {
      const next = !prev
      if (streamRef.current) {
        streamRef.current.getAudioTracks().forEach((track) => {
          track.enabled = next
        })
      }
      if (!next) {
        setAudioLevel(0)
      }
      return next
    })
  }, [])

  return {
    stream,
    isCameraEnabled,
    isMicEnabled,
    isPreparing,
    error,
    hasPermissions,
    audioLevel: isMicEnabled ? audioLevel : 0,
    toggleCamera,
    toggleMic,
    retryPermissions: startPreview,
  }
}

export default useDevicePreview
