/**
 * Centralized Server-Side RBAC & Permission Service for Video Meetings.
 *
 * Enforces authoritative rules across all roles: HOST, CO_HOST, PARTICIPANT, GUEST.
 * Guarantees zero client-side privilege escalation.
 */

import { MeetingRoles } from "./videoTokenService.js"

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
}

export class PermissionService {
  /**
   * Evaluates if a given user/role has a specific permission in a meeting context.
   */
  static hasPermission(permission, role, meeting, userId = null) {
    if (!role || !meeting) return false

    const isHost = role === MeetingRoles.HOST || (userId && String(meeting.hostId) === String(userId))
    const isCoHost =
      role === MeetingRoles.CO_HOST ||
      (userId && meeting.coHosts?.some((id) => String(id) === String(userId)))
    const isParticipant = role === MeetingRoles.PARTICIPANT || role === "PARTICIPANT" || isHost || isCoHost

    // 1. Host has all permissions unconditionally
    if (isHost) return true

    const meetingPerms = meeting.permissions || {}

    switch (permission) {
      case MeetingPermissionsList.CAN_END_MEETING:
      case MeetingPermissionsList.CAN_MANAGE_PERMISSIONS:
      case MeetingPermissionsList.CAN_ENABLE_E2EE:
      case MeetingPermissionsList.CAN_ROTATE_E2EE_KEY:
        // Host only
        return false

      case MeetingPermissionsList.CAN_START_RECORDING:
      case MeetingPermissionsList.CAN_STOP_RECORDING:
        // Co-host can record if room allowRecording is not explicitly false
        return isCoHost && meetingPerms.allowRecording !== false

      case MeetingPermissionsList.CAN_MUTE_PARTICIPANTS:
      case MeetingPermissionsList.CAN_MANAGE_LOBBY:
      case MeetingPermissionsList.CAN_MANAGE_CHAT:
        return isCoHost

      case MeetingPermissionsList.CAN_REMOVE_PARTICIPANTS:
        return isCoHost

      case MeetingPermissionsList.CAN_SHARE_SCREEN:
        return isParticipant && meetingPerms.allowScreenShare !== false

      case MeetingPermissionsList.CAN_SHARE_FILES:
        return isParticipant && meetingPerms.allowFileSharing !== false

      case MeetingPermissionsList.CAN_VIEW_RECORDINGS:
        // Participants can view if room allows or authenticated
        return isParticipant

      case MeetingPermissionsList.CAN_DELETE_RECORDINGS:
        // Handled with ownership check in controller
        return false

      default:
        return false
    }
  }

  /**
   * Generates a resolved permission map for a specific user/role.
   */
  static getPermissionsMap(role, meeting, userId = null) {
    const map = {}
    for (const key of Object.values(MeetingPermissionsList)) {
      map[key] = this.hasPermission(key, role, meeting, userId)
    }
    return map
  }

  /**
   * Validates if target participant can be removed by requester.
   */
  static canRemoveTarget(requesterRole, requesterId, targetRole, targetId, meetingHostId) {
    // 1. Host can never be removed
    if (String(targetId) === String(meetingHostId) || targetRole === MeetingRoles.HOST) {
      return false
    }

    // 2. Host can remove anyone else
    if (requesterRole === MeetingRoles.HOST || String(requesterId) === String(meetingHostId)) {
      return true
    }

    // 3. Co-Host cannot remove another Co-Host or Host
    if (requesterRole === MeetingRoles.CO_HOST) {
      return targetRole !== MeetingRoles.CO_HOST && targetRole !== MeetingRoles.HOST
    }

    return false
  }
}

export const permissionService = PermissionService
