# Chat media lifecycle

Release 2026.10.31.7 unifies chat images and videos in `ChatMedia.tsx`. Both share a proportional thumbnail contract: width is capped at 228px / 58vw and height at 300px / 42dvh, also bounded by the parent. Ratios are constrained to 9:16–16:9 for thumbnails; extreme media is cropped there and remains complete in the viewer. Unknown dimensions use 4:3 until browser metadata is available. Grouped image grids remain square collection tiles.

Local file dimensions are read alongside upload without blocking upload. Confirmation retains those dimensions when the server has not supplied them yet. It registers a local-to-remote association, so a preview already opened during upload continues to work and can fall back to the confirmed URL if the local object URL stops working. A playback variant takes priority over the original local video. Releasing a local URL also releases its association.

Bubble images, bubble videos, ordinary previews and immersive previews share `useMediaSource`. Retries use stable URLs per attempt, not timestamps that change during rendering. Transient errors remain loading while bounded recovery runs; video gets additional time for newly uploaded/transcoded resources. Pending retry timers are cleared on source changes/unmount, and paused/inactive videos do not resume without playback intent. Signed resources retain the freshest expiry rather than freezing the first token.

The Service Worker treats `sermo_retry` as an explicit cache bypass: evict the affected variant and reload the network request, preserving Range headers and playback variant identity. Empty bodies and HTML/JSON responses to browser media requests are not cached. Cached video suffix ranges use the final requested bytes, supporting media metadata/seek requests correctly.

Focused tests cover optimistic confirmation, geometry retention, local/remote fallback, signed URL freshness, cancellation, stable retry URLs, bad-cache bypass and suffix/open byte ranges. Browser checks simulate upload confirmation while opening the actual shared viewer and revoking a local image URL.
