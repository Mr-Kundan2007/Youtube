import React, { useState, useRef } from "react"
import { Upload, FileText, X, CheckCircle2, AlertCircle } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import axiosInstance from "@/lib/axiosinstance"
import { useAuth } from "@/lib/AuthContext"

interface VideoUploaderProps {
  channelId?: string | number
  channelName?: string
  onUploadSuccess?: (newVideo: any) => void
  onClose?: () => void
}

export default function VideoUploader({
  channelId,
  channelName,
  onUploadSuccess,
  onClose,
}: VideoUploaderProps) {
  const { user }: any = useAuth()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [videoTitle, setVideoTitle] = useState("")
  const [isDragging, setIsDragging] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const effectiveChannelName =
    channelName || user?.channelname || user?.name || "Tech Channel"
  const effectiveChannelId =
    channelId || user?._id || user?.id || "1"

  const handleSelectFile = (file: File) => {
    if (!file) return
    setSelectedFile(file)
    setErrorMsg(null)
    setIsComplete(false)
    const rawName = file.name.replace(/\.[^/.]+$/, "")
    setVideoTitle(rawName)
  }

  const handleReset = () => {
    setSelectedFile(null)
    setVideoTitle("")
    setUploadProgress(null)
    setIsUploading(false)
    setIsComplete(false)
    setErrorMsg(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      setErrorMsg("Please select a video file first.")
      return
    }

    if (!videoTitle.trim()) {
      setErrorMsg("Please enter a title for the video.")
      return
    }

    setIsUploading(true)
    setUploadProgress(15)
    setErrorMsg(null)

    const formData = new FormData()
    formData.append("file", selectedFile)
    formData.append("videotitle", videoTitle.trim())
    formData.append("videochanel", effectiveChannelName)
    formData.append("channelId", String(effectiveChannelId))
    formData.append("uploader", String(user?._id || effectiveChannelId))
    formData.append("description", `Uploaded by ${effectiveChannelName}`)
    formData.append("duration", "0:30")

    try {
      const response = await axiosInstance.post("/video/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total)
            setUploadProgress(Math.min(percent, 95))
          }
        },
      })

      setUploadProgress(100)
      setIsComplete(true)
      setIsUploading(false)

      const savedVideo = response.data

      setTimeout(() => {
        if (onUploadSuccess) {
          onUploadSuccess({
            _id: savedVideo._id,
            id: savedVideo._id,
            videotitle: savedVideo.videotitle,
            videochanel: savedVideo.videochanel,
            views: savedVideo.views || 0,
            createdAt: savedVideo.createdAt || new Date().toISOString(),
            duration: savedVideo.duration || "0:30",
            thumbnailUrl: savedVideo.thumbnailUrl || "/video/snowglobe.jpg",
            videoUrl: savedVideo.videoUrl || savedVideo.videofilepath || "/video/vdo.mp4",
            videofilepath: savedVideo.videofilepath || savedVideo.videoUrl || "/video/vdo.mp4",
            description: savedVideo.description,
          })
        }
        handleReset()
      }, 1000)
    } catch (error: any) {
      console.error("Video upload to database failed:", error)
      setIsUploading(false)
      setUploadProgress(null)
      setErrorMsg(
        error?.response?.data?.message ||
        error?.message ||
        "Failed to upload video to the database. Make sure backend is running."
      )
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleSelectFile(e.dataTransfer.files[0])
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleSelectFile(e.target.files[0])
    }
  }

  return (
    <div className="w-full">
      <h2 className="text-base font-semibold text-neutral-900 dark:text-white mb-3 text-center sm:text-left">
        Upload a video
      </h2>

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,.mp4,.webm,.mov,.avi"
        onChange={handleInputChange}
        className="hidden"
      />

      {errorMsg && (
        <div className="mb-3 flex items-center justify-center sm:justify-start gap-2 p-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-lg text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {!selectedFile ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-6 sm:p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
            isDragging
              ? "border-red-600 bg-neutral-100 dark:bg-neutral-800"
              : "border-neutral-300 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-600 hover:bg-neutral-50/60 dark:hover:bg-neutral-900/60"
          }`}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 mb-2">
            <Upload className="h-6 w-6 stroke-[1.75]" />
          </div>

          <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 mt-1">
            Drag and drop video files to upload
          </p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            or tap to browse files
          </p>
          <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-2">
            MP4, WebM, MOV or AVI • Up to 100MB
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* File Card with Icon, Name, Size, and Clear button */}
          <div className="flex items-center justify-between p-3.5 border border-neutral-200 dark:border-neutral-800 rounded-xl bg-neutral-50 dark:bg-neutral-900">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="p-2 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleReset}
              disabled={isUploading}
              className="text-neutral-400 hover:text-neutral-700 dark:hover:text-white p-2 rounded-full cursor-pointer transition-colors"
              aria-label="Remove selected file"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Title (required) label & input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
              Title (required)
            </label>
            <input
              type="text"
              value={videoTitle}
              onChange={(e) => setVideoTitle(e.target.value)}
              placeholder="e.g. My Awesome Video"
              disabled={isUploading}
              className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2.5 text-sm text-neutral-900 dark:text-white focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600"
            />
          </div>

          {/* Upload progress during submission */}
          {uploadProgress !== null && (
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-xs font-medium text-neutral-600 dark:text-neutral-400">
                <span>
                  {isComplete
                    ? "Upload complete! Saving to database..."
                    : "Uploading to database..."}
                </span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
            </div>
          )}

          {isComplete && (
            <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs text-green-600 dark:text-green-400 font-medium pt-1">
              <CheckCircle2 className="h-4 w-4" />
              <span>Upload complete! Saved to database.</span>
            </div>
          )}

          {/* Action buttons: Cancel & Upload */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              disabled={isUploading}
              className="w-full sm:w-auto rounded-lg border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs px-4 h-10 sm:h-9 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleUpload}
              disabled={isUploading || !videoTitle.trim()}
              className="w-full sm:w-auto rounded-lg bg-red-600 text-white hover:bg-red-700 text-xs px-5 h-10 sm:h-9 cursor-pointer font-medium"
            >
              {isUploading ? "Uploading..." : "Upload Video"}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export { VideoUploader }
