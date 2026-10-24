# Asset lifecycle

`npm run assets:check` checks source/public; `assets:check-built` checks clean
Vite output. Both run in every production/mirror build. Checks only report;
they never delete files. `scripts/retired-assets.json` records reviewed removals
and required compatibility resources. Check code and other clients before
retiring more assets.

October 2026 cleanup: removed the discontinued Xiaobai bubble/avatar renderer,
its translations and public artwork; superseded Baxian v2/v4 exports and unused
previews; PNG city textures replaced by WebP; flat wallpapers replaced by live
layers; unused Niko/Fufu directions/greetings; old BGM composite; old Friendly
Neighborhood city profile; unused logo sizes and Sermo logo concept exports.

Legacy Xiaobai preferences fall back to default bubbles/no frame. Backend
discontinuation validation remains to prevent old clients re-enabling it. The
miniprogram source renderer is cleaned too; historical deployed clients retain
access to old server copies until a separate retention decision.

Map boundaries, generated avatars and wallpaper layers use dynamic filenames.
Unreferenced full filenames alone are not deletion proof. Design originals stay
outside public/dist; the locally edited Frienden logo preview is preserved.

Vite empties local dist at every build. Mirror and Frienden Pages publishing keep
historical resources for stale clients, per deployment policy. Never use rsync
--delete or prune historical hashed assets during source/build cleanup.
