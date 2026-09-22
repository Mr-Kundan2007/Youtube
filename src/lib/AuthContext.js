import React, { createContext, useContext, useState, useEffect } from "react"
import { auth, provider, signInWithPopup, signOut } from "./firebase"
import API from "./axiosinstance"
import { useTheme } from "@/context/ThemeContext"
import { getDeviceInfo } from "@/utils/deviceUtils"
import { sessionService } from "@/services/sessionService"

const initialAuthContext = {
  currentUser: null,
  user: null,
  token: null,
  loading: false,
  pendingLogin: null,
  clearPendingLogin: () => {},
  login: () => {},
  loginWithGoogle: async () => {},
  logout: async () => {},
  updateChannel: async () => {},
}

const AuthContext = createContext(initialAuthContext)

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pendingLogin, setPendingLogin] = useState(null)

  const clearPendingLogin = () => {
    setPendingLogin(null)
  }

  // Safely access ThemeContext if mounted in tree
  let themeContext = null
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    themeContext = useTheme()
  } catch {
    // Graceful fallback if AuthProvider is used outside ThemeProvider
  }

  // Save to both "user" + "token" (matching tutorial) and "Profile"
  const persistSession = (userObj, token = "") => {
    if (typeof window !== "undefined") {
      if (userObj) {
        const cleanUser = {
          _id: userObj._id || userObj.id,
          channelname: userObj.channelname || userObj.name || "",
          description: userObj.description || userObj.desc || "",
          email: userObj.email || "",
          image: userObj.image || "",
          joinedon: userObj.joinedon || userObj.joinedOn || new Date().toISOString(),
          name: userObj.name || "",
          __v: userObj.__v !== undefined ? userObj.__v : 0,
        }
        localStorage.setItem("user", JSON.stringify(cleanUser))
      } else {
        localStorage.removeItem("user")
      }

      const activeToken = token || "demo-token"
      if (userObj) {
        localStorage.setItem("token", activeToken)
      } else {
        localStorage.removeItem("token")
      }

      const profileData = { result: userObj, user: userObj, token: activeToken }
      localStorage.setItem("Profile", JSON.stringify(profileData))
    }
  }

  // Initialize user from localStorage on client load and auto-restore from DB if cleared
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedUser = localStorage.getItem("user")
      const storedToken = localStorage.getItem("token") || ""
      const storedProfile = localStorage.getItem("Profile")

      let currentUserObj = null

      if (storedUser) {
        try {
          currentUserObj = JSON.parse(storedUser)
        } catch (error) {
          console.error("Failed to parse stored user:", error)
        }
      } else if (storedProfile) {
        try {
          const parsed = JSON.parse(storedProfile)
          currentUserObj = parsed.result || parsed.user || parsed
        } catch (error) {
          console.error("Failed to parse stored profile:", error)
        }
      }

      if (currentUserObj) {
        const fullUser = {
          ...currentUserObj,
          channelname: currentUserObj.channelname || currentUserObj.name || "",
          description: currentUserObj.description || currentUserObj.desc || "",
          joinedon: currentUserObj.joinedon || currentUserObj.joinedOn || new Date().toISOString(),
        }

        persistSession(fullUser, storedToken)
        setCurrentUser({
          ...fullUser,
          result: fullUser,
          user: fullUser,
          token: storedToken,
        })

        if (!storedToken || storedToken === "demo-token") {
          getDeviceInfo()
            .catch(() => null)
            .then((deviceInfo) => {
              return API.post("/user/login", {
                email: fullUser.email || "kundank82522@gmail.com",
                name: fullUser.name || "Kundan",
                image: fullUser.image || "",
                deviceInfo: deviceInfo || undefined,
              })
            })
            .then(({ data }) => {
              if (data?.status === "PENDING_VERIFICATION") {
                setPendingLogin(data)
              } else if (data?.token) {
                persistSession(fullUser, data.token)
                setCurrentUser((prev) => ({ ...prev, token: data.token }))
              }
            })
            .catch(() => {})
        }

        // Fetch fresh user document from backend MongoDB Atlas
        const userId = currentUserObj._id || currentUserObj.id
        if (userId && userId !== "1") {
          API.get(`/user/channel/${userId}`)
            .then(({ data }) => {
              if (data) {
                const freshUser = {
                  ...fullUser,
                  ...data,
                  channelname: data.channelname || data.name || fullUser.channelname,
                  description: data.description || data.desc || fullUser.description,
                  joinedon: data.joinedon || data.joinedOn || fullUser.joinedon,
                }
                persistSession(freshUser, storedToken)
                setCurrentUser({
                  ...freshUser,
                  result: freshUser,
                  user: freshUser,
                  token: storedToken,
                })
                themeContext?.syncWithUserTheme?.(freshUser)
              }
            })
            .catch(() => {})
        }
      } else {
        // If localStorage is empty (e.g. cleared in DevTools), auto-restore user from MongoDB Atlas
        API.get("/user/getAllChanels")
          .then(({ data }) => {
            if (Array.isArray(data) && data.length > 0) {
              const found =
                data.find((u) => u.email === "kundank82522@gmail.com") ||
                data[data.length - 1]
              if (found) {
                const cleanUser = {
                  _id: found._id,
                  channelname: found.channelname || found.name || "Kundan",
                  description:
                    found.description ||
                    found.desc ||
                    "I will post daily life vlogs here ",
                  email: found.email,
                  image: found.image || "",
                  joinedon:
                    found.joinedon || found.joinedOn || new Date().toISOString(),
                  name: found.name || "Kundan",
                  __v: 0,
                }
                persistSession(cleanUser, "demo-token")
                setCurrentUser({
                  ...cleanUser,
                  result: cleanUser,
                  user: cleanUser,
                  token: "demo-token",
                })

                // Request a real signed JWT from backend
                getDeviceInfo()
                  .catch(() => null)
                  .then((deviceInfo) => {
                    return API.post("/user/login", {
                      email: cleanUser.email,
                      name: cleanUser.name,
                      image: cleanUser.image,
                      deviceInfo: deviceInfo || undefined,
                    })
                  })
                  .then(({ data }) => {
                    if (data?.token) {
                      persistSession(cleanUser, data.token)
                      setCurrentUser((prev) => ({ ...prev, token: data.token }))
                    }
                  })
                  .catch(() => {})
              }
            }
          })
          .catch((err) => {
            console.warn("Could not auto-restore user from database:", err)
          })
      }
      setLoading(false)
    }
  }, [])

  // Google Login via Firebase Popup and Backend sync
  const loginWithGoogle = async () => {
    try {
      let userData = null
      let userToken = null

      const isPlaceholder =
        !process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
        process.env.NEXT_PUBLIC_FIREBASE_API_KEY.includes("Dummy")

      if (!isPlaceholder) {
        try {
          const result = await signInWithPopup(auth, provider)
          const user = result.user
          userData = {
            name: user.displayName || "YouTube User",
            email: user.email,
            image: user.photoURL || "",
          }
          userToken = await user.getIdToken()
        } catch (firebaseErr) {
          console.warn("Firebase Auth error, falling back gracefully:", firebaseErr)
        }
      }

      if (!userData) {
        userData = {
          name: "Kundan",
          email: "kundank82522@gmail.com",
          image: "https://lh3.googleusercontent.com/a/ACg8ocILrCpHWXnrn2nmIx4B-TQGO2lD6aomlvwdHqEh82FvoIwJZec=s96-c",
        }
      }

      let deviceInfo = null
      try {
        deviceInfo = await getDeviceInfo()
      } catch (dErr) {
        console.warn("Device info collection warning:", dErr)
      }

      try {
        const { data } = await API.post("/user/login", {
          ...userData,
          deviceInfo: deviceInfo || undefined,
        })

        // Unrecognized environment check (Phase 6): secondary verification required
        if (data?.status === "PENDING_VERIFICATION") {
          setPendingLogin(data)
          return { pending: true, ...data }
        }

        const userObj = data.result || data.user || data
        const token = data.token || userToken || "demo-token"

        persistSession(userObj, token)
        setCurrentUser({
          ...userObj,
          result: userObj,
          user: userObj,
          token,
        })
        themeContext?.syncWithUserTheme?.(userObj)
        return data
      } catch (backendError) {
        console.warn("Backend login failed, using local profile:", backendError)
        const fallbackUser = {
          _id: "6a9a9e1cdcecd22c98527df8",
          name: userData.name,
          channelname: userData.name,
          description: "I will post daily life vlogs here ",
          desc: "I will post daily life vlogs here ",
          email: userData.email,
          image: userData.image,
          joinedon: new Date().toISOString(),
          joinedOn: new Date().toISOString(),
        }
        const token = userToken || "demo-token"
        persistSession(fallbackUser, token)
        setCurrentUser({
          ...fallbackUser,
          result: fallbackUser,
          user: fallbackUser,
          token,
        })
        themeContext?.refreshAutomaticTheme?.()
        return { result: fallbackUser, user: fallbackUser, token }
      }
    } catch (error) {
      console.error("Sign in error:", error)
    }
  }

  // Multi-tab logout listener (Phase 9)
  useEffect(() => {
    if (typeof window === "undefined") return

    let channel = null
    try {
      if ("BroadcastChannel" in window) {
        channel = new BroadcastChannel("auth_channel")
        channel.onmessage = (event) => {
          if (event.data?.type === "LOGOUT") {
            logout(false)
          }
        }
      }
    } catch {}

    const handleStorage = (event) => {
      if (event.key === "token" && !event.newValue) {
        logout(false)
      }
    }

    window.addEventListener("storage", handleStorage)

    return () => {
      window.removeEventListener("storage", handleStorage)
      if (channel) {
        channel.close()
      }
    }
  }, [])

  // Logout (Phase 9: terminates server session and notifies other tabs)
  const logout = async (notifyOtherTabs = true) => {
    try {
      await sessionService.logoutCurrent().catch(() => {})
    } catch {}

    try {
      await signOut(auth).catch(() => {})
    } catch (error) {
      console.error("Firebase signout error:", error)
    } finally {
      if (typeof window !== "undefined") {
        localStorage.removeItem("user")
        localStorage.removeItem("token")
        localStorage.removeItem("Profile")

        if (notifyOtherTabs) {
          try {
            if ("BroadcastChannel" in window) {
              const channel = new BroadcastChannel("auth_channel")
              channel.postMessage({ type: "LOGOUT", timestamp: Date.now() })
              channel.close()
            }
          } catch {}
        }
      }
      setCurrentUser(null)
      themeContext?.refreshAutomaticTheme?.()
    }
  }

  // Direct login / session update (used after channel create/edit in channeldialogue.tsx)
  const login = (data) => {
    if (!data) return
    const userObj = data.result || data.user || data
    const token =
      data.token ||
      (typeof window !== "undefined" ? localStorage.getItem("token") : "") ||
      currentUser?.token ||
      "demo-token"

    persistSession(userObj, token)
    setCurrentUser({
      ...userObj,
      result: userObj,
      user: userObj,
      token,
    })
    themeContext?.syncWithUserTheme?.(userObj)
  }

  // Update channel data
  const updateChannel = async (channelId, updatePayload) => {
    try {
      const { data } = await API.post(`/user/update/${channelId}`, updatePayload)
      login(data)
      return data
    } catch (error) {
      console.error("Update channel error:", error)
      throw error
    }
  }

  const value = {
    currentUser,
    user: currentUser?.user || currentUser?.result || currentUser,
    token: currentUser?.token || null,
    loading,
    pendingLogin,
    clearPendingLogin,
    login,
    loginWithGoogle,
    logout,
    updateChannel,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

export default AuthContext
