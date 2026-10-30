# Ai full-body bubble ornament

Mode: built-in `image_gen`, identity-preserve edit, transparent background.

Input: `public/activity/explorer-2026/ai-portrait-v5.webp`.

Generated original:
`/Users/jyonn/.codex/generated_images/01a18a29-f00c-7473-b30d-7bc48ec3b610/exec-a573a38e-b8d7-48b7-a11b-3a61a2f3883c.png`.

Shipped assets: `public/activity/explorer-2026/ai-fullbody-v6.webp` (320px high),
`public/activity/explorer-2026/ai-fullbody-thumb-v6.webp` (128px high).
WebP encoding retains alpha; the transparent outer margin was trimmed for a
narrow ornament. Previous assets remain available to stale clients.

Final prompt:

> Use case: identity-preserve. Edit target: the attached Ai Haibara portrait. Create a transparent full-body character cutout for a very narrow chat-bubble ornament. Keep her recognizable auburn short bob, cool blue-gray half-lidded eyes and composed intelligent expression, elegant clean Detective Conan anime cel shading, white laboratory coat over muted plum turtleneck. Change the composition from wide seated bust to a slim standing FULL BODY, head to both shoes visible. Arms held close to torso, one hand in coat pocket, other lightly holding coat lapel; feet close together, straight upright relaxed pose. Knee-length white coat with narrow silhouette, charcoal leggings and small dark shoes. Natural child character proportions with clearly readable face; not super-deformed chibi, no oversized hands, no props or sprawling elbows. Portrait canvas, body height about 2.6 times widest point, minimal transparent padding, sharp clean silhouette, no background, no text, no badge, no frame, no shadow floor. Intended display width 28 CSS px and height 66 CSS px; hair can peek over bubble top, feet aligned to bottom.

## Transformation rendering

The paired background artwork and measured silhouettes stay unchanged. Two
small, clipped SVG portrait layers receive a one-second native opacity animation:
gold covers the outgoing body, identity swaps at peak light, gold clears to reveal
the incoming body. The city and sky remain static. There are no canvas backing
stores, particles, filters or JavaScript animation frames. The first transition
starts after three visible seconds; subsequent rests last eight seconds.
Only one visible instance owns playback. Offscreen/background instances cancel
their animation and timers; reduced motion and data saver keep a still image.
CPU count and reported device memory no longer disable motion on phones.
Landscape anchors the backdrop near the roof and scales both figures around
their feet, keeping the standing body within the available height.
