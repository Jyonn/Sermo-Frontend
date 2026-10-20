# BGM visual assets V2

Created with the built-in ImageGen tool, not the CLI. All selected PNGs are saved in this repository, with the originals preserved under Codex generated_images. Transparent device alpha is preserved. Buttons, numbers, branding and playback states are real UI layers, not baked into the product images.

## Files

- `public/activity/bgm/drawer-background-v2.png`: quiet portrait studio backdrop, 1024 x 1536.
- `public/activity/bgm/device-blue-v2.png`: transparent blue housing, 1402 x 1122.
- `public/activity/bgm/device-pink-v2.png`: matching transparent pink housing, 1402 x 1122.
- Header reuses `public/activity/bgm/title-zh-v1.png` at 116px wide rather than repeating a large title in the body.

## Final Prompts

### Background
Use case: stylized-concept. Asset type: production background texture for the Frienden 主角登场 music keychain event Drawer. A vertical 2:3 premium soft tactile toy-world backdrop, warm porcelain ivory paper/satin with very subtle powder-blue and blush-pink reflected light at outer edges, delicate studio light bloom in upper right, a tiny understated star-shaped shadow near bottom corner, faint soft fabric folds only at edges. Vast clean low-detail center and upper region for legible interface text and a 3D keychain product. Editorial collectible-toy photography atmosphere, airy, warm, not fantasy, not purple, not neon, no people, no products, no letters, no logos, no borders or UI. Seamless-looking quiet background that can crop responsively, no strong focal objects, restrained contrast.

### Blue Housing
Use case: product-mockup. Asset type: production transparent base for an interactive six-button music keychain, blue boy edition. Generate a single realistic premium powder-blue ABS plastic oval keychain housing, landscape 5:4 canvas, almost perfectly front-on orthographic camera with slight top light, no perspective distortion. Oval body occupies x20%-96%, y15%-90%; polished chrome split ring and short realistic chain on left occupying x2%-28%, y18%-65%, a tiny original boy-face enamel charm and small star hanging below chain on far left. The oval face is COMPLETELY SMOOTH AND BLANK with no buttons, no holes, no circles, no printed words, no logos, no embossed artwork. Its upper and lower rows are blank uninterrupted blue plastic for buttons added later in code. Convincing thick rounded body, defined rim and seam, soft glossy convex edges, subtle specular reflections, believable injection-molded object, soft studio product lighting, actual transparent alpha background and subtle contact shadow only under object. No hands, no UI, no panel, no text, no numbers. The center of the blue face should remain spacious, even, unornamented. Physical collectible toy, not a flat illustration.

### Pink Housing Edit
Use case: precise-object-edit. Asset type: matching pink girl edition of this interactive keychain housing. Edit target: supplied blue keychain image. Change ONLY the powder-blue plastic housing to soft blush-pink plastic, the small blue star charm to pink, and the tiny boy enamel face charm to a cute original girl enamel face charm with dark bob hair and a pink bow. Preserve EXACTLY the canvas size, transparent alpha background, oval body shape, body placement, blank smooth face without any buttons or holes, front-on view, chrome keyring shape and location, shadows, lighting, proportions and rim geometry. No words, no logos, no buttons, no circles. This must align perfectly with the original image for the same six HTML button coordinates.
