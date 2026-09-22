import express from "express"
import { requireAuth } from "../middleware/authMiddleware.js"
import {
  createSupportTicketHandler,
  getUserTicketsHandler,
  getTicketDetailsHandler,
  addTicketMessageHandler,
} from "../controllers/userSupportController.js"

const router = express.Router()

router.use(requireAuth)

router.post("/download", createSupportTicketHandler)
router.get("/tickets", getUserTicketsHandler)
router.get("/tickets/:ticketId", getTicketDetailsHandler)
router.post("/tickets/:ticketId/messages", addTicketMessageHandler)

export default router
