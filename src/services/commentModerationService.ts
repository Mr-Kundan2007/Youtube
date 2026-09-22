import axiosInstance from "@/lib/axiosinstance"

export interface ReportCommentPayload {
  reason: string
  description?: string
  captchaToken?: string
}

export interface ReportStatusResponse {
  hasReported: boolean
  report?: any
}

export interface ModerationSummary {
  totalPending: number
  underReview: number
  resolvedToday: number
  dismissedToday: number
  highPriority: number
  totalReports: number
}

export interface CommentReportItem {
  id: string
  _id: string
  commentId: string
  commentPreview: string
  commentStatus: string
  commentAuthor: string
  commentAuthorId?: string
  commentCreatedAt?: string
  isCommentDeleted?: boolean
  reportedBy: string
  reporterName: string
  reporterEmail?: string
  reason: string
  description?: string
  status: "pending" | "under_review" | "reviewing" | "resolved" | "dismissed"
  priority: "low" | "medium" | "high"
  reportCount: number
  moderatorNotes?: string
  resolutionAction?: string
  resolvedAt?: string
  resolvedBy?: string
  createdAt: string
  updatedAt: string
}

export interface ModerationReportsResponse {
  reports: CommentReportItem[]
  pagination: {
    page: number
    limit: number
    totalReports: number
    totalPages: number
    hasMore: boolean
  }
}

export interface ReportDetailDossier {
  report: CommentReportItem
  comment: {
    id: string
    _id: string
    contentId?: string
    userId?: string
    authorName: string
    authorEmail?: string
    authorAvatar?: string
    authorLocation?: string
    text: string
    languageCode: string
    version: number
    status: string
    isEdited: boolean
    isDeleted: boolean
    createdAt: string
    updatedAt: string
  } | null
  threadContext: {
    isReply: boolean
    parentComment: {
      id: string
      authorName: string
      text: string
      status?: string
    } | null
    repliesCount: number
    sampleReplies: Array<{
      id: string
      authorName: string
      text: string
    }>
  }
  editHistory: Array<{
    version: number
    previousText: string
    newText: string
    editedAt: string
  }>
  safetySignals: {
    eventCount: number
    events: Array<{
      eventType: string
      reason: string
      createdAt: string
    }>
  }
  telemetry: {
    riskScore: number
    violationCount: number
    captchaRequired: boolean
  }
  otherReports: Array<{
    id: string
    reason: string
    status: string
    createdAt: string
  }>
  priorModerationHistory: Array<{
    id: string
    action: string
    reason: string
    moderatorId: string
    createdAt: string
  }>
}

export interface ModerationActionPayload {
  reportId?: string
  commentId: string
  action: "hide" | "restore" | "delete" | "dismiss_report" | "resolve"
  reason: string
  notes?: string
  expectedVersion?: number
}

export const REPORT_REASONS = [
  { value: "spam", label: "Spam", description: "Unwanted commercial content or repetitive text" },
  { value: "harassment", label: "Harassment", description: "Targeted hostility, intimidation, or cyberbullying" },
  { value: "offensive", label: "Offensive", description: "Grossly vulgar, profane, or inappropriate language" },
  { value: "hateful_or_abusive", label: "Hate Speech or Abuse", description: "Attacking protected groups or inciting violence" },
  { value: "malicious_link", label: "Malicious Link", description: "Phishing, malware, scam URLs or unsafe redirects" },
  { value: "misinformation", label: "Misinformation", description: "Demonstrably false claims intended to deceive" },
  { value: "impersonation", label: "Impersonation", description: "Pretending to be another creator or community member" },
  { value: "other", label: "Other Issue", description: "Violates community guidelines in another way" },
]

export const commentModerationService = {
  /**
   * Submits a report against a comment or threaded reply
   */
  async reportComment(commentId: string, payload: ReportCommentPayload): Promise<{ success: boolean; message: string; reportId?: string }> {
    const headers = payload.captchaToken ? { "x-captcha-token": payload.captchaToken } : undefined
    const { data } = await axiosInstance.post(
      `/comment/${encodeURIComponent(commentId)}/reports`,
      payload,
      { headers }
    )
    return data
  },

  /**
   * Checks if authenticated user has an active report on a comment
   */
  async checkReportStatus(commentId: string): Promise<ReportStatusResponse> {
    try {
      const { data } = await axiosInstance.get(`/comment/${encodeURIComponent(commentId)}/reports/status`)
      return data
    } catch {
      return { hasReported: false }
    }
  },

  /**
   * Admin: Fetches summary statistics for moderation dashboard
   */
  async getModerationSummary(): Promise<ModerationSummary> {
    const { data } = await axiosInstance.get("/admin/comment-moderation/summary")
    return data
  },

  /**
   * Admin: Fetches paginated reports list with filtering and search
   */
  async getModerationReports(params: {
    status?: string
    reason?: string
    priority?: string
    search?: string
    page?: number
    limit?: number
    sortBy?: string
    sortOrder?: string | number
  } = {}): Promise<ModerationReportsResponse> {
    const { data } = await axiosInstance.get("/admin/comment-moderation/reports", { params })
    return data
  },

  /**
   * Admin: Fetches complete contextual dossier for a report
   */
  async getReportDetails(reportId: string): Promise<ReportDetailDossier> {
    const { data } = await axiosInstance.get(`/admin/comment-moderation/reports/${encodeURIComponent(reportId)}`)
    return data
  },

  /**
   * Admin: Updates status or notes on a report
   */
  async updateReportStatus(reportId: string, status: string, notes?: string): Promise<any> {
    const { data } = await axiosInstance.patch(`/admin/comment-moderation/reports/${encodeURIComponent(reportId)}/status`, {
      status,
      notes,
    })
    return data
  },

  /**
   * Admin: Executes an authorized moderation action (hide, restore, delete, dismiss)
   */
  async executeModerationAction(payload: ModerationActionPayload): Promise<{ success: boolean; action: string; newStatus: string; message: string }> {
    const { data } = await axiosInstance.post("/admin/comment-moderation/action", payload)
    return data
  },
}

export default commentModerationService
