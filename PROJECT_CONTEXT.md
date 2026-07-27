# Project Context

## Product

Cyber Pong is an Android application whose native `MainActivity` hosts the production web game in a full-screen Compose `AndroidView`/`WebView`. The WebView loads `file:///android_asset/index.html`.

## Runtime Structure

`index.html` owns the approved Cyber-Pong screens, menus, HUD, styling, and effects. It loads classic browser scripts in dependency order from `app/src/main/assets/js/modules/`; these scripts communicate through browser globals rather than ES module imports.

The current load order is:

1. State and utilities
2. Audio/effects/cup/ball/UI rendering
3. Renderer and camera
4. Physics and trajectory prediction
5. Input, throwing, AI, and main initialization

`app/src/main/assets/js/tailwindcss.js` is packaged locally. Google Fonts and Material Symbols are referenced remotely, so font availability can differ when the device is offline, but this baseline does not change that approved behavior.

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
- Gradle wrapper target: 9.3.1 (binary wrapper JAR intentionally excluded from the text-only PR)
- Java source/target compatibility: 11

## Scope Guard

The production assets are the source of truth. Files in `tools/archive/` are historical transformations and diagnostics, not inputs to the build. Future gameplay work must address one subsystem at a time without redesigning the approved UI.
