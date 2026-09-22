import "@/styles/globals.css"
import React, { useState } from "react"
import type { AppProps } from "next/app"
import Head from "next/head"
import { Header } from "@/components/Header"
import { Sidebar } from "@/components/Sidebar"
import { MobileBottomNav } from "@/components/MobileBottomNav"
import { HistoryProvider } from "@/context/HistoryContext"
import { AuthProvider } from "@/lib/AuthContext"
import { ThemeProvider } from "@/context/ThemeContext"
import { useRouter } from "next/router"
import { VerificationPendingModal } from "@/components/auth/VerificationPendingModal"
import { AuthModal } from "@/components/auth/AuthModal"

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter()
  const isMeetingRoom = router.pathname === "/meet/[roomId]"
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
    <ThemeProvider>
      <AuthProvider>
        <VerificationPendingModal />
        <AuthModal />
        <HistoryProvider>
          <Head>
            <title>YouTube</title>
            <meta name="description" content="YouTube Clone built with Next.js and Tailwind CSS" />
            <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
          </Head>
          {isMeetingRoom ? (
            <main className="w-full min-h-screen bg-zinc-950 text-neutral-100">
              <Component {...pageProps} />
            </main>
          ) : (
            <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex flex-col font-sans transition-colors duration-200">
              <Header onToggleSidebar={() => setIsMobileMenuOpen((prev) => !prev)} />
              <div className="flex flex-1 overflow-hidden relative">
                <Sidebar
                  isMobileOpen={isMobileMenuOpen}
                  onCloseMobile={() => setIsMobileMenuOpen(false)}
                />
                <main className="flex-1 overflow-y-auto bg-[var(--background)] text-[var(--foreground)] pb-16 md:pb-0">
                  <Component {...pageProps} />
                </main>
              </div>
              <MobileBottomNav />
            </div>
          )}
        </HistoryProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
