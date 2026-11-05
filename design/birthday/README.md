# Frienden birthday atelier

Four local art directions pairing a site skin with its full-screen birthday welcome.

## Preview

Start the existing Vite development server and open `/design/birthday/index.html`.

- `?theme=gilded&scene=skin`: 鎏光礼序 / Gilded occasion
- `?theme=orbital&scene=welcome`: 星河来信 / A letter from the stars
- `?theme=botanical&scene=welcome`: 花间来日 / A garden of tomorrows
- `?theme=pop&scene=welcome`: 糖纸派对 / A little more joy
- `?scene=compare`: four-direction comparison
- `?theme=gilded&scene=components`: interactive themed component gallery (all four themes supported)
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

## Themed component extension

Eight selected transparent bitmaps were generated with built-in imagegen, one independent corner ornament and one gift emblem per theme. Exact prompts, source PNGs and local WebP paths are recorded in `component-prompts.json`. Alpha is preserved. Early full-frame bitmap explorations were rejected and are not referenced or shipped.

All border lines are CSS geometry (`border`, `border-radius`, `outline` and subtle outline shadows), sized directly to the container. There is no bitmap border, border-image, nine-slice image or stretched image frame. Corner ornaments are separate, contain-sized layers anchored to corners, with a responsive size token independent of container width and height. Content, controls and typography stay in HTML; bitmaps never contain functional labels or buttons. All decorative layers ignore pointer input and are hidden from accessibility trees. Normal dialogs are ornamented; destructive-action confirmations remain neutral.

The component gallery covers confirmation dialogs, desktop/mobile detail drawers, bottom action sheets, nested visibility pickers, calendars, form inputs, greeting cards, empty/loading states and toasts. It supports nested layers with focus containment, inert underlying content, Escape/backdrop close and return to the opener. Selection and reminder settings are local preview state only.

The same generated ornament is applied to conversation headers, the composer add-action sheet, birthday cards, Square author rows, Menu cards, settings groups and the full-screen welcome. Use the Decor toggle to compare ornamented and undecorated versions. Each theme loads only its own art; components reuse decoded images rather than loading individual full-size decorations per instance.

This remains local design work on `design/birthday-ateliers`, not a production release. Browser visual QA remains subject to the browser connection limitation noted above.
