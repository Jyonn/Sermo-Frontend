# Frienden DEV official avatar

This identity belongs to the official account in the `dev` space, not the OAuth
application management interface. It retains the current four-color textured
Frienden mark. Three square directions are included in preview.html; concept 3
is the user-selected DEV terminal-badge lockup and is exported as
`public/icons/frienden-dev-512.png`. The PNG is ready to upload as the account
avatar. No account identity or server avatar has been changed automatically.

SVGs keep the brand mark and developer tag in separate editable groups. The
existing raster brand texture is referenced without altering its shape or color.
The export tool inlines that texture in memory before rasterizing. Run
`scripts/export-brand-icons.mjs` in a Node tool environment with Sharp available
(or set NODE_PATH to the bundled workspace dependency directory). This optional
tool is not a runtime/build dependency.

PWA exports use the same original mark on #f7f4ec, with 10% general padding and
16% maskable padding. Exported PNGs are RGB, with no alpha channel. Existing
transparent in-product brand graphics stay unchanged.
