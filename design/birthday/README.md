# Frienden birthday atelier

Four local art directions pairing a site skin with its full-screen birthday welcome.

## Preview

Start the existing Vite development server and open `/design/birthday/index.html`.

- `?theme=gilded&scene=skin`: 鎏光礼序 / Gilded occasion
- `?theme=orbital&scene=welcome`: 星河来信 / A letter from the stars
- `?theme=botanical&scene=welcome`: 花间来日 / A garden of tomorrows
- `?theme=pop&scene=welcome`: 糖纸派对 / A little more joy
- `?scene=compare`: four-direction comparison
- `device=phone`, `lang=en`, `dark=true`, `name=...` also supported.

Controls switch themes, page contexts, viewport, language and color mode. The welcome supports a birthday wish, a direct exit, Escape, keyboard focus containment, and entry into the matching skin. Chat composer messages stay in this page only. Sample conversations and settings are illustrative, without production account/API access.

## Design system

| Direction | Palette and material | Welcome | Site skin |
| --- | --- | --- | --- |
| 鎏光礼序 | Burgundy, champagne, limestone, satin | An editorial birthday invitation and candlelight still life | Warm ivory surfaces, burgundy actions, quiet gold detailing |
| 星河来信 | Midnight navy, champagne, glass, orbital lines | A personal observatory and another journey around the sun | Deep-blue surfaces, pale-gold actions, an understated celestial backdrop |
| 花间来日 | Sage, petal pink, ecru, handmade paper | A painted garden birthday letter | Botanical greens, paper-warm surfaces, soft organic accents |
| 糖纸派对 | Cobalt, coral, butter yellow, enamel | A playful collectible-design birthday set | Confident blue actions, buttery bubbles and coral accents |

The same artwork, palette, typography and copy direction carry through welcome, shared birthday card, chat environment, Square posts and Menu. Mobile welcomes place the image above the letter; desktop uses a full-height image beside the letter. Dark surfaces remain readable without filtering or recoloring the artwork.

## Performance and accessibility

- Four optimized WebP assets total approximately 770 KB; originals are preserved at their generated-image locations recorded in `prompts.json`.
- No video, audio, WebGL, canvas loop, network API, third-party CDN, or perpetual particle animation.
- At most 22 celebration fragments, one finite animation; removed after 3.6 seconds and when the page is hidden.
- System reduced-motion preference is respected; an additional preview toggle is provided.
- Named buttons, keyboard dialog containment, Escape exit, visible focus and English copy are included.
- Browser visual QA was unavailable because browser use was disabled in Work settings. Do not claim screenshots or real-device verification based on this preview.

## Scope and next stage

These are local review artifacts, outside the production app entry/build. No API/model changes, automatic birthday triggers, production permissions or production theme choices have been added. No release or deployment is intended at this stage.

After a direction is selected, integrate its tokens and welcome into Frienden's shared framework, connect it to explicit skin permissions and celebration settings, and upload selected bitmaps into the managed cloud resource library before production. Local design assets are kept here for review, not as a replacement for production resource management.

Images were generated with the built-in imagegen tool, one distinct prompt per direction. Exact prompts and source locations are in `prompts.json`.
