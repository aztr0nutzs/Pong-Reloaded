# Build Status

Final regression recorded: 2026-07-29 (UTC).

## Production Gate

**BOOTSTRAP REQUIRED.** The debug-signing blocker is resolved, and the text-only bootstrap generates and validates the official Gradle wrapper JAR locally. The repository is intentionally not self-contained before bootstrap because the browser-based PR workflow rejects binary additions.

No source, unit-test, JavaScript, browser-runtime, wrapper-bootstrap, SDK-bootstrap, Android compilation, or debug-signing P0 remains. Android device/emulator runtime QA remains tracked in `BUG_TRACKER.md`.

## Pinned Build Configuration

| Component | Version/configuration | Status |
|---|---|---|
| Android Gradle Plugin | 9.1.1 | Pinned; unchanged |
| Gradle wrapper target | 9.3.1 | Official distribution bootstrap verified; generated JAR ignored |
| Kotlin Compose plugin | 2.2.10 | Pinned; unchanged |
| Java runtime | OpenJDK 21.0.2 | Available |
| Java source/target | 11 | Configured |
| Compile/target SDK | 36 minor API 1 / 36 | Validated with temporary SDK installation |
| Debug signing | Android default debug signing | Generated user debug keystore; no repository key required |
| Android command-line tools | 22.0 (`15859902`) | Official Google archive SHA-256 verified |
| Installed SDK packages | `platform-tools`, `platforms;android-36.1`, `build-tools;36.0.0` | Secure local bootstrap and post-install checks passed |

## Validation Results

These results describe commands actually executed in the final-regression environment.

| Command | Result | Notes |
|---|---|---|
| `bash -n tools/bootstrap-gradle-wrapper.sh` | **PASS** | Shell syntax validation completed. |
| `./tools/bootstrap-gradle-wrapper.sh` | **PASS** | Downloaded Gradle 9.3.1 from `services.gradle.org`, verified SHA-256 `b266d5ff6b90eada6dc3b20cb090e3731302e553a27c5d3e4df1f0d76beaff06`, generated the wrapper JAR, and launched the wrapper. |
| Checksum mismatch injection | **PASS** | Bootstrap exited nonzero before extraction or wrapper generation. |
| PowerShell syntax check | **BLOCKED** | PowerShell is not installed in the validation environment. |
| `./gradlew --version` | **PASS** | Generated repository wrapper launched Gradle 9.3.1. |
| `bash -n tools/bootstrap-android-sdk.sh` | **PASS** | Shell syntax validation completed. |
| Android SDK unsafe-path and checksum-mismatch injections | **PASS** | Both cases exited nonzero before SDK installation. |
| `./tools/bootstrap-android-sdk.sh /root/android-sdk` | **PASS** | Verified Google's command-line tools SHA-256, accepted licenses explicitly, and installed/verified the three required packages. |
| `sdkmanager --version` / `adb version` | **PASS** | Command-line tools 22.0 and platform-tools 37.0.0 started successfully. |
| `./gradlew testDebugUnitTest --stacktrace` | **PASS** | Three JVM/Robolectric tests passed; proxy properties were supplied to the forked JVM for artifact access. |
| `./gradlew assembleDebug --stacktrace` | **PASS** | Debug signing validation and APK assembly completed. |
| `npm test` | **PASS** | Lifecycle, deterministic AI, physics, fixed timestep, throw solver, prediction/live parity, and UI contracts passed. |
| Physics calibration and renderer visual-state tests | **PASS** | Both deterministic supplemental suites passed. |
| Headless Chromium portrait QA | **PASS (browser)** | Boot skip, menu, match initialization, HUD/toast contracts, full-app sizing, and unstretched table layout passed at 360×800, 393×873, 412×915, and 480×1040. |
| Android device/emulator QA | **BLOCKED** | No device or emulator binary was available for runtime QA. |

## Build Notes

- Run `./tools/bootstrap-gradle-wrapper.sh` (or the PowerShell equivalent on Windows) once before wrapper commands. The generated wrapper JAR is intentionally ignored for this text-only PR; a normal repository workflow may commit the official JAR separately later.
- Run `./tools/bootstrap-android-sdk.sh "$HOME/android-sdk"` when the required Android SDK is unavailable. The SDK stays outside the repository and no `local.properties` is created.
- The validated debug APK was `app/build/outputs/apk/debug/app-debug.apk`: 22,666,581 bytes, SHA-256 `837e3a5e35806f360f23a7b84132603de1cd30da80c76309dc70ed929de8e357`, package `com.aistudio.cyberpong.lxmpt`, minimum SDK 24, target SDK 36. It remains under ignored build output and is not committed.
- `.env.example` now uses the non-secret `DEFAULT_API_KEY` placeholder expected by the Secrets Gradle Plugin; this generates valid quoted Java rather than an empty initializer.
- `google-services.json` is absent. The configured `WARN` strategy allows debug compilation and assembly to continue, but Firebase-backed behavior is not runtime-validated.
- The browser test environment could not load remote Google Fonts/Material Symbols because of certificate trust restrictions. Local game scripts produced no runtime exception; typography/icon fidelity still requires Android device QA.
