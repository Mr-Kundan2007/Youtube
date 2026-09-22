"use client"

import React, { useState, useRef, useEffect } from "react"
import { MeetingChatMessageItem } from "../types/meeting"
import { meetingApi } from "../services/meetingApi"
import {
  X,
  Send,
  Paperclip,
  Download,
  FileText,
  Image as ImageIcon,
  Smile,
  AlertCircle,
} from "lucide-react"

interface ChatPanelProps {
  roomId: string
  messages: MeetingChatMessageItem[]
  isOpen: boolean
  onClose: () => void
  onSendMessage: (text: string) => Promise<void>
  onUploadAttachment: (file: File, text?: string) => Promise<void>
  uploadProgress: number | null
  allowChat?: boolean
  allowFileSharing?: boolean
  currentUserId?: string
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  roomId,
  messages,
  isOpen,
  onClose,
  onSendMessage,
  onUploadAttachment,
  uploadProgress,
  allowChat = true,
  allowFileSharing = true,
  currentUserId,
}) => {
  const [inputText, setInputText] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, isOpen])

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!inputText.trim() || isSending || !allowChat) return

    setIsSending(true)
    setErrorMessage(null)
    try {
      await onSendMessage(inputText.trim())
      setInputText("")
    } catch (err: any) {
      setErrorMessage("Failed to send message. Please try again.")
    } finally {
      setIsSending(false)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !allowFileSharing) return

    // 25MB check
    if (file.size > 25 * 1024 * 1024) {
      setErrorMessage("File size exceeds 25MB limit.")
      return
    }

    setErrorMessage(null)
    try {
      await onUploadAttachment(file)
    } catch (err) {
      setErrorMessage("Failed to upload file.")
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "0 KB"
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <>
      {/* Backdrop for mobile */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 sm:hidden animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="chat-dialog-title"
        className="fixed z-40 bg-zinc-950/95 backdrop-blur-xl border-white/10 flex flex-col shadow-2xl animate-in duration-200
          max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-14 max-sm:rounded-t-3xl max-sm:border-t max-sm:slide-in-from-bottom pb-safe
          sm:inset-y-0 sm:right-0 sm:w-80 md:w-96 sm:border-l sm:slide-in-from-right"
      >
        {/* Mobile drag handle */}
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mt-3 mb-1 sm:hidden" />

        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 id="chat-dialog-title" className="text-base font-semibold text-white">In-Call Chat</h2>
            <p className="text-xs text-zinc-400">Messages are visible to participants</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close chat panel"
            className="min-w-[44px] min-h-[44px] rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center touch-target-44"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="mx-3 mt-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2 text-xs text-red-300">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500">
            <Smile className="w-10 h-10 mb-2 stroke-1 text-zinc-600" />
            <p className="text-sm font-medium">No messages yet</p>
            <p className="text-xs mt-1">Send a message or share a file with the team</p>
          </div>
        ) : (
          messages.map((m, idx) => {
            const isLocal =
              currentUserId &&
              (m.senderId === currentUserId ||
                m.senderId === `user_${currentUserId}` ||
                m.senderId === `guest_${currentUserId}`)

            return (
              <div
                key={m.id || m.messageId || `msg-${idx}`}
                className={`flex flex-col ${isLocal ? "items-end" : "items-start"}`}
              >
                {/* Sender Header */}
                <div className="flex items-center gap-1.5 mb-1 px-1">
                  <span className="text-xs font-medium text-zinc-400">
                    {isLocal ? "You" : m.senderName}
                  </span>
                  <span className="text-[10px] text-zinc-500">
                    {new Date(m.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                {/* Message Bubble */}
                <div
                  className={`max-w-[85%] rounded-2xl p-3 text-sm break-words shadow-md ${
                    isLocal
                      ? "bg-red-600 text-white rounded-tr-none"
                      : "bg-zinc-800 text-zinc-100 rounded-tl-none border border-white/10"
                  }`}
                >
                  {/* Text Content */}
                  {m.text && <p className="whitespace-pre-wrap">{m.text}</p>}

                  {/* Attachment Card */}
                  {m.attachment && (
                    <div
                      className={`mt-2 p-2.5 rounded-xl border flex items-center justify-between gap-3 ${
                        isLocal
                          ? "bg-black/20 border-white/20"
                          : "bg-zinc-900/80 border-white/10"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-5 h-5 flex-shrink-0 text-white/80" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate text-white">
                            {m.attachment.originalName}
                          </p>
                          <p className="text-[10px] text-zinc-300">
                            {formatFileSize(m.attachment.filesize)}
                          </p>
                        </div>
                      </div>

                      <a
                        href={meetingApi.getAttachmentDownloadUrl(roomId, m.id || m.messageId || "")}
                        download={m.attachment.originalName}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                        title="Download file"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Upload Progress Bar */}
      {uploadProgress !== null && (
        <div className="px-4 py-2 bg-zinc-900 border-t border-white/10">
          <div className="flex justify-between text-xs text-zinc-400 mb-1">
            <span>Uploading file...</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-red-500 transition-all duration-200"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Input Section */}
      <div className="p-3 border-t border-white/10 bg-zinc-950 pb-safe">
        {!allowChat ? (
          <div className="text-center py-3 text-xs text-zinc-500 font-medium">
            Chat is disabled by the host
          </div>
        ) : (
          <form onSubmit={handleSend} className="flex items-center gap-2">
            {/* File Attachment Button */}
            {allowFileSharing && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Attach file (Max 25MB)"
                  className="min-w-[44px] min-h-[44px] p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center touch-target-44"
                  title="Attach file (Max 25MB)"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
              </>
            )}

            {/* Text Input */}
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Send a message..."
              aria-label="Send a message"
              maxLength={2000}
              className="flex-1 min-h-[44px] px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
            />

            {/* Send Button */}
            <button
              type="submit"
              disabled={!inputText.trim() || isSending}
              aria-label="Send message"
              className="min-w-[44px] min-h-[44px] p-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white transition-all shadow-lg flex items-center justify-center touch-target-44"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        )}
      </div>
    </div>
    </>
  )
}
