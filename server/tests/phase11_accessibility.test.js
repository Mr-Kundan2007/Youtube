/**
 * Phase 11 Automated Responsive, Mobile Experience & Accessibility Test Suite
 *
 * Validates:
 * 1. Safe Area & Design Tokens in globals.css (pt-safe, pb-safe, touch-target-44, sr-only, prefers-reduced-motion)
 * 2. Screen Reader Live Announcements (LiveAnnouncer.tsx polite & assertive regions)
 * 3. Keyboard Shortcuts & Input Guarding (useAccessibilityShortcuts.ts)
 * 4. Mobile Toolbar & Bottom Sheet (MeetingControls.tsx & MobileMoreMenu.tsx)
 * 5. Responsive Participant Grid (1-col, 2-col, 2x2, and 5+ filmstrip)
 * 6. Accessible Dialog Semantics in Drawers & Modals (ChatPanel, ParticipantList, DeviceSettingsModal)
 * 7. Accessible Form Controls in MeetingLobby (htmlFor, aria-invalid, aria-describedby)
 * 8. Viewport Fit & Dynamic Height Configuration (_app.tsx, MeetingRoom.tsx, MeetingHeader.tsx)
 */

import assert from "assert"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, "../../")

function readFile(relativePath) {
  const fullPath = path.join(ROOT_DIR, relativePath)
  assert.ok(fs.existsSync(fullPath), `File must exist: ${relativePath}`)
  return fs.readFileSync(fullPath, "utf-8")
}

console.log("===============================================================")
console.log(" PHASE 11: RESPONSIVE / MOBILE EXPERIENCE & ACCESSIBILITY TEST")
console.log("===============================================================")

let passedTests = 0
let failedTests = 0

function runTest(name, fn) {
  try {
    fn()
    console.log(`  PASS: ${name}`)
    passedTests++
  } catch (err) {
    console.error(`  FAIL: ${name}`)
    console.error(`    ${err.message}`)
    failedTests++
  }
}

// --------------------------------------------------------------------------
// TEST 1: Design Tokens, Safe Areas & Reduced Motion
// --------------------------------------------------------------------------
runTest("1. Safe Area, Touch Target & Reduced Motion Tokens in globals.css", () => {
  const css = readFile("src/styles/globals.css")

  // Safe area utilities
  assert.ok(css.includes(".pt-safe"), "Must include .pt-safe utility")
  assert.ok(css.includes("env(safe-area-inset-top"), "Must use env(safe-area-inset-top)")
  assert.ok(css.includes(".pb-safe"), "Must include .pb-safe utility")
  assert.ok(css.includes("env(safe-area-inset-bottom"), "Must use env(safe-area-inset-bottom)")
  assert.ok(css.includes(".pl-safe"), "Must include .pl-safe utility")
  assert.ok(css.includes(".pr-safe"), "Must include .pr-safe utility")

  // Touch target utility (minimum 44x44px per WCAG AAA)
  assert.ok(css.includes(".touch-target-44"), "Must include .touch-target-44 utility")
  assert.ok(css.includes("min-height: 44px"), "Touch target must have min-height 44px")
  assert.ok(css.includes("min-width: 44px"), "Touch target must have min-width 44px")

  // Screen reader utility
  assert.ok(css.includes(".sr-only"), "Must include .sr-only utility")

  // Reduced motion support
  assert.ok(
    css.includes("@media (prefers-reduced-motion: reduce)"),
    "Must include @media (prefers-reduced-motion: reduce) query"
  )
})

// --------------------------------------------------------------------------
// TEST 2: Live Announcer (Polite & Assertive Regions)
// --------------------------------------------------------------------------
runTest("2. Screen Reader Live Announcements in LiveAnnouncer.tsx", () => {
  const code = readFile("src/features/meetings/components/LiveAnnouncer.tsx")

  assert.ok(code.includes("LiveAnnouncerProvider"), "Must export LiveAnnouncerProvider")
  assert.ok(code.includes("useAnnouncer"), "Must export useAnnouncer hook")

  // Polite region
  assert.ok(code.includes('aria-live="polite"'), "Must render polite live region")
  assert.ok(code.includes('role="status"'), "Polite region must have role status")

  // Assertive region
  assert.ok(code.includes('aria-live="assertive"'), "Must render assertive live region")
  assert.ok(code.includes('role="alert"'), "Assertive region must have role alert")

  // Both should be hidden from sighted users via sr-only
  assert.ok(code.includes("sr-only"), "Announcer regions must be visually hidden via sr-only")
})

// --------------------------------------------------------------------------
// TEST 3: Keyboard Shortcuts & Input Guarding
// --------------------------------------------------------------------------
runTest("3. Keyboard Shortcuts & Input Guarding in useAccessibilityShortcuts.ts", () => {
  const code = readFile("src/features/meetings/hooks/useAccessibilityShortcuts.ts")

  // Target element checks
  assert.ok(code.includes('target?.tagName === "INPUT"'), "Must ignore shortcuts when inside INPUT")
  assert.ok(code.includes('target?.tagName === "TEXTAREA"'), "Must ignore shortcuts when inside TEXTAREA")
  assert.ok(code.includes('target?.tagName === "SELECT"'), "Must ignore shortcuts when inside SELECT")
  assert.ok(code.includes("target?.isContentEditable"), "Must ignore shortcuts when inside contenteditable")

  // Escape key always works
  assert.ok(code.includes('e.key === "Escape"'), "Must handle Escape key to close modals")
  assert.ok(code.includes("onCloseModals()"), "Escape key must call onCloseModals")

  // Shortcuts: M, V, C, P, H
  assert.ok(code.includes('key === "m"'), "Must handle M shortcut for mic")
  assert.ok(code.includes('key === "v"'), "Must handle V shortcut for camera")
  assert.ok(code.includes('key === "c"'), "Must handle C shortcut for chat")
  assert.ok(code.includes('key === "p"'), "Must handle P shortcut for participants")
  assert.ok(code.includes('key === "h"'), "Must handle H shortcut for hand raise")

  // Announces to screen readers
  assert.ok(code.includes("announce("), "Shortcuts must trigger screen reader announcements")
})

// --------------------------------------------------------------------------
// TEST 4: Mobile Toolbar & Bottom Sheet
// --------------------------------------------------------------------------
runTest("4. Mobile Toolbar & Bottom Sheet (MeetingControls & MobileMoreMenu)", () => {
  const controls = readFile("src/features/meetings/components/MeetingControls.tsx")
  const moreMenu = readFile("src/features/meetings/components/MobileMoreMenu.tsx")

  // MeetingControls has dual-dock design
  assert.ok(controls.includes("sm:hidden"), "Must contain mobile-specific dock hidden on sm+")
  assert.ok(controls.includes("hidden sm:flex"), "Must contain desktop dock hidden on mobile")
  assert.ok(controls.includes("pb-safe"), "Toolbar must use pb-safe for mobile home indicator")
  assert.ok(controls.includes("touch-target-44"), "Controls must use 44px touch targets")

  // Mobile More Menu contains secondary actions
  assert.ok(moreMenu.includes("role=\"dialog\""), "MobileMoreMenu must be an accessible dialog")
  assert.ok(moreMenu.includes("aria-modal=\"true\""), "MobileMoreMenu must have aria-modal=true")
  assert.ok(moreMenu.includes("pb-safe"), "MobileMoreMenu must have pb-safe")
  assert.ok(moreMenu.includes("touch-target-44"), "MobileMoreMenu items must have 44px touch targets")
  assert.ok(moreMenu.includes("onToggleScreenShare"), "MobileMoreMenu must support screen share")
  assert.ok(moreMenu.includes("onToggleChat"), "MobileMoreMenu must support chat toggle")
  assert.ok(moreMenu.includes("onToggleParticipants"), "MobileMoreMenu must support participants toggle")
  assert.ok(moreMenu.includes("onToggleHandRaise"), "MobileMoreMenu must support hand raise toggle")
  assert.ok(moreMenu.includes("onSendReaction"), "MobileMoreMenu must support reactions")
  assert.ok(moreMenu.includes("onOpenSecurity"), "MobileMoreMenu must support security modal")
  assert.ok(moreMenu.includes("onOpenSettings"), "MobileMoreMenu must support settings modal")
})

// --------------------------------------------------------------------------
// TEST 5: Responsive Video Grid (1, 2, 3-4, 5+ Participants)
// --------------------------------------------------------------------------
runTest("5. Responsive Video Grid Layouts in ParticipantGrid.tsx", () => {
  const grid = readFile("src/features/meetings/components/ParticipantGrid.tsx")

  // 1 participant
  assert.ok(grid.includes("grid-cols-1"), "Must support 1-column layout")

  // 2 participants: vertical on mobile, 2-col on sm+
  assert.ok(grid.includes("grid-cols-1 sm:grid-cols-2"), "2 participants must be 1-col on mobile, 2-col on sm+")

  // 3-4 participants: 2x2 grid
  assert.ok(grid.includes("grid-cols-2"), "3-4 participants must use 2x2 grid")

  // 5+ participants: active-speaker spotlight and horizontal filmstrip
  assert.ok(grid.includes("overflow-x-auto"), "5+ participants must render horizontal scrollable thumbnail strip")
  assert.ok(grid.includes("activeSpeaker"), "Grid must track and spotlight active speaker")
  assert.ok(grid.includes("role=\"region\""), "Grid must designate region for accessibility")
  assert.ok(grid.includes("aria-label"), "Grid must provide descriptive aria-label")
})

// --------------------------------------------------------------------------
// TEST 6: Accessible Drawers & Modals (ChatPanel, ParticipantList, DeviceSettingsModal)
// --------------------------------------------------------------------------
runTest("6. Accessible Drawers & Modals (ChatPanel, ParticipantList, DeviceSettingsModal)", () => {
  const chat = readFile("src/features/meetings/components/ChatPanel.tsx")
  const participants = readFile("src/features/meetings/components/ParticipantList.tsx")
  const settings = readFile("src/features/meetings/components/DeviceSettingsModal.tsx")

  // ChatPanel
  assert.ok(chat.includes('role="dialog"'), "ChatPanel must have role dialog")
  assert.ok(chat.includes('aria-modal="true"'), "ChatPanel must have aria-modal=true")
  assert.ok(chat.includes("pb-safe"), "ChatPanel must use pb-safe for input area")
  assert.ok(chat.includes("touch-target-44"), "ChatPanel must use touch-target-44 on buttons")
  assert.ok(chat.includes("max-sm:rounded-t-3xl"), "ChatPanel must render as mobile bottom sheet on small screens")

  // ParticipantList
  assert.ok(participants.includes('role="dialog"'), "ParticipantList must have role dialog")
  assert.ok(participants.includes('aria-modal="true"'), "ParticipantList must have aria-modal=true")
  assert.ok(participants.includes("pb-safe"), "ParticipantList must use pb-safe")
  assert.ok(participants.includes("touch-target-44"), "ParticipantList must use touch-target-44")
  assert.ok(participants.includes("max-sm:rounded-t-3xl"), "ParticipantList must render as mobile bottom sheet on small screens")

  // DeviceSettingsModal
  assert.ok(settings.includes('role="dialog"'), "DeviceSettingsModal must have role dialog")
  assert.ok(settings.includes('aria-modal="true"'), "DeviceSettingsModal must have aria-modal=true")
  assert.ok(settings.includes("pb-safe"), "DeviceSettingsModal must use pb-safe")
  assert.ok(settings.includes("touch-target-44"), "DeviceSettingsModal must use touch-target-44")
  assert.ok(settings.includes("max-sm:rounded-t-3xl"), "DeviceSettingsModal must render as mobile bottom sheet on small screens")
})

// --------------------------------------------------------------------------
// TEST 7: Accessible Form Controls in MeetingLobby
// --------------------------------------------------------------------------
runTest("7. Accessible Form Controls in MeetingLobby.tsx", () => {
  const lobby = readFile("src/features/meetings/components/MeetingLobby.tsx")

  assert.ok(lobby.includes('htmlFor="lobby-display-name"'), "Label must link to input via htmlFor")
  assert.ok(lobby.includes('id="lobby-display-name"'), "Input must have matching id")
  assert.ok(lobby.includes("aria-invalid="), "Input must declare aria-invalid state")
  assert.ok(lobby.includes("aria-describedby="), "Input must declare aria-describedby for errors")
  assert.ok(lobby.includes("touch-target-44"), "Buttons must have min 44px touch targets")
})

// --------------------------------------------------------------------------
// TEST 8: Viewport Configuration & Dynamic Height
// --------------------------------------------------------------------------
runTest("8. Viewport Configuration & Dynamic Viewport Height", () => {
  const app = readFile("src/pages/_app.tsx")
  const room = readFile("src/features/meetings/components/MeetingRoom.tsx")
  const header = readFile("src/features/meetings/components/MeetingHeader.tsx")

  // Viewport-fit=cover
  assert.ok(app.includes("viewport-fit=cover"), "Viewport meta tag must specify viewport-fit=cover")

  // Meeting room dedicated layout
  assert.ok(app.includes("isMeetingRoom"), "App must provide dedicated immersive layout for meeting rooms")

  // Dynamic height
  assert.ok(room.includes("h-[100dvh]"), "MeetingRoom must use h-[100dvh] for mobile browsers")

  // Safe area header padding
  assert.ok(header.includes("pt-safe"), "MeetingHeader must use pt-safe for top notches and status bars")
  assert.ok(header.includes("touch-target-44"), "MeetingHeader link copy must have touch-target-44")
})

console.log("---------------------------------------------------------------")
console.log(`TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`)
console.log("===============================================================")

if (failedTests > 0) {
  process.exit(1)
} else {
  process.exit(0)
}
