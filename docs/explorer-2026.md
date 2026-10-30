# 2026 Explorer

Annual automatic activity, fixed to 2026-10-30 00:00 through 2027-01-01 00:00
exclusive in Asia/Shanghai. A space joining later does not extend the window.

## Progress and Rewards

Themes may finish in any order. Every completed theme unlocks one additional
reward; five manual claims must occur in order and within the activity window.
Existing profile customization, verified bindings and check-ins count. Posts or
submitted contributions must be within the window. The backend latches completed
themes into ActivityEvent and checks all claims and wearable ownership itself.

The other-activity theme requires every reward tier from one activity in the same
space. VIP checks its full permanent inventory; BGM uses its final automatically
owned track gate; configured rewards use inventory ownership; pooled activities
require each milestone's actual prize and the personal reward where applicable.
Rewardless games do not count. Historical completed activities do count.

Welcome editing retains existing LV6 permissions. No activity-specific bypass is
introduced. Chronelle evidence reads the verified native binding locally, with no
token refresh or remote requests from activity polling.

| Tier | Resource key | Quality |
| --- | --- | --- |
| 1 | explorer-conan | uncommon / selected |
| 2 | explorer-ai | rare |
| 3 | explorer-duality | epic |
| 4 | explorer-romance | legendary / collector |
| 5 | identity.explorer.2026 | annual medal |

## Artwork and Motion

All seven raster assets were generated specifically for this activity with
imagegen. Transparent title artwork is reused in the banner, navigation header,
share card and landing page. Assets live under public/activity/explorer-2026 and
are WebP-encoded for mobile delivery. Background states crossfade; the profile
cover uses independent floating artwork and rain layers. Both respect reduced
motion. Background animation pauses when the page or scene is not visible.

## Visual refresh / 2026.10.30.11

Reference review:

| Reference | Useful principle | Explorer application |
| --- | --- | --- |
| [Conan TV 30th exhibition](https://tvconanten-30th.jp/) | Character-led identity and themed collectible grouping | One navy/brass moonlit world, five distinct collectible specimens |
| [Pokémon GO anniversary](https://pokemongo.com/news/10th-anniversary-party) | Separate event identity, time window and reward information | Focused landing, visible progress and next action; secondary reward gallery |

The review is an editorial comparison of identity, information hierarchy and
collectible presentation, not a copied layout. External reference pages did not
render reliably in the connected Chrome; their official structure and reward
information were reviewed through web sources. The original Explorer activity and
the implemented refresh were inspected directly in Chrome.

The gallery now shows one selected collectible in its real product context:
shared UserAvatar, shared bubble skin tokens, FriendenLivingWallpaper and
UserProfileCard. Desktop pairs the specimen with its description; mobile stacks
them in an expanded shared Sheet. The avatar clip selector has sufficient
specificity to preserve all frame ornaments. Navigation keeps a compact title
and circular back/share controls. Reduced-motion behavior remains shared.

Seven built-in imagegen assets are shipped as versioned WebP files under
`public/activity/explorer-2026/`; transparent alpha is retained. The complete
prompt set and file list are in [explorer-2026-art-v2.json](explorer-2026-art-v2.json).
The generated transparent title is reused without replacement. Five derived
128px thumbnails total about 34 KB, avoiding full reward artwork downloads for
the landing page's small collection strip and next-reward thumbnail.

Explorer campaign cards resolve their full-bleed banner from local presentation
metadata even when a forwarded payload has no presentation or has the old
portrait artwork URL. Reward keys, tiers, progress and claim enforcement remain
server-owned and unchanged. Old image filenames remain for stale clients.

`/design/explorer` is a synthetic, non-claiming preview for desktop/mobile,
appearance modes, incomplete and completed collection states.

## Personalization correction / 2026.10.30.13

Reviewed the live Menu → Language & personalization editors, including Dragon
bubbles and the Friendly Neighborhood profile. The previous Explorer bubble
repeated a large character sticker on every line and inflated short messages;
the avatar inherited a 28% corner radius that did not match the artwork aperture.
The frame now bleeds the portrait beneath the measured inner rim. Ai bubbles use
two-tone material, offset corners, fine inner rules and a small molecular motif,
with no repeated character sticker or fixed message height.

The shared wallpaper renderer now assembles both portraits from 150 unique,
instance-scoped SVG clips. Tiles disperse, rotate and reassemble on a 14-second
cycle, with small pixel sparks and an opaque navy stage so gaps never expose
the light chat surface during a burst. The shared profile card opts into a separate
layered scene: generated transparent couple, generated city, rain planes,
water rings, lamp breathing and falling petals. Animation pauses offscreen or
when the document is hidden; reduced motion shows a still wallpaper and scene.
All three profile consumers pass the same theme to the same card component.

Two new built-in imagegen assets and prompts are recorded in
[explorer-2026-art-v3.json](explorer-2026-art-v3.json). The non-claiming study at
`/design/explorer?wearables=1` renders the actual ChatsPage preview and profile
card for checking the same skins used in the Menu editor.

## Character-only transformation / 2026.10.30.14

The environment is now one stationary, inpainted clean plate. Source portraits
are clipped to their own silhouettes and lenses, rather than tiling the whole
photo. The sky, moon, skyline, cat and rooftop are never part of the moving grid.
Foreground grains are 16 × 16 source pixels (about 6 CSS pixels on a 390px-wide
view). Each follows six samples of a cubic Bézier curl, shrinking as it leaves
and gathering along the reverse trail. Both roles retain the shared visibility
pause and reduced-motion fallback. Geometry tests check coverage, unique cells,
foreground bounds and non-collinear motion. The built-in imagegen clean-plate
prompt and asset path are in [explorer-2026-art-v4.json](explorer-2026-art-v4.json).

## Initial release

Backend migration Activity.0019 seeds configuration only. No account data is
rewritten. Ship the frontend assets and backend together, execute the approved
migration, then verify all four release IDs and the seeded configuration.
