export type SubtitleTrackKind =
  | "subtitles"
  | "captions"
  | "descriptions"
  | "chapters"
  | "metadata"

export interface SubtitleTrack {
  id: string
  index: number
  kind: SubtitleTrackKind
  label: string
  language: string
  mode: "disabled" | "hidden" | "showing"
  isDefault?: boolean
}

export interface SubtitleTrackSource {
  src: string
  kind?: SubtitleTrackKind
  srcLang: string
  label: string
  default?: boolean
}

const COMMON_LANGUAGE_MAP: Record<string, string> = {
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

/**
 * Returns a human-friendly language name from a standard ISO language code.
 */
export function getLanguageName(code: string): string {
  if (!code || typeof code !== "string") return "Unknown"
  const clean = code.trim().toLowerCase().split("-")[0]
  return COMMON_LANGUAGE_MAP[clean] || code
}

/**
 * Normalizes an HTML5 TextTrack object into a serializable SubtitleTrack metadata object.
 */
export function normalizeSubtitleTrack(
  track: Partial<TextTrack> & {
    id?: string
    kind?: string
    label?: string
    language?: string
    mode?: string
    default?: boolean
    isDefault?: boolean
  },
  index: number,
  isDefault = false
): SubtitleTrack {
  const kind: SubtitleTrackKind =
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
