import express from "express"
import {
    login,
    updateChanelData,
    updateChannelData,
    getAllChanels,
    getAllChannels,
    getChannelById,
    getPendingLoginStatus,
    logout,
} from "../controllers/auth.js"
import {
    getThemePreference,
    updateThemePreference
} from "../controllers/themePreferenceController.js"
import { requireAuth } from "../middleware/authMiddleware.js"
import otpRoutes from "./otpRoutes.js"

const routes = express.Router()

// Phase 7: OTP Routes
routes.use("/otp", otpRoutes)

routes.post("/login", login)
routes.post("/logout", requireAuth, logout)
routes.get("/pending-login/:pendingLoginId", getPendingLoginStatus)
routes.patch("/update/:id", updateChanelData)
routes.post("/update/:id", updateChanelData)
routes.get("/getAllChanels", getAllChanels)
routes.get("/getAllChannels", getAllChannels)
routes.get("/channel/:id", getChannelById)

// Phase 3: Persistent Cross-Device Theme Preferences
routes.get("/theme", requireAuth, getThemePreference)
routes.patch("/theme", requireAuth, updateThemePreference)
routes.put("/theme", requireAuth, updateThemePreference)

// Phase 5: Mention search
import("../services/mentionService.js").then(({ searchUsersForMention }) => {
  routes.get("/mention-search", async (req, res) => {
    try {
      const users = await searchUsersForMention(req.query?.q || req.query?.query || "", req.query?.limit || 10)
      res.status(200).json(users)
    } catch (err) {
      res.status(500).json({ message: err.message })
    }
  })
})

export default routes
