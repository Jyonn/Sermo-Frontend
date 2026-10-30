# Ai expression set v7 and local transformation studies

Status: local design review only; no production release.

Preview: `http://127.0.0.1:5173/design/explorer?wearables=1` (`npm run dev -- --host 127.0.0.1`). The chat tab switches between Moonlight sweep, Lens flash and Double exposure; Replay restarts the three-second initial hold. The expression tab displays all ten portraits. Add a sample message exercises stable per-message choices.

The selected transformation is now Moonlight sweep in both actual chat and personalization previews; the old gold effect has been removed. The other two studies remain available only through the comparison lab. All studies use bounded SVG portrait layers with native opacity/transform animation, the shared visibility lease and explicit reduced-motion/data-saving fallbacks. No particle renderer, canvas or JavaScript frame loop was added. Release notes 2026.10.30.21 are prepared for a future release, not deployed.

Ai uses one shared inline expression component in actual message text and reward previews. A hash of the random stable client message ID selects a face; reconciliation retains that ID after delivery. Each text message starts with a 1em-square portrait, aligned to the text baseline with a .25em trailing space. It is part of normal inline layout and appears only before the first line, including message text beside link previews. Quoted text and non-text media do not get an extra expression. Portrait compartments, dividers and all size measurements have been removed. A small red/ivory APTX 4869 capsule SVG sits on the inner vertical bubble border, clear of text and adjacent messages. The asset is editable native SVG; no new image generation was needed.

The Shinichi source `public/activity/explorer-2026/shinichi-night-v2.webp` already contains both complete shoes. The old animation polygon was shifted to the left around the lower leg and excluded the left shoe. The crop now follows the source leg and shoe landmarks, keeping the gap between the legs transparent. No regeneration or change to the source artwork was needed.

Validation: 22 focused tests passed, including message acknowledgement identity, expression stability/distribution, mobile asset budgets and both shoe landmarks. Production build and asset/style audits passed. Chrome checked 390px portrait, dark mode, all ten portraits and all three animated transitions; adding a message preserved existing faces. The full i18n audit still reports pre-existing non-English locale gaps (zh-TW 923, ja/ko/es 943); all 21 new keys are populated in all six locales.

Image generation mode: built-in imagegen; 10 independent transparent images. Identity reference: `public/activity/explorer-2026/ai-portrait-v5.webp`. Runtime files are 192px transparent WebP, encoded with cwebp q90; menu thumbnail 96px.

## yawn

Source: `/Users/jyonn/.codex/generated_images/01a18a29-f00c-7473-b30d-7bc48ec3b610/exec-d46d903a-8322-47cf-8071-d59fd831a70f.png`

Asset: `public/activity/explorer-2026/ai-expressions-v7/yawn.webp`

Full prompt:

Use case: identity-preserve. Input image is identity and cel-shading reference for Ai Haibara from Detective Conan. Create ONE square transparent reaction sticker, very close BIG HEAD portrait, complete auburn short bob silhouette and face, only a tiny plum turtleneck/white lab coat collar at bottom. Crop below neck, no torso. Recognizable cool blue-gray eyes, composed young character, premium expressive clean anime cel art, crisp readable face at 40 CSS px, minimal 4% transparent margin. The head fills 90% of canvas. Same identity, hair length and palette as reference. No text, no symbols, no speech bubble, no pill, no circular backing, no frame or white sticker border, no background, no floor shadow. Expression: She is mid-yawn: eyes squeezed shut, small open yawning mouth, one hand daintily covering her mouth, visibly sleepy and endearing.

## cool

Source: `/Users/jyonn/.codex/generated_images/01a18a29-f00c-7473-b30d-7bc48ec3b610/exec-fe4784e6-b903-4980-b146-54e6b43e2480.png`

Asset: `public/activity/explorer-2026/ai-expressions-v7/cool.webp`

Full prompt:

Use case: identity-preserve. Input image is identity and cel-shading reference for Ai Haibara from Detective Conan. Create ONE square transparent reaction sticker, very close BIG HEAD portrait, complete auburn short bob silhouette and face, only a tiny plum turtleneck/white lab coat collar at bottom. Crop below neck, no torso. Recognizable cool blue-gray eyes, composed young character, premium expressive clean anime cel art, crisp readable face at 40 CSS px, minimal 4% transparent margin. The head fills 90% of canvas. Same identity, hair length and palette as reference. No text, no symbols, no speech bubble, no pill, no circular backing, no frame or white sticker border, no background, no floor shadow. Expression: A frosty, cool and analytical expression: half-lidded sharp blue-gray eyes looking directly at viewer, straight closed mouth, chin slightly lowered, absolutely composed.

## smile

Source: `/Users/jyonn/.codex/generated_images/01a18a29-f00c-7473-b30d-7bc48ec3b610/exec-e0bf55ad-3cd2-4e07-b593-7597901f5482.png`

Asset: `public/activity/explorer-2026/ai-expressions-v7/smile.webp`

Full prompt:

Use case: identity-preserve. Input image is identity and cel-shading reference for Ai Haibara from Detective Conan. Create ONE square transparent reaction sticker, very close BIG HEAD portrait, complete auburn short bob silhouette and face, only a tiny plum turtleneck/white lab coat collar at bottom. Crop below neck, no torso. Recognizable cool blue-gray eyes, composed young character, premium expressive clean anime cel art, crisp readable face at 40 CSS px, minimal 4% transparent margin. The head fills 90% of canvas. Same identity, hair length and palette as reference. No text, no symbols, no speech bubble, no pill, no circular backing, no frame or white sticker border, no background, no floor shadow. Expression: A genuinely happy and warm smile: upturned mouth with a little visible teeth, joyful crescent eyes, gently rosy cheeks, head slightly tilted. Clearly cheerful rather than neutral.

## smirk

Source: `/Users/jyonn/.codex/generated_images/01a18a29-f00c-7473-b30d-7bc48ec3b610/exec-53400a3c-f8f2-4e2d-8cf0-0b8566e4a096.png`

Asset: `public/activity/explorer-2026/ai-expressions-v7/smirk.webp`

Full prompt:

Use case: identity-preserve. Input image is identity and cel-shading reference for Ai Haibara from Detective Conan. Create ONE square transparent reaction sticker, very close BIG HEAD portrait, complete auburn short bob silhouette and face, only a tiny plum turtleneck/white lab coat collar at bottom. Crop below neck, no torso. Recognizable cool blue-gray eyes, composed young character, premium expressive clean anime cel art, crisp readable face at 40 CSS px, minimal 4% transparent margin. The head fills 90% of canvas. Same identity, hair length and palette as reference. No text, no symbols, no speech bubble, no pill, no circular backing, no frame or white sticker border, no background, no floor shadow. Expression: A knowing mischievous smirk, one eyebrow raised, sly half-lidded eyes.

## side-eye

Source: `/Users/jyonn/.codex/generated_images/01a18a29-f00c-7473-b30d-7bc48ec3b610/exec-a6d5b33a-1752-49ab-8f32-b32a8dc6e206.png`

Asset: `public/activity/explorer-2026/ai-expressions-v7/side-eye.webp`

Full prompt:

Use case: identity-preserve. Input image is identity and cel-shading reference for Ai Haibara from Detective Conan. Create ONE square transparent reaction sticker, very close BIG HEAD portrait, complete auburn short bob silhouette and face, only a tiny plum turtleneck/white lab coat collar at bottom. Crop below neck, no torso. Recognizable cool blue-gray eyes, composed young character, premium expressive clean anime cel art, crisp readable face at 40 CSS px, minimal 4% transparent margin. The head fills 90% of canvas. Same identity, hair length and palette as reference. No text, no symbols, no speech bubble, no pill, no circular backing, no frame or white sticker border, no background, no floor shadow. Expression: Strong skeptical sideways glance to the left, narrowed eyes, tiny displeased pout.

## blush

Source: `/Users/jyonn/.codex/generated_images/01a18a29-f00c-7473-b30d-7bc48ec3b610/exec-a0d8a710-a56c-4c2b-9d98-40ff073c7197.png`

Asset: `public/activity/explorer-2026/ai-expressions-v7/blush.webp`

Full prompt:

Use case: identity-preserve. Input image is identity and cel-shading reference for Ai Haibara from Detective Conan. Create ONE square transparent reaction sticker, very close BIG HEAD portrait, complete auburn short bob silhouette and face, only a tiny plum turtleneck/white lab coat collar at bottom. Crop below neck, no torso. Recognizable cool blue-gray eyes, composed young character, premium expressive clean anime cel art, crisp readable face at 40 CSS px, minimal 4% transparent margin. The head fills 90% of canvas. Same identity, hair length and palette as reference. No text, no symbols, no speech bubble, no pill, no circular backing, no frame or white sticker border, no background, no floor shadow. Expression: Shy embarrassed blush, eyes looking down, softly pursed mouth, flushed cheeks.

## annoyed

Source: `/Users/jyonn/.codex/generated_images/01a18a29-f00c-7473-b30d-7bc48ec3b610/exec-c32587d1-e67e-4045-a905-5f9a5d550cdc.png`

Asset: `public/activity/explorer-2026/ai-expressions-v7/annoyed.webp`

Full prompt:

Use case: identity-preserve. Input image is identity and cel-shading reference for Ai Haibara from Detective Conan. Create ONE square transparent reaction sticker, very close BIG HEAD portrait, complete auburn short bob silhouette and face, only a tiny plum turtleneck/white lab coat collar at bottom. Crop below neck, no torso. Recognizable cool blue-gray eyes, composed young character, premium expressive clean anime cel art, crisp readable face at 40 CSS px, minimal 4% transparent margin. The head fills 90% of canvas. Same identity, hair length and palette as reference. No text, no symbols, no speech bubble, no pill, no circular backing, no frame or white sticker border, no background, no floor shadow. Expression: Clearly annoyed, brows furrowed, stern frown, cheeks slightly puffed.

## sleepy

Source: `/Users/jyonn/.codex/generated_images/01a18a29-f00c-7473-b30d-7bc48ec3b610/exec-4258379b-e534-4e16-a5bb-94f3baaa7cc6.png`

Asset: `public/activity/explorer-2026/ai-expressions-v7/sleepy.webp`

Full prompt:

Use case: identity-preserve. Input image is identity and cel-shading reference for Ai Haibara from Detective Conan. Create ONE square transparent reaction sticker, very close BIG HEAD portrait, complete auburn short bob silhouette and face, only a tiny plum turtleneck/white lab coat collar at bottom. Crop below neck, no torso. Recognizable cool blue-gray eyes, composed young character, premium expressive clean anime cel art, crisp readable face at 40 CSS px, minimal 4% transparent margin. The head fills 90% of canvas. Same identity, hair length and palette as reference. No text, no symbols, no speech bubble, no pill, no circular backing, no frame or white sticker border, no background, no floor shadow. Expression: Extremely sleepy, drooping eyelids, eyes barely open, relaxed tiny mouth.

## surprised

Source: `/Users/jyonn/.codex/generated_images/01a18a29-f00c-7473-b30d-7bc48ec3b610/exec-e221a2fe-6475-4d4b-9751-bd2bbdcf7d44.png`

Asset: `public/activity/explorer-2026/ai-expressions-v7/surprised.webp`

Full prompt:

Use case: identity-preserve. Input image is identity and cel-shading reference for Ai Haibara from Detective Conan. Create ONE square transparent reaction sticker, very close BIG HEAD portrait, complete auburn short bob silhouette and face, only a tiny plum turtleneck/white lab coat collar at bottom. Crop below neck, no torso. Recognizable cool blue-gray eyes, composed young character, premium expressive clean anime cel art, crisp readable face at 40 CSS px, minimal 4% transparent margin. The head fills 90% of canvas. Same identity, hair length and palette as reference. No text, no symbols, no speech bubble, no pill, no circular backing, no frame or white sticker border, no background, no floor shadow. Expression: Wide-eyed surprise, raised eyebrows, small open round mouth.

## thinking

Source: `/Users/jyonn/.codex/generated_images/01a18a29-f00c-7473-b30d-7bc48ec3b610/exec-c749e14b-b43e-4cd2-b6c1-3caf598e1d85.png`

Asset: `public/activity/explorer-2026/ai-expressions-v7/thinking.webp`

Full prompt:

Use case: identity-preserve. Input image is identity and cel-shading reference for Ai Haibara from Detective Conan. Create ONE square transparent reaction sticker, very close BIG HEAD portrait, complete auburn short bob silhouette and face, only a tiny plum turtleneck/white lab coat collar at bottom. Crop below neck, no torso. Recognizable cool blue-gray eyes, composed young character, premium expressive clean anime cel art, crisp readable face at 40 CSS px, minimal 4% transparent margin. The head fills 90% of canvas. Same identity, hair length and palette as reference. No text, no symbols, no speech bubble, no pill, no circular backing, no frame or white sticker border, no background, no floor shadow. Expression: Thoughtful analytical pose, one finger resting on chin, eyes looking upward.
