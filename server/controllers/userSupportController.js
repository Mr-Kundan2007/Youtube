import { userSupportService } from "../services/userSupportService.js"
import { sendSuccess, sendError } from "../utils/apiResponse.js"

/**
 * POST /api/support/download
 */
export const createSupportTicketHandler = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id
    const { downloadId, issueType, description, priority } = req.body
    const result = await userSupportService.createTicket(userId, {
      downloadId,
      issueType,
      description,
      priority,
    })
    return sendSuccess(res, result, 201, "Support ticket created successfully")
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * GET /api/support/tickets
 */
export const getUserTicketsHandler = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id
    const { page, limit, status } = req.query
    const result = await userSupportService.getUserTickets(userId, { page, limit, status })
    return sendSuccess(res, result, "Support tickets retrieved successfully")
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * GET /api/support/tickets/:ticketId
 */
export const getTicketDetailsHandler = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id
    const { ticketId } = req.params
    const ticket = await userSupportService.getTicketDetails(userId, ticketId)
    return sendSuccess(res, ticket, "Ticket details retrieved successfully")
  } catch (err) {
    return sendError(res, err)
  }
}

/**
 * POST /api/support/tickets/:ticketId/messages
 */
export const addTicketMessageHandler = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id
    const { ticketId } = req.params
    const { message } = req.body
    const result = await userSupportService.addMessage(userId, ticketId, message)
    return sendSuccess(res, result, "Message added successfully")
  } catch (err) {
    return sendError(res, err)
  }
}
