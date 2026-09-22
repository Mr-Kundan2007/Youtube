import React from "react"
import Head from "next/head"
import WatchLaterContent from "@/components/WatchLaterContent"

export default function WatchLaterPage() {
  return (
    <>
      <Head>
        <title>Watch later - YouTube</title>
      </Head>
      <div className="bg-[var(--background)] text-[var(--foreground)] min-h-screen">
        <WatchLaterContent />
      </div>
    </>
  )
}
