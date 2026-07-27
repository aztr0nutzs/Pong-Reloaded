# Bug Tracker

Statuses: **OPEN**, **BLOCKED**, **RESOLVED**, **VERIFIED**.

| ID | Status | Area | Finding | Next action |
|---|---|---|---|---|
| BUILD-001 | BLOCKED | Gradle wrapper | Wrapper scripts/properties target Gradle 9.3.1, but the binary wrapper JAR is excluded to keep this PR text-only. | Regenerate it locally with `gradle wrapper --gradle-version 9.3.1 --distribution-type bin` before wrapper-based validation. |
| BUILD-002 | RESOLVED | Build configuration | The configured Secrets plugin default file `.env.example` was absent, causing every Gradle task to fail during project evaluation. | Added a non-secret placeholder matching the existing configuration. |
| TEST-001 | RESOLVED | Unit tests | Generated tests asserted `2 + 2`, referenced nonexistent `Greeting()`, and expected stale name `My Application`. | Replaced with asset/module/UI-contract and product-name tests. |
| TEST-002 | RESOLVED | Instrumentation | Generated test expected namespace `com.example` as the installed package rather than the configured application ID. | Replaced with packaged identity, product-name, and asset smoke assertions. |
| REPO-001 | RESOLVED | Repository layout | One-off patch, split, update, migration, and debug scripts were mixed with production root files. | Preserved under `tools/archive/` and marked non-production. |
| ENV-001 | BLOCKED | Android SDK | No SDK environment variable or standard SDK installation was detected in the baseline environment. | Install/configure an SDK containing platform Android 36 (minor API 1 as configured) and compatible build-tools, then rerun Gradle validation. |
| SCM-001 | BLOCKED | Upstream sync | Repository has no configured `origin`, so `git fetch origin --prune` and rebase onto `origin/main` cannot run. | Configure the correct remote and rebase before integration. |
