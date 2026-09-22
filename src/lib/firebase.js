import { initializeApp, getApps, getApp, deleteApp } from "firebase/app"
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth"

const clean = (val, fallback = "") => {
  if (!val) return fallback
  return val.replace(/['",]/g, "").trim()
}

const firebaseConfig = {
  apiKey: clean(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    "AIzaSyBNk3yzEhK-IqH4f2bgH7JuOFB6OaJPKvE"
  ),
  authDomain: clean(
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    "fir-ce689.firebaseapp.com"
  ),
  projectId: clean(
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    "fir-ce689"
  ),
  storageBucket: clean(
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    "fir-ce689.firebasestorage.app"
  ),
  messagingSenderId: clean(
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    "757579729870"
  ),
  appId: clean(
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    "1:757579729870:web:955b6b88b3a164576db99f"
  ),
}

// Initialize Firebase safely for SSR/Next.js, reinitializing if stale app was cached
let app
const currentApps = getApps()
if (currentApps.length > 0) {
  const existingApp = currentApps[0]
  if (existingApp?.options?.apiKey === firebaseConfig.apiKey) {
    app = existingApp
  } else {
    try {
      deleteApp(existingApp)
    } catch {
      // ignore deletion errors if already disposed
    }
    app = initializeApp(firebaseConfig)
  }
} else {
  app = initializeApp(firebaseConfig)
}

const auth = getAuth(app)
const provider = new GoogleAuthProvider()
provider.setCustomParameters({ prompt: "select_account" })

export { auth, provider, GoogleAuthProvider, signInWithPopup, signOut }
export default app

