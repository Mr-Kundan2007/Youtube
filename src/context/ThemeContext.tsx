import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from "react"
import {
  ThemeMode,
  ActiveTheme,
  getISTHour,
  getISTTimeString,
  isMorningIST,
  getAutomaticTheme,
  resolveActiveTheme,
  getStoredTheme,
  setStoredTheme,
  applyThemeToDocument,
} from "@/utils/themeUtils"
import { themeService } from "@/services/themeService"

export interface ThemeContextValue {
  themeMode: ThemeMode
  activeTheme: ActiveTheme
  isThemeLoading: boolean
  isThemeSyncing: boolean
  lastSyncedAt: string | null
  syncError: string | null
  istTime: string
  istHour: number
  isMorning: boolean
  lastThemeUpdatedAt: string | null
  setThemeMode: (mode: ThemeMode) => Promise<void>
  setLightTheme: () => Promise<void>
  setDarkTheme: () => Promise<void>
  setAutomaticTheme: () => Promise<void>
  refreshAutomaticTheme: () => void
  applyTheme: (theme: ActiveTheme) => void
  syncWithUserTheme: (userData?: any) => Promise<void>
  loadUserTheme: () => Promise<void>
  dismissSyncError: () => void
}

const defaultContextValue: ThemeContextValue = {
  themeMode: "automatic",
  activeTheme: "light",
  isThemeLoading: false,
  isThemeSyncing: false,
  lastSyncedAt: null,
  syncError: null,
  istTime: "",
  istHour: 12,
  isMorning: false,
  lastThemeUpdatedAt: null,
  setThemeMode: async () => {},
  setLightTheme: async () => {},
  setDarkTheme: async () => {},
  setAutomaticTheme: async () => {},
  refreshAutomaticTheme: () => {},
  applyTheme: () => {},
  syncWithUserTheme: async () => {},
  loadUserTheme: async () => {},
  dismissSyncError: () => {},
}

const ThemeContext = createContext<ThemeContextValue>(defaultContextValue)

export interface ThemeProviderProps {
  children: React.ReactNode
  initialThemeMode?: ThemeMode
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children, initialThemeMode }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>("automatic")
  const [activeTheme, setActiveThemeState] = useState<ActiveTheme>("light")
  const [isThemeLoading, setIsThemeLoading] = useState<boolean>(true)
  const [isThemeSyncing, setIsThemeSyncing] = useState<boolean>(false)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [istTime, setIstTime] = useState<string>("")
  const [istHour, setIstHour] = useState<number>(12)
  const [lastThemeUpdatedAt, setLastThemeUpdatedAt] = useState<string | null>(null)

  // Keep references to current state for rollback on API failure
  const themeModeRef = useRef<ThemeMode>(themeMode)
  const activeThemeRef = useRef<ActiveTheme>(activeTheme)
  useEffect(() => {
    themeModeRef.current = themeMode
    activeThemeRef.current = activeTheme
  }, [themeMode, activeTheme])

  // Updates IST diagnostics
  const updateIstDiagnostics = useCallback(() => {
    const now = new Date()
    setIstTime(getISTTimeString(now))
    setIstHour(getISTHour(now))
  }, [])

  // Applies an active theme and saves settings locally
  const applyAndPersistTheme = useCallback(
    (mode: ThemeMode, themeToApply: ActiveTheme, updatedAt?: string) => {
      applyThemeToDocument(themeToApply)
      setActiveThemeState(themeToApply)
      setThemeModeState(mode)
      const timestamp = updatedAt || new Date().toISOString()
      setLastThemeUpdatedAt(timestamp)

      setStoredTheme({
        themeMode: mode,
        activeTheme: themeToApply,
        lastUpdated: timestamp,
      })
    },
    []
  )

  // Synchronizes local theme state with user's remote profile
  const syncWithUserTheme = useCallback(
    async (userData?: any) => {
      let remoteMode: ThemeMode | null = null
      let remoteTimestamp: string | null = null

      if (userData && typeof userData === "object") {
        const candidateMode =
          userData.themeSettings?.mode ||
          userData.themeMode ||
          userData.mode

        if (candidateMode && ["automatic", "light", "dark"].includes(candidateMode)) {
          remoteMode = candidateMode
          remoteTimestamp =
            userData.themeSettings?.updatedAt ||
            userData.lastThemeUpdatedAt ||
            null
        }
      }

      // If userData didn't contain themeSettings, fetch via themeService
      if (!remoteMode) {
        const remotePrefs = await themeService.getThemeSettings()
        if (remotePrefs && remotePrefs.themeMode) {
          remoteMode = remotePrefs.themeMode
          remoteTimestamp = remotePrefs.lastThemeUpdatedAt
        }
      }

      if (remoteMode) {
        const resolved = resolveActiveTheme(remoteMode)
        applyAndPersistTheme(remoteMode, resolved, remoteTimestamp || undefined)
        setLastSyncedAt(new Date().toISOString())
      }
    },
    [applyAndPersistTheme]
  )

  const loadUserTheme = useCallback(async () => {
    await syncWithUserTheme()
  }, [syncWithUserTheme])

  // Initial theme initialization on mount (Client-side)
  useEffect(() => {
    updateIstDiagnostics()

    const stored = getStoredTheme()
    const effectiveMode = initialThemeMode || stored?.themeMode || "automatic"

    let effectiveTheme: ActiveTheme
    if (effectiveMode === "light") {
      effectiveTheme = "light"
    } else if (effectiveMode === "dark") {
      effectiveTheme = "dark"
    } else {
      // In automatic mode, resolve based on current IST login/session time
      effectiveTheme = getAutomaticTheme()
    }

    applyThemeToDocument(effectiveTheme)
    setThemeModeState(effectiveMode)
    setActiveThemeState(effectiveTheme)
    if (stored?.lastUpdated) {
      setLastThemeUpdatedAt(stored.lastUpdated)
    }
    setIsThemeLoading(false)

    // Check if user is already logged in and reconcile with server
    if (typeof window !== "undefined" && localStorage.getItem("token")) {
      syncWithUserTheme()
    }
  }, [initialThemeMode, updateIstDiagnostics, syncWithUserTheme])

  /**
   * Public theme mode setter:
   * 1. Immediate optimistic UI update (zero latency)
   * 2. Asynchronous background server sync
   * 3. Automatic rollback to previous theme if server sync fails
   */
  const setThemeMode = useCallback(
    async (mode: ThemeMode) => {
      const prevMode = themeModeRef.current
      const prevActive = activeThemeRef.current
      const resolved = resolveActiveTheme(mode)

      // Step 1: Optimistic local update
      applyAndPersistTheme(mode, resolved)
      updateIstDiagnostics()
      setSyncError(null)

      // Step 2: Asynchronous backend sync
      setIsThemeSyncing(true)
      try {
        const response = await themeService.updateThemeSettings(mode)
        if (response) {
          setLastSyncedAt(new Date().toISOString())
        }
      } catch (err: any) {
        // If aborted because user clicked another option rapidly, ignore
        if (err?.message === "REQUEST_ABORTED") {
          return
        }

        // Step 3: Rollback on API failure
        console.warn("[Theme] Server sync failed, rolling back to previous theme:", err)
        applyAndPersistTheme(prevMode, prevActive)
        setSyncError("Unable to save preference. Your theme may not sync across devices.")
      } finally {
        setIsThemeSyncing(false)
      }
    },
    [applyAndPersistTheme, updateIstDiagnostics]
  )

  const setLightTheme = useCallback(async () => {
    await setThemeMode("light")
  }, [setThemeMode])

  const setDarkTheme = useCallback(async () => {
    await setThemeMode("dark")
  }, [setThemeMode])

  const setAutomaticTheme = useCallback(async () => {
    await setThemeMode("automatic")
  }, [setThemeMode])

  // Explicitly recalculates and refreshes the automatic theme using current IST time
  const refreshAutomaticTheme = useCallback(() => {
    updateIstDiagnostics()
    const autoTheme = getAutomaticTheme()

    // If current mode is automatic, update applied theme immediately
    if (themeMode === "automatic") {
      applyAndPersistTheme("automatic", autoTheme)
    }
  }, [themeMode, applyAndPersistTheme, updateIstDiagnostics])

  // Explicit direct theme application
  const applyTheme = useCallback(
    (theme: ActiveTheme) => {
      applyThemeToDocument(theme)
      setActiveThemeState(theme)
    },
    []
  )

  const dismissSyncError = useCallback(() => {
    setSyncError(null)
  }, [])

  const isMorning = useMemo(() => isMorningIST(), [istHour])

  const value = useMemo<ThemeContextValue>(
    () => ({
      themeMode,
      activeTheme,
      isThemeLoading,
      isThemeSyncing,
      lastSyncedAt,
      syncError,
      istTime,
      istHour,
      isMorning,
      lastThemeUpdatedAt,
      setThemeMode,
      setLightTheme,
      setDarkTheme,
      setAutomaticTheme,
      refreshAutomaticTheme,
      applyTheme,
      syncWithUserTheme,
      loadUserTheme,
      dismissSyncError,
    }),
    [
      themeMode,
      activeTheme,
      isThemeLoading,
      isThemeSyncing,
      lastSyncedAt,
      syncError,
      istTime,
      istHour,
      isMorning,
      lastThemeUpdatedAt,
      setThemeMode,
      setLightTheme,
      setDarkTheme,
      setAutomaticTheme,
      refreshAutomaticTheme,
      applyTheme,
      syncWithUserTheme,
      loadUserTheme,
      dismissSyncError,
    ]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}

export default ThemeContext
