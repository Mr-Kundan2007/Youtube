import React, { useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"

export interface ChannelInfo {
  id?: string | number
  _id?: string | number
  name?: string
  channelname?: string
  handle?: string
  description?: string
  subscribers?: string
  bannerUrl?: string
  avatarUrl?: string
  image?: string
}

interface ChannelHeaderProps {
  channel?: ChannelInfo | null
  user?: any
}

export default function ChannelHeader({
  channel,
  user,
}: ChannelHeaderProps) {
  const [isSubscribed, setIsSubscribed] = useState(false)

  const displayName =
    channel?.channelname || channel?.name || user?.channelname || user?.name || "Tech Channel"
  const displayHandle =
    channel?.handle || `@${displayName.toLowerCase().replace(/\s+/g, "")}`
  const displayDesc =
    channel?.description ||
    user?.description ||
    user?.desc ||
    "Welcome to our tech channel! We cover the latest in technology, reviews, and tutorials."
  const displayImage = channel?.image || channel?.avatarUrl || user?.image || ""
  const initial = displayName ? displayName[0].toUpperCase() : "T"

  return (
    <div className="w-full bg-[var(--background)] text-[var(--foreground)]">
      {/* Banner */}
      <div className="relative h-28 sm:h-40 md:h-52 lg:h-64 bg-gradient-to-r from-red-600 via-rose-600 to-indigo-700 overflow-hidden shadow-inner" />

      {/* Channel Info */}
      <div className="px-4 py-6 sm:px-8 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center sm:items-center text-center sm:text-left gap-4 sm:gap-6">
          <Avatar className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 ring-4 ring-[var(--background)] shadow-xl shrink-0 -mt-12 sm:-mt-16">
            {displayImage ? (
              <AvatarImage src={displayImage} alt={displayName} />
            ) : null}
            <AvatarFallback className="text-3xl md:text-4xl font-extrabold bg-[var(--muted)] text-[var(--foreground)]">
              {initial}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 space-y-1.5 min-w-0">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[var(--foreground)] tracking-tight">
              {displayName}
            </h1>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs sm:text-sm text-[var(--muted-foreground)] font-medium">
              <span>{displayHandle}</span>
              <span>•</span>
              <span>1.2M subscribers</span>
            </div>
            {displayDesc && (
              <p className="text-xs sm:text-sm text-[var(--muted-foreground)] max-w-2xl leading-relaxed mx-auto sm:mx-0">
                {displayDesc}
              </p>
            )}

            <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-3">
              <Button
                onClick={() => setIsSubscribed(!isSubscribed)}
                className={`rounded-full px-6 h-9 text-sm font-semibold transition-colors cursor-pointer ${
                  isSubscribed
                    ? "bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--muted-hover)] hover:text-[var(--foreground)] dark:hover:text-white"
                    : "bg-red-600 text-white hover:bg-red-700"
                }`}
              >
                {isSubscribed ? "Subscribed" : "Subscribe"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export { ChannelHeader }
