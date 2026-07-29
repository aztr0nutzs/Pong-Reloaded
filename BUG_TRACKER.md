# Bug Tracker

Statuses: **OPEN**, **BLOCKED**, **RESOLVED**, **VERIFIED**.

| ID | Priority | Status | Area | Finding | Next action/evidence |
|---|---|---|---|---|---|
| BUILD-001 | P0 | VERIFIED | Gradle wrapper | The text-only bootstrap downloads the official pinned Gradle distribution, verifies its SHA-256, generates the ignored wrapper JAR locally, and validates the wrapper. | Shell bootstrap and `./gradlew --version` passed; PowerShell implementation requires validation on a Windows host. |
| BUILD-002 | P0 | VERIFIED | Debug signing | Debug builds use Android's standard generated debug keystore; release signing remains environment-driven and separate. | `validateSigningDebug` and `assembleDebug` passed without a root `debug.keystore`. |
| BUILD-003 | P0 | RESOLVED | Secrets defaults | Empty `GEMINI_API_KEY=` generated invalid Java: `public static final String GEMINI_API_KEY = ;`. | Non-secret `DEFAULT_API_KEY` now generates a valid quoted default; external Gradle compilation and assembly passed. |
| UI-001 | P0 | RESOLVED | Module contract | `UIRenderer` methods were exported individually, but `window.UIRenderer` was undefined, so guarded boot navigation never entered the menu. | Exported the controller and added contract coverage; browser boot/menu QA passed. |
| UI-002 | P0 | RESOLVED | UI preservation | A development console obscured the top 30% of every screen, and the table texture class dimmed the entire root application. | Removed only the debug injection and misplaced root class; retained the intended table texture element and approved screen structure. |
| STATE-001 | P0 | RESOLVED | Boot lifecycle | Manual boot skip left the animation callback alive; it could reopen the menu after a match entered `PLAYER_AIM`. | Boot completion is one-shot; browser match initialization remains on the game screen. |
| UI-003 | P1 | RESOLVED | HUD contracts | `UIRenderer` referenced five nonexistent legacy DOM IDs, leaving score, accuracy, stats, and trick progress disconnected. | Bound approved current IDs and verified score/accuracy/toast/trick-segment initialization in browser QA. |
| TEST-001 | P1 | VERIFIED | Deterministic regression | Fixed-step, collision, throw-control independence, prediction/live parity, lifecycle, and AI repeatability require regression coverage. | All Node suites passed in the final regression. |
| TEST-002 | P2 | BLOCKED | Robolectric network | Robolectric's Android 16 instrumented JAR fetch initially failed because the forked test JVM lacked proxy properties. | Test passed after providing the environment proxy as `JAVA_TOOL_OPTIONS`; CI should propagate equivalent network settings or pre-cache the artifact. |
| ANDROID-001 | P1 | BLOCKED | Runtime QA | No Android device/emulator was available for WebView, cutout, system-bar, pause/background, and packaging smoke QA. | Run the documented portrait matrix on API 28 and API 36 before release. |
| ASSET-001 | P2 | OPEN | Offline presentation | Google Fonts and Material Symbols remain remote dependencies; the browser QA environment displayed fallback glyph text when certificate trust blocked them. | Verify normal Android network loading and decide in a separate asset PR whether production must package fonts/icons locally. |
| FIREBASE-001 | P2 | BLOCKED | Firebase configuration | `google-services.json` is absent; debug build continues under the configured warning strategy. | Supply the environment-specific file securely before validating Firebase-backed behavior. |
| SCM-001 | P0 | BLOCKED | Upstream sync | Repository has no configured `origin`, so fetch/rebase and open-PR conflict inspection cannot run. | Configure the correct remote and rebase onto `origin/main` before integration. |
