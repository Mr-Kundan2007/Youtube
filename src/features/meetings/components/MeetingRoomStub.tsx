import React from "react"
import {
  Mic,
  Video,
  MonitorUp,
  Hand,
  MessageSquare,
  Users,
  PhoneOff,
  Signal,
  MoreVertical,
  ShieldCheck,
} from "lucide-react"
import { Button } from "@/components/ui/button"

interface MeetingRoomStubProps {
  roomId: string
  title?: string
  role?: string
  onLeave?: () => void
}

export const MeetingRoomStub: React.FC<MeetingRoomStubProps> = ({
  roomId,
  title = "Video Meeting",
  role = "PARTICIPANT",
  onLeave,
}) => {
  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-neutral-950 text-white overflow-hidden">
      {/* Top Bar: Meeting Name, Security badge, Connection, Timer */}
      <header className="h-14 px-4 flex items-center justify-between border-b border-neutral-800 bg-neutral-900/50 backdrop-blur">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold truncate max-w-xs">{title}</h1>
          <span className="text-xs bg-neutral-800 px-2 py-0.5 rounded text-neutral-300 font-mono">
            {roomId}
          </span>
          <span className="flex items-center gap-1 text-[11px] text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">
            <ShieldCheck className="w-3 h-3" />
            Encrypted
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs text-neutral-400">
          <div className="flex items-center gap-1.5 text-neutral-300 font-mono">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            00:00
          </div>
          <div className="flex items-center gap-1 text-green-400">
            <Signal className="w-4 h-4" />
            <span className="hidden sm:inline text-xs">Excellent</span>
          </div>
        </div>
      </header>

      {/* Center: Video Grid Container (Prepared for Phase 2/3 LiveKit integration) */}
      <main className="flex-1 p-4 flex items-center justify-center relative overflow-hidden">
        <div className="w-full h-full max-w-5xl rounded-2xl bg-neutral-900 border border-neutral-800 flex flex-col items-center justify-center text-center p-6 shadow-inner">
          <div className="w-24 h-24 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-400 mb-4 border border-neutral-700">
            <Users className="w-10 h-10" />
          </div>
          <h2 className="text-lg font-medium text-neutral-200">Room Ready: {roomId}</h2>
          <p className="text-xs text-neutral-500 mt-1 max-w-sm">
            Phase 1 Foundation Active. Media streams and WebRTC participant tiles will attach here in Phase 2.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 bg-neutral-800/80 px-3 py-1 rounded-full text-xs text-neutral-300">
            Role: <span className="font-semibold text-blue-400">{role}</span>
          </div>
        </div>
      </main>

      {/* Bottom: Floating / Docked Control Bar */}
      <footer className="h-16 px-4 flex items-center justify-between border-t border-neutral-800 bg-neutral-900/80">
        <div className="hidden md:flex items-center gap-2 text-xs text-neutral-400">
          <span className="truncate max-w-[200px]">{roomId}</span>
        </div>

        {/* Center Media Controls */}
        <div className="flex items-center gap-2 mx-auto md:mx-0">
          <Button
            size="icon"
            variant="outline"
            className="w-10 h-10 rounded-full bg-neutral-800 border-neutral-700 hover:bg-neutral-700 text-white"
            title="Toggle Microphone"
          >
            <Mic className="w-4 h-4" />
          </Button>

          <Button
            size="icon"
            variant="outline"
            className="w-10 h-10 rounded-full bg-neutral-800 border-neutral-700 hover:bg-neutral-700 text-white"
            title="Toggle Camera"
          >
            <Video className="w-4 h-4" />
          </Button>

          <Button
            size="icon"
            variant="outline"
            className="w-10 h-10 rounded-full bg-neutral-800 border-neutral-700 hover:bg-neutral-700 text-white hidden sm:flex"
            title="Share Screen"
          >
            <MonitorUp className="w-4 h-4" />
          </Button>

          <Button
            size="icon"
            variant="outline"
            className="w-10 h-10 rounded-full bg-neutral-800 border-neutral-700 hover:bg-neutral-700 text-white hidden sm:flex"
            title="Raise Hand"
          >
            <Hand className="w-4 h-4" />
          </Button>

          <Button
            size="icon"
            variant="outline"
            className="w-10 h-10 rounded-full bg-neutral-800 border-neutral-700 hover:bg-neutral-700 text-white"
            title="In-call Chat"
          >
            <MessageSquare className="w-4 h-4" />
          </Button>

          <Button
            size="icon"
            variant="outline"
            className="w-10 h-10 rounded-full bg-neutral-800 border-neutral-700 hover:bg-neutral-700 text-white"
            title="Participants List"
          >
            <Users className="w-4 h-4" />
          </Button>

          <Button
            size="icon"
            onClick={onLeave}
            className="w-10 h-10 rounded-full bg-red-600 hover:bg-red-700 text-white ml-2"
            title="Leave Meeting"
          >
            <PhoneOff className="w-4 h-4" />
          </Button>
        </div>

        <div className="hidden md:flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            className="w-9 h-9 text-neutral-400 hover:text-white"
            title="More Options"
          >
            <MoreVertical className="w-4 h-4" />
          </Button>
        </div>
      </footer>
    </div>
  )
}

export default MeetingRoomStub
