"use client"

import React, { useState } from "react"
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  ScreenShare,
  Monitor,
  Smile,
  Hand,
  MessageSquare,
  Users,
  Settings,
  Lock,
  Unlock,
  PhoneOff,
  RefreshCw,
  Disc,
  MoreHorizontal,
} from "lucide-react"
import { ReactionBar } from "./ReactionBar"
import { MobileMoreMenu } from "./MobileMoreMenu"
import { MeetingRole } from "../types/meeting"

interface MeetingControlsProps {
  isMicOn: boolean
  isCameraOn: boolean
  isScreenSharing: boolean
  isHandRaised: boolean
  isChatOpen: boolean
  isParticipantsOpen: boolean
  isLocked: boolean
  userRole: MeetingRole
  unreadChatCount: number
  participantCount: number
  isMobile?: boolean
  canFlipCamera?: boolean
  allowScreenShare?: boolean
  isRecording?: boolean
  canRecord?: boolean
  isRecordingLoading?: boolean
  onToggleMic: () => void
  onToggleCamera: () => void
  onToggleScreenShare: () => void
  onFlipCamera?: () => void
  onToggleHandRaise: () => void
  onSendReaction: (emoji: string) => void
  onToggleChat: () => void
  onToggleParticipants: () => void
  onToggleRecord?: () => void
  onOpenSettings: () => void
  onToggleLock?: (lock: boolean) => void
  onLeaveCall: () => void
  onOpenSecurity?: () => void
  securityMode?: "STANDARD" | "E2EE"
}

export const MeetingControls: React.FC<MeetingControlsProps> = ({
  isMicOn,
  isCameraOn,
  isScreenSharing,
  isHandRaised,
  isChatOpen,
  isParticipantsOpen,
  isLocked,
  userRole,
  unreadChatCount,
  participantCount,
  isMobile = false,
  canFlipCamera = false,
  allowScreenShare = true,
  isRecording = false,
  canRecord = false,
  isRecordingLoading = false,
  onToggleMic,
  onToggleCamera,
  onToggleScreenShare,
  onFlipCamera,
  onToggleHandRaise,
  onSendReaction,
  onToggleChat,
  onToggleParticipants,
  onToggleRecord,
  onOpenSettings,
  onToggleLock,
  onLeaveCall,
  onOpenSecurity = () => {},
  securityMode = "STANDARD",
}) => {
  const [showReactions, setShowReactions] = useState(false)
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false)


  const isHostOrCoHost = userRole === "HOST" || userRole === "CO_HOST"

  return (
    <nav
      aria-label="Meeting controls"
      className="relative flex items-center justify-center p-3 pb-safe select-none w-full"
    >
      {/* Floating Reaction Bar Popover */}
      {showReactions && (
        <div className="absolute bottom-20 z-40">
          <ReactionBar
            onSendReaction={onSendReaction}
            isHandRaised={isHandRaised}
            onToggleHandRaise={onToggleHandRaise}
            onClose={() => setShowReactions(false)}
          />
        </div>
      )}

      {/* Mobile-Only Focused Dock (< 640px) */}
      <div className="flex sm:hidden items-center justify-around w-full max-w-sm px-4 py-2 rounded-full bg-zinc-950/95 backdrop-blur-xl border border-white/10 shadow-2xl">
        {/* Mobile Mic */}
        <button
          onClick={onToggleMic}
          aria-label={isMicOn ? "Mute microphone" : "Unmute microphone"}
          className={`p-3 rounded-full touch-target-44 transition-all duration-150 flex items-center justify-center focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none ${
            isMicOn
              ? "bg-white/10 hover:bg-white/20 text-white active:bg-white/30"
              : "bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.4)]"
          }`}
        >
          {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </button>

        {/* Mobile Camera */}
        <button
          onClick={onToggleCamera}
          aria-label={isCameraOn ? "Turn camera off" : "Turn camera on"}
          className={`p-3 rounded-full touch-target-44 transition-all duration-150 flex items-center justify-center focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none ${
            isCameraOn
              ? "bg-white/10 hover:bg-white/20 text-white active:bg-white/30"
              : "bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.4)]"
          }`}
        >
          {isCameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </button>

        {/* Mobile Camera Flip (if multi-camera available) */}
        {canFlipCamera && onFlipCamera && (
          <button
            onClick={onFlipCamera}
            aria-label="Switch front and rear camera"
            className="p-3 rounded-full touch-target-44 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white transition-colors flex items-center justify-center focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        )}

        {/* Mobile More (⋯) Trigger */}
        <button
          onClick={() => setIsMoreMenuOpen(true)}
          aria-label="More meeting controls"
          aria-haspopup="dialog"
          aria-expanded={isMoreMenuOpen}
          className="relative p-3 rounded-full touch-target-44 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white transition-all flex items-center justify-center focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none"
        >
          <MoreHorizontal className="w-5 h-5" />
          {unreadChatCount > 0 && (
            <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-bold">
              {unreadChatCount}
            </span>
          )}
        </button>

        {/* Mobile Leave */}
        <button
          onClick={onLeaveCall}
          aria-label="Leave or end meeting"
          className="p-3 rounded-full touch-target-44 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white flex items-center justify-center transition-all shadow-[0_0_15px_rgba(220,38,38,0.4)] focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
        >
          <PhoneOff className="w-5 h-5" />
        </button>
      </div>

      {/* Tablet & Desktop Full Dock (640px+) */}
      <div className="hidden sm:flex items-center gap-2 sm:gap-3 px-4 py-2.5 rounded-full bg-zinc-950/90 backdrop-blur-xl border border-white/10 shadow-2xl overflow-x-auto max-w-full">
        {/* Microphone */}
        <button
          onClick={onToggleMic}
          aria-label={isMicOn ? "Mute microphone" : "Unmute microphone"}
          className={`p-3 rounded-full transition-all duration-150 flex items-center justify-center touch-target-44 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none ${
            isMicOn
              ? "bg-white/10 hover:bg-white/20 text-white"
              : "bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.4)]"
          }`}
          title={isMicOn ? "Mute Microphone" : "Unmute Microphone"}
        >
          {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </button>

        {/* Camera */}
        <button
          onClick={onToggleCamera}
          aria-label={isCameraOn ? "Turn camera off" : "Turn camera on"}
          className={`p-3 rounded-full transition-all duration-150 flex items-center justify-center touch-target-44 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none ${
            isCameraOn
              ? "bg-white/10 hover:bg-white/20 text-white"
              : "bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.4)]"
          }`}
          title={isCameraOn ? "Turn Camera Off" : "Turn Camera On"}
        >
          {isCameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </button>

        {/* Flip Camera (Tablet / Multi-camera) */}
        {canFlipCamera && onFlipCamera && (
          <button
            onClick={onFlipCamera}
            aria-label="Flip camera"
            className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors touch-target-44 flex items-center justify-center focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none"
            title="Flip Camera"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        )}

        {/* Screen Share */}
        {allowScreenShare && !isMobile && (
          <button
            onClick={onToggleScreenShare}
            aria-label={isScreenSharing ? "Stop sharing screen" : "Share screen"}
            className={`p-3 rounded-full transition-all duration-150 touch-target-44 flex items-center justify-center focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none ${
              isScreenSharing
                ? "bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]"
                : "bg-white/10 hover:bg-white/20 text-white"
            }`}
            title={isScreenSharing ? "Stop Sharing Screen" : "Share Screen"}
          >
            {isScreenSharing ? <Monitor className="w-5 h-5" /> : <ScreenShare className="w-5 h-5" />}
          </button>
        )}

        {/* Reactions & Raise Hand */}
        <div className="relative">
          <button
            onClick={() => setShowReactions(!showReactions)}
            aria-label="Reactions and raise hand"
            aria-expanded={showReactions}
            className={`p-3 rounded-full transition-all duration-150 touch-target-44 flex items-center justify-center focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:outline-none ${
              isHandRaised
                ? "bg-amber-500 text-amber-950 shadow-[0_0_15px_rgba(245,158,11,0.4)]"
                : "bg-white/10 hover:bg-white/20 text-white"
            }`}
            title="Reactions & Raise Hand"
          >
            {isHandRaised ? <Hand className="w-5 h-5 fill-amber-950 animate-bounce" /> : <Smile className="w-5 h-5" />}
          </button>
        </div>

        <div className="w-px h-6 bg-white/10 mx-1 hidden sm:block" />

        {/* In-Call Chat */}
        <button
          onClick={onToggleChat}
          aria-label={`Toggle chat panel (${unreadChatCount} unread)`}
          aria-expanded={isChatOpen}
          className={`relative p-3 rounded-full transition-all duration-150 touch-target-44 flex items-center justify-center focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none ${
            isChatOpen
              ? "bg-red-600 text-white"
              : "bg-white/10 hover:bg-white/20 text-white"
          }`}
          title="Toggle Chat"
        >
          <MessageSquare className="w-5 h-5" />
          {unreadChatCount > 0 && !isChatOpen && (
            <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-bold shadow-md">
              {unreadChatCount}
            </span>
          )}
        </button>

        {/* Participants */}
        <button
          onClick={onToggleParticipants}
          aria-label={`Toggle participants list (${participantCount} participants)`}
          aria-expanded={isParticipantsOpen}
          className={`relative p-3 rounded-full transition-all duration-150 touch-target-44 flex items-center justify-center focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none ${
            isParticipantsOpen
              ? "bg-red-600 text-white"
              : "bg-white/10 hover:bg-white/20 text-white"
          }`}
          title="Toggle Participant List"
        >
          <Users className="w-5 h-5" />
          {participantCount > 0 && (
            <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-zinc-800 border border-white/10 text-zinc-300 text-[10px] font-semibold">
              {participantCount}
            </span>
          )}
        </button>

        {/* Record Meeting */}
        {onToggleRecord && (
          <button
            onClick={() => {
              if (canRecord || isRecording) {
                onToggleRecord()
              } else {
                alert("Only meeting hosts and co-hosts can start recordings.")
              }
            }}
            disabled={isRecordingLoading}
            aria-label={isRecording ? "Stop recording meeting" : "Record meeting"}
            className={`relative p-3 rounded-full transition-all duration-150 flex items-center justify-center touch-target-44 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none ${
              isRecording
                ? "bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.5)] animate-pulse"
                : canRecord
                ? "bg-white/10 hover:bg-white/20 text-white"
                : "bg-white/5 hover:bg-white/10 text-zinc-400"
            } disabled:opacity-50`}
            title={
              isRecording
                ? "Stop Recording"
                : canRecord
                ? "Record Meeting"
                : "Record Meeting (Host only)"
            }
          >
            <Disc
              className={`w-5 h-5 ${
                isRecording
                  ? "animate-spin text-white"
                  : canRecord
                  ? "text-red-500"
                  : "text-zinc-500"
              }`}
            />
          </button>
        )}

        {/* Lock Meeting (Host / Co-Host) */}
        {isHostOrCoHost && onToggleLock && (
          <button
            onClick={() => onToggleLock(!isLocked)}
            aria-label={isLocked ? "Unlock meeting room" : "Lock meeting room"}
            className={`p-3 rounded-full transition-all duration-150 touch-target-44 flex items-center justify-center focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:outline-none ${
              isLocked
                ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                : "bg-white/10 hover:bg-white/20 text-white"
            }`}
            title={isLocked ? "Unlock Meeting" : "Lock Meeting"}
          >
            {isLocked ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
          </button>
        )}

        {/* Settings */}
        <button
          onClick={onOpenSettings}
          aria-label="Audio and video device settings"
          className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors touch-target-44 flex items-center justify-center focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none"
          title="Device Settings"
        >
          <Settings className="w-5 h-5" />
        </button>

        {/* Leave / End Call */}
        <button
          onClick={onLeaveCall}
          aria-label="Leave call"
          className="p-3 sm:px-5 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(220,38,38,0.35)] touch-target-44 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
          title="Leave Call"
        >
          <PhoneOff className="w-5 h-5" />
          <span className="hidden sm:inline text-xs font-bold uppercase tracking-wider">Leave</span>
        </button>
      </div>

      {/* Mobile Secondary Controls Bottom Sheet */}
      <MobileMoreMenu
        isOpen={isMoreMenuOpen}
        onClose={() => setIsMoreMenuOpen(false)}
        isScreenSharing={isScreenSharing}
        allowScreenShare={allowScreenShare}
        onToggleScreenShare={onToggleScreenShare}
        isRecording={isRecording}
        canRecord={canRecord}
        isRecordingLoading={isRecordingLoading}
        onToggleRecord={onToggleRecord}
        unreadChatCount={unreadChatCount}
        onToggleChat={onToggleChat}
        participantCount={participantCount}
        onToggleParticipants={onToggleParticipants}
        isHandRaised={isHandRaised}
        onToggleHandRaise={onToggleHandRaise}
        onOpenSettings={onOpenSettings}
        userRole={userRole}
        isLocked={isLocked}
        onToggleLock={onToggleLock}
        onOpenSecurity={onOpenSecurity}
        securityMode={securityMode}
        onSendReaction={onSendReaction}
      />
    </nav>
  )
}

