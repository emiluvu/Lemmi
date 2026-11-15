# Avatar animation artwork study

Generated edits made with built-in ImageGen from Kylie's original PNGs, supplied
by Emilia on November 14, 2026. Original files are unchanged. Full initial prompts
and correction instructions are in `manifest.json`. These are review assets,
not final device exports or a replacement for the six interaction-state set.

Each transparent RGBA PNG is 2172 × 724: three horizontal 724 × 724 cells,
ordered mouth_closed, mouth_open, pet_ack. Stable identities are dog, cat,
bunny, bird and lemming. Bunny keeps the w-shaped lip; the bird's beak is its
only mouth. The pet_ack cell adds three pink hearts and happy closed eyes.

Open `preview.html` locally. It previews all five identities, bounded mouth
movement (six seconds), a static hearts reaction (1.8 seconds), and reduced
motion. These durations are preview choices, not firmware contracts. Changing
avatar or hiding the page stops the preview. No external resources, serial,
credentials, microphone, camera, speech or backend are used.

Observed checks: all five generated strips visually inspected; PNG headers
confirm dimensions and RGBA format; git diff whitespace check passed. Generated
silhouettes are not guaranteed pixel-identical. Browser animation, RGB565
conversion, memory budgets, device readability and touch checks remain unrun.
Kylie/Emilia should review identity preservation and alignment before export.

Integration handoff: the app's explicitly selected avatar should select that
same identity on the robot through an agreed authoritative profile/session
contract. This task adds no profile sync or firmware API. Speech mouth movement
must follow actual local playback and return closed on cancellation/Stop; it
must not imply capture. Petting never changes identity, starts audio/camera or
resumes a session. Preserve status/Stop overlays, reduced motion, and the F13
gate before integrated F14 petting. App selection changes and all real hardware
behavior are pending. Installed control 0.7 is untouched.
