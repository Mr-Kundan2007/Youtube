"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { videoService } from "../services/videoService"

export interface MediaDeviceInfoItem {
  deviceId: string
  label: string
}

export function useMediaDevices() {
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfoItem[]>([])
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfoItem[]>([])
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfoItem[]>([])

  const [selectedAudioInput, setSelectedAudioInput] = useState<string>("")
  const [selectedVideoInput, setSelectedVideoInput] = useState<string>("")
  const [selectedAudioOutput, setSelectedAudioOutput] = useState<string>("")

  const [facingMode, setFacingMode] = useState<"user" | "environment">("user")
  const [isMobile, setIsMobile] = useState<boolean>(false)

  // Test microphone audio level meter
  const [testAudioLevel, setTestAudioLevel] = useState<number>(0)
  const testStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const animFrameRef = useRef<number | null>(null)

  // Detect mobile user agent
  useEffect(() => {
    if (typeof navigator !== "undefined") {
      setIsMobile(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent))
    }
  }, [])

  // Enumerate devices
  const updateDeviceList = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) return

    try {
      const devices = await navigator.mediaDevices.enumerateDevices()

      const aIn: MediaDeviceInfoItem[] = []
      const vIn: MediaDeviceInfoItem[] = []
      const aOut: MediaDeviceInfoItem[] = []

      devices.forEach((dev, idx) => {
        const label = dev.label || `${dev.kind} ${idx + 1}`
        if (dev.kind === "audioinput") {
          aIn.push({ deviceId: dev.deviceId, label })
        } else if (dev.kind === "videoinput") {
          vIn.push({ deviceId: dev.deviceId, label })
        } else if (dev.kind === "audiooutput") {
          aOut.push({ deviceId: dev.deviceId, label })
        }
      })

      setAudioInputs(aIn)
      setVideoInputs(vIn)
      setAudioOutputs(aOut)

      if (aIn.length > 0 && !selectedAudioInput) setSelectedAudioInput(aIn[0].deviceId)
      if (vIn.length > 0 && !selectedVideoInput) setSelectedVideoInput(vIn[0].deviceId)
      if (aOut.length > 0 && !selectedAudioOutput) setSelectedAudioOutput(aOut[0].deviceId)
    } catch (err) {
      console.warn("[useMediaDevices] Failed to enumerate devices", err)
    }
  }, [selectedAudioInput, selectedVideoInput, selectedAudioOutput])

  useEffect(() => {
    updateDeviceList()

    if (navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener("devicechange", updateDeviceList)
      return () => {
        navigator.mediaDevices.removeEventListener("devicechange", updateDeviceList)
      }
    }
  }, [updateDeviceList])

  // Switch microphone
  const switchMicrophone = useCallback(async (deviceId: string) => {
    setSelectedAudioInput(deviceId)
    await videoService.switchMicrophone(deviceId)
  }, [])

  // Switch camera
  const switchCamera = useCallback(async (deviceId: string) => {
    setSelectedVideoInput(deviceId)
    await videoService.switchCamera(deviceId)
  }, [])

  // Switch speaker output
  const switchAudioOutput = useCallback(async (deviceId: string) => {
    setSelectedAudioOutput(deviceId)
    await videoService.switchAudioOutput(deviceId)
  }, [])

  // Mobile camera flip (front <-> rear)
  const flipCamera = useCallback(async () => {
    const nextMode = facingMode === "user" ? "environment" : "user"
    setFacingMode(nextMode)

    // Find device corresponding to target facing mode if labels permit
    const target = videoInputs.find((d) =>
      nextMode === "environment"
        ? /back|rear|environment/i.test(d.label)
        : /front|user/i.test(d.label)
    )

    if (target) {
      await switchCamera(target.deviceId)
    } else if (videoInputs.length > 1) {
      // Toggle between available inputs
      const other = videoInputs.find((d) => d.deviceId !== selectedVideoInput)
      if (other) await switchCamera(other.deviceId)
    }
  }, [facingMode, videoInputs, selectedVideoInput, switchCamera])

  // Microphone level tester
  const startMicTest = useCallback(async (deviceId?: string) => {
    stopMicTest()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
      })
      testStreamRef.current = stream

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      audioContextRef.current = ctx

      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      const source = ctx.createMediaStreamSource(stream)
      source.connect(analyser)

      const dataArray = new Uint8Array(analyser.frequencyBinCount)

      const tick = () => {
        analyser.getByteFrequencyData(dataArray)
        let sum = 0
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i]
        }
        const avg = sum / dataArray.length
        setTestAudioLevel(Math.min(100, Math.round((avg / 128) * 100)))
        animFrameRef.current = requestAnimationFrame(tick)
      }
      tick()
    } catch (e) {
      console.warn("Failed to start mic test", e)
    }
  }, [])

  const stopMicTest = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(console.warn)
      audioContextRef.current = null
    }
    if (testStreamRef.current) {
      testStreamRef.current.getTracks().forEach((t) => t.stop())
      testStreamRef.current = null
    }
    setTestAudioLevel(0)
  }, [])

  useEffect(() => {
    return () => {
      stopMicTest()
    }
  }, [stopMicTest])

  return {
    audioInputs,
    videoInputs,
    audioOutputs,
    selectedAudioInput,
    selectedVideoInput,
    selectedAudioOutput,
    isMobile,
    facingMode,
    switchMicrophone,
    switchCamera,
    switchAudioOutput,
    flipCamera,
    testAudioLevel,
    startMicTest,
    stopMicTest,
  }
}
