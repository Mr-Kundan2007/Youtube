/**
 * Centralized Client-Side RBAC & Permission Service for Video Meetings.
 * Mirrors server-side permissions for clean UI enforcement.
 */

import { MeetingRole, MeetingPermissions } from "../types/meeting"

export const MeetingPermissionsList = {
  CAN_START_RECORDING: "canStartRecording",
  CAN_STOP_RECORDING: "canStopRecording",
  CAN_MUTE_PARTICIPANTS: "canMuteParticipants",
  CAN_REMOVE_PARTICIPANTS: "canRemoveParticipants",
  CAN_MANAGE_LOBBY: "canManageLobby",
  CAN_MANAGE_CHAT: "canManageChat",
  CAN_SHARE_SCREEN: "canShareScreen",
  CAN_SHARE_FILES: "canShareFiles",
  CAN_END_MEETING: "canEndMeeting",
  CAN_MANAGE_PERMISSIONS: "canManagePermissions",
  CAN_ENABLE_E2EE: "canEnableE2EE",
  CAN_ROTATE_E2EE_KEY: "canRotateE2EEKey",
  CAN_VIEW_RECORDINGS: "canViewRecordings",
  CAN_DELETE_RECORDINGS: "canDeleteRecordings",
} as const

export type MeetingPermissionKey =
  typeof MeetingPermissionsList[keyof typeof MeetingPermissionsList]

export interface MeetingContextState {
  hostId?: string
  currentUserId?: string
  role: MeetingRole
  permissions?: MeetingPermissions
}

export class ClientPermissionService {
  public static hasPermission(
    permission: MeetingPermissionKey,
    context: MeetingContextState
  ): boolean {
    const { role, hostId, currentUserId, permissions } = context
    const isHost = role === "HOST" || (Boolean(currentUserId && hostId) && currentUserId === hostId)
    const isCoHost = role === "CO_HOST"
    const isParticipant = role === "PARTICIPANT" || isHost || isCoHost

    if (isHost) return true

    switch (permission) {
      case MeetingPermissionsList.CAN_END_MEETING:
      case MeetingPermissionsList.CAN_MANAGE_PERMISSIONS:
      case MeetingPermissionsList.CAN_ENABLE_E2EE:
      case MeetingPermissionsList.CAN_ROTATE_E2EE_KEY:
        return false

      case MeetingPermissionsList.CAN_START_RECORDING:
      case MeetingPermissionsList.CAN_STOP_RECORDING:
        return isCoHost && permissions?.allowRecording !== false

      case MeetingPermissionsList.CAN_MUTE_PARTICIPANTS:
      case MeetingPermissionsList.CAN_MANAGE_LOBBY:
      case MeetingPermissionsList.CAN_MANAGE_CHAT:
        return isCoHost

      case MeetingPermissionsList.CAN_REMOVE_PARTICIPANTS:
        return isCoHost

      case MeetingPermissionsList.CAN_SHARE_SCREEN:
        return isParticipant && permissions?.allowScreenShare !== false

      case MeetingPermissionsList.CAN_SHARE_FILES:
        return isParticipant && permissions?.allowFileSharing !== false

      case MeetingPermissionsList.CAN_VIEW_RECORDINGS:
        return isParticipant

      case MeetingPermissionsList.CAN_DELETE_RECORDINGS:
        return false

      default:
        return false
    }
  }

  public static getPermissionsMap(context: MeetingContextState): Record<MeetingPermissionKey, boolean> {
    const map = {} as Record<MeetingPermissionKey, boolean>
    for (const key of Object.values(MeetingPermissionsList)) {
      map[key] = this.hasPermission(key, context)
    }
    return map
  }

  public static canRemoveParticipant(
    requesterRole: MeetingRole,
    targetRole: MeetingRole,
    isTargetHost = false
  ): boolean {
    if (isTargetHost || targetRole === "HOST") return false
    if (requesterRole === "HOST") return true
    if (requesterRole === "CO_HOST") {
      return targetRole === "PARTICIPANT"
    }
    return false
  }
}

export const permissionService = ClientPermissionService
