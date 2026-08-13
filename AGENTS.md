# Sermo Frontend Agent Guidelines

## Workflow

- Inspect all call sites before changing a component or interaction shared by chat, Square, menus, or drawers.
- Preserve unrelated local changes and never revert user work without explicit permission.
- Use `apply_patch` for manual source edits.
- Run `npm run build` before committing frontend work.
- Every completed change must be staged, committed with a focused message, and pushed to the remote repository.
- Retry transient network failures when pushing. If approval is denied, report the unpushed commit clearly instead of bypassing approval.

## User-Facing Releases

- Update `release-notes.json` for every change visible to ordinary users.
- Use release IDs in `YYYY.MM.DD.N` format and increment `N` for multiple releases on the same day.
- Keep release notes concise, user-friendly, bilingual, and focused on outcomes rather than implementation details.
- Internal administration-only or maintenance-only changes do not require release notes unless they affect ordinary users.

## Product Quality

- Reuse one shared component for the same experience across chat and Square; do not maintain visually divergent copies.
- Maintain Chinese and English through translation keys rather than hard-coded bilingual branches.
- Design mobile-first while verifying desktop layouts, dark mode, safe areas, PWA behavior, loading states, and empty states.
- Prefer restrained copy, clear hierarchy, and native-feeling Drawer, Sheet, Modal, and Toast interactions.
