import { TestRunner } from "./helpers/testEnv.js"

// Mirror subtitle utilities from subtitleUtils.ts
const COMMON_LANGUAGE_MAP = {
  en: "English",
  hi: "Hindi",
  es: "Spanish",
  fr: "French",
  de: "German",
  ja: "Japanese",
  zh: "Chinese",
  ru: "Russian",
  pt: "Portuguese",
  ar: "Arabic",
  bn: "Bengali",
  ko: "Korean",
  it: "Italian",
}

function getLanguageName(code) {
  if (!code || typeof code !== "string") return "Unknown"
  const clean = code.trim().toLowerCase().split("-")[0]
  return COMMON_LANGUAGE_MAP[clean] || code
}

function normalizeSubtitleTrack(track, index, isDefault = false) {
  const kind =
    track.kind === "captions" ||
    track.kind === "descriptions" ||
    track.kind === "chapters" ||
    track.kind === "metadata"
      ? track.kind
      : "subtitles"

  const language = track.language && track.language.trim() ? track.language.trim() : "unknown"

  let label = track.label && track.label.trim() ? track.label.trim() : ""
  if (!label) {
    if (language !== "unknown") {
      const friendlyLang = getLanguageName(language)
      label = kind === "captions" ? `${friendlyLang} CC` : friendlyLang
    } else {
      label = kind === "captions" ? `Captions ${index + 1}` : `Subtitles ${index + 1}`
    }
  }

  const id = track.id || `track-${kind}-${language}-${index}`
  const mode = track.mode === "showing" ? "showing" : "disabled"
  const resolvedDefault = Boolean(isDefault || track.isDefault || track.default)

  return {
    id,
    index,
    kind,
    label,
    language,
    mode,
    isDefault: resolvedDefault,
  }
}

// Mirror quality utilities from videoQualityUtils.ts
function getQualityLabel(videoHeight) {
  if (
    typeof videoHeight !== "number" ||
    isNaN(videoHeight) ||
    !isFinite(videoHeight) ||
    videoHeight <= 0
  ) {
    return "Auto"
  }

  if (videoHeight >= 2160) return "4K"
  if (videoHeight >= 1440) return "1440p"
  if (videoHeight >= 1080) return "1080p"
  if (videoHeight >= 720) return "720p"
  if (videoHeight >= 480) return "480p"
  if (videoHeight >= 360) return "360p"
  if (videoHeight >= 240) return "240p"

  return `${Math.floor(videoHeight)}p`
}

function calculateAspectRatio(width, height) {
  if (
    typeof width !== "number" ||
    typeof height !== "number" ||
    isNaN(width) ||
    isNaN(height) ||
    !isFinite(width) ||
    !isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return "16:9"
  }

  const ratio = width / height

  if (Math.abs(ratio - 16 / 9) < 0.05) return "16:9"
  if (Math.abs(ratio - 4 / 3) < 0.05) return "4:3"
  if (Math.abs(ratio - 21 / 9) < 0.08) return "21:9"
  if (Math.abs(ratio - 1) < 0.03) return "1:1"
  if (Math.abs(ratio - 9 / 16) < 0.05) return "9:16"

  const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b))
  const roundedWidth = Math.round(width)
  const roundedHeight = Math.round(height)
  const divisor = gcd(roundedWidth, roundedHeight)

  if (divisor > 1) {
    return `${Math.round(roundedWidth / divisor)}:${Math.round(roundedHeight / divisor)}`
  }

  return `${ratio.toFixed(2)}:1`
}

function formatResolution(width, height) {
  if (!width || !height || width <= 0 || height <= 0) {
    return "Unknown"
  }
  return `${Math.round(width)} × ${Math.round(height)}`
}

function getReadyStatusLabel(readyState, isBuffering, hasError = false) {
  if (hasError) return "Playback Error"
  if (isBuffering) return "Buffering..."
  switch (readyState) {
    case 0:
      return "No Media"
    case 1:
      return "Loading Metadata"
    case 2:
      return "Loading Data"
    case 3:
    case 4:
      return "Ready"
    default:
      return "Ready"
  }
}

// Phase 6 Video Player Subtitle & Quality State Machine Simulator
class VideoPlayerStateMachinePhase6 {
  constructor(options = {}) {
    this.textTracks = (options.tracks || []).map((t, i) => ({
      id: t.id || `track-${i}`,
      kind: t.kind || "subtitles",
      label: t.label || "",
      language: t.language || t.srcLang || "",
      mode: t.default ? "showing" : "disabled",
      isDefault: Boolean(t.default),
    }))

    this.videoElement = {
      videoWidth: options.videoWidth || 0,
      videoHeight: options.videoHeight || 0,
      readyState: options.readyState !== undefined ? options.readyState : 4,
      currentSrc: options.src || "/video/vdo.mp4",
      textTracks: this.textTracks,
    }

    this.state = {
      isPlaying: options.isPlaying || false,
      currentTime: 0,
      duration: options.duration || 120,
      volume: 1,
      bufferedPercent: options.bufferedPercent || 80,
      isBuffering: false,
      error: null,
      availableSubtitleTracks: [],
      activeSubtitleTrack: null,
      areSubtitlesEnabled: false,
      videoQuality: {
        videoWidth: 0,
        videoHeight: 0,
        qualityLabel: "Auto",
        aspectRatio: "16:9",
        formattedResolution: "Auto",
        readyStatus: "Loading",
        bufferedPercent: options.bufferedPercent || 80,
        sourceType: "MP4",
      },
    }

    this.syncTracks()
    this.syncQuality()
  }

  syncTracks() {
    const tracks = []
    let active = null

    this.textTracks.forEach((t, i) => {
      if (t.kind === "subtitles" || t.kind === "captions") {
        const normalized = normalizeSubtitleTrack(t, i, t.isDefault)
        tracks.push(normalized)
        if (t.mode === "showing") {
          active = normalized
        }
      }
    })

    this.state.availableSubtitleTracks = tracks
    this.state.activeSubtitleTrack = active
    this.state.areSubtitlesEnabled = active !== null
  }

  syncQuality() {
    const width = this.videoElement.videoWidth || 0
    const height = this.videoElement.videoHeight || 0
    this.state.videoQuality = {
      videoWidth: width,
      videoHeight: height,
      qualityLabel: getQualityLabel(height),
      aspectRatio: calculateAspectRatio(width, height),
      formattedResolution: formatResolution(width, height),
      readyStatus: getReadyStatusLabel(this.videoElement.readyState, this.state.isBuffering, !!this.state.error),
      bufferedPercent: this.state.bufferedPercent,
      sourceType: this.videoElement.currentSrc ? this.videoElement.currentSrc.split(".").pop().toUpperCase() : "MP4",
    }
  }

  enableSubtitleTrack(trackIdOrIndex) {
    let found = null

    const hasExactMatch = this.textTracks.some(
      (t, i) =>
        t.id === trackIdOrIndex ||
        i === trackIdOrIndex ||
        String(i) === String(trackIdOrIndex)
    )

    this.textTracks.forEach((t, i) => {
      const matches = hasExactMatch
        ? t.id === trackIdOrIndex ||
          i === trackIdOrIndex ||
          String(i) === String(trackIdOrIndex)
        : t.language === trackIdOrIndex || t.label === trackIdOrIndex

      if (matches && !found) {
        t.mode = "showing"
        found = normalizeSubtitleTrack(t, i, t.isDefault)
      } else if (t.kind === "subtitles" || t.kind === "captions") {
        t.mode = "disabled"
      }
    })

    if (found) {
      this.state.activeSubtitleTrack = found
      this.state.areSubtitlesEnabled = true
      // Update availableSubtitleTracks modes
      this.state.availableSubtitleTracks.forEach((t) => {
        t.mode = t.id === found.id ? "showing" : "disabled"
      })
    }
  }

  disableSubtitles() {
    this.textTracks.forEach((t) => {
      if (t.kind === "subtitles" || t.kind === "captions") {
        t.mode = "disabled"
      }
    })
    this.state.activeSubtitleTrack = null
    this.state.areSubtitlesEnabled = false
    this.state.availableSubtitleTracks.forEach((t) => {
      t.mode = "disabled"
    })
  }

  toggleSubtitles() {
    if (this.state.areSubtitlesEnabled) {
      this.disableSubtitles()
    } else if (this.state.availableSubtitleTracks.length > 0) {
      const target =
        this.state.availableSubtitleTracks.find((t) => t.isDefault) ||
        this.state.availableSubtitleTracks[0]
      this.enableSubtitleTrack(target.id)
    }
  }

  changeSource(newSrc, newTracks = [], newDimensions = { width: 1920, height: 1080 }) {
    this.videoElement.currentSrc = newSrc
    this.videoElement.videoWidth = newDimensions.width
    this.videoElement.videoHeight = newDimensions.height
    this.textTracks = newTracks.map((t, i) => ({
      id: t.id || `track-${i}`,
      kind: t.kind || "subtitles",
      label: t.label || "",
      language: t.language || t.srcLang || "",
      mode: t.default ? "showing" : "disabled",
      isDefault: Boolean(t.default),
    }))
    this.videoElement.textTracks = this.textTracks
    this.syncTracks()
    this.syncQuality()
  }
}

// =========================================================================
// TEST SUITE: Phase 6 Subtitles, Captions & Video Quality Information
// =========================================================================

export async function runSubtitlesQualityTestSuite() {
  const runner = new TestRunner("Phase 6: Subtitles, Captions & Video Quality Information System")
  runner.start()

  try {
    // -------------------------------------------------------------------------
    // 1. Subtitle & Caption Track Detection
    // -------------------------------------------------------------------------
    const emptyPlayer = new VideoPlayerStateMachinePhase6({ tracks: [] })
    runner.assert(emptyPlayer.state.availableSubtitleTracks.length === 0, "No tracks: availableSubtitleTracks is empty")
    runner.assert(emptyPlayer.state.areSubtitlesEnabled === false, "No tracks: areSubtitlesEnabled is false")
    runner.assert(emptyPlayer.state.activeSubtitleTrack === null, "No tracks: activeSubtitleTrack is null")

    const singleTrackPlayer = new VideoPlayerStateMachinePhase6({
      tracks: [{ id: "en-sub", kind: "subtitles", label: "English", language: "en" }],
    })
    runner.assert(singleTrackPlayer.state.availableSubtitleTracks.length === 1, "Single track detected")
    runner.assert(singleTrackPlayer.state.availableSubtitleTracks[0].label === "English", "Single track label is English")
    runner.assert(singleTrackPlayer.state.availableSubtitleTracks[0].kind === "subtitles", "Single track kind is subtitles")

    const multiTrackPlayer = new VideoPlayerStateMachinePhase6({
      tracks: [
        { id: "en", kind: "subtitles", label: "English", language: "en", default: true },
        { id: "hi", kind: "subtitles", label: "Hindi", language: "hi" },
        { id: "es", kind: "subtitles", label: "Spanish", language: "es" },
        { id: "en-cc", kind: "captions", label: "English CC", language: "en" },
      ],
    })
    runner.assert(multiTrackPlayer.state.availableSubtitleTracks.length === 4, "4 tracks detected (3 subtitles + 1 caption)")
    runner.assert(multiTrackPlayer.state.areSubtitlesEnabled === true, "Default track auto-enables subtitles")
    runner.assert(multiTrackPlayer.state.activeSubtitleTrack.id === "en", "Active subtitle track is the default track (en)")

    // Caption track separation
    const captions = multiTrackPlayer.state.availableSubtitleTracks.filter((t) => t.kind === "captions")
    runner.assert(captions.length === 1, "Caption track categorized correctly")
    runner.assert(captions[0].label === "English CC", "Caption label verified")

    // -------------------------------------------------------------------------
    // 2. Subtitle Actions & Exclusive Selection
    // -------------------------------------------------------------------------
    // Switch to Hindi
    multiTrackPlayer.enableSubtitleTrack("hi")
    runner.assert(multiTrackPlayer.state.areSubtitlesEnabled === true, "Subtitles remain enabled after language switch")
    runner.assert(multiTrackPlayer.state.activeSubtitleTrack.id === "hi", "Active subtitle track switched to Hindi")
    runner.assert(multiTrackPlayer.state.activeSubtitleTrack.label === "Hindi", "Active subtitle label is Hindi")

    // Verify exclusive showing mode: only Hindi is showing
    const showingTracks = multiTrackPlayer.state.availableSubtitleTracks.filter((t) => t.mode === "showing")
    runner.assert(showingTracks.length === 1, "Only one subtitle track is in mode='showing' at a time")
    runner.assert(showingTracks[0].id === "hi", "Showing track is Hindi")

    // Switch to captions
    multiTrackPlayer.enableSubtitleTrack("en-cc")
    runner.assert(multiTrackPlayer.state.activeSubtitleTrack.id === "en-cc", "Switched to captions track (en-cc)")
    runner.assert(multiTrackPlayer.state.activeSubtitleTrack.kind === "captions", "Active track kind is captions")

    // Disable subtitles (Off option)
    multiTrackPlayer.disableSubtitles()
    runner.assert(multiTrackPlayer.state.areSubtitlesEnabled === false, "disableSubtitles marks areSubtitlesEnabled=false")
    runner.assert(multiTrackPlayer.state.activeSubtitleTrack === null, "disableSubtitles sets activeSubtitleTrack=null")
    const showingAfterDisable = multiTrackPlayer.state.availableSubtitleTracks.filter((t) => t.mode === "showing")
    runner.assert(showingAfterDisable.length === 0, "All tracks disabled after disableSubtitles")

    // Toggle subtitles
    multiTrackPlayer.toggleSubtitles()
    runner.assert(multiTrackPlayer.state.areSubtitlesEnabled === true, "toggleSubtitles re-enables subtitles")
    runner.assert(multiTrackPlayer.state.activeSubtitleTrack.id === "en", "toggleSubtitles enables default track (en)")

    multiTrackPlayer.toggleSubtitles()
    runner.assert(multiTrackPlayer.state.areSubtitlesEnabled === false, "toggleSubtitles again disables subtitles")

    // -------------------------------------------------------------------------
    // 3. Fallback Label and Language Normalization
    // -------------------------------------------------------------------------
    // Missing label but language provided -> maps language code
    const trackNoLabel = normalizeSubtitleTrack({ kind: "subtitles", language: "hi" }, 0)
    runner.assert(trackNoLabel.label === "Hindi", "Empty label normalized to language name 'Hindi'")

    // Missing label on captions -> maps to '${Language} CC'
    const ccNoLabel = normalizeSubtitleTrack({ kind: "captions", language: "en" }, 0)
    runner.assert(ccNoLabel.label === "English CC", "Empty caption label normalized to 'English CC'")

    // Missing label and missing language -> fallbacks to 'Subtitles 1'
    const fullyEmpty = normalizeSubtitleTrack({ kind: "subtitles", language: "" }, 2)
    runner.assert(fullyEmpty.label === "Subtitles 3", "Completely missing label/language fallbacks to 'Subtitles 3'")
    runner.assert(fullyEmpty.language === "unknown", "Missing language fallbacks to 'unknown'")

    // Invalid track selection safely ignored
    multiTrackPlayer.enableSubtitleTrack("non-existent-track")
    runner.assert(multiTrackPlayer.state.areSubtitlesEnabled === false, "Invalid track selection safely ignored without mutation")

    // -------------------------------------------------------------------------
    // 4. Source Change Synchronization
    // -------------------------------------------------------------------------
    multiTrackPlayer.changeSource("/video/nature2.mp4", [
      { id: "fr-sub", kind: "subtitles", label: "French", language: "fr", default: true },
    ], { width: 1280, height: 720 })

    runner.assert(multiTrackPlayer.state.availableSubtitleTracks.length === 1, "Source change clears old tracks and loads new")
    runner.assert(multiTrackPlayer.state.availableSubtitleTracks[0].id === "fr-sub", "New track is French")
    runner.assert(multiTrackPlayer.state.activeSubtitleTrack.id === "fr-sub", "New default track is active")
    runner.assert(multiTrackPlayer.state.videoQuality.qualityLabel === "720p", "Source change updates quality label to 720p")

    // -------------------------------------------------------------------------
    // 5. Video Quality Resolution Detection
    // -------------------------------------------------------------------------
    runner.assert(getQualityLabel(2160) === "4K", "2160p maps to '4K'")
    runner.assert(getQualityLabel(1440) === "1440p", "1440p maps to '1440p'")
    runner.assert(getQualityLabel(1080) === "1080p", "1080p maps to '1080p'")
    runner.assert(getQualityLabel(720) === "720p", "720p maps to '720p'")
    runner.assert(getQualityLabel(480) === "480p", "480p maps to '480p'")
    runner.assert(getQualityLabel(360) === "360p", "360p maps to '360p'")
    runner.assert(getQualityLabel(240) === "240p", "240p maps to '240p'")
    runner.assert(getQualityLabel(0) === "Auto", "0p maps to 'Auto'")
    runner.assert(getQualityLabel(-1) === "Auto", "Negative height maps to 'Auto'")
    runner.assert(getQualityLabel(NaN) === "Auto", "NaN maps to 'Auto'")
    runner.assert(getQualityLabel(null) === "Auto", "null maps to 'Auto'")

    // -------------------------------------------------------------------------
    // 6. Aspect Ratio Calculation & Edge Cases
    // -------------------------------------------------------------------------
    runner.assert(calculateAspectRatio(1920, 1080) === "16:9", "1920x1080 is 16:9")
    runner.assert(calculateAspectRatio(1280, 720) === "16:9", "1280x720 is 16:9")
    runner.assert(calculateAspectRatio(1440, 1080) === "4:3", "1440x1080 is 4:3")
    runner.assert(calculateAspectRatio(640, 480) === "4:3", "640x480 is 4:3")
    runner.assert(calculateAspectRatio(2560, 1080) === "21:9", "2560x1080 is 21:9")
    runner.assert(calculateAspectRatio(1080, 1080) === "1:1", "1080x1080 is 1:1")
    runner.assert(calculateAspectRatio(1080, 1920) === "9:16", "1080x1920 is 9:16")
    runner.assert(calculateAspectRatio(0, 0) === "16:9", "0x0 safely returns 16:9 without divide-by-zero")
    runner.assert(calculateAspectRatio(NaN, 1080) === "16:9", "NaN width safely returns 16:9")
    runner.assert(calculateAspectRatio(1920, 0) === "16:9", "0 height safely returns 16:9")
    runner.assert(calculateAspectRatio(-1920, -1080) === "16:9", "Negative dimensions safely return 16:9")

    // -------------------------------------------------------------------------
    // 7. Resolution Formatting & Ready State Mapping
    // -------------------------------------------------------------------------
    runner.assert(formatResolution(1920, 1080) === "1920 × 1080", "Formats 1920x1080 as '1920 × 1080'")
    runner.assert(formatResolution(0, 0) === "Unknown", "0x0 formatted as 'Unknown'")
    runner.assert(getReadyStatusLabel(4, false) === "Ready", "readyState=4 is 'Ready'")
    runner.assert(getReadyStatusLabel(2, true) === "Buffering...", "Buffering status is 'Buffering...'")
    runner.assert(getReadyStatusLabel(0, false) === "No Media", "readyState=0 is 'No Media'")
    runner.assert(getReadyStatusLabel(4, false, true) === "Playback Error", "Error status takes precedence")

    // -------------------------------------------------------------------------
    // 8. Quality Info Initialization on Video State
    // -------------------------------------------------------------------------
    const hdPlayer = new VideoPlayerStateMachinePhase6({
      videoWidth: 1920,
      videoHeight: 1080,
      bufferedPercent: 88,
    })
    runner.assert(hdPlayer.state.videoQuality.videoWidth === 1920, "videoWidth is 1920")
    runner.assert(hdPlayer.state.videoQuality.videoHeight === 1080, "videoHeight is 1080")
    runner.assert(hdPlayer.state.videoQuality.qualityLabel === "1080p", "qualityLabel is 1080p")
    runner.assert(hdPlayer.state.videoQuality.aspectRatio === "16:9", "aspectRatio is 16:9")
    runner.assert(hdPlayer.state.videoQuality.formattedResolution === "1920 × 1080", "formattedResolution is 1920 × 1080")
    runner.assert(hdPlayer.state.videoQuality.readyStatus === "Ready", "readyStatus is Ready")
    runner.assert(hdPlayer.state.videoQuality.bufferedPercent === 88, "bufferedPercent is 88%")

  } catch (err) {
    runner.assert(false, `Unexpected error in Phase 6 test suite: ${err.message}`)
  }

  return runner.summary()
}

// Auto-run if executed directly
if (process.argv[1]?.endsWith("phase6_subtitles_quality.test.js")) {
  runSubtitlesQualityTestSuite()
    .then((result) => {
      process.exit(result.failed > 0 ? 1 : 0)
    })
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
