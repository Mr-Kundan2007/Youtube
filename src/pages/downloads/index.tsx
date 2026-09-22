import React from "react"
import Head from "next/head"
import DownloadsContent from "@/components/DownloadsContent"

export default function DownloadsPage() {
  return (
    <>
      <Head>
        <title>Your Downloads - YouTube</title>
        <meta
          name="description"
          content="Manage your offline video downloads, subscription plan quotas, and download history."
        />
      </Head>
      <div className="bg-white min-h-screen">
        <DownloadsContent />
      </div>
    </>
  )
}
