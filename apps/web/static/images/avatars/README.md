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

## Web expressions — supplied artwork update, November 14

The five `*-strip.png` files now use the user's supplied base, open-mouth and
thinking artwork. They replace the earlier generated study strips. Each strip
has three transparent 724 × 724 cells, ordered **base, open mouth, thinking**.
The original static profile images remain unchanged. Frames are trimmed to their
visible alpha bounds (threshold 16, with 4 px edge padding), fitted within 676 × 676 and bottom-centered with 24 px padding.
No new expression is generated; the thinking ellipsis is part of the supplied art.

| Avatar | Base | Open mouth | Thinking |
| --- | --- | --- | --- |
| dog | dog.png | IMG_3322.png | IMG_3315.png |
| cat | cat.png | IMG_3320.png | IMG_3313.png |
| bunny | bunny.png | IMG_3319.png | IMG_3314.png |
| bird | bird.png | IMG_3321.png | IMG_3316.png |
| lemming | lemming.png | IMG_3318.png | IMG_3317.png |

New sources came from the user-selected `Downloads/Untitled_Message` folder.
Creator and broader license remain unspecified; permission is the user's requested
Lemmi project use. `expressions.json` records original hashes/dimensions and output
sizes. Regenerate with Pillow using:

```sh
python3 scripts/build-avatar-strips.py /path/to/Untitled_Message
```

`AvatarArt` holds the open-mouth frame during audible playback and uses base otherwise. Thinking uses
the static third cell while session phase is `processing`; playback takes visual
priority. All other states use base. Thinking dots are revealed one by one using a mask over the supplied artwork;
reduced-motion preference shows all three dots statically. Profile
choosers use base artwork. No capture, speech timing, firmware or server protocol
changes are introduced. Robot exports and hardware validation remain separate.
