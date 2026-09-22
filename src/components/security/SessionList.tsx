import React, { useState } from "react"
import { UserSession } from "@/services/sessionService"
import { ActiveSessionCard } from "./ActiveSessionCard"
import { LogoutConfirmModal, LogoutActionType } from "./LogoutConfirmModal"
import { Laptop, LogOut, ShieldAlert, Sparkles } from "lucide-react"

interface SessionListProps {
  sessions: UserSession[]
  loading: boolean
  maxLimit: number
  onTerminate: (sessionId: string) => Promise<void>
  onLogoutOthers: () => Promise<void>
  onLogoutAll: () => Promise<void>
}

export const SessionList: React.FC<SessionListProps> = ({
  sessions,
  loading,
  maxLimit,
  onTerminate,
  onLogoutOthers,
  onLogoutAll,
}) => {
  const [modalState, setModalState] = useState<{
    isOpen: boolean
    actionType: LogoutActionType
    targetSession?: UserSession
  }>({
    isOpen: false,
    actionType: "individual",
  })
  const [actionLoading, setActionLoading] = useState(false)

  const currentSession = sessions.find((s) => s.isCurrentSession)
  const otherSessions = sessions.filter((s) => !s.isCurrentSession)

  const handleOpenIndividual = (session: UserSession) => {
    setModalState({
      isOpen: true,
      actionType: "individual",
      targetSession: session,
    })
  }

  const handleOpenOthers = () => {
    setModalState({
      isOpen: true,
      actionType: "others",
    })
  }

  const handleOpenAll = () => {
    setModalState({
      isOpen: true,
      actionType: "all",
    })
  }

  const handleConfirm = async () => {
    try {
      setActionLoading(true)
      if (modalState.actionType === "individual" && modalState.targetSession) {
        await onTerminate(modalState.targetSession.sessionId || modalState.targetSession.id)
      } else if (modalState.actionType === "others") {
        await onLogoutOthers()
      } else if (modalState.actionType === "all") {
        await onLogoutAll()
      }
      setModalState((prev) => ({ ...prev, isOpen: false }))
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Top Bar with Bulk Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl border border-[var(--border)] bg-[var(--card)]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-[var(--foreground)]">Connected Sessions</h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              {sessions.length} / {maxLimit} active
            </span>
          </div>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
            You are signed in on {sessions.length} {sessions.length === 1 ? "device" : "devices"}. You can remotely sign out of any unrecognized session.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {otherSessions.length > 0 && (
            <button
              onClick={handleOpenOthers}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout Other Devices ({otherSessions.length})</span>
            </button>
          )}

          <button
            onClick={handleOpenAll}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-red-600 hover:bg-red-700 text-white transition-colors flex items-center gap-1.5"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Logout All</span>
          </button>
        </div>
      </div>

      {/* Sessions Content */}
      {loading ? (
        <div className="p-8 text-center text-xs text-[var(--muted-foreground)] rounded-2xl border border-[var(--border)]">
          Loading connected sessions...
        </div>
      ) : sessions.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-[var(--border)] bg-[var(--card)]">
          <Laptop className="w-10 h-10 text-[var(--muted-foreground)] mx-auto mb-3 opacity-50" />
          <p className="text-sm font-semibold text-[var(--foreground)]">No Active Sessions Found</p>
          <p className="text-xs text-[var(--muted-foreground)] mt-1">
            Please refresh or sign in to verify your active session.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Current Session always rendered first */}
          {currentSession && (
            <ActiveSessionCard
              key={currentSession.sessionId || currentSession.id}
              session={currentSession}
              onTerminate={handleOpenIndividual}
            />
          )}

          {/* Other Connected Sessions */}
          {otherSessions.map((session) => (
            <ActiveSessionCard
              key={session.sessionId || session.id}
              session={session}
              onTerminate={handleOpenIndividual}
            />
          ))}
        </div>
      )}

      {/* Confirmation Modal */}
      <LogoutConfirmModal
        isOpen={modalState.isOpen}
        actionType={modalState.actionType}
        deviceName={modalState.targetSession?.device?.model}
        loading={actionLoading}
        onClose={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={handleConfirm}
      />
    </div>
  )
}

export default SessionList
