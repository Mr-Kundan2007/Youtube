import React, { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/router"
import {
  Home,
  Compass,
  PlaySquare,
  History,
  ThumbsUp,
  Clock,
  Download,
  Upload,
  User,
  PlusCircle,
  Crown,
  Sparkles,
  Receipt,
  BarChart3,
  ShieldAlert,
  Moon,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import ChannelDialogue from "@/components/channeldialogue"
import VideoUploadDialog from "@/components/VideoUploadDialog"
import { useAuth } from "@/lib/AuthContext"
import { ThemeToggle } from "@/components/ThemeToggle"

interface SidebarProps {
  isMobileOpen?: boolean
  onCloseMobile?: () => void
}

export const Sidebar: React.FC<SidebarProps> = ({ isMobileOpen = false, onCloseMobile }) => {
  const router = useRouter()
  const { user }: any = useAuth()
  const [isChannelDialogOpen, setIsChannelDialogOpen] = useState(false)
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false)

  const handleLinkClick = () => {
    if (onCloseMobile) {
      onCloseMobile()
    }
  }

  const renderNavLinks = () => (
    <div className="space-y-1">
      <Button
        asChild
        variant="ghost"
        className={cn(
          "w-full justify-start font-normal text-sm text-[var(--foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] dark:hover:text-white rounded-xl px-3 py-2.5 h-11 transition-colors touch-target-44",
          router.pathname === "/" && "bg-[var(--muted)] font-semibold text-[var(--foreground)]"
        )}
      >
        <Link href="/" onClick={handleLinkClick}>
          <Home className="w-5 h-5 mr-3 shrink-0" />
          <span>Home</span>
        </Link>
      </Button>

      <Button
        asChild
        variant="ghost"
        className={cn(
          "w-full justify-start font-normal text-sm text-[var(--foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] dark:hover:text-white rounded-xl px-3 py-2.5 h-11 transition-colors touch-target-44",
          router.pathname === "/explore" && "bg-[var(--muted)] font-semibold text-[var(--foreground)]"
        )}
      >
        <Link href="/explore" onClick={handleLinkClick}>
          <Compass className="w-5 h-5 mr-3 shrink-0" />
          <span>Explore</span>
        </Link>
      </Button>

      <Button
        asChild
        variant="ghost"
        className={cn(
          "w-full justify-start font-normal text-sm text-[var(--foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] dark:hover:text-white rounded-xl px-3 py-2.5 h-11 transition-colors touch-target-44",
          router.pathname === "/subscriptions" && "bg-[var(--muted)] font-semibold text-[var(--foreground)]"
        )}
      >
        <Link href="/subscriptions" onClick={handleLinkClick}>
          <PlaySquare className="w-5 h-5 mr-3 shrink-0" />
          <span>Subscriptions</span>
        </Link>
      </Button>

      <div className="border-t border-[var(--border)] pt-2 mt-2 space-y-1">
        <Button
          asChild
          variant="ghost"
          className={cn(
            "w-full justify-start font-normal text-sm text-[var(--foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] dark:hover:text-white rounded-xl px-3 py-2.5 h-11 transition-colors touch-target-44",
            router.pathname.startsWith("/history") && "bg-[var(--muted)] font-semibold text-[var(--foreground)]"
          )}
        >
          <Link href="/history" onClick={handleLinkClick}>
            <History className="w-5 h-5 mr-3 shrink-0" />
            <span>History</span>
          </Link>
        </Button>

        <Button
          asChild
          variant="ghost"
          className={cn(
            "w-full justify-start font-normal text-sm text-[var(--foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] dark:hover:text-white rounded-xl px-3 py-2.5 h-11 transition-colors touch-target-44",
            router.pathname.startsWith("/liked") && "bg-[var(--muted)] font-semibold text-[var(--foreground)]"
          )}
        >
          <Link href="/liked" onClick={handleLinkClick}>
            <ThumbsUp className="w-5 h-5 mr-3 shrink-0" />
            <span>Liked videos</span>
          </Link>
        </Button>

        <Button
          asChild
          variant="ghost"
          className={cn(
            "w-full justify-start font-normal text-sm text-[var(--foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] dark:hover:text-white rounded-xl px-3 py-2.5 h-11 transition-colors touch-target-44",
            router.pathname.startsWith("/watch-later") && "bg-[var(--muted)] font-semibold text-[var(--foreground)]"
          )}
        >
          <Link href="/watch-later" onClick={handleLinkClick}>
            <Clock className="w-5 h-5 mr-3 shrink-0" />
            <span>Watch Later</span>
          </Link>
        </Button>

        <Button
          asChild
          variant="ghost"
          className={cn(
            "w-full justify-start font-normal text-sm text-[var(--foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] dark:hover:text-white rounded-xl px-3 py-2.5 h-11 transition-colors touch-target-44",
            router.pathname.startsWith("/downloads") && "bg-[var(--muted)] font-semibold text-[var(--foreground)]"
          )}
        >
          <Link href="/downloads" onClick={handleLinkClick}>
            <Download className="w-5 h-5 mr-3 shrink-0 text-red-600" />
            <span>Downloads</span>
          </Link>
        </Button>
      </div>

      <div className="border-t border-[var(--border)] pt-2 mt-2 space-y-1">
        <div className="px-3 py-1 text-xs font-semibold text-[var(--muted-foreground)]">
          You
        </div>
        <Button
          asChild
          variant="ghost"
          className={cn(
            "w-full justify-start font-normal text-sm text-[var(--foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] dark:hover:text-white rounded-xl px-3 py-2.5 h-11 transition-colors touch-target-44",
            router.pathname.startsWith("/channel") && "bg-[var(--muted)] font-semibold text-[var(--foreground)]"
          )}
        >
          <Link href={`/channel/${user?._id || user?.result?._id || "1"}`} onClick={handleLinkClick}>
            <User className="w-5 h-5 mr-3 shrink-0" />
            <span>Your channel</span>
          </Link>
        </Button>

        <Button
          variant="ghost"
          onClick={() => {
            setIsUploadDialogOpen(true)
            if (onCloseMobile) onCloseMobile()
          }}
          className="w-full justify-start font-normal text-sm text-[var(--foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] dark:hover:text-white rounded-xl px-3 py-2.5 h-11 transition-colors touch-target-44"
        >
          <Upload className="w-5 h-5 mr-3 shrink-0 text-red-600" />
          <span>Upload video</span>
        </Button>

        <Button
          variant="ghost"
          onClick={() => {
            setIsChannelDialogOpen(true)
            if (onCloseMobile) onCloseMobile()
          }}
          className="w-full justify-start font-normal text-sm text-[var(--foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] dark:hover:text-white rounded-xl px-3 py-2.5 h-11 transition-colors touch-target-44"
        >
          <PlusCircle className="w-5 h-5 mr-3 shrink-0" />
          <span>Create channel</span>
        </Button>
      </div>

      {/* Premium & Subscriptions Hub */}
      <div className="border-t border-[var(--border)] pt-2 mt-2 space-y-1">
        <Button
          asChild
          variant="ghost"
          className={cn(
            "w-full justify-start font-normal text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl px-3 py-2.5 h-11 transition-colors touch-target-44",
            router.pathname === "/pricing" && "bg-red-50 dark:bg-red-950/40 font-semibold"
          )}
        >
          <Link href="/pricing" onClick={handleLinkClick}>
            <Sparkles className="w-5 h-5 mr-3 shrink-0 text-red-600" />
            <span>Get Premium</span>
          </Link>
        </Button>

        <Button
          asChild
          variant="ghost"
          className={cn(
            "w-full justify-start font-normal text-sm text-[var(--foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] dark:hover:text-white rounded-xl px-3 py-2.5 h-11 transition-colors touch-target-44",
            router.pathname.startsWith("/subscription") && "bg-[var(--muted)] font-semibold text-[var(--foreground)]"
          )}
        >
          <Link href="/subscription" onClick={handleLinkClick}>
            <Crown className="w-5 h-5 mr-3 shrink-0 text-amber-500" />
            <span>My Subscription</span>
          </Link>
        </Button>

        <Button
          asChild
          variant="ghost"
          className={cn(
            "w-full justify-start font-normal text-sm text-[var(--foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] dark:hover:text-white rounded-xl px-3 py-2.5 h-11 transition-colors touch-target-44",
            router.pathname.startsWith("/billing") && "bg-[var(--muted)] font-semibold text-[var(--foreground)]"
          )}
        >
          <Link href="/billing" onClick={handleLinkClick}>
            <Receipt className="w-5 h-5 mr-3 shrink-0 text-emerald-600" />
            <span>Billing & Invoices</span>
          </Link>
        </Button>
      </div>

      {/* Admin Suite for Administrator Accounts */}
      {(user?.role === "admin" || user?.result?.role === "admin") && (
        <div className="border-t border-[var(--border)] pt-2 mt-2 space-y-1">
          <div className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
            <span>Admin Suite</span>
          </div>
          <Button
            asChild
            variant="ghost"
            className={cn(
              "w-full justify-start font-normal text-sm text-[var(--foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] dark:hover:text-white rounded-xl px-3 py-2.5 h-11 transition-colors touch-target-44",
              router.pathname.startsWith("/admin/subscriptions") && "bg-[var(--muted)] font-semibold text-[var(--foreground)]"
            )}
          >
            <Link href="/admin/subscriptions" onClick={handleLinkClick}>
              <BarChart3 className="w-5 h-5 mr-3 shrink-0 text-amber-600" />
              <span>Sub Analytics</span>
            </Link>
          </Button>

          <Button
            asChild
            variant="ghost"
            className={cn(
              "w-full justify-start font-normal text-sm text-[var(--foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] dark:hover:text-white rounded-xl px-3 py-2.5 h-11 transition-colors touch-target-44",
              router.pathname.startsWith("/admin/security") && "bg-[var(--muted)] font-semibold text-[var(--foreground)]"
            )}
          >
            <Link href="/admin/security" onClick={handleLinkClick}>
              <ShieldAlert className="w-5 h-5 mr-3 shrink-0 text-red-600" />
              <span>Security & Fraud</span>
            </Link>
          </Button>
        </div>
      )}

      {/* Theme Appearance Section */}
      <div className="border-t border-[var(--border)] pt-3 mt-3 px-1 pb-4">
        <div className="px-2 pb-1.5 text-xs font-semibold text-[var(--muted-foreground)] flex items-center gap-1.5">
          <Moon className="w-3.5 h-3.5 text-indigo-400" />
          <span>Theme Appearance</span>
        </div>
        <ThemeToggle variant="segmented" showDetails={true} />
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:block w-60 shrink-0 min-h-[calc(100vh-56px)] p-3 pb-28 bg-[var(--sidebar)] text-[var(--foreground)] border-r border-[var(--border)] select-none transition-colors duration-200 overflow-y-auto">
        {renderNavLinks()}
      </aside>

      {/* Mobile Slide-Over Drawer */}
      {isMobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
            onClick={onCloseMobile}
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <div className="relative w-72 max-w-[85vw] h-full bg-[var(--sidebar)] text-[var(--foreground)] p-4 shadow-2xl flex flex-col overflow-y-auto z-10 border-r border-[var(--border)] animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] mb-3">
              <div className="flex items-center gap-2">
                <div className="relative flex h-6 w-8 items-center justify-center rounded-lg bg-[#FF0000] px-1 py-0.5 shadow-sm">
                  <div className="h-0 w-0 border-y-[5px] border-y-transparent border-l-[9px] border-l-white ml-0.5" />
                </div>
                <span className="text-lg font-bold tracking-tighter text-[var(--foreground)]">YouTube</span>
                <span className="text-[10px] -mt-2 text-[var(--muted-foreground)] font-semibold">IN</span>
              </div>
              <button
                onClick={onCloseMobile}
                className="p-2 rounded-full hover:bg-[var(--muted)] text-[var(--foreground)] cursor-pointer"
                aria-label="Close navigation menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {renderNavLinks()}
          </div>
        </div>
      )}

      <ChannelDialogue
        isopen={isChannelDialogOpen}
        onclose={() => setIsChannelDialogOpen(false)}
        mode="create"
      />

      <VideoUploadDialog
        isOpen={isUploadDialogOpen}
        onClose={() => setIsUploadDialogOpen(false)}
        onUploadSuccess={() => {
          if (router.pathname === "/" || router.pathname.startsWith("/channel")) {
            router.replace(router.asPath)
          }
        }}
      />
    </>
  )
}

export default Sidebar
