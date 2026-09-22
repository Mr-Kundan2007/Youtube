import React, { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/router"
import {
  Menu,
  Search,
  Mic,
  Video,
  Bell,
  Settings,
  HelpCircle,
  Moon,
  LogOut,
  User,
  Plus,
  X,
  MicOff,
  Upload,
  Download,
  Crown,
  Sparkles,
  ArrowLeft,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu"
import ChannelDialogue from "@/components/channeldialogue"
import VideoUploadDialog from "@/components/VideoUploadDialog"
import { useAuth } from "@/lib/AuthContext"
import NotificationBellDropdown from "@/components/notifications/NotificationBellDropdown"
import { useTheme } from "@/context/ThemeContext"
import { ThemeToggle } from "@/components/ThemeToggle"

interface HeaderProps {
  onToggleSidebar?: () => void
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const router = useRouter()
  const { user, openAuthModal, logout }: any = useAuth()
  const { themeMode, activeTheme } = useTheme()
  const [searchQuery, setSearchQuery] = useState("")
  const [isChannelDialogOpen, setIsChannelDialogOpen] = useState(false)
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isMobileSearchActive, setIsMobileSearchActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync searchQuery from router.query.q if on search page
  useEffect(() => {
    if (router.pathname === "/search") {
      const q = Array.isArray(router.query.q)
        ? router.query.q[0]
        : router.query.q || ""
      setSearchQuery(q)
    }
  }, [router.pathname, router.query.q])

  const executeSearch = (query: string) => {
    const trimmed = query.trim()
    if (trimmed) {
      router.push(`/search?q=${encodeURIComponent(trimmed)}`)
    } else {
      router.push("/search")
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    executeSearch(searchQuery)
  }

  const handleClear = () => {
    setSearchQuery("")
    inputRef.current?.focus()
  }

  const handleVoiceSearch = () => {
    if (typeof window === "undefined") return

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition

    if (!SpeechRecognition) {
      alert("Voice search is not supported in this browser.")
      return
    }

    try {
      const recognition = new SpeechRecognition()
      recognition.lang = "en-US"
      recognition.continuous = false
      recognition.interimResults = false

      recognition.onstart = () => {
        setIsListening(true)
      }

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript
        setSearchQuery(transcript)
        executeSearch(transcript)
      }

      recognition.onerror = () => {
        setIsListening(false)
      }

      recognition.onend = () => {
        setIsListening(false)
      }

      recognition.start()
    } catch (err) {
      setIsListening(false)
    }
  }

  return (
    <>
      <header className="sticky top-0 z-50 flex h-14 w-full items-center justify-between bg-[var(--header)] px-2 sm:px-4 border-b border-[var(--border)] transition-colors duration-200">
        {/* Full-width Mobile Search Bar */}
        {isMobileSearchActive ? (
          <div className="flex w-full items-center gap-2 animate-in fade-in duration-150">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full hover:bg-[var(--muted)] text-[var(--foreground)] shrink-0"
              onClick={() => setIsMobileSearchActive(false)}
              aria-label="Back to navigation"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <form onSubmit={handleSearch} className="flex-1 flex items-center">
              <div className="relative flex w-full items-center">
                <Input
                  ref={inputRef}
                  autoFocus
                  type="text"
                  placeholder="Search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-10 w-full rounded-full border border-[var(--border)] bg-[var(--background)] pl-4 pr-10 text-sm text-[var(--foreground)] shadow-inner placeholder:text-[var(--muted-foreground)] focus-visible:border-blue-600 focus-visible:ring-1 focus-visible:ring-blue-600"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="absolute right-3 text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </form>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleVoiceSearch}
              className={`h-10 w-10 shrink-0 rounded-full transition-all ${
                isListening
                  ? "bg-red-500 text-white animate-pulse"
                  : "bg-[var(--muted)] hover:bg-[var(--muted-hover)] text-[var(--foreground)]"
              }`}
              aria-label="Search with voice"
            >
              {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>
          </div>
        ) : (
          <>
            {/* Left: Menu & Logo */}
            <div className="flex items-center gap-2 sm:gap-4">
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-full hover:bg-[var(--muted)] text-[var(--foreground)] cursor-pointer"
                onClick={onToggleSidebar}
                aria-label="Toggle menu"
              >
                <Menu className="h-5 w-5" />
              </Button>

              <Link href="/" className="flex items-center gap-1">
                <div className="flex items-center">
                  {/* YouTube Icon */}
                  <div className="relative flex h-6 w-8 items-center justify-center rounded-lg bg-[#FF0000] px-1 py-0.5 shadow-sm">
                    <div className="h-0 w-0 border-y-[5px] border-y-transparent border-l-[9px] border-l-white ml-0.5" />
                  </div>
                  <span className="ml-1 text-lg font-bold tracking-tighter text-[var(--foreground)] font-sans">
                    YouTube
                  </span>
                  <span className="ml-0.5 -mt-2 text-[10px] font-normal text-[var(--muted-foreground)]">
                    IN
                  </span>
                </div>
              </Link>
            </div>

            {/* Center: Desktop Search Bar & Voice Search */}
            <div className="hidden sm:flex flex-1 max-w-[720px] items-center justify-center px-4">
              <form
                onSubmit={handleSearch}
                className="flex w-full max-w-[600px] items-center"
              >
                <div className="relative flex w-full items-center">
                  <Input
                    ref={inputRef}
                    type="text"
                    placeholder="Search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-10 w-full rounded-l-full rounded-r-none border border-r-0 border-[var(--border)] bg-[var(--background)] pl-4 pr-9 text-sm text-[var(--foreground)] shadow-inner placeholder:text-[var(--muted-foreground)] focus-visible:border-blue-600 focus-visible:ring-1 focus-visible:ring-blue-600"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={handleClear}
                      className="absolute right-3 text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer"
                      aria-label="Clear search"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <Button
                  type="submit"
                  variant="outline"
                  className="h-10 rounded-l-none rounded-r-full border border-[var(--border)] bg-[var(--muted)] text-[var(--foreground)] px-6 hover:bg-[var(--muted-hover)] cursor-pointer shrink-0"
                  aria-label="Search"
                >
                  <Search className="h-5 w-5" />
                </Button>
              </form>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleVoiceSearch}
                className={`ml-3 h-10 w-10 shrink-0 rounded-full transition-all ${
                  isListening
                    ? "bg-red-500 text-white animate-pulse"
                    : "bg-[var(--muted)] hover:bg-[var(--muted-hover)] text-[var(--foreground)]"
                }`}
                aria-label="Search with voice"
                title={isListening ? "Listening..." : "Search with voice"}
              >
                {isListening ? (
                  <MicOff className="h-5 w-5" />
                ) : (
                  <Mic className="h-5 w-5" />
                )}
              </Button>
            </div>

            {/* Right: Actions & User Avatar */}
            <div className="flex items-center gap-1 sm:gap-2">
              {/* Mobile Search Button trigger */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMobileSearchActive(true)}
                className="sm:hidden h-10 w-10 rounded-full hover:bg-[var(--muted)] text-[var(--foreground)] cursor-pointer"
                aria-label="Search"
              >
                <Search className="h-5 w-5" />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-full hover:bg-[var(--muted)] text-[var(--foreground)] cursor-pointer"
                    aria-label="Create"
                  >
                    <Video className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-[var(--card)] text-[var(--card-foreground)] border-[var(--border)]">
              <DropdownMenuItem
                onClick={() => setIsUploadDialogOpen(true)}
                className="cursor-pointer"
              >
                <Upload className="mr-2 h-4 w-4 text-red-600" />
                <span>Upload video</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push("/meet")}
                className="cursor-pointer"
              >
                <Video className="mr-2 h-4 w-4 text-neutral-600" />
                <span>Go live</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setIsChannelDialogOpen(true)}
                className="cursor-pointer"
              >
                <Plus className="mr-2 h-4 w-4 text-neutral-600" />
                <span>Create channel</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Link
            href="/pricing"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-700 dark:text-red-400 text-xs font-bold border border-red-200 dark:border-red-800/50 transition-colors"
          >
            <Crown className="w-3.5 h-3.5 text-amber-500" />
            <span>Premium</span>
          </Link>

          <NotificationBellDropdown />

          {/* Dedicated Theme Toggle Button */}
          <ThemeToggle variant="compact" className="shrink-0" />

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Avatar className="h-8 w-8 cursor-pointer ring-2 ring-transparent hover:ring-[var(--border)]">
                  <AvatarImage
                    src={user.image || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"}
                    alt={user.name || "Profile"}
                  />
                  <AvatarFallback className="bg-gradient-to-tr from-purple-600 to-indigo-600 text-xs font-semibold text-white">
                    {user.name ? user.name[0].toUpperCase() : "U"}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-[var(--card)] text-[var(--card-foreground)] border-[var(--border)]">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none text-[var(--foreground)]">{user.name || "YouTube User"}</p>
                    <p className="text-xs leading-none text-[var(--muted-foreground)]">
                      @{user.email ? user.email.split("@")[0] : "user"}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => router.push("/subscription")}
                  className="cursor-pointer"
                >
                  <Crown className="mr-2 h-4 w-4 text-amber-500" />
                  <span className="font-semibold text-[var(--foreground)]">My Subscription</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => router.push("/pricing")}
                  className="cursor-pointer"
                >
                  <Sparkles className="mr-2 h-4 w-4 text-red-600" />
                  <span className="font-semibold text-red-600">Get Premium</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => router.push(`/channel/${user._id || "1"}`)}
                  className="cursor-pointer"
                >
                  <User className="mr-2 h-4 w-4" />
                  <span>Your channel</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => router.push("/downloads")}
                  className="cursor-pointer"
                >
                  <Download className="mr-2 h-4 w-4" />
                  <span>Downloads</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setIsUploadDialogOpen(true)}
                  className="cursor-pointer"
                >
                  <Upload className="mr-2 h-4 w-4 text-red-600" />
                  <span className="font-medium text-red-600">Upload video</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setIsChannelDialogOpen(true)}
                  className="cursor-pointer"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  <span>Create channel</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => router.push("/settings")}
                  className="cursor-pointer"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>

                {/* Appearance Submenu with IST Theme Toggle */}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="cursor-pointer">
                    <Moon className="mr-2 h-4 w-4 text-indigo-400" />
                    <span>
                      Appearance: {themeMode === "automatic" ? `Auto (${activeTheme})` : themeMode === "light" ? "Light" : "Dark"}
                    </span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-64 p-2 bg-[var(--card)] text-[var(--card-foreground)] border-[var(--border)]">
                    <div className="px-2 py-1 text-xs font-semibold text-[var(--muted-foreground)]">
                      Appearance (Theme)
                    </div>
                    <ThemeToggle variant="list" showDetails={true} />
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuItem className="cursor-pointer">
                  <HelpCircle className="mr-2 h-4 w-4" />
                  <span>Help</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => logout()}
                  className="text-red-600 dark:text-red-400 cursor-pointer hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              onClick={() => openAuthModal()}
              variant="outline"
              className="flex items-center gap-2 rounded-full border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 px-4 h-9 text-xs font-semibold cursor-pointer"
            >
              <User className="h-4 w-4" />
              <span>Sign in</span>
            </Button>
          )}
        </div>
      </>
    )}
  </header>

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

export default Header
