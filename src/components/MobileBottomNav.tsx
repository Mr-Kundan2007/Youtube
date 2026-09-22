import React from "react"
import Link from "next/link"
import { useRouter } from "next/router"
import { Home, Compass, PlaySquare, Download, User, Crown } from "lucide-react"
import { useAuth } from "@/lib/AuthContext"
import { cn } from "@/lib/utils"

export const MobileBottomNav = () => {
  const router = useRouter()
  const { user }: any = useAuth()

  const navItems = [
    {
      label: "Home",
      href: "/",
      icon: Home,
      isActive: router.pathname === "/",
    },
    {
      label: "Explore",
      href: "/explore",
      icon: Compass,
      isActive: router.pathname === "/explore",
    },
    {
      label: "Subscriptions",
      href: "/subscriptions",
      icon: PlaySquare,
      isActive: router.pathname === "/subscriptions" || router.pathname === "/pricing",
    },
    {
      label: "Downloads",
      href: "/downloads",
      icon: Download,
      isActive: router.pathname.startsWith("/downloads"),
    },
    {
      label: "You",
      href: user ? `/channel/${user._id || user.id || "1"}` : "/settings",
      icon: User,
      isActive: router.pathname.startsWith("/channel") || router.pathname === "/settings",
    },
  ]

  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--header)]/95 backdrop-blur-md border-t border-[var(--border)] flex items-center justify-around px-1 py-1 pb-safe transition-colors duration-200"
    >
      {navItems.map((item) => {
        const Icon = item.icon
        return (
          <Link
            key={item.label}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 px-2 rounded-xl transition-all duration-150 text-center select-none",
              item.isActive
                ? "text-red-600 dark:text-red-500 font-semibold"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            )}
          >
            <div className="relative flex items-center justify-center">
              <Icon className={cn("w-5 h-5 transition-transform duration-150", item.isActive && "scale-110")} />
              {item.label === "Subscriptions" && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-600 ring-2 ring-[var(--header)]" />
              )}
            </div>
            <span className="text-[10px] mt-1 leading-tight tracking-tight">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

export default MobileBottomNav
