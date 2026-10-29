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

## Release

Backend migration Activity.0019 seeds configuration only. No account data is
rewritten. Ship the frontend assets and backend together, execute the approved
migration, then verify all four release IDs and the seeded configuration.
