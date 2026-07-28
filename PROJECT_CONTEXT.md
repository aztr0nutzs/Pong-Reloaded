# Project Context

## Product and UI Contract

Cyber Pong is an Android application whose native `MainActivity` hosts the approved production web game in a full-screen Compose `AndroidView`/`WebView`. The WebView loads `file:///android_asset/index.html`.

`index.html` remains the source of truth for the approved screens, menus, HUD, controls, neon styling, and artwork. Final-regression changes removed only a development overlay and a root-level misuse of the existing table texture class; no screen, control, menu, panel, font declaration, color palette, or table artwork was redesigned.

## Authoritative Runtime Architecture

- `GameStateManager` is the sole match lifecycle authority. It owns explicit states, turn/score/attempt/accuracy/timer/ball flags, match generations, and cancellation of match-owned handles.
- `PhysicsEngine` owns one `PhysicsWorld`, fixed-step accumulation, SI `WorldGeometry`, collision response, and live simulation.
- `ShotSolution` is the immutable contract shared by input, deterministic AI, prediction, playback, and rendering.
- `TrajectoryPredictor` and live playback use the same `PhysicsEngine` simulation path and fixed timestep; deterministic parity tests pass within `1e-12`.
- `Renderer` and `CameraController` convert authoritative world coordinates into screen coordinates. Rendering reads interpolated physics state and does not mutate it.
- AI uses a match-seeded deterministic decision stream and `ThrowController`; difficulty changes shot error only and does not mutate physics constants or geometry.

Only `app/src/main/assets/js/modules/PhysicsEngine.js` declares active `PhysicsWorld`/`PhysicsEngine` classes outside archived/non-production material.

## Web Runtime Structure

Production scripts are classic browser scripts loaded in explicit dependency order from `app/src/main/assets/js/modules/`. They communicate through deliberate browser globals. `UIRenderer` now exports both its controller and legacy method aliases so guarded and direct call sites share the same implementation.

Viewport sizing uses `100dvh` where supported, an `--app-height` fallback synchronized from `visualViewport`, safe-area environment insets, and camera recomputation without changing the table's 1:4 layout ratio. Browser regression checks confirmed exact root viewport consumption at 360×800, 393×873, 412×915, and 480×1040.

## Build Identity

- Gradle root project: `Cyber Pong`
- Android module: `:app`
- Namespace: `com.example`
- Application ID: `com.aistudio.cyberpong.lxmpt`
- Minimum SDK: 24
- Target SDK: 36
- Compile SDK: Android 36, minor API 1
- Android Gradle Plugin: 9.1.1
- Kotlin Compose plugin: 2.2.10
- Gradle wrapper target: 9.3.1
- Java source/target compatibility: 11

## Release Validation Boundary

Source compilation, JVM tests, APK assembly, deterministic JavaScript suites, and browser portrait checks were completed with temporary tooling prerequisites. The repository itself is not production-ready until the missing wrapper JAR and debug-signing setup are corrected in a focused build-system PR and the exact `./gradlew` commands pass from a clean clone.

No Android emulator/device runtime QA was performed. WebView lifecycle, system bars/cutouts, hardware rendering, remote font/icon loading, pause/background behavior, and installed-APK navigation remain mandatory device checks.

Files under `tools/archive/` remain historical diagnostics and are not production inputs.
