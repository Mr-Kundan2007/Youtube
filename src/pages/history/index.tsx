import React from "react"
import Head from "next/head"
import HistoryContent from "@/components/HistoryContent"

export default function HistoryPage() {
  return (
    <>
      <Head>
        <title>Watch History - YouTube</title>
      </Head>
      <div className="bg-[var(--background)] text-[var(--foreground)] min-h-screen">
        <HistoryContent />
      </div>
    </>
  )
}
