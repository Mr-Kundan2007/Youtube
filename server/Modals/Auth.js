import mongoose from "mongoose"

const userSchema = mongoose.Schema({
    name: { type: String },
    channelname: { type: String },
    description: { type: String },
    desc: { type: String },
    email: { type: String, required: true },
    image: { type: String },
    joinedon: { type: Date, default: Date.now },
    joinedOn: { type: Date, default: Date.now },
    role: { type: String, enum: ["user", "admin", "moderator"], default: "user" },
    status: { type: String, enum: ["active", "blocked", "suspended"], default: "active" },

    // Phase 7: Contact Verification Status
    phone: { type: String, default: null },
    mobile: { type: String, default: null },
    isEmailVerified: { type: Boolean, default: true },
    isMobileVerified: { type: Boolean, default: false },

    // Phase 2 & 3: Persistent Theme Preferences & Cross-Device Synchronization
    themeMode: { type: String, enum: ["automatic", "light", "dark"], default: "automatic" },
    themePreference: { type: String, enum: ["light", "dark"], default: "dark" },
    lastThemeUpdatedAt: { type: Date, default: null },

    themeSettings: {
        mode: { type: String, enum: ["automatic", "light", "dark"], default: "automatic" },
        preference: { type: String, enum: ["light", "dark"], default: "dark" },
        updatedAt: { type: Date, default: Date.now },
    },

    // Phase 10: Advanced Security Alerts & Account Protection
    accountProtectionState: {
        type: String,
        enum: ["NORMAL", "MONITORING", "PROTECTED", "TEMPORARILY_RESTRICTED", "SECURITY_REVIEW"],
        default: "NORMAL",
    },
    protectionStateReason: { type: String, default: null },
    protectionStateUpdatedAt: { type: Date, default: null },

    // Phase 2 (Commenting): Preferred Language
    preferredLanguage: { type: String, default: "en" },
    preferred_language: { type: String, default: "en" },
})

// Ensure dual compatibility between flat theme fields and nested themeSettings
userSchema.pre("save", function (next) {
    if (this.preferredLanguage && !this.preferred_language) this.preferred_language = this.preferredLanguage
    if (this.preferred_language && !this.preferredLanguage) this.preferredLanguage = this.preferred_language

    if (!this.themeSettings) {
        this.themeSettings = {
            mode: this.themeMode || "automatic",
            preference: this.themePreference || "dark",
            updatedAt: this.lastThemeUpdatedAt || new Date(),
        }
    } else {
        if (this.themeMode && !this.themeSettings.mode) this.themeSettings.mode = this.themeMode
        if (this.themeSettings.mode && !this.themeMode) this.themeMode = this.themeSettings.mode
        if (this.themePreference && !this.themeSettings.preference) this.themeSettings.preference = this.themePreference
        if (this.themeSettings.preference && !this.themePreference) this.themePreference = this.themeSettings.preference
        if (this.lastThemeUpdatedAt && !this.themeSettings.updatedAt) this.themeSettings.updatedAt = this.lastThemeUpdatedAt
        if (this.themeSettings.updatedAt && !this.lastThemeUpdatedAt) this.lastThemeUpdatedAt = this.themeSettings.updatedAt
    }
    next()
})

export default mongoose.models.User || mongoose.model("User", userSchema)
