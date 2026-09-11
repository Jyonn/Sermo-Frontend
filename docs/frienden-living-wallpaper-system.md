# FRIENDEN Living Wallpaper System

## Purpose

The LV17 illustrated rooms are living scenes, not moving posters. Their architecture and
paint texture remain stable while animals and plants express small, readable actions.
Messages always remain the highest-contrast moving content.

## Rendering Model

The source illustration is sampled once by a full-scene WebGL canvas. Motion zones apply
continuous, soft-edged UV displacement around authored source-image coordinates. This
avoids detached cutouts, duplicated pixels, seams, and viewport-dependent positioning.

The original CSS background remains mounted underneath as the permanent fallback. The
canvas fades in only after the image texture and shader are ready.

## Motion Grammar

- \`breathe\`: resting animals expand and settle around their center of mass.
- \`peek\`: window and doorway characters rise, pause, look, and withdraw.
- \`hop\`: standing characters use a short anticipation and lift cycle.
- \`wag\`: horizontal body motion suggests a tail or relaxed fidget.
- \`water\`: the gardener tilts toward the flower while procedural drops cross the gap.
- \`sway\`: plants bend progressively from their root instead of translating as a block.

Each actor owns source coordinates, influence radius, amplitude, speed, and phase.
Phases are deliberately offset so the scene never moves in unison.

## Runtime Contract

- Render at no more than 30 fps and cap device pixel ratio at 1.5.
- Pause when the canvas leaves the viewport or the document becomes hidden.
- Keep the static CSS artwork when WebGL, shader compilation, or texture loading fails.
- Disable the canvas entirely when reduced motion is requested.
- Keep the renderer below messages and composers and outside pointer interaction.
- Use one shared renderer in live chat, conversation previews, and welcome-message previews.

## Authoring Rules

Motion zones must be authored against the uncropped 941 by 1672 source painting. A zone
should contain one semantic actor or one rooted plant cluster. Overlapping broad zones,
full-frame transforms, floating decorative particles, and hard clip paths are prohibited.

Amplitude should remain below one percent of the source dimension. A motion can be clear
through timing and posture without producing visual instability behind chat text.

## Future Asset Pipeline

When editable source art becomes available, scene definitions can progress from soft
deformation to authored skeletal meshes without changing the React API. Each future actor
should provide a neutral plate, occlusion mask, mesh, bones, and named animation clips.
The runtime should continue to expose the same static fallback and lifecycle behavior.

