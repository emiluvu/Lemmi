# Mascot artwork — version 1

User supplied and explicitly requested these generic character images for Lemmi's chooser and conversation screen. Creator and broader license are unspecified; permission recorded here is the user's requested project use. Originals are copied without modification, preserving PNG RGBA transparency. These are static app previews, not animation states or measured robot exports.

| Avatar ID / file      | Dimensions  | Bytes  | Original source filename                | Description                               |
| --------------------- | ----------- | ------ | --------------------------------------- | ----------------------------------------- |
| dog / dog.png         | 1448 × 1086 | 453613 | Tiny Cream-and-Caramel Puppy Mascot.png | Cream puppy with caramel ears             |
| cat / cat.png         | 1312 × 1199 | 619026 | Tiny Cream-and-Caramel Cat Mascot.png   | Cream and caramel cat                     |
| bunny / bunny.png     | 1278 × 1230 | 697497 | Tiny Cream Bunny Mascot.png             | Cream bunny with pink inner ears          |
| bird / bird.png       | 1312 × 1199 | 616004 | Chubby Blue Bird Mascot.png             | Blue bird with cream belly                |
| lemming / lemming.png | 1312 × 1199 | 536716 | Tiny caramel lemming mascot.png         | Caramel lemming with cream face and belly |

`apps/web/src/lib/avatars.ts` maps the shared AvatarId values to these public app assets. Profile saves use the existing shared profile client and revisions; the conversation screen loads only the participant-safe profile projection. All animals share controls and voice. Six-state artwork and Emilia's hardware-format/memory validation remain pending.
