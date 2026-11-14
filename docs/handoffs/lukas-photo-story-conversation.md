# Photo Story voice rehearsal handoff

Branch: `codex/photo-story-conversation`. Review checkpoint, not deployed or fully
accepted. Based on main `86a4540`; unrelated Teach Lemmi changes were preserved
in their checkout. Reuses the earlier Photo Story pure context, browser PCM utility
and authored generic garden/park SVGs, plus main's existing SessionCoordinator,
SpeechTurns, speech adapters, support policy and OpenRouter adapter.

Implemented: pure photo create/reduce/project/system transitions; factual
`photo.skip` / `photo_skipped`; caption-grounded context; Conversational, Guided,
Quiet handling; shared speech ownership for openings/repeats and STT replies;
local browser microphone capture, PCM streaming, receipt-backed playback,
typed fallback, skip, just-look, pause/resume, mute, help and stop controls.
New local rehearsal operations consume existing speech schemas. Production live
gateway routes remain unchanged; Anay must review the proposed contract additions.

Run with pinned Bun 1.4.4 from the branch checkout:

```powershell
bun run photo-story --speech-home C:/path/to/existing/configured/Lemmi
```

The supplied home must contain the existing configured speech `.env`, Python
environment and model assets. The launcher reads configuration privately, resolves
model paths, starts the existing speech wrapper if needed and opens local services
on ports 3011/5183. Open http://127.0.0.1:5183/participant/photo-story.
Default chat is explicitly `reviewed_demo`, not OpenRouter. For real model calls,
set `LEMMI_PHOTO_STORY_CHAT=openrouter` and supply private `OPENROUTER_MODEL` and
`OPENROUTER_API_KEY` to the existing adapter. No failed-live fallback is performed.
Without speech configuration, text fallback remains available.

Observed verification before publication:

- Eight Photo Story tests pass: support settings, uncertainty, repeated answers,
  idempotent factual skip, voice next/end, late-result cancellation, missing content,
  provider failure, shared STT/TTS receipts and TTS-to-text fallback/repeat.
- Full suite: 125 pass, 33 database skips, one existing Windows POSIX file-mode
  assertion failure (0666 versus 0600). No real test database configured.
- Svelte and TypeScript checks passed during development; final TypeScript check
  also passed. Windows native Bun aliases had intermittent runtime issues.
- Real local synthetic speech smoke passed: opening TTS, synthesized sample answer
  through STT, reviewed follow-up TTS and shared playback receipts, no saved audio
  or transcript. Run `bun run smoke:photo-story` with existing private speech env.
- Browser showed garden opening and a typed Roses follow-up with completed local
  TTS playback after fixing four-frame batching. Human microphone recognition,
  denied-mic path, sustained capture, all keyboard/error states and hardware still
  need acceptance. Do not describe synthetic speech as a human microphone test.
- Standard Windows `bun run build` encountered a native alias/Bun module-resolution
  issue; invoking installed Vite directly with Bun from `apps/web`
  (`bun ../../node_modules/vite/bin/vite.js build`) built successfully. Frozen
  dependency installation also encountered Windows lifecycle/junction failures;
  existing pinned dependencies were reused locally; lockfile unchanged.

Next work and review:

1. Anay reviews proposed `conversation.text`, `speech.speak/start/chunk/end/receipt/output`,
   `photoStory.status`, `ConversationTextCommand.purpose`, and photo skip event
   integration. These are opt-in loopback rehearsal consumers, not new public APIs.
   Integrate approved pack hosting/scoped media into the existing production authority,
   and reconcile with Teach Lemmi's concurrent coordinator changes.
2. Kylie reviews browser control races, microphone permission/delayed grant handling,
   pause/stop/next during pending work, network failure cleanup and usable real voice.
   Test with a person before claiming a complete voice demo. Browser draft still
   needs polish and final acceptance; the protocol keeps capture bounded per turn.
3. Use approved uploaded photo IDs through existing protected media APIs. This
   checkpoint uses authored fictional illustrations, not the supplied stock photos.
   Photo source/permission review remains separate from the song approval.
4. Runtime image analysis is unavailable: existing ChatInput and OpenRouter messages
   contain text only. No photo pixels were analyzed or sent to a model. No configured
   model capability lookup or real OpenRouter Photo Story quality test was performed.
5. `photoEventRecap` derives viewed/skipped IDs exclusively from validated measured
   journal events. Excerpts remain off; no spoken-content summaries are produced.
   Existing `JournalSchema` still requires `summary: null`; authorized production
   journal/summary hosting is Anay's missing integration. The local caregiver page
   is explicitly unauthenticated rehearsal, not a protected production summary.

No shared backend deployment, live profile mutation, media upload, notifications,
or real participant data use occurred. Merge/deploy only after counterpart review.
