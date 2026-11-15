# Photo Story Start/Resume handoff

November 14, 2026 (America/Los_Angeles). Branch: `codex/photo-story-start-resume`.
Base: `cd68663`. Source candidate only; nothing deployed or merged.

Lukas reported a disappearing avatar, silent Start/Resume and an unconfirmed image
glitch. This branch updates the existing coordinator, gateway and browser together.

## Behavior

- Explicit Start schedules one reviewed greeting and one simple opening question.
  Quiet receives a greeting without a question. The browser opens its audio context
  during the explicit action, separately from microphone permission/capture.
- Direct Photo Story start applies Lukas's existing `photo.talk` action and reads
  the approved caption plus an optional simple question. Existing typed/recognized
  mode entry still uses its reviewed fixed opening. Quiet reads the caption only.
- Explicit Resume briefly reorients and repeats the current photo prompt, current
  open-conversation reply/question, or teaching prompt. It never advances the
  picture/topic or asks the model to reconstruct a canceled photo turn.
- Pause silences current work. Stop during pending opening or Resume synthesis
  aborts that work; even an adapter ignoring cancellation cannot publish late
  text/audio or restart the session. Receipt-based playback and endpoint ownership
  remain authoritative. There is no automatic capture or recurring prompt loop.
- A single transient output reminder survives participant Pause/Resume and mic mute.
  Stop, disconnect, handoff, context changes and activity replacement clear it.
  Photo reminders bind to activity instance and asset. It is never checkpointed,
  journaled, used as a retained transcript or added to conversation summaries.
- Lemmi remains beside the image while speaking/thinking. Caption and picture space
  stay reserved. Long captions can scroll/read in the existing dialog; short screens
  can scroll the photo screen without hiding fixed safety controls.
- `ScopedPhoto.svelte` uses the same protected asset URL with no-store fetches.
  Generation changes alone do not remount a loaded picture. Session/lease/profile/
  privacy/policy/endpoint/asset changes replace it and release its blob URL. HTTP 409
  is retried once with fresh server authorization, within an eight-second deadline.
  Failure cancels local audio and requests Pause; retry loads only the picture and
  never resumes the conversation automatically.

The exact reported glitch was not reproduced. Two plausible contributors were
confirmed in source: mobile captions resized the old image, and a generation change
during an asynchronous scoped image read is deliberately rejected. Authorization
checks were preserved; no failed read is converted to a fixture success.

## Changed interfaces

No public HTTP route, WSS schema, dependency, migration or environment change.
Existing `input.start`, `input.photo.start` and `input.resume` now initiate output.
Existing clients must consume/cancel that playback before requesting capture.
Internal coordinator methods use the existing approved-output speech queue; its
text ceiling now matches the existing 600-character reply contract. Very long
repeats omit the added introductory prefix to preserve the complete bounded reply.
The new browser `preparePlayback()` method never calls getUserMedia or requests a
server capture grant. Text-only Photo Story introduction remains available.

## Observed checks

- Bun 1.4.4: 76 focused tests passed / 673 expectations across activity selection,
  browser audio/window, multi-endpoint, scoped photo HTTP, photo integration and
  speech gateway suites. Covers Start speaking first, photo introduction, same
  scene/question Resume, pending Resume/Start TTS Stop, Quiet, no new capture,
  no prompting loop, no checkpoint retention, profile/observer isolation, and
  stale scoped-media reads.
- Full suite: 307 passed / 52 skipped / three failures / 5,127 expectations.
  Skips require a configured test PostgreSQL database. Existing environment failures:
  OpenSSL missing from PATH in control TLS and voice proxy TLS tests; Windows
  media-file permissions report 0666 where the POSIX assertion requires 0600.
  These same three failures were documented in the prior profile-context acceptance.
- `bun run check`: TypeScript passed; Svelte reported zero errors and warnings.
- `bun run build`: production build passed. Changed-source Prettier and Git
  whitespace checks passed. Windows Bun emitted its existing temporary node-alias
  warning; it did not prevent these checks.
- Actual in-app browser inspection using temporary fictional UI fixtures at
  390×844 and 1280×800: picture plus speaking/thinking avatar, readable captions,
  loading status, explicit error/retry and keyboard focus into voice controls.
  Mobile speaking/thinking scene bounds both measured y=80, width=350,
  height=378.3125 CSS px. A six-second image load kept the picture at y=80,
  width=202.7917, height=236.3125 before and after loading. Failed image kept the
  avatar visible and showed “Try picture again.” Desktop slow/failure states were
  also inspected. Temporary routes/fixtures were removed afterward.

These are fixture visuals plus synthetic adapter/socket tests. No real microphone,
human-audible playback, private deployed asset read, real provider call, database
acceptance or K151 behavior was established in this task. The existing deployed
revision and configuration remain unchanged.

## Next review and rehearsal

Anay: review transient reminder clearing, approved speech and output cancellation.
Kylie: review the coordinated LiveParticipant/ScopedPhoto layout, keyboard/zoom and
actual browser playback gesture behavior. Lukas: review the short opening wording
and photo/question continuity. Emilia: verify device playback and local Stop/mute.
No messages have been sent on the teammates' behalf.

Before integration/deployment, rehearse with a fictional profile on the real browser:
Start → hear Lemmi first; say Start Photo Story → see both avatar and picture and
hear its introduction; answer → Pause → silence; Resume → hear the same question
on the same picture; Stop during delayed synthesis → no late output. Repeat in
Quiet, with microphone denied/off, with a throttled image and with an image failure.
Confirm retry alone neither speaks nor captures. Reconnect must remain paused.

Unrelated journal/overview and other pre-existing working-tree edits were preserved
and excluded from this branch's commit; they are not dependencies of this fix.
