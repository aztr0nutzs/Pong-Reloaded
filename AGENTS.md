# Cyber-Pong Agent Instructions

These instructions apply to the entire repository.

## Mandatory UI Preservation Contract

The current Cyber-Pong UI is approved production artwork. Preserve its visual identity, menus, HUD, typography, neon styling, colors, animations, screen structure, navigation, control placement, themes, effects, panels, buttons, and assets.

Do not redesign or simplify the UI; flatten it into another design system; remove HUD elements, menus, panels, effects, controls, assets, or functionality; replace typography or colors; reorganize screens; rename DOM IDs/classes or public module APIs unnecessarily; rewrite working UI code for architectural preference; or alter gameplay-screen composition unless the task explicitly requires it.

If a UI-facing change is technically necessary:

1. Preserve the existing appearance as closely as possible.
2. Make the smallest possible change.
3. Document exactly why it is required.
4. Verify unrelated UI remains unchanged.

Fix the game underneath the UI. Do not replace the UI.

## Required Workflow

- Inspect relevant files and identify the root cause before editing.
- State a minimal, exact file scope before editing; expand it only when required and disclosed.
- Make minimal changes and avoid unrelated cleanup or dependency upgrades.
- Work on one subsystem at a time and keep each change focused.
- Preserve approved UI, gameplay behavior, physics, public APIs, and assets unless the active task explicitly authorizes a change.
- Validate compilation and the strongest relevant automated checks before reporting success.
- Inspect the final diff and revert accidental visual or unrelated changes.
- Never fabricate runtime QA, build results, screenshots, device testing, or manual navigation results. Report environmental blockers honestly.
- Do not treat archived scripts in `tools/archive/` as production source or run them against production assets without first reviewing and intentionally adapting them.
