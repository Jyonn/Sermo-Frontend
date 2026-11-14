# Pocklo songs v1

Contract: Disk `docs/songs-v1.md`, matched against the deployed API on 2026-11-14.

## Boundaries

- Existing Pocklo OAuth (`files.read shares.create`), iframe picker, fallback file browser and share idempotency remain in use. Only explicit `type: song` is a song. Unconfirmed audio remains a file.
- A share is published as its canonical URL. The existing message/statement link-preview pipeline persists `pocklo_music`, `schema`, stable `song_id`, metadata version and display text. It never persists playback signatures, cover signatures or lyrics.
- Public Frienden JSON endpoints `/users/pocklo/shares/:token/song` and `/playback` read the fixed Pocklo API. No listener OAuth is required; no audio bytes pass through Frienden. Responses use `no-store`.
- `PockloSongCard` and the square cover use the existing music UI and shared player. Signatures stay in component/session memory. Cover failures fall back to an icon. One HTML audio element coordinates cards by provider and song ID.
- Audio uses anonymous CORS, its declared audio MIME and native CDN Range support. Metadata is revalidated on play/resume/seek; playback refreshes with 15 seconds of safety margin. A media failure has one automatic retry per explicit user action, preserving time, volume and intended playback state. Aborted/stale responses cannot replace a newer song. HTTP 404/410 are terminal for that session.
- Lyrics are rendered as React text. Millisecond cues are authoritative; existing LRC and plain-text rendering are reused.
- Revocation blocks new metadata/playback requests. Already issued CDN addresses can remain valid until expiration and already buffered audio cannot be recalled.

## Deployed iframe compatibility

Pocklo currently spreads resource fields after its event `type`, producing `type: song/file/folder` instead of `pocklo.picker.selected`. Frienden accepts both forms with the same strict iframe origin/source/version checks and requires the share to have been created through its trusted request map. Pocklo should eventually separate the event discriminator and resource type; this is not a release blocker.

## Verification

- Node tests cover references, picker protocol, millisecond lyrics, expiry margin, address refresh, pause/time/volume restoration, version changes, 404/410, unavailable audio, bounded retries, replay and racing switches.
- Django tests cover stable DB reference round-trip, OAuth share idempotency, legacy files/folders, no-store metadata, error-envelope semantics and fixed CDN validation.
- Chrome local Frienden E2E: actual deployed picker UI, dedicated local Disk song, create share, send and reopen chat, music detail and lyrics, same-song card state, seeking, mobile viewport and dark rendering. OAuth identity was a local test adapter, not a production OAuth login.
- Actual private CDN: generated 46.9-second silent MP3 and generated cover only; `audio/mpeg`, HTTP 206/Content-Range and CORS verified for all four sites. Chrome played it directly from `res.6-79.cn` through completion, beyond 30 seconds. This is real CDN validation, separate from local E2E and mocked state-machine tests.
- No real private files or public user posts are used. Dedicated cloud fixtures are revoked and removed after verification.

## Regression commands

`node --test tests/pockloSong.test.ts tests/pockloPicker.test.ts`

`python manage.py test User.tests_pocklo User.tests_pocklo_songs --settings=Sermo.isolated_test_settings --noinput`

`npm run build`
