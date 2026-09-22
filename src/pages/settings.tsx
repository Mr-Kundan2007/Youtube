import React from "react"
import Head from "next/head"
import Link from "next/link"
import { useRouter } from "next/router"
import { Settings as SettingsIcon, Palette, User, Shield, ArrowLeft } from "lucide-react"
import { AppearanceSettings } from "@/components/settings/AppearanceSettings"
import { useAuth } from "@/lib/AuthContext"
import { Button } from "@/components/ui/button"

export default function SettingsPage() {
  const router = useRouter()
  const { user }: any = useAuth()

  return (
    <>
      <Head>
        <title>Settings - YouTube</title>
        <meta name="description" content="Manage account settings and appearance preferences" />
      </Head>

      <div className="w-full min-h-screen bg-[var(--background)] text-[var(--foreground)] p-4 sm:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Top Bar Navigation */}
          <div className="flex flex-col sm:flex-row items-center sm:items-center text-center sm:text-left gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              className="rounded-full hover:bg-[var(--muted)] self-start sm:self-center"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Settings</h1>
              <p className="text-xs sm:text-sm text-[var(--muted-foreground)]">
                Manage your account preferences and personalized experience
              </p>
            </div>
          </div>

          {/* Account Profile Card */}
          {user && (
            <div className="p-4 sm:p-5 rounded-2xl border border-[var(--border)] bg-[var(--card)] flex flex-col sm:flex-row items-center justify-between text-center sm:text-left gap-4 shadow-sm">
              <div className="flex flex-col sm:flex-row items-center gap-3.5">
                <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/40 text-red-600 flex items-center justify-center font-bold text-lg shrink-0">
                  {user.name ? user.name[0].toUpperCase() : "U"}
                </div>
                <div>
                  <p className="font-bold text-sm sm:text-base text-[var(--foreground)]">{user.name || "YouTube User"}</p>
                  <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{user.email || ""}</p>
                </div>
              </div>
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)]">
                Account Synced
              </span>
            </div>
          )}

          {/* Account Security & Trusted Devices Navigation Card */}
          <Link
            href="/account/security"
            className="p-4 sm:p-5 rounded-2xl border border-[var(--border)] bg-[var(--card)] hover:border-blue-500/40 flex flex-col sm:flex-row items-center justify-between text-center sm:text-left gap-4 transition-all group shadow-sm"
          >
            <div className="flex flex-col sm:flex-row items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-sm sm:text-base text-[var(--foreground)] group-hover:text-blue-500 transition-colors">
                  Account Security & Trusted Devices
                </p>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                  Manage trusted browsers, review login history audit trail, and security alerts
                </p>
              </div>
            </div>
            <span className="text-xs font-bold px-4 py-2 rounded-xl bg-[var(--muted)] text-[var(--foreground)] group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0">
              Manage &rarr;
            </span>
          </Link>

          {/* Appearance Section */}
          <section aria-labelledby="appearance-heading">
            <AppearanceSettings />
          </section>
        </div>
      </div>
    </>
  )
}
