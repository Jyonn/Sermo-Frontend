# Sermo Frontend Agent Guidelines

## Workflow

- Inspect all call sites before changing a component or interaction shared by chat, Square, menus, or drawers.
- Preserve unrelated local changes and never revert user work without explicit permission.
- Use `apply_patch` for manual source edits.
- Run `npm run build` before committing frontend work.
- Every completed change must be staged, committed with a focused message, and pushed to the remote repository.
- Retry transient network failures when pushing. If approval is denied, report the unpushed commit clearly instead of bypassing approval.
- After every frontend release, also deploy the mirror with `npm run deploy:mirror` and verify its release ID. Pushing Git is not a mirror deployment. Report blocked/failed deployment explicitly; never claim synchronization without verification.
- Every frontend release must also register `release-notes.json` in the server's frontend release registry **after each origin is verified deployed**. `deploy:frienden-pages` registers both Pages origins; `deploy:mirror` registers its mirror. For an independent deployment use `npm run release:publish -- --origin https://<allowed-origin>`. Verify `https://api.sermo.jyonn.space/frontend/releases` lists the intended release for all four origins. A deployed frontend with failed API registration is incomplete and must be reported. Do not record backend-only changes here.
- Client update detection keeps the API-only startup/foreground/three-minute interval checks, with one toast per new version and shared Menu/update red dots. Background detection must never install updates or reload the app. Only the user's confirmation inside Check for updates may activate a worker or reload. Do not restore static-site/worker version probes or persistent global update cards. Keep the service worker independent of frontend release IDs.
- Mirror SSH settings belong in ignored `.env.deploy.local`, not `VITE_*` variables. The confirmed SSH host is `175.178.125.57`, key `~/Resources/Subscription/Server/tencent`, user `ubuntu`, port `22`, and remote directory `/home/ubuntu/sermo-frontend/dist`. Public mirror: `https://sermo.6-79.cn`. Never commit or print private-key contents.
- Mirror publication must build with `build:mirror`, upload resources before entry files and publish `release.json` last. Do not use rsync `--delete` or delete old hashed assets; stale clients still need them.
- Keep all four sites on the same release: the existing master workflow publishes `sermo.jyonn.space`; also run `npm run deploy:frienden-pages` for the separate artifact-only `Jyonn/Frienden-Frontend` Pages site, and deploy both mirrors. For the new mirror, run `npm run deploy:mirror` with `MIRROR_BUILD_SCRIPT=build:frienden-mirror`, `MIRROR_DIRECTORY=/home/ubuntu/frienden-frontend/dist`, and `MIRROR_PUBLIC_ORIGIN=https://frienden.6-79.cn`. Verify all four public HTTPS release IDs. Builds share `dist`; run deployment commands sequentially.
- Never replace the existing Sermo Pages custom domain with Frienden. Preserve both old sites through the announced maintenance end date of December 31, 2026; do not infer permission to redirect, remove DNS, stop service, or schedule shutdown from that date.
- Enable `public/site-migration.json` only after both new Frienden origins pass HTTPS and functional checks. Migration links must stay free of OAuth parameters, tokens and fragments. No database, credential or OAuth registration changes are needed for parallel frontend domains.
- In migration notices, site labels and related release copy, display the full brand pairs `Sermo 言浪` and `Frienden 友间`. Preserve technical domain names, client IDs, paths and unrelated historical records.

## User-Facing Releases

- Update `release-notes.json` for every change visible to ordinary users.
- Use release IDs in `YYYY.MM.DD.N` format and increment `N` for multiple releases on the same day.
- Keep release notes concise, user-friendly, bilingual, and focused on outcomes rather than implementation details.
- Internal administration-only or maintenance-only changes do not require release notes unless they affect ordinary users.

## Product Quality

- Personalization bitmap assets live in the managed cloud resource library, grouped as avatar-frame, background, profile-card, bubble, or emoji. Use stable `/resources/assets/<id>/<variant>/<hash>` API URLs and keep only URL metadata in `src/lib/appearanceAssetManifest.json`; do not restore retired bitmap copies. Resolve computed layer paths through `appearanceAsset`. Keep preset-avatar compatibility files until backend and native clients have migrated their saved URLs. CSS/vector-only ornamentation stays in code.
- Reuse one shared component for the same experience across chat and Square; do not maintain visually divergent copies.
- Maintain Chinese and English through translation keys rather than hard-coded bilingual branches.
- Design mobile-first while verifying desktop layouts, dark mode, safe areas, PWA behavior, loading states, and empty states.
- Prefer restrained copy, clear hierarchy, and native-feeling Drawer, Sheet, Modal, and Toast interactions.

## Activity Design

- Use imagegen for every new activity's custom activity-name lettering. Persist the transparent asset in this repository and reuse it for the banner, share card, and header, with accessible text and a localized fallback. Plain text or a generic display font is not the final Chinese activity wordmark.
- Activity headers must be transparent and include a back button, a compact activity wordmark, and a share button. Use navigation-title sizing rather than an oversized hero title, and verify safe areas, portrait, landscape, desktop, and dark-mode readability.
- Keep activity landing pages focused on the main visual, essential progress, and primary actions. Move rules, records, rankings, reward pools, and setup forms into shared modals or Sheets opened from concise secondary links. Use a translucent circular back control.
