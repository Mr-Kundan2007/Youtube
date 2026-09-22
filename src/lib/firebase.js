import { initializeApp, getApps, getApp } from "firebase/app"
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth"

const clean = (val, fallback = "") => {
  if (!val) return fallback
  return val.replace(/['",]/g, "").trim()
}

const firebaseConfig = {
  apiKey: clean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY, "AIzaSyDummyApiKeyForFirebase"),
  authDomain: clean(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, "youtube-clone-app.firebaseapp.com"),
  projectId: clean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, "youtube-clone-app"),
  storageBucket: clean(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, "youtube-clone-app.appspot.com"),
  messagingSenderId: clean(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, "123456789012"),
  appId: clean(process.env.NEXT_PUBLIC_FIREBASE_APP_ID, "1:123456789012:web:abcdef1234567890"),
}

// Initialize Firebase safely for SSR/Next.js
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp()
const auth = getAuth(app)
const provider = new GoogleAuthProvider()
provider.setCustomParameters({ prompt: "select_account" })

export { auth, provider, GoogleAuthProvider, signInWithPopup, signOut }
export default app
