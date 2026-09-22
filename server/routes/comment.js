import express from "express"
import {
  postcomment,
  getcomment,
  deletecomment,
  editcomment,
  postreply,
  getreplies,
  reactcomment,
  searchmentionusers,
  getcommenthistory,
  translatecomment,
} from "../controllers/comment.js"
import { optionalAuth, requireAuth } from "../middleware/authMiddleware.js"
import { commentRateLimit } from "../middleware/commentRateLimitMiddleware.js"
import { getCaptchaPublicConfig } from "../services/captchaService.js"
import {
  reportCommentHandler,
  getReportStatusHandler,
} from "../controllers/commentReportingController.js"

const routes = express.Router()

// CAPTCHA Public Config (Phase 9 Rate Limiting & CAPTCHA)
routes.get("/captcha/config", (req, res) => res.json(getCaptchaPublicConfig()))
routes.get("/captcha-config", (req, res) => res.json(getCaptchaPublicConfig()))

// Comment Reporting (Phase 10 Reporting & Admin Moderation) - registered BEFORE wildcards
routes.post("/:commentId/reports", requireAuth, commentRateLimit("comment_report"), reportCommentHandler)
routes.post("/:commentId/report", requireAuth, commentRateLimit("comment_report"), reportCommentHandler)
routes.post("/report/:commentId", requireAuth, commentRateLimit("comment_report"), reportCommentHandler)
routes.get("/:commentId/reports/status", optionalAuth, getReportStatusHandler)
routes.get("/:commentId/report-status", optionalAuth, getReportStatusHandler)

// Multilingual Translation (Phase 7 Translation System) - registered BEFORE wildcards
routes.post("/:commentId/translate", optionalAuth, commentRateLimit("comment_translate"), translatecomment)
routes.post("/translate/:commentId", optionalAuth, commentRateLimit("comment_translate"), translatecomment)
routes.get("/:commentId/translate", optionalAuth, commentRateLimit("comment_translate"), translatecomment)
routes.get("/:commentId/translations", optionalAuth, commentRateLimit("comment_translate"), translatecomment)
routes.get("/translate/:commentId", optionalAuth, commentRateLimit("comment_translate"), translatecomment)

// Revision History (Phase 6 Edit History) - registered BEFORE wildcards
routes.get("/:commentId/history", optionalAuth, getcommenthistory)
routes.get("/history/:commentId", optionalAuth, getcommenthistory)

// Mention Search (Phase 5 @Mentions autocomplete) - registered BEFORE wildcards
routes.get("/users/mention-search", optionalAuth, commentRateLimit("mention_search"), searchmentionusers)
routes.get("/mentions/users", optionalAuth, commentRateLimit("mention_search"), searchmentionusers)
routes.get("/mention-search", optionalAuth, commentRateLimit("mention_search"), searchmentionusers)

// POST reactions (Phase 5 Likes & Dislikes)
routes.post("/:commentId/reactions", optionalAuth, commentRateLimit("comment_reaction"), reactcomment)
routes.post("/:commentId/reaction", optionalAuth, commentRateLimit("comment_reaction"), reactcomment)
routes.post("/:commentId/like", optionalAuth, commentRateLimit("comment_reaction"), (req, res, next) => {
  req.body = { ...req.body, reaction_type: "like" }
  return reactcomment(req, res, next)
})
routes.post("/:commentId/dislike", optionalAuth, commentRateLimit("comment_reaction"), (req, res, next) => {
  req.body = { ...req.body, reaction_type: "dislike" }
  return reactcomment(req, res, next)
})
routes.post("/reaction/:commentId", optionalAuth, commentRateLimit("comment_reaction"), reactcomment)

// POST replies (Phase 4 Replies & Threaded Comments)
routes.post("/:commentId/replies", optionalAuth, commentRateLimit("reply_create"), postreply)
routes.post("/reply/:commentId", optionalAuth, commentRateLimit("reply_create"), postreply)
routes.post("/replies/:commentId", optionalAuth, commentRateLimit("reply_create"), postreply)

// GET replies (Phase 4 Replies Retrieval)
routes.get("/:commentId/replies", optionalAuth, getreplies)
routes.get("/replies/:commentId", optionalAuth, getreplies)
routes.get("/reply/:commentId", optionalAuth, getreplies)

// POST comments (creates new comment on content)
routes.post("/post", optionalAuth, commentRateLimit("comment_create"), postcomment)
routes.post("/postcomment", optionalAuth, commentRateLimit("comment_create"), postcomment)
routes.post("/content/:contentId", optionalAuth, commentRateLimit("comment_create"), postcomment)
routes.post("/:contentId", optionalAuth, commentRateLimit("comment_create"), postcomment)
routes.post("/", optionalAuth, commentRateLimit("comment_create"), postcomment)

// GET comments (retrieves comments for content with pagination & sorting)
routes.get("/get/:videoid", optionalAuth, getcomment)
routes.get("/getcomment/:videoid", optionalAuth, getcomment)
routes.get("/video/:videoid", optionalAuth, getcomment)
routes.get("/content/:contentId", optionalAuth, getcomment)
routes.get("/:videoid", optionalAuth, getcomment)
routes.get("/", optionalAuth, getcomment)

// DELETE comment (soft deletes comment)
routes.delete("/delete/:id", optionalAuth, deletecomment)
routes.delete("/deletecomment/:id", optionalAuth, deletecomment)
routes.delete("/:id", optionalAuth, deletecomment)

// EDIT / UPDATE comment
routes.patch("/edit/:id", optionalAuth, commentRateLimit("comment_edit"), editcomment)
routes.patch("/editcomment/:id", optionalAuth, commentRateLimit("comment_edit"), editcomment)
routes.put("/edit/:id", optionalAuth, commentRateLimit("comment_edit"), editcomment)
routes.patch("/:id", optionalAuth, commentRateLimit("comment_edit"), editcomment)
routes.put("/:id", optionalAuth, commentRateLimit("comment_edit"), editcomment)

export default routes
