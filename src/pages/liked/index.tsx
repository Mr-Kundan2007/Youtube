import React from "react"
import Head from "next/head"
import LikedContent from "@/components/LikedContent"

export default function LikedPage() {
  return (
    <>
      <Head>
        <title>Liked videos - YouTube</title>
      </Head>
      <div className="bg-[var(--background)] text-[var(--foreground)] min-h-screen">
        <LikedContent />
      </div>
    </>
  )
}
