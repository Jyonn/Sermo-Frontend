# Entrance audio behavior

## Collection pace

- The first track is a joining gift. One qualifying public post earns 6 inspiration per Beijing calendar date; 15 posting days earn the final 90-point threshold.
- Comments on distinct other users' posts earn 3 points each (three daily); likes for distinct authors earn 1 each (five daily). One post, comment and like daily earns 100 points across ten active dates, completing the collection on day ten. No amount of points bypasses the ten-active-date minimum.
- Server-owned cumulative gates `(active days, inspiration)` are `(0,0), (1,6), (2,12), (3,18), (4,24), (5,30), (6,36), (7,42), (8,54), (9,66), (10,78), (10,90)`. Dates need not be consecutive. Existing interaction records are unchanged and every threshold is lower than before, preserving all previously earned tracks.

## Playback

- A foreground conversation attempts to play new peer entrance clips when member autoplay is enabled (on by default), regardless of the user's own entrance mode. Existing history, self echoes, duplicates and background arrivals do not replay. The existing `receive_audio` boolean is now saved and honored; disabling it still allows manual playback.
- Entrances have an independent 600-second cooldown per user and conversation, across campaigns. There is no cross-conversation throttle. `GET /activities/bgm/me?chat_id=<id>` returns `bgm.entrance` with `allowed`, `reason`, and `retry_after_seconds` after checking membership and speaking permission. It never sends a message. POST uses the same policy under a user row lock; cooldown responses include the remaining seconds. Manual mode only opens the keychain after preflight; both modes toast silent entry with the remaining minutes rounded up.
- Browser autoplay restrictions still apply. Playing voice/video is not interrupted. Users can replay from the icon at the end of the system message.
- New entrances emit exactly one SYSTEM message (`type=3`, `kind=system`, `event=bgm_entrance`) containing `bgm_entrance=true`, `uri`, `duration_seconds`, `song_title`, and `song_author`. The existing media resource is attached to this system message and counted once; no AUDIO message or second sync event is created. The send response returns `system_message_id` and a null legacy `audio_message_id` alongside playback fields. Old clients still show the system text but no longer receive a separate audio item.
- Previously stored system/audio pairs remain unchanged. Clients still merge those historical pairs by `system_message_id`, actor and event, while standalone system messages need no merging. Unmatched historical audio remains playable rather than disappearing.
- Blue and pink generated housings share aligned geometry; the six physical buttons are real controls in `BgmKeychain`, with inactive, ready, and playing states. Activity and conversation keychains share the component and coordinates. Playing state starts only after audio playback succeeds.
- Language & Personalization contains one Character keychain entry (no campaign banner), opening member autoplay, entrance mode, and automatic fixed/random track settings using shared settings controls.
- Character style becomes immutable on first join. The server enforces this under the existing progress-row transaction lock, including calls from older clients. Existing users keep their current edition; tracks, points and dates are unchanged.
- Tracks, daily tasks and rules open secondary sheets. Main event artwork appears as a compact header title; generated background and product assets are documented in `docs/bgm-visual-assets-v2.md`.
