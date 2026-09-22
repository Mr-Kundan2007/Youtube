import React from "react"
import Link from "next/link"
import { useRouter } from "next/router"
import {
  BarChart3,
  Users,
  Layers,
  CreditCard,
  FileSpreadsheet,
  Download,
  ShieldAlert,
  MessageSquareWarning,
  ArrowLeft,
} from "lucide-react"
import { Button } from "@/components/ui/button"

interface AdminSubscriptionNavProps {
  title: string
  description?: string
  actionSlot?: React.ReactNode
}

export const AdminSubscriptionNav: React.FC<AdminSubscriptionNavProps> = ({
  title,
  description,
  actionSlot,
}) => {
  const router = useRouter()
  const currentPath = router.pathname

  const navItems = [
    {
      label: "Analytics & Overview",
      href: "/admin/subscriptions",
      icon: BarChart3,
      isActive: currentPath === "/admin/subscriptions",
    },
    {
      label: "Subscribers",
      href: "/admin/subscribers",
      icon: Users,
      isActive: currentPath.startsWith("/admin/subscribers"),
    },
    {
      label: "Subscription Plans",
      href: "/admin/subscription-plans",
      icon: Layers,
      isActive: currentPath === "/admin/subscription-plans",
    },
    {
      label: "Payments Oversight",
      href: "/admin/payments",
      icon: CreditCard,
      isActive: currentPath === "/admin/payments",
    },
    {
      label: "Reports & CSV Export",
      href: "/admin/reports/subscriptions",
      icon: FileSpreadsheet,
      isActive: currentPath.startsWith("/admin/reports"),
    },
    {
      label: "Downloads Admin",
      href: "/admin/downloads",
      icon: Download,
      isActive: currentPath === "/admin/downloads",
    },
    {
      label: "Security & Fraud",
      href: "/admin/security",
      icon: ShieldAlert,
      isActive: currentPath.startsWith("/admin/security"),
    },
    {
      label: "Comment Moderation",
      href: "/admin/moderation",
      icon: MessageSquareWarning,
      isActive: currentPath.startsWith("/admin/moderation"),
    },
  ]

  return (
    <div className="space-y-4 mb-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200/80 pb-5">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-neutral-900 text-white flex items-center justify-center font-bold text-sm shadow-sm shrink-0">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight">
                {title}
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-amber-100 text-amber-800 border border-amber-200">
                Admin Suite
              </span>
            </div>
            {description && (
              <p className="text-neutral-500 text-xs mt-0.5 max-w-2xl">{description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {actionSlot}
          <Link href="/">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl text-xs font-medium cursor-pointer border-neutral-200 hover:bg-neutral-100"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              Platform Home
            </Button>
          </Link>
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin border-b border-neutral-200/60">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                item.isActive
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs"
                  : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white"
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${item.isActive ? "text-amber-400" : "text-neutral-500"}`} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

export default AdminSubscriptionNav
