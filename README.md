# Cyber Pong

Cyber Pong is an Android application that packages its production web game under `app/src/main/assets/` and displays it in a full-screen WebView.

## Prerequisites

- JDK 17 or newer (JDK 21 is supported by the pinned toolchain)
- Android SDK containing the configured Android 36 platform, including minor API 1 support
- Compatible Android SDK build-tools
- Android Studio or command-line Android SDK tools

Set `ANDROID_HOME` or `ANDROID_SDK_ROOT` to the installed SDK. Do not let an IDE randomly upgrade AGP, Gradle, Kotlin, or dependencies during import.

## Deterministic Command-Line Build

The wrapper scripts and properties target Gradle 9.3.1 for the current Android Gradle Plugin 9.1.1 configuration. The binary `gradle-wrapper.jar` is intentionally excluded so this baseline can be submitted as a text-only pull request. Regenerate it once with an installed compatible Gradle before using `./gradlew`:

```bash
gradle wrapper --gradle-version 9.3.1 --distribution-type bin
./gradlew testDebugUnitTest
./gradlew assembleDebug
```

The debug APK is produced under `app/build/outputs/apk/debug/` after a successful assembly.

The application does not require editing `app/build.gradle.kts` for a debug build. Release signing requires the keystore path and credentials configured by the existing Gradle build.

## Android Studio

1. Open the repository root as an existing project.
2. Select a compatible installed JDK.
3. Confirm the Android SDK has the configured platform/build-tools.
4. Sync without changing pinned versions.
5. Run the `app` debug configuration on an emulator or physical device.

## Tests and Project Rules

Baseline JVM tests verify the packaged game module order, required navigation/game controls, and product identity. An instrumentation smoke test verifies the installed application ID and packaged game asset on a device.

Read `AGENTS.md`, `PROJECT_GUIDELINES.md`, `PROJECT_CONTEXT.md`, `BUILD_STATUS.md`, and `BUG_TRACKER.md` before making changes. The current Cyber-Pong UI and visual identity are approved production artwork and must be preserved.

Historical patch/migration/debug scripts are retained under `tools/archive/`; they are not production build inputs.
