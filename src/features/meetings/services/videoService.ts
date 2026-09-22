import {
  Room,
  RoomEvent,
  VideoPresets,
  Track,
  RemoteParticipant,
  LocalParticipant,
  Participant,
} from "livekit-client"

export interface DataChannelMessage<T = any> {
  type:
    | "CHAT"
    | "REACTION"
    | "HAND_RAISE"
    | "MUTE_REQUEST"
    | "PARTICIPANT_REMOVED"
    | "ROOM_LOCKED"
    | "ROOM_UNLOCKED"
    | "PERMISSION_UPDATE"
    | "RECORDING_STARTED"
    | "RECORDING_STOPPED"
    | "E2EE_KEY_DISTRIBUTE"
    | "E2EE_KEY_ROTATED"
    | "E2EE_MODE_TOGGLED"
  data: T
  senderId: string
  senderName: string
  timestamp: number
}

class VideoService {
  private room: Room | null = null
  private localCameraStream: MediaStream | null = null
  private localScreenStream: MediaStream | null = null
  private textEncoder = new TextEncoder()
  private textDecoder = new TextDecoder()

  /**
   * Initializes a LiveKit room instance with adaptive streaming and dynacast enabled.
   */
  public getOrCreateRoom(): Room {
    if (this.room) return this.room

    this.room = new Room({
      adaptiveStream: true,
      dynacast: true,
      videoCaptureDefaults: {
        resolution: VideoPresets.h720.resolution,
      },
      audioCaptureDefaults: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    })

    return this.room
  }

  public getRoom(): Room | null {
    return this.room
  }

  /**
   * Connects to the LiveKit SFU server.
   */
  public async connect(url: string, token: string): Promise<Room> {
    const room = this.getOrCreateRoom()

    // Clean up if already connected to another room
    if (room.state === "connected") {
      await room.disconnect()
    }

    await room.connect(url, token)
    return room
  }

  /**
   * Toggles local microphone state.
   */
  public async setMicrophoneEnabled(enabled: boolean): Promise<boolean> {
    if (!this.room?.localParticipant) return false
    await this.room.localParticipant.setMicrophoneEnabled(enabled)
    return enabled
  }

  /**
   * Toggles local camera state.
   */
  public async setCameraEnabled(enabled: boolean): Promise<boolean> {
    if (this.room?.localParticipant) {
      try {
        const pub = await this.room.localParticipant.setCameraEnabled(enabled)
        if (pub?.track?.mediaStreamTrack) {
          this.localCameraStream = new MediaStream([pub.track.mediaStreamTrack])
          return enabled
        }
      } catch (err) {
        console.warn("[videoService] Failed LiveKit setCameraEnabled, falling back to native getUserMedia:", err)
      }
    }

    if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
      if (enabled) {
        try {
          if (!this.localCameraStream || this.localCameraStream.getVideoTracks().every((t) => t.readyState === "ended")) {
            this.localCameraStream = await navigator.mediaDevices.getUserMedia({
              video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
              audio: false,
            })
          } else {
            this.localCameraStream.getVideoTracks().forEach((t) => {
              t.enabled = true
            })
          }
          return true
        } catch (err) {
          console.warn("[videoService] native getUserMedia failed:", err)
          return false
        }
      } else {
        if (this.localCameraStream) {
          this.localCameraStream.getTracks().forEach((t) => {
            try {
              t.stop()
            } catch {}
          })
          this.localCameraStream = null
        }
        return false
      }
    }

    return false
  }

  public getLocalCameraStream(): MediaStream | null {
    if (this.room?.localParticipant) {
      const camPub = this.room.localParticipant.getTrackPublication(Track.Source.Camera)
      if (camPub?.track?.mediaStreamTrack && camPub.track.mediaStreamTrack.readyState === "live") {
        return new MediaStream([camPub.track.mediaStreamTrack])
      }
    }
    if (this.localCameraStream && this.localCameraStream.getVideoTracks().some((t) => t.readyState === "live")) {
      return this.localCameraStream
    }
    return null
  }

  public async ensureCameraStream(): Promise<MediaStream | null> {
    const stream = this.getLocalCameraStream()
    if (stream && stream.getVideoTracks().some((t) => t.readyState === "live")) {
      return stream
    }
    await this.setCameraEnabled(true)
    return this.getLocalCameraStream()
  }

  /**
   * Toggles screen sharing.
   */
  public async setScreenShareEnabled(enabled: boolean): Promise<boolean> {
    if (this.room?.localParticipant) {
      try {
        await this.room.localParticipant.setScreenShareEnabled(enabled, {
          audio: false,
        })
        return enabled
      } catch (err) {
        console.warn("[videoService] Retrying setScreenShareEnabled without constraints:", err)
        try {
          await this.room.localParticipant.setScreenShareEnabled(enabled)
          return enabled
        } catch (innerErr) {
          console.warn("[videoService] LiveKit screen share failed, trying native getDisplayMedia:", innerErr)
        }
      }
    }

    // Direct browser display media fallback
    if (typeof navigator !== "undefined" && navigator.mediaDevices?.getDisplayMedia) {
      if (enabled) {
        try {
          const stream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: false,
          })
          this.localScreenStream = stream
          return true
        } catch (displayErr) {
          console.warn("[videoService] getDisplayMedia was cancelled or denied:", displayErr)
          return false
        }
      } else {
        if (this.localScreenStream) {
          this.localScreenStream.getTracks().forEach((t) => t.stop())
          this.localScreenStream = null
        }
        return false
      }
    }

    return false
  }

  public getLocalScreenStream(): MediaStream | null {
    return this.localScreenStream
  }

  /**
   * Switches the active video input device.
   */
  public async switchCamera(deviceId: string): Promise<void> {
    if (!this.room) return
    await this.room.switchActiveDevice("videoinput", deviceId)
  }

  /**
   * Switches the active audio input device.
   */
  public async switchMicrophone(deviceId: string): Promise<void> {
    if (!this.room) return
    await this.room.switchActiveDevice("audioinput", deviceId)
  }

  /**
   * Switches the audio output speaker device.
   */
  public async switchAudioOutput(deviceId: string): Promise<void> {
    if (!this.room) return
    await this.room.switchActiveDevice("audiooutput", deviceId)
  }

  /**
   * Publishes real-time collaboration data over LiveKit WebRTC Data Channel.
   */
  public async publishData<T = any>(
    message: DataChannelMessage<T>,
    reliable = true,
    destinationIdentities?: string[]
  ): Promise<void> {
    if (!this.room?.localParticipant) return
    const payload = this.textEncoder.encode(JSON.stringify(message))
    await this.room.localParticipant.publishData(payload, {
      reliable,
      destinationIdentities,
    })
  }

  /**
   * Decodes incoming binary Data Channel payload to typed message.
   */
  public decodeDataPayload<T = any>(payload: Uint8Array): DataChannelMessage<T> | null {
    try {
      const decodedString = this.textDecoder.decode(payload)
      return JSON.parse(decodedString) as DataChannelMessage<T>
    } catch (e) {
      console.error("[VideoService] Failed to parse DataChannel payload", e)
      return null
    }
  }

  /**
   * Disconnects and releases local media tracks.
   */
  public async disconnect(): Promise<void> {
    if (this.localCameraStream) {
      this.localCameraStream.getTracks().forEach((t) => {
        try {
          t.stop()
        } catch {}
      })
      this.localCameraStream = null
    }
    if (this.localScreenStream) {
      this.localScreenStream.getTracks().forEach((t) => {
        try {
          t.stop()
        } catch {}
      })
      this.localScreenStream = null
    }
    if (this.room) {
      try {
        await this.room.disconnect(true)
      } catch (err) {
        console.warn("[VideoService] Error during room disconnect", err)
      }
      this.room = null
    }
  }
}

export const videoService = new VideoService()
