# Cyber Pong

Cyber Pong is an Android application that packages its production web game under `app/src/main/assets/` and displays it in a full-screen WebView.

## Prerequisites

- JDK 17 or newer (JDK 21 is supported by the pinned toolchain)
- Android SDK containing the configured Android 36 platform, including minor API 1 support
- Compatible Android SDK build-tools
- Android Studio or command-line Android SDK tools

Set `ANDROID_HOME` or `ANDROID_SDK_ROOT` to the installed SDK. Do not let an IDE randomly upgrade AGP, Gradle, Kotlin, or dependencies during import.

## Deterministic Command-Line Build

The wrapper scripts and properties target Gradle 9.3.1 for the current Android Gradle Plugin 9.1.1 configuration. The binary `gradle-wrapper.jar` is generated locally and intentionally not committed because the current browser-based PR workflow rejects binary additions. The bootstrap downloads only the matching official Gradle binary distribution from `services.gradle.org`, verifies its official SHA-256 checksum, and uses that verified Gradle executable to generate and validate the wrapper.

Linux / Codex environment:

```bash
chmod +x tools/bootstrap-gradle-wrapper.sh
./tools/bootstrap-gradle-wrapper.sh
./gradlew testDebugUnitTest
./gradlew assembleDebug
```

Windows PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File tools/bootstrap-gradle-wrapper.ps1
.\gradlew.bat testDebugUnitTest
.\gradlew.bat assembleDebug
```

Run the bootstrap once after cloning and again only when the pinned wrapper version changes or the local wrapper JAR is removed. The generated `gradle/wrapper/gradle-wrapper.jar` is ignored by Git. A normal desktop/repository workflow may later choose to commit the verified official wrapper JAR in a separate change that supports binary files; this text-only PR does not make the repository immediately self-contained before bootstrap.

The debug APK is produced under `app/build/outputs/apk/debug/` after a successful assembly.

Debug builds use Android's standard generated debug keystore and do not require a committed root `debug.keystore`. Release signing remains separate and requires `KEYSTORE_PATH`, `STORE_PASSWORD`, and `KEY_PASSWORD`; release builds are never silently signed with debug credentials.

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
