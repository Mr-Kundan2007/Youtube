"use client"

import React, { useEffect } from "react"
import { useMediaDevices } from "../hooks/useMediaDevices"
import {
  X,
  Mic,
  Video,
  Volume2,
  Check,
  RefreshCw,
} from "lucide-react"

interface DeviceSettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export const DeviceSettingsModal: React.FC<DeviceSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    audioInputs,
    videoInputs,
    audioOutputs,
    selectedAudioInput,
    selectedVideoInput,
    selectedAudioOutput,
    switchMicrophone,
    switchCamera,
    switchAudioOutput,
    testAudioLevel,
    startMicTest,
    stopMicTest,
  } = useMediaDevices()

  // Start mic level tester when modal is open
  useEffect(() => {
    if (isOpen) {
      startMicTest(selectedAudioInput)
    } else {
      stopMicTest()
    }
  }, [isOpen, selectedAudioInput, startMicTest, stopMicTest])

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="device-settings-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 max-sm:items-end max-sm:p-0 bg-black/70 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl max-sm:rounded-b-none max-sm:rounded-t-3xl max-sm:max-h-[85vh] shadow-2xl overflow-hidden flex flex-col pb-safe">
        {/* Mobile handle */}
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mt-3 mb-1 sm:hidden" />

        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h2 id="device-settings-title" className="text-base font-semibold text-white">Audio & Video Settings</h2>
          <button
            onClick={onClose}
            aria-label="Close audio and video settings"
            className="min-w-[44px] min-h-[44px] p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center touch-target-44"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          {/* Microphone Selector */}
          <div>
            <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
              <Mic className="w-4 h-4 text-red-500" />
              <span>Microphone</span>
            </label>
            <select
              value={selectedAudioInput}
              onChange={(e) => switchMicrophone(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-red-500 touch-target-44"
            >
              {audioInputs.length === 0 ? (
                <option value="">Default Microphone</option>
              ) : (
                audioInputs.map((d) => (
                  <option key={d.deviceId} value={d.deviceId} className="bg-zinc-900 text-white">
                    {d.label}
                  </option>
                ))
              )}
            </select>

            {/* Live Mic Test Meter */}
            <div className="mt-3 p-2.5 rounded-xl bg-black/40 border border-white/5">
              <div className="flex justify-between text-xs text-zinc-400 mb-1.5">
                <span>Input Level</span>
                <span className="font-mono text-[10px]">{testAudioLevel}%</span>
              </div>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-amber-500 transition-all duration-75"
                  style={{ width: `${testAudioLevel}%` }}
                />
              </div>
            </div>
          </div>

          {/* Camera Selector */}
          <div>
            <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
              <Video className="w-4 h-4 text-blue-500" />
              <span>Camera</span>
            </label>
            <select
              value={selectedVideoInput}
              onChange={(e) => switchCamera(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-red-500 touch-target-44"
            >
              {videoInputs.length === 0 ? (
                <option value="">Default Camera</option>
              ) : (
                videoInputs.map((d) => (
                  <option key={d.deviceId} value={d.deviceId} className="bg-zinc-900 text-white">
                    {d.label}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Speaker Selector (if browser supports audio output selection) */}
          {audioOutputs.length > 0 && (
            <div>
              <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                <Volume2 className="w-4 h-4 text-emerald-500" />
                <span>Speakers / Audio Output</span>
              </label>
              <select
                value={selectedAudioOutput}
                onChange={(e) => switchAudioOutput(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-red-500 touch-target-44"
              >
                {audioOutputs.map((d) => (
                  <option key={d.deviceId} value={d.deviceId} className="bg-zinc-900 text-white">
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-zinc-950 flex justify-end">
          <button
            onClick={onClose}
            aria-label="Save and close settings"
            className="min-h-[44px] px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-medium text-white transition-colors touch-target-44"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
