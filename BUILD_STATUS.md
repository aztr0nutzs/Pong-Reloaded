# Build Status

Final regression recorded: 2026-07-28 (UTC).

## Production Gate

**NOT PRODUCTION READY.** The debug-signing blocker is resolved, but the repository does not contain `gradle/wrapper/gradle-wrapper.jar`, so required wrapper commands cannot start from a clean clone.

No source, unit-test, JavaScript, browser-runtime, or debug-signing P0 remains. The wrapper packaging blocker and Android device/emulator runtime QA remain tracked in `BUG_TRACKER.md`.

## Pinned Build Configuration

| Component | Version/configuration | Status |
|---|---|---|
| Android Gradle Plugin | 9.1.1 | Pinned; unchanged |
| Gradle wrapper target | 9.3.1 | Properties valid; wrapper JAR not committed |
| Kotlin Compose plugin | 2.2.10 | Pinned; unchanged |
| Java runtime | OpenJDK 21.0.2 | Available |
| Java source/target | 11 | Configured |
| Compile/target SDK | 36 minor API 1 / 36 | Validated with temporary SDK installation |
| Debug signing | Android default debug signing | Generated user debug keystore; no repository key required |

## Validation Results

These results describe commands actually executed in the final-regression environment.

| Command | Result | Notes |
|---|---|---|
| `./gradlew --version` | **BLOCKED** | `gradle/wrapper/gradle-wrapper.jar` is not committed. |
| `./gradlew testDebugUnitTest` | **BLOCKED** | The repository wrapper cannot start without its JAR. |
| `./gradlew assembleDebug` | **BLOCKED** | The repository wrapper cannot start without its JAR. |
| `npm test` | **PASS** | Lifecycle, deterministic AI, physics, fixed timestep, throw solver, prediction/live parity, and UI contracts passed. |
| Physics calibration and renderer visual-state tests | **PASS** | Both deterministic supplemental suites passed. |
| Headless Chromium portrait QA | **PASS (browser)** | Boot skip, menu, match initialization, HUD/toast contracts, full-app sizing, and unstretched table layout passed at 360×800, 393×873, 412×915, and 480×1040. |
| Android device/emulator QA | **BLOCKED** | No device or emulator binary was available for runtime QA. |

## Build Notes

- `.env.example` now uses the non-secret `DEFAULT_API_KEY` placeholder expected by the Secrets Gradle Plugin; this generates valid quoted Java rather than an empty initializer.
- `google-services.json` is absent. The configured `WARN` strategy allows debug compilation and assembly to continue, but Firebase-backed behavior is not runtime-validated.
- The browser test environment could not load remote Google Fonts/Material Symbols because of certificate trust restrictions. Local game scripts produced no runtime exception; typography/icon fidelity still requires Android device QA.
