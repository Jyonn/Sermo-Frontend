# Frienden parallel sites

Four independent HTTPS origins share the existing API and database:

| Origin | Deployment |
| --- | --- |
| https://sermo.jyonn.space | Existing Jyonn/Sermo-Frontend Pages; preserve its custom domain |
| https://sermo.6-79.cn | Existing nginx root /home/ubuntu/sermo-frontend/dist |
| https://frienden.jyonn.space | Dedicated public Jyonn/Frienden-Frontend artifact-only Pages repository |
| https://frienden.6-79.cn | Dedicated nginx site/root /home/ubuntu/frienden-frontend/dist |

The source frontend repository is already public. The new Pages repository contains static build output, a Pages workflow and source-commit provenance only. No backend/configuration/credentials are copied. `npm run deploy:frienden-pages` uses existing local gh/git authorization, without creating persistent tokens. Pages and mirror scripts share a deployment lock because builds use the same dist directory. Run them sequentially. Check the Pages run and public HTTPS after pushing; a push alone does not prove deployment.

For the new mirror, invoke `npm run deploy:mirror` with `MIRROR_BUILD_SCRIPT=build:frienden-mirror`, `MIRROR_DIRECTORY=/home/ubuntu/frienden-frontend/dist`, and `MIRROR_PUBLIC_ORIGIN=https://frienden.6-79.cn`. Existing confirmed host/user/key settings are reused. The script rejects an old mirror directory/origin for this build. Build output retains the existing API origin; public share links target the appropriate frontend origin. Resources publish first and release.json last, preserving old hashed assets. Do not reuse old mirror paths or change old DNS/Pages bindings.

DNS additions, after checking existing exact records: frienden.jyonn.space CNAME jyonn.github.io; frienden.6-79.cn A to the confirmed mirror server. Preserve all existing records, including mail records. Bind the independent Pages custom domain before exposing its DNS. Validate GitHub ownership verification and HTTPS certificate; obtain a separate mirror certificate after its DNS resolves. Local workstation DNS uses synthetic proxy addresses; use authoritative DNSPod responses and server-side checks for verification.

No database migration, new API hostname, OAuth client/callback/scope changes, grants, credential or token transfers are necessary. API CORS preflight for both new origins was verified read-only. Current chat updates use HTTP polling, without a WebSocket origin dependency. Authentication is browser-local bearer token storage; accounts/data are shared but new origins require a normal new login. PWA installation, caches, notifications and push subscriptions are per origin. Never copy tokens between sites in URL parameters.

## Migration notice activation

`public/site-migration.json` starts disabled. Only after both new origins pass real HTTPS, SPA-route, manifest/service-worker/assets, release-ID and API checks may an operator set enabled=true with both exact Frienden origins in readyOrigins. Until then the old sites stay fully usable, the four-site update dialog reports failed/unavailable endpoints honestly, and no migration notice appears. The readiness file is public operator configuration, never a source of credentials.

The notice is limited to the two exact legacy hostnames, dismissible, and recorded on display in localStorage at most once every seven days per browser/origin. It is suppressed when persistent storage is unavailable. Web Locks serialize simultaneous tabs where supported. OAuth consent and admin/design pages do not show it. Links use only the matching new HTTPS homepage without paths, query parameters or fragments, and suppress Referer. All four update source links follow the same rule. Maintenance ends December 31, 2026; this change does not redirect, remove old DNS, disable old sites or schedule shutdown.

## Rollback

Disable the readiness file first to stop new notices. Revert frontend release if needed; retain old hashed assets. Remove only newly added Frienden server blocks/DNS/Pages configuration if abandoning deployment; leave both old sites, the API, database and OAuth registrations untouched. There is no database rollback.

## Verified activation prerequisites, October 18, 2026

Existing operator-authorized Tencent DNS credentials from the Chronelle project were located and used in memory, without copying or printing their values or creating new API credentials. DNSPod authenticated reads confirmed both domains and the absence of exact frienden records. Only the new CNAME frienden.jyonn.space → jyonn.github.io and A frienden.6-79.cn → 175.178.125.57 were created; both existing sermo records were compared before/after and stayed unchanged.

The new Pages repository uses its own custom domain; the original repository remains bound to sermo.jyonn.space. After DNS validation, GitHub's documented remove/re-add procedure was applied only to the new custom domain to restart certificate provisioning. Its certificate became approved (expires January 16, 2027), and HTTPS enforcement was enabled. The mirror has a separate certificate with the same expiry, using the existing ACME account. Its HTTP host redirects to HTTPS except the ACME webroot. The renewal reload hook is scoped to this new certificate; no other virtual host or certificate was replaced. Its original HTTP config is backed up at /home/ubuntu/sermo-release-backups/frienden-sites-20261018/nginx-http.conf.

All four public origins passed verified TLS, release 2026.10.18.2, entry assets, SPA fallbacks, manifest/service-worker release and release.json CORS checks before enabling the readiness file for 2026.10.18.3. A transient TLS connection reset on an old origin passed on a normal validated retry. No certificate checks were bypassed. Production OAuth metadata for both original supervision-web callbacks still reports email/profile and the approved real icon; invalid phone scope and unsupported refresh flow remain rejected.

The new mirror rendered in real Chrome at 1512px desktop and 390×844 mobile light/dark, with no horizontal overflow; the sign-in entry stayed on its own origin and opened the space-selection page. No login credentials, OTP or grants were submitted. Further browser checks were temporarily interrupted by another extension UI; this is a browser availability limitation, not a filesystem approval rejection. Supporting screenshots are in the shared workspace artifacts/frienden-sites directory. Backend code, database, account verification flags and OAuth registrations were unchanged by the domain rollout.

The final wording release 2026.10.18.4 uses the exact proper brand pairs Sermo 言浪 and Frienden 友间 in all six locales' migration notice, action and four-site labels, plus the current release notes. The Chinese notice states: “Sermo 言浪旧域名将于 2026 年 12 月 31 日结束维护，请迁移至 Frienden 友间。” No technical hostname, client ID, route or unrelated history was renamed. The seven-day display timestamp remains intact rather than forcing another prompt for this wording refinement.

## Logo transition, release 2026.10.18.5

The weekly notice adds the actual historical SERMO wordmark → actual current Frienden mark, with each full brand name beneath its image. Reused public/icons/sermo-192.png, byte-identical to the SERMO logo rollout commit 6274080 (SHA-256 bda248f6949af7c20da39997e59d312c86b2d5e1be88c8dd3ffd92f4b8442941), and public/icons/frienden-192.png, byte-identical to the current Frienden rollout commit 33c7029 (SHA-256 ef2a1ef0c6b67e3a8c84959b3903ddb18045dd0dcdfa95b1c83b8d315c8dcd49). No logo was recreated, recolored or substituted, and the unrelated logos/frienden/preview.html remains untouched.

The notice reuses the OAuth brand image component with an optional frame class; existing OAuth styling remains the default. A real image error switches to its existing neutral accessible placeholder, retaining both names, the deadline and the actions. The compact responsive frame uses the original warm-white logo field in both themes to preserve the historical black wordmark and make the current transparent color mark readable. No seen timestamp/key or seven-day logic changes are included.

27 focused tests pass, including actual production-component rendering, event-driven image-error fallback and a fully failed-image notice retaining its content/actions. Production build passes. The agent-owned local preview was started for visual acceptance, but Chrome extension UI occupancy blocked control before screenshots or viewport overrides; desktop/mobile/dark visual checks for this added strip remain unverified rather than being inferred from static tests. This is a technical browser-control limitation; no rejection was bypassed and other user pages were not changed.
