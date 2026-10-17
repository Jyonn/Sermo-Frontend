# Chat list transport

The web API client requests `GET /chats/?format=compact-v1`. Purpose and submission
role filters are unchanged. The backend defaults to the legacy array when the
parameter is absent, unknown, or a compact envelope would be larger (comparing gzip
sizes when the request accepts gzip). An older
backend ignores the parameter and returns the legacy array, which the same
decoder accepts without a second request. Mini-programs and older clients are
unchanged.

The compact envelope has `format`, `users`, and `chats`. Both tables contain
`schemas` (arrays of field names) and `rows` (`[schemaIndex, values]`). Complete user
records are deduplicated within this response only, by exact JSON value, not just
user ID. Tiny users and full members therefore cannot overwrite each other.

Chat owner, last-message sender, mentions and reply senders use user-table indexes.
Members are `[userIndex, context]`, where context retains `joined_at`,
`submission_role` and `group_chat_mute` independently for each chat. All other chat,
message and submission fields remain unchanged, including nulls and missing keys.
`decodeChatList` restores the existing `ChatDTO[]` contract and clones shared users
so changing one UI object cannot mutate another chat's member.

No global identity cache, extra user lookup endpoint, pagination change, or new
permission policy is introduced. The list also stops serializing the same last
message twice before applying the viewer-specific preview.

The backend also enables Django's built-in GZip middleware specifically for this
list route after envelope packing. It respects Accept-Encoding, Vary, already
encoded responses, and Django's compression safeguards. It does not compress
unrelated endpoints or change proxy configuration.

The table format is lossless application-level size reduction. Savings
depend on the number of chats and repeated users; compare decoded JSON bytes and
actual compressed transfer bytes separately. It does not claim a fixed reduction
for production. A future summary/detail split must first migrate member-dependent
consumers (mentions, forwarding, profile shared groups) rather than silently drop
members or message data from the current DTO.
