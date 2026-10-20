# Entrance audio behavior

- A foreground conversation attempts to play new peer entrance clips, regardless of participation or entrance mode. Existing history, self echoes, duplicates and background arrivals do not replay.
- The legacy `receive_audio` request boolean remains accepted for client compatibility. The backend reports and saves `true`; new clients do not use it as an opt-in gate.
- Browser autoplay restrictions still apply. Playing voice/video is not interrupted. Users can replay from the icon at the end of the system message.
- The server continues emitting a system message plus an ordinary audio message for old clients. New clients pair them by `system_message_id`, matching actor and event, and render a single system message with playback. Unmatched audio remains playable rather than disappearing.
- Blue and pink six-key positions are calibrated independently in `src/lib/bgmEntrance.ts` against the original sprite dimensions. Activity and conversation keychains share the same component and coordinates.
- Entrance settings reuse the shared `SettingSelect` control. There are no native selects or separate receive-audio checkbox in the BGM settings.
