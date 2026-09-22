import React from "react"
import Head from "next/head"
import DownloadsContent from "@/components/DownloadsContent"

export default function ProfileDownloadsPage() {
  return (
    <>
      <Head>
        <title>Download Center - Profile - YouTube</title>
        <meta
          name="description"
          content="Manage your personal video downloads, subscription quotas, registered devices, notifications, and download preferences."
        />
      </Head>
      <div className="bg-white min-h-screen">
        <DownloadsContent />
      </div>
    </>
  )
}
