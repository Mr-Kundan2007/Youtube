import mongoose from "mongoose"
import crypto from "crypto"
import SupportTicket from "../Modals/SupportTicket.js"
import DownloadRecord from "../Modals/DownloadRecord.js"
import { ApiError } from "../utils/apiError.js"

export class UserSupportService {
  /**
   * Creates a download support ticket for the user.
   */
  async createTicket(userId, { downloadId, issueType, description, priority = "MEDIUM" }) {
    if (!userId) {
      throw ApiError.unauthorized("UNAUTHORIZED", "User authentication required")
    }

    if (!issueType || !description) {
      throw ApiError.badRequest("MISSING_REQUIRED_FIELDS", "Issue type and description are required")
    }

    const validIssueTypes = [
      "DOWNLOAD_FAILED",
      "DOWNLOAD_NOT_STARTING",
      "DOWNLOAD_INTERRUPTED",
      "FILE_PROBLEM",
      "QUOTA_PROBLEM",
      "DEVICE_PROBLEM",
      "OTHER",
    ]

    if (!validIssueTypes.includes(issueType)) {
      throw ApiError.badRequest("INVALID_ISSUE_TYPE", `Issue type must be one of: ${validIssueTypes.join(", ")}`)
    }

    let verifiedDownload = null
    if (downloadId && mongoose.Types.ObjectId.isValid(downloadId)) {
      verifiedDownload = await DownloadRecord.findOne({
        _id: downloadId,
        $or: [
          { userId: new mongoose.Types.ObjectId(userId) },
          { user_id: new mongoose.Types.ObjectId(userId) },
        ],
      }).lean()
    }

    const ticketId = `TICK-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`

    const ticket = await SupportTicket.create({
      ticketId,
      userId,
      user_id: userId,
      downloadId: verifiedDownload ? verifiedDownload._id : null,
      issueType,
      description: description.trim(),
      priority,
      status: "OPEN",
      responses: [
        {
          sender: "system",
          senderName: "Support Bot",
          message:
            "Thank you for contacting Download Support. Our automated systems are reviewing your request and a specialist will respond shortly.",
          createdAt: new Date(),
        },
      ],
      metadata: {
        videoTitle: verifiedDownload?.videoTitle || undefined,
        downloadStatus: verifiedDownload?.download_status || undefined,
      },
    })

    return {
      ticketId: ticket.ticketId,
      id: ticket._id,
      issueType: ticket.issueType,
      status: ticket.status,
      priority: ticket.priority,
      createdAt: ticket.createdAt,
    }
  }

  /**
   * Lists tickets belonging to authenticated user.
   */
  async getUserTickets(userId, { page = 1, limit = 20, status = null } = {}) {
    if (!userId) {
      throw ApiError.unauthorized("UNAUTHORIZED", "User authentication required")
    }

    const safePage = Math.max(1, parseInt(page, 10) || 1)
    const safeLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 20))
    const skip = (safePage - 1) * safeLimit

    const query = {
      $or: [
        { userId: new mongoose.Types.ObjectId(userId) },
        { user_id: new mongoose.Types.ObjectId(userId) },
      ],
    }

    if (status && status !== "all") {
      query.status = status.toUpperCase()
    }

    const [tickets, total] = await Promise.all([
      SupportTicket.find(query)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .lean(),
      SupportTicket.countDocuments(query),
    ])

    return {
      tickets: tickets.map((t) => ({
        ticketId: t.ticketId,
        id: t._id,
        issueType: t.issueType,
        description: t.description,
        status: t.status,
        priority: t.priority,
        messageCount: t.responses?.length || 0,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit) || 1,
      },
    }
  }

  /**
   * Retrieves single ticket details ensuring ownership.
   */
  async getTicketDetails(userId, ticketIdentifier) {
    if (!userId || !ticketIdentifier) {
      throw ApiError.badRequest("MISSING_PARAMETERS", "User ID and Ticket ID required")
    }

    const isObjectId = mongoose.Types.ObjectId.isValid(ticketIdentifier)
    const query = {
      $and: [
        {
          $or: [
            { userId: new mongoose.Types.ObjectId(userId) },
            { user_id: new mongoose.Types.ObjectId(userId) },
          ],
        },
        {
          $or: [
            { ticketId: ticketIdentifier },
            ...(isObjectId ? [{ _id: new mongoose.Types.ObjectId(ticketIdentifier) }] : []),
          ],
        },
      ],
    }

    const ticket = await SupportTicket.findOne(query).lean()

    if (!ticket) {
      throw ApiError.notFound("TICKET_NOT_FOUND", "Support ticket not found or access denied")
    }

    return {
      ticketId: ticket.ticketId,
      id: ticket._id,
      issueType: ticket.issueType,
      description: ticket.description,
      status: ticket.status,
      priority: ticket.priority,
      downloadId: ticket.downloadId,
      metadata: ticket.metadata,
      responses: ticket.responses || [],
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
    }
  }

  /**
   * Appends user message to ticket thread, ensuring ownership.
   */
  async addMessage(userId, ticketIdentifier, message) {
    if (!userId || !ticketIdentifier || !message) {
      throw ApiError.badRequest("MISSING_PARAMETERS", "User ID, Ticket ID, and message required")
    }

    const isObjectId = mongoose.Types.ObjectId.isValid(ticketIdentifier)
    const query = {
      $and: [
        {
          $or: [
            { userId: new mongoose.Types.ObjectId(userId) },
            { user_id: new mongoose.Types.ObjectId(userId) },
          ],
        },
        {
          $or: [
            { ticketId: ticketIdentifier },
            ...(isObjectId ? [{ _id: new mongoose.Types.ObjectId(ticketIdentifier) }] : []),
          ],
        },
      ],
    }

    const ticket = await SupportTicket.findOne(query)

    if (!ticket) {
      throw ApiError.notFound("TICKET_NOT_FOUND", "Support ticket not found or access denied")
    }

    if (ticket.status === "CLOSED") {
      throw ApiError.forbidden("TICKET_CLOSED", "Cannot add messages to a closed support ticket")
    }

    ticket.responses.push({
      sender: "user",
      senderName: "You",
      message: message.trim(),
      createdAt: new Date(),
    })

    if (ticket.status === "WAITING_FOR_USER") {
      ticket.status = "IN_PROGRESS"
    }

    await ticket.save()

    return {
      success: true,
      message: "Message added to support ticket",
      responses: ticket.responses,
    }
  }
}

export const userSupportService = new UserSupportService()
export default userSupportService
