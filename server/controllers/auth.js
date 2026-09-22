import users from "../Modals/Auth.js"
import jwt from "jsonwebtoken"
import mongoose from "mongoose"
import { createSession } from "./authSecurity.js"
import { deviceService } from "../services/deviceService.js"
import { networkService } from "../services/networkService.js"
import { loginDetectionService } from "../services/loginDetectionService.js"
import { securityBaselineService } from "../services/securityBaselineService.js"
import { evaluateLogin } from "../services/securityComparisonService.js"
import { pendingLoginService } from "../services/pendingLoginService.js"
import { otpService } from "../services/otpService.js"
import { trustedDeviceService } from "../services/trustedDeviceService.js"
import { loginHistoryService } from "../services/loginHistoryService.js"
import { TRUSTED_DEVICE_CONFIG } from "../config/trustedDeviceConfig.js"
import { sessionService } from "../services/sessionService.js"
import { suspiciousActivityService } from "../services/suspiciousActivityService.js"

// User login controller: registers new user if not found, or signs token for existing user
export const login = async (req, res) => {
    const { email, name, image, deviceInfo } = req.body
    try {
        // Collect and normalize device metadata non-blockingly (Phase 4)
        const deviceMetadata = deviceService.normalizeDeviceInfo(deviceInfo, req.headers)

        // Resolve client IP and approximate location non-blockingly (Phase 5)
        let networkInfo = null
        try {
            networkInfo = await networkService.getLoginNetworkInfo(req)
        } catch (netErr) {
            console.warn("[Auth] Non-fatal network resolution error:", netErr)
            networkInfo = {
                ip: { address: "127.0.0.1", version: "IPv4", isPublic: false, source: "error-fallback" },
                location: { city: null, state: null, country: null, status: "unavailable" }
            }
        }

        // Build unified security login context (Phases 4, 5, 6)
        const loginContext = networkService.buildLoginContext(deviceMetadata, networkInfo)

        let existingUser = await users.findOne({ email })
        if (!existingUser) {
            try {
                existingUser = await users.create({
                    email,
                    name: name || "User",
                    channelname: name || "User",
                    description: "Welcome to our tech channel! We cover the latest in technology, reviews, and tutorials.",
                    desc: "Welcome to our tech channel! We cover the latest in technology, reviews, and tutorials.",
                    image: image || "",
                    joinedon: new Date(),
                    joinedOn: new Date(),
                })
            } catch (createErr) {
                return res.status(500).json({ mess: "Something went wrong creating user..." })
            }
        }

        // 1. Evaluate login against Security Baseline (Phase 6)
        let baseline = null
        try {
            baseline = await securityBaselineService.getBaseline(existingUser._id)
        } catch (bErr) {
            console.warn("[Auth] Non-fatal baseline lookup error:", bErr)
        }

        const securityDecision = evaluateLogin(baseline, loginContext)

        // Evaluate backwards-compatible detectionResult
        let detectionResult = null
        try {
            detectionResult = await loginDetectionService.evaluateLoginContext(
                existingUser._id,
                loginContext
            )
        } catch (detErr) {
            detectionResult = loginDetectionService.createDefaultResult(false)
        }

        // Phase 8: Trusted Device Evaluation & High-Risk Override Check
        let activeTrustedDevice = null
        let isTrustedDeviceBypass = false

        if (existingUser?._id && TRUSTED_DEVICE_CONFIG.enabled) {
            try {
                const devSig =
                    loginContext.device?.signature ||
                    `${loginContext.device?.type || "desktop"}:${loginContext.device?.browser?.name || "browser"}:${loginContext.device?.os?.name || "os"}`
                activeTrustedDevice = await trustedDeviceService.findActiveTrustedDevice(
                    existingUser._id,
                    devSig
                )

                if (activeTrustedDevice) {
                    const isNewCountry = Boolean(securityDecision.signals?.isNewCountry)
                    const isCriticalRisk =
                        securityDecision.riskScore >= 60 || securityDecision.riskLevel === "CRITICAL"

                    if (isNewCountry || isCriticalRisk) {
                        // High-risk override: mandate OTP verification even on a trusted device
                        securityDecision.trustedDeviceChallenged = true
                        securityDecision.trustedDeviceReason = isNewCountry
                            ? "NEW_COUNTRY_OVERRIDE"
                            : "CRITICAL_RISK_OVERRIDE"
                    } else {
                        // Low/medium risk: bypass OTP verification on trusted device
                        isTrustedDeviceBypass = true
                        securityDecision.decision = "ALLOW"
                        securityDecision.trustedDeviceBypass = true

                        // Non-blocking update of trusted device activity
                        activeTrustedDevice.lastUsedAt = new Date()
                        const rawIp =
                            loginContext.network?.ipAddress ||
                            loginContext.network?.ip?.address ||
                            loginContext.clientIp
                        if (rawIp) activeTrustedDevice.lastKnownIP = rawIp
                        if (loginContext.network?.location?.city) {
                            activeTrustedDevice.lastKnownLocation = {
                                city: loginContext.network.location.city,
                                state: loginContext.network.location.state,
                                country: loginContext.network.location.country,
                                countryCode: loginContext.network.location.countryCode,
                            }
                        }
                        activeTrustedDevice
                            .save()
                            .catch((e) => console.warn("[Auth] Failed to update trusted device activity:", e))
                    }
                }
            } catch (tdErr) {
                console.warn("[Auth] Non-fatal trusted device check error:", tdErr)
            }
        }

        // 2. Authentication Gate: If verification required or high risk, DO NOT issue token
        if (
            securityDecision.decision === "VERIFICATION_REQUIRED" ||
            securityDecision.decision === "HIGH_RISK"
        ) {
            const pendingLogin = await pendingLoginService.createPendingLogin({
                userId: existingUser._id,
                userEmail: existingUser.email,
                loginContext,
                securityDecision,
            })

            let availableMethods = []
            try {
                const methodsRes = await otpService.getAvailableMethods(pendingLogin.pendingLoginId)
                availableMethods = methodsRes.availableMethods || []
            } catch (mErr) {
                availableMethods = [{ type: "EMAIL", masked: existingUser.email ? existingUser.email.slice(0, 3) + "***@" + existingUser.email.split("@")[1] : "***@***.com" }]
            }

            // Record OTP_REQUIRED in Login History (Phase 8)
            try {
                await loginHistoryService.recordLogin({
                    userId: existingUser._id,
                    status: TRUSTED_DEVICE_CONFIG.loginStatus.OTP_REQUIRED,
                    authenticationMethod: "PASSWORD",
                    loginContext,
                    verificationRequired: true,
                    verificationMethod: "OTP",
                })
            } catch (histErr) {
                console.warn("[Auth] Error recording login history:", histErr)
            }

            return res.status(200).json({
                status: "PENDING_VERIFICATION",
                decision: securityDecision.decision,
                pendingLoginId: pendingLogin.pendingLoginId,
                maskedIP: pendingLogin.maskedIP,
                availableMethods,
                securityDecision,
                riskLevel: securityDecision.riskLevel,
                riskScore: securityDecision.riskScore,
                reasons: securityDecision.reasons,
                expiresAt: pendingLogin.expiresAt,
                userEmail: existingUser.email,
                message: "Verification required: new environment detected.",
            })
        }

        // 3. ALLOWed: Seed or update verified baseline
        if (securityDecision.isInitialBaseline) {
            await securityBaselineService.createInitialBaseline(existingUser._id, loginContext)
        } else {
            await securityBaselineService.updateVerifiedBaseline(existingUser._id, loginContext)
        }

        let sessionId = null
        let tokens = null
        try {
            const sessionRes = await sessionService.createSession({
                userId: existingUser._id,
                user: existingUser,
                req,
                loginContext,
                authenticationMethod: "PASSWORD",
                trustedDeviceId: activeTrustedDevice?._id || null,
            })
            sessionId = sessionRes.sessionId
            tokens = sessionRes.tokens
        } catch (sErr) {
            console.warn("[Auth] Could not create managed session, falling back:", sErr)
            sessionId = "session-" + Date.now()
            const fallbackToken = jwt.sign(
                { email: existingUser.email, id: existingUser._id, sessionId },
                process.env.JWT_SECRET || "thisisayoutubeclonesecretkey",
                { expiresIn: "7d" }
            )
            tokens = { accessToken: fallbackToken, refreshToken: `rft_${sessionId}`, token: fallbackToken }
        }

        const token = tokens?.accessToken || tokens?.token
        const refreshToken = tokens?.refreshToken

        const doc = existingUser._doc || existingUser
        const userObj = {
            ...doc,
            channelname: doc.channelname || doc.name,
            description: doc.description || doc.desc || "",
            joinedon: doc.joinedon || doc.joinedOn,
            themeMode: doc.themeMode || "automatic",
            themePreference: doc.themePreference || "dark",
            lastThemeUpdatedAt: doc.lastThemeUpdatedAt || null,
        }

        // Record SUCCESS in Login History (Phase 8)
        try {
            await loginHistoryService.recordLogin({
                userId: existingUser._id,
                status: TRUSTED_DEVICE_CONFIG.loginStatus.SUCCESS,
                authenticationMethod: "PASSWORD",
                loginContext,
                verificationRequired: false,
                trustedDeviceId: activeTrustedDevice?._id || null,
            })
        } catch (histErr) {
            console.warn("[Auth] Error recording login history:", histErr)
        }

        // Phase 10: Security Alerts & Suspicious Activity Detection
        try {
            await suspiciousActivityService.evaluatePostLoginAlerts({
                user: existingUser,
                loginContext,
                securityDecision,
                sessionId,
                trustedDevice: activeTrustedDevice,
            })
        } catch (alertErr) {
            console.warn("[Auth] Non-fatal security alert evaluation notice:", alertErr)
        }

        return res.status(200).json({
            status: "ALLOWED",
            ...userObj,
            result: userObj,
            user: userObj,
            token,
            accessToken: token,
            refreshToken,
            sessionId,
            deviceMetadata,
            networkInfo,
            loginContext,
            detectionResult,
            securityDecision,
            trustedDevice: activeTrustedDevice
                ? {
                      id: activeTrustedDevice._id.toString(),
                      isTrusted: true,
                      deviceName: activeTrustedDevice.customName || activeTrustedDevice.deviceName,
                  }
                : null,
        })
    } catch (error) {
        console.error("[Auth] Login error:", error)
        try {
            suspiciousActivityService.trackFailedLogin({
                email: req.body?.email,
                ip: req.ip,
                loginContext: typeof loginContext !== "undefined" ? loginContext : {},
                reason: error.message,
            })
        } catch {}
        return res.status(500).json({ mess: "Something went wrong..." })
    }
}

// Standard Authenticated Logout (Phase 9)
export const logout = async (req, res) => {
    try {
        const userId = req.user?.id
        const sessionId = req.user?.sessionId

        if (userId && sessionId) {
            await sessionService.terminateSession(userId, sessionId, "USER_LOGOUT")
        }

        return res.status(200).json({
            success: true,
            message: "Logged out successfully",
        })
    } catch (err) {
        console.error("[Auth] Logout error:", err)
        return res.status(500).json({ message: "Error processing logout" })
    }
}

// Phase 6: Query Pending Login Status
export const getPendingLoginStatus = async (req, res) => {
    const { pendingLoginId } = req.params
    try {
        const pending = await pendingLoginService.getPendingLogin(pendingLoginId)
        if (!pending) {
            return res.status(404).json({ message: "Pending login request not found or expired" })
        }
        return res.status(200).json({
            pendingLoginId: pending.pendingLoginId,
            status: pending.status,
            maskedIP: pending.maskedIP,
            securityDecision: pending.securityDecision,
            securitySignals: pending.securitySignals,
            expiresAt: pending.expiresAt,
            userEmail: pending.userEmail,
        })
    } catch (err) {
        return res.status(500).json({ message: "Error fetching pending login status" })
    }
}

// Update channel data (name, desc, channelname, description)
export const updateChanelData = async (req, res) => {
    const { id: _id } = req.params
    const { name, desc, channelname, description } = req.body

    if (!mongoose.Types.ObjectId.isValid(_id)) {
        return res.status(404).json({ message: "Channel unavailable..." })
    }

    const finalName = channelname || name
    const finalDesc = description !== undefined ? description : desc

    try {
        const updateData = await users.findByIdAndUpdate(
            _id,
            {
                $set: {
                    name: finalName,
                    channelname: finalName,
                    desc: finalDesc,
                    description: finalDesc,
                },
            },
            { new: true }
        )
        const doc = updateData._doc || updateData
        const formatted = {
            ...doc,
            channelname: doc.channelname || doc.name,
            description: doc.description || doc.desc,
            joinedon: doc.joinedon || doc.joinedOn,
            themeMode: doc.themeMode || "automatic",
            themePreference: doc.themePreference || "dark",
            lastThemeUpdatedAt: doc.lastThemeUpdatedAt || null,
        }
        res.status(200).json({
            ...formatted,
            result: formatted,
            user: formatted,
        })
    } catch (error) {
        res.status(405).json({ message: error.message })
    }
}

// Alias for standard spelling
export const updateChannelData = updateChanelData

// Fetch all registered channels / users
const defaultChannels = [
    {
        _id: "662a1f8e9c1d2e3f4a5b6c70",
        name: "StreamHub Official",
        channelname: "StreamHub Official",
        email: "official@streamhub.io",
        desc: "Welcome to StreamHub Official Channel!",
        description: "Welcome to StreamHub Official Channel!",
        image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
        joinedon: new Date().toISOString(),
        joinedOn: new Date().toISOString(),
    }
]

export const getAllChanels = async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.status(200).json(defaultChannels)
        }
        const allChanels = await users.find()
        const allChanelDetails = []
        allChanels.forEach((channel) => {
            allChanelDetails.push({
                _id: channel._id,
                name: channel.name,
                channelname: channel.channelname || channel.name,
                email: channel.email,
                desc: channel.desc || channel.description,
                description: channel.description || channel.desc,
                image: channel.image,
                joinedon: channel.joinedon || channel.joinedOn,
                joinedOn: channel.joinedOn || channel.joinedon,
            })
        })
        res.status(200).json(allChanelDetails.length > 0 ? allChanelDetails : defaultChannels)
    } catch (error) {
        res.status(200).json(defaultChannels)
    }
}

// Alias for standard spelling
export const getAllChannels = getAllChanels

// Get single channel by ID
export const getChannelById = async (req, res) => {
    const { id: _id } = req.params

    if (_id === "1" || !mongoose.Types.ObjectId.isValid(_id)) {
        try {
            const firstUser = await users.findOne()
            if (firstUser && _id !== "1") {
                const doc = firstUser._doc || firstUser
                return res.status(200).json({
                    ...doc,
                    channelname: doc.channelname || doc.name,
                    description: doc.description || doc.desc || "",
                    joinedon: doc.joinedon || doc.joinedOn,
                })
            }
        } catch (e) {}

        return res.status(200).json({
            _id: "1",
            name: "Tech Channel",
            channelname: "Tech Channel",
            description: "Welcome to our tech channel! We cover the latest in technology, reviews, and tutorials.",
            desc: "Welcome to our tech channel! We cover the latest in technology, reviews, and tutorials.",
            email: "techchannel@example.com",
            image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
            joinedon: new Date().toISOString(),
        })
    }

    try {
        const channel = await users.findById(_id)
        if (!channel) {
            return res.status(200).json({
                _id,
                name: "Channel",
                channelname: "Channel",
                description: "Welcome to this channel!",
                image: "",
                joinedon: new Date().toISOString(),
            })
        }
        const doc = channel._doc || channel
        const formatted = {
            ...doc,
            channelname: doc.channelname || doc.name,
            description: doc.description || doc.desc || "",
            joinedon: doc.joinedon || doc.joinedOn,
            themeMode: doc.themeMode || "automatic",
            themePreference: doc.themePreference || "dark",
            lastThemeUpdatedAt: doc.lastThemeUpdatedAt || null,
        }
        res.status(200).json({
            ...formatted,
            result: formatted,
            user: formatted,
        })
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}
