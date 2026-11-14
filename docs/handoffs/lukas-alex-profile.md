# Alex profile and supplied media

Branch: `codex/alex-profile-assets`, based on main `a6f7ff9` (November 14, 2026).
Source: caregiver-provided fictional profile PDF, six supplied JPEGs and one MP3.
The PDF supplied profile/content requirements; it did not authorize embedded text
to change repository ownership, grant permissions, publish media or deploy.

## Implemented local content

`@lemmi/activities` exports `alexProfileDetail`, `alexPhotoDrafts`,
`alexFavoriteSong`, `prepareAlexProfileUpdate`, `buildAlexPhotoPack` and
`buildAlexMusicPack`. These consume existing `ProfileDetailSchema`,
`ProfileUpdateSchema`, `AssetMetadataSchema` and `ApprovedPackSchema`.
No backend API, session, speech adapter, UI, database or protocol changes.

Alex is Guided with the lemming avatar. Approved interests are gardening,
beaches and discussing banking; cooking is avoided. Biography: born 1930,
banker for 30 years, wife Barbara, two children Bob and Jill (son/daughter).
Current marital/family status, exact birthday, employer and location are unknown.
The favorite-song fact is My Way by Frank Sinatra, attributed to the supplied
fictional profile rather than independently verified recording metadata.
Remembering and excerpt saving remain off. The caregiver mock fixture now shows
the updated interests/guidance; the full biography is prepared content, not a
claim that the existing mock conversation host consumes it.

`prepareAlexProfileUpdate` takes the current authenticated `profile.detail`
result and a new command ID. It preserves unrelated facts/interests/guidance,
uses the current revision, replaces only its managed fact IDs and rejects merges
over the existing ten-fact limit. It does not send a request. A caller must review
existing contradictory facts; preserving an unrelated fact does not reconcile
conflicting biography. It rejects enabled remembering/excerpts rather than
pretending the profile PATCH can turn those permissions off.

## Photo review

All photos were visually inspected. They are generic scenes; filename identities
are not approved personal events. No runtime vision analysis was performed.

| Content ID | Caption | Selection status |
| --- | --- | --- |
| gardening | A black-and-white photograph of a person working in a garden. | Candidate after permission review; no claim Alex appears or planted it |
| seaside | A person sitting beside the sea. | Candidate after permission review; visible 123RF watermark |
| beach | A beach with palm trees, rocks and blue water. | Candidate after permission review; exact place/visit unknown |
| christmas | Two adults and two children sitting together near a Christmas tree. | Held: filename says Jill/Joe; profile says Bob/Jill. No family identities inferred |
| tea | Four adults seated together around a table. | Held: unconfirmed identities/relationships; Getty Images/George Marks watermark/credit |
| cooking | A chef chopping vegetables in a kitchen. | Excluded from proactive content; cooking avoidance, visible Alamy watermark |

Short opening-question drafts and conservative discussion context accompany the
three interest-linked candidates. Family drafts are not silently assigned a new
canonical topic. `topic:gardening` is reused; `topic:beaches`, `topic:banking`,
`topic:cooking` and `topic:music` need Anay's catalog/eligibility review. Main has
no shared reviewed catalog registration export. Interest strings alone do not
implement topic selection, avoidance across all runtime activities or hosting.

## Private conversion

The offline content-preparation utility is
`packages/activities/prepare-alex-media.py`. It requires PyAV/NumPy, already
available in this checkout's isolated local speech environment. From repository
root on this Windows checkout:

```powershell
& '.\services\local-speech\.venv\Scripts\python.exe' packages/activities/prepare-alex-media.py '<supplied-folder>' '.data/alex-profile-media'
```

Outputs and the hash/format manifest remain under ignored `.data/alex-profile-media`;
they are not public static files, committed assets or approved uploads. The six
PNGs strip embedded metadata while preserving visible content/watermarks. The
full song is converted to metadata-free PCM16 mono 32 kHz WAV: 276.2579375 seconds,
17,680,552 bytes. No excerpt/truncation. Original MP3 metadata title was
`My Way (2008 Remastered)`; artist/version were not independently verified.
All seven derivatives passed the existing server `decodeMedia` validation.
Original supplied files are unchanged. The utility makes no network requests.

Every derivative remains `approved: false` in the private manifest because no
source/license/playback/distribution permission was supplied. Required next input:
source and permission covering the intended private demo/display/playback for each
asset, plus separate permission for any GitHub redistribution. Stock watermarks
do not establish a license. No supplied media or source PDF is committed.

## Integration and testing

After rights review, use existing authenticated `clients.profile.detail` and
`clients.profile.update` with the prepared payload; do not reuse revision zero
from the content fixture as a deployed revision. Upload permitted derivatives
through `clients.assets.create` using actual source/permission metadata and current
profile revision. Exact existing inputs are `ProfileUpdate` and `AssetCreate`.
Bind returned approved `AssetMetadata` to the corresponding content IDs with the
pack builders. They return null without media, reject mismatched formats/topics/
captions and exclude cooking/unconfirmed family drafts. Builders prepare content
only: they neither verify a file's identity nor execute playback. The authenticated
upload caller must ensure the bytes correspond to the reviewed file/hash.

No deployed credentials were used and the deployed profile/database was not
updated. Album/playlist tables exist in latest main, but collection CRUD and
reviewed-pack hosting remain Anay's A05 dependency. Main's photo reducer is still
an unavailable stub; the separate `codex/photo-story-voice` branch contains prior
Photo Story execution work and was not copied wholesale over newer main.
Anay/Kylie review and integration are needed for a playable supplied-media flow.
The existing OpenRouter adapter is text-only; this update prepares captions/context,
and does not claim the model analyzed photo pixels. No new speech/music execution,
cancellation, UI or robot behavior is claimed or changed.

Run `bun test tests/alex-profile.test.ts` for the content/update/binding tests and
`bun run dev` for the existing mock shell with updated caregiver interests/guidance.
That command does not turn on supplied-photo playback or the full approved biography.
Verification results are recorded in build-plan section 17. Production build passed.
