# Entrance audio behavior

- A foreground conversation attempts to play new peer entrance clips, regardless of participation or entrance mode. Existing history, self echoes, duplicates and background arrivals do not replay.
- The legacy `receive_audio` request boolean remains accepted for client compatibility. The backend reports and saves `true`; new clients do not use it as an opt-in gate.
- Browser autoplay restrictions still apply. Playing voice/video is not interrupted. Users can replay from the icon at the end of the system message.
- The server continues emitting a system message plus an ordinary audio message for old clients. New clients pair them by `system_message_id`, matching actor and event, and render a single system message with playback. Unmatched audio remains playable rather than disappearing.
- Blue and pink generated housings share aligned geometry; the six physical buttons are real controls in `BgmKeychain`, with inactive, ready, and playing states. Activity and conversation keychains share the component and coordinates. Playing state starts only after audio playback succeeds.
- Entrance settings live under Language & Personalization and reuse `SettingSelect`. The activity Drawer links there instead of duplicating settings.
- Character style becomes immutable on first join. The server enforces this under the existing progress-row transaction lock, including calls from older clients. Existing users keep their current edition; tracks, points and dates are unchanged.
- Tracks, daily tasks and rules open secondary sheets. Main event artwork appears as a compact header title; generated background and product assets are documented in `docs/bgm-visual-assets-v2.md`.
