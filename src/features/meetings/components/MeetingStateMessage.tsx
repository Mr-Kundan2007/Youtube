import React from "react"
import { useRouter } from "next/router"
import {
  AlertCircle,
  Lock,
  Users,
  Clock,
  LogIn,
  ShieldAlert,
  ArrowLeft,
  RotateCcw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { LobbyState } from "../types/meeting"

interface MeetingStateMessageProps {
  state: LobbyState
  customMessage?: string
  roomId?: string
  onRetry?: () => void
  onSignIn?: () => void
}

export const MeetingStateMessage: React.FC<MeetingStateMessageProps> = ({
  state,
  customMessage,
  roomId,
  onRetry,
  onSignIn,
}) => {
  const router = useRouter()

  const stateConfigs: Record<string, any> = {
    NOT_FOUND: {
      icon: AlertCircle,
      iconColor: "text-amber-500",
      iconBg: "bg-amber-500/10",
      title: "Meeting Not Found",
      defaultMessage: "We couldn't find a meeting with this room code. Please check the link or code.",
      primaryAction: {
        label: "Return to Lobby",
        onClick: () => router.push("/meet"),
        icon: ArrowLeft,
      },
    },
    ENDED: {
      icon: Clock,
      iconColor: "text-neutral-400",
      iconBg: "bg-neutral-800",
      title: "This Meeting Has Ended",
      defaultMessage: "The host has concluded this meeting session. Thank you for participating.",
      primaryAction: {
        label: "Start New Meeting",
        onClick: () => router.push("/meet"),
        icon: ArrowLeft,
      },
    },
    LOCKED: {
      icon: Lock,
      iconColor: "text-red-400",
      iconBg: "bg-red-500/10",
      title: "Meeting is Locked",
      defaultMessage: "This meeting is currently locked by the host. New participants cannot join at this time.",
      primaryAction: {
        label: "Check Again",
        onClick: onRetry || (() => router.reload()),
        icon: RotateCcw,
      },
    },
    FULL: {
      icon: Users,
      iconColor: "text-orange-400",
      iconBg: "bg-orange-500/10",
      title: "Meeting is Full",
      defaultMessage: "This meeting has reached its maximum participant capacity. Please try again later.",
      primaryAction: {
        label: "Retry",
        onClick: onRetry || (() => router.reload()),
        icon: RotateCcw,
      },
    },
    AUTH_REQUIRED: {
      icon: LogIn,
      iconColor: "text-blue-400",
      iconBg: "bg-blue-500/10",
      title: "Authentication Required",
      defaultMessage: "The host configured this room to require a signed-in account. Please sign in to enter.",
      primaryAction: {
        label: "Sign In",
        onClick: onSignIn || (() => router.push("/login")),
        icon: LogIn,
      },
    },
    DENIED: {
      icon: ShieldAlert,
      iconColor: "text-red-400",
      iconBg: "bg-red-500/10",
      title: "Access Denied",
      defaultMessage: "You do not have permission to join this meeting room or you were removed by the host.",
      primaryAction: {
        label: "Return to Meetings",
        onClick: () => router.push("/meet"),
        icon: ArrowLeft,
      },
    },
    WAITING_FOR_APPROVAL: {
      icon: Clock,
      iconColor: "text-yellow-400",
      iconBg: "bg-yellow-500/10",
      title: "Waiting for Host Approval",
      defaultMessage: "Your join request has been submitted. The host will admit you shortly.",
      primaryAction: {
        label: "Cancel Request",
        onClick: () => router.push("/meet"),
        icon: ArrowLeft,
      },
    },
    ERROR: {
      icon: AlertCircle,
      iconColor: "text-red-400",
      iconBg: "bg-red-500/10",
      title: "Connection Error",
      defaultMessage: "An error occurred while connecting to the meeting room. Please try again.",
      primaryAction: {
        label: "Retry Connection",
        onClick: onRetry || (() => router.reload()),
        icon: RotateCcw,
      },
    },
  }

  const config = stateConfigs[state] || {
    icon: AlertCircle,
    iconColor: "text-red-400",
    iconBg: "bg-red-500/10",
    title: "Unable to Join",
    defaultMessage: customMessage || "An unexpected error occurred.",
    primaryAction: {
      label: "Return to Meetings",
      onClick: () => router.push("/meet"),
      icon: ArrowLeft,
    },
  }

  const Icon = config.icon
  const PrimaryIcon = config.primaryAction.icon

  return (
    <div className="min-h-[75vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-neutral-900 border border-neutral-800 rounded-3xl p-8 text-center shadow-xl">
        <div
          className={`w-16 h-16 rounded-2xl ${config.iconBg} ${config.iconColor} flex items-center justify-center mx-auto mb-5 shadow-inner`}
        >
          <Icon className="w-8 h-8 stroke-[1.75]" />
        </div>

        <h1 className="text-xl font-bold text-neutral-100 mb-2">{config.title}</h1>
        <p className="text-sm text-neutral-400 mb-6 leading-relaxed">
          {customMessage || config.defaultMessage}
        </p>

        {roomId && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-neutral-800/80 rounded-full text-xs text-neutral-300 font-mono mb-6 border border-neutral-700/50">
            <span>Room ID:</span>
            <span className="font-semibold text-neutral-100">{roomId}</span>
          </div>
        )}

        <div className="flex flex-col gap-2.5">
          <Button
            onClick={config.primaryAction.onClick}
            className="w-full bg-white text-neutral-950 hover:bg-neutral-200 font-medium py-2.5 text-sm rounded-xl transition-all shadow-sm"
          >
            <PrimaryIcon className="w-4 h-4 mr-2" />
            {config.primaryAction.label}
          </Button>

          {state !== "NOT_FOUND" && (
            <Button
              onClick={() => router.push("/meet")}
              variant="outline"
              className="w-full border-neutral-800 hover:bg-neutral-800/60 text-neutral-400 hover:text-neutral-200 text-xs py-2 rounded-xl"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
              Return to Meetings
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export default MeetingStateMessage
