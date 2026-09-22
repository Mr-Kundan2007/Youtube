import React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import VideoUploader from "@/components/VideoUploader"
import { useAuth } from "@/lib/AuthContext"

interface VideoUploadDialogProps {
  isOpen: boolean
  onClose: () => void
  onUploadSuccess?: (newVideo: any) => void
}

export default function VideoUploadDialog({
  isOpen,
  onClose,
  onUploadSuccess,
}: VideoUploadDialogProps) {
  const { user }: any = useAuth()

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-xl p-5 sm:p-6 overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-[var(--background,#ffffff)] dark:bg-neutral-950 text-[var(--foreground,#0f0f0f)] dark:text-white rounded-2xl shadow-2xl">
        <DialogHeader className="text-center sm:text-left">
          <DialogTitle className="text-lg font-bold text-center sm:text-left">Upload Video</DialogTitle>
        </DialogHeader>
        <VideoUploader
          channelId={user?._id || user?.id || "1"}
          channelName={user?.channelname || user?.name || "My Channel"}
          onUploadSuccess={(video) => {
            if (onUploadSuccess) onUploadSuccess(video)
          }}
          onClose={onClose}
        />
      </DialogContent>
    </Dialog>
  )
}

export { VideoUploadDialog }
