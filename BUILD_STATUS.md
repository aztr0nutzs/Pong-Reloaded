# Build Status

Final regression recorded: 2026-07-28 (UTC).

## Production Gate

**NOT PRODUCTION READY.** Two repository packaging prerequisites remain P0 blockers:

1. `gradle/wrapper/gradle-wrapper.jar` is absent, so both required `./gradlew` commands stop before Gradle starts.
2. `app/build.gradle.kts` requires `${rootDir}/debug.keystore` for the debug signing configuration, but that file is absent.

No source, unit-test, JavaScript, or browser-runtime P0 remains after supplying equivalent external/ephemeral build prerequisites. The missing repository prerequisites must be resolved in a dedicated build-system change before release.

## Pinned Build Configuration

| Component | Version/configuration | Status |
|---|---|---|
| Android Gradle Plugin | 9.1.1 | Pinned; unchanged |
| Gradle wrapper target | 9.3.1 | Properties valid; wrapper JAR missing |
| Kotlin Compose plugin | 2.2.10 | Pinned; unchanged |
| Java runtime | OpenJDK 21.0.2 | Available |
| Java source/target | 11 | Configured |
| Compile/target SDK | 36 minor API 1 / 36 | Validated with temporary SDK installation |
| Debug signing | Explicit root `debug.keystore` | Required file missing |

## Validation Results

These results describe commands actually executed in the final-regression environment.

| Command | Result | Notes |
|---|---|---|
| `./gradlew testDebugUnitTest` | **FAIL (P0)** | `gradle/wrapper/gradle-wrapper.jar` is absent. |
| `./gradlew assembleDebug` | **FAIL (P0)** | `gradle/wrapper/gradle-wrapper.jar` is absent. |
| External Gradle 9.3.1 `testDebugUnitTest` | **PASS with prerequisites** | Passed with temporary Android SDK 36.1, an ephemeral standard debug key, and Java proxy properties for Robolectric's SDK artifact. |
| External Gradle 9.3.1 `assembleDebug` | **PASS with prerequisites** | APK assembly completed with temporary Android SDK 36.1 and an ephemeral standard debug key. |
| `npm test` | **PASS** | Lifecycle, deterministic AI, physics, fixed timestep, throw solver, prediction/live parity, and UI contracts passed. |
| Physics calibration and renderer visual-state tests | **PASS** | Both deterministic supplemental suites passed. |
| Headless Chromium portrait QA | **PASS (browser)** | Boot skip, menu, match initialization, HUD/toast contracts, full-app sizing, and unstretched table layout passed at 360×800, 393×873, 412×915, and 480×1040. |
| Android device/emulator QA | **BLOCKED** | No device, emulator binary, or deployable repository wrapper/signing setup was available. |

## Build Notes

- `.env.example` now uses the non-secret `DEFAULT_API_KEY` placeholder expected by the Secrets Gradle Plugin; this generates valid quoted Java rather than an empty initializer.
- `google-services.json` is absent. The configured `WARN` strategy allows debug compilation and assembly to continue, but Firebase-backed behavior is not runtime-validated.
- The browser test environment could not load remote Google Fonts/Material Symbols because of certificate trust restrictions. Local game scripts produced no runtime exception; typography/icon fidelity still requires Android device QA.
