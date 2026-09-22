import React, { useState } from "react"
import Head from "next/head"
import { useRouter } from "next/router"
import { useAuth } from "@/lib/AuthContext"
import MeetingLobbyStub from "@/features/meetings/components/MeetingLobbyStub"
import { meetingApi } from "@/features/meetings/services/meetingApi"

export default function MeetLobbyPage() {
  const router = useRouter()
  const { user }: any = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreateMeeting = async (customName?: string) => {
    try {
      setIsLoading(true)
      setError(null)
      const hostName = customName || user?.channelname || user?.name || "Host"
      const res = await meetingApi.createMeeting({
        title: `${hostName}'s Meeting`,
      })
      if (res?.roomId) {
        if (typeof window !== "undefined") {
          try {
            const hostSessionData = JSON.stringify({
              token: res.token,
              role: res.role || "HOST",
              identity: res.identity,
              livekitUrl: res.livekitUrl,
              meeting: (res as any).meeting,
            })
            sessionStorage.setItem(`instant_host_${res.roomId}`, hostSessionData)
            localStorage.setItem(`instant_host_${res.roomId}`, hostSessionData)
          } catch (e) {}
        }
        router.push(`/meet/${res.roomId}?name=${encodeURIComponent(hostName)}&host=true`)
      }
    } catch (err: any) {
      console.error("Create meeting error:", err)
      const msg =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to create meeting room. Please try again."
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }

  const handleJoinMeeting = (roomId: string, name: string) => {
    if (!roomId) return
    router.push(`/meet/${roomId}${name ? `?name=${encodeURIComponent(name)}` : ""}`)
  }

  return (
    <>
      <Head>
        <title>Video Meetings - YouTube Clone</title>
        <meta name="description" content="Start or join secure real-time video meetings." />
      </Head>

      <div className="bg-[var(--background,#ffffff)] dark:bg-neutral-950 text-[var(--foreground,#0f0f0f)] dark:text-white min-h-[calc(100vh-64px)] py-4 sm:py-6 px-2 sm:px-4">
        {error && (
          <div className="max-w-md mx-auto mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg text-center">
            {error}
          </div>
        )}

        <MeetingLobbyStub
          initialName={user?.channelname || user?.name || ""}
          onCreateMeeting={handleCreateMeeting}
          onJoinMeeting={handleJoinMeeting}
          isLoading={isLoading}
        />
      </div>
    </>
  )
}
