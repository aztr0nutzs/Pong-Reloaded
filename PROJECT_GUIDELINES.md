# Project Guidelines

## Change Discipline

1. Inspect the affected subsystem, its callers, and its tests before editing.
2. Record the root cause and the smallest file scope that resolves it.
3. Keep build, gameplay, physics, and UI changes in separate focused pull requests.
4. Do not upgrade Gradle, AGP, Kotlin, or Android dependencies incidentally.
5. Do not reformat, rename, or reorganize unrelated production code.
6. Add deterministic tests for observable contracts rather than generated sample behavior.
7. Run the strongest available checks and distinguish passed checks from blocked device/manual QA.

## Approved UI

The production page and assets under `app/src/main/assets/` are approved artwork. The full preservation rules are mandatory and are defined in `AGENTS.md`. Any authorized UI change must be minimal, documented, and checked for unrelated visual drift.

## Subsystem Boundaries

- Android host: `app/src/main/java/com/example/MainActivity.kt`
- Web application shell and artwork: `app/src/main/assets/index.html`
- Game modules: `app/src/main/assets/js/modules/`
- Android build configuration: root and `app/` Gradle Kotlin DSL files plus `gradle/libs.versions.toml`
- Historical migration/debug tooling: `tools/archive/`

## Validation Expectations

From the repository root, use the checked-in wrapper:

```bash
./gradlew testDebugUnitTest
./gradlew assembleDebug
```

Device-only tests require an emulator or connected API-compatible device:

```bash
./gradlew connectedDebugAndroidTest
```

A command is not a pass unless it exits successfully. Manual navigation or visual QA must not be claimed unless it was actually performed and recorded.
