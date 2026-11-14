# Resume: Anay speech pipeline

Historical pause marker. The user resumed work on November 14, 2026 and enabled completion/blocker Telegram notifications. See the current speech-pipeline handoff and build-plan observations for the final state; details below describe the pause checkpoint.

**Resumed checkpoint:** implementation/review/testing completed on the feature branch; see [current protocol handoff](anay-speech-pipeline.md) and the build-plan speech-pipeline evidence. 109 Bun tests, seven Python tests, build/check/format, production fixture smokes and a real 20-turn synthetic English WSS endurance passed. Clock-adjustment and cleanup fixes are included. Hardware/browser/German and human quality remain pending; deployment unchanged. Completion Telegram was requested for this resumed task. The earlier uncommitted/remaining-check statements below are historical.

## Location and branch

- **Active implementation:** `/tmp/lemmi-speech-pipeline-789epxj0`, branch **`anay/speech-pipeline`**, based on `origin/main` at `be1e096`.
- `backend-deploy` was merged into main through PR #2. Deployment head last reviewed: `04d050e`. Do not change/deploy that branch during this work.
- Shared checkout `/home/chaos/projects/Lemmi` remains on `anay/device-control-foundation` with earlier uncommitted copies. Its commits are already in main. **Do not reset, stash, clean, switch or overwrite that checkout.**
- New speech work is **uncommitted and unpushed** in the isolated worktree. Use explicit tool working directories. No subagents were used.

## Implemented so far

Existing coordinator now owns explicit capture grants, 16 kHz mono PCM16 / 640-byte chunks, chunk order/stream/lease/generation checks, 20-second/640,000-byte capture bound, and STT → existing chat → TTS orchestration. Input and output buffers are transient and wiped on completion/cancellation. Output negotiates native sample rates, carries four chunks ahead of consumed-playback receipts, distinguishes queued from receipt-backed speaking, and returns capture-off waiting. Stop/pause/help/disconnect/revoke/context changes cancel; mic mute preserves already-approved playback. Legacy clients remain audio-disabled unless they negotiate playback.

Main changes: contracts `speech.ts`, `device.ts`, `session.ts`; server `speech-turns.ts`, `session-coordinator.ts`; realtime gateway/startup; OpenRouter adapter; new speech pipeline/gateway tests; scripts `speech-gateway-smoke.ts`, `speech-quality.ts`, `speech-fixture.ts`. Speech startup is opt-in with `LEMMI_SPEECH_ENABLED=1`. Root template lists independent speech settings.

**Important limitation:** current engine API recognizes a bounded whole turn after explicit `audio.end`; incremental STT and automatic silence detection are not implemented. This differs from the technical spec's streaming-recognition target and must be documented. Hardware/browser capture, physical playback and German acceptance remain pending.

## Observations

- 14 new pipeline/gateway tests passed (1,222 expectations), covering control cancellation, buffer bounds, stale work, fixed help/refusal and receipt validation.
- Initial full suite: 99 passed / 6 failed; failures cascaded from the legacy unsupported-audio test. Fixed the turn-ID guard to preserve UNAVAILABLE for unnegotiated audio. **All 7 legacy control-gateway tests then passed. Full suite has NOT been rerun after that fix and the new reasoning test.**
- TypeScript passed before the latest reasoning/diagnostic edits; final check/build/format/Python suite still pending.
- Verified TLS/WSS fixture rehearsal passed. Real isolated text + voice rehearsal passed with local engines and `z-ai/glm-5.3-flash`; no production sessions or physical speaker were used.
- GLM's mandatory default reasoning exhausted 160 tokens (HTTP 200, finish_reason length, no final content). Added explicit `LEMMI_LLM_REASONING_EFFORT`, exclusion of reasoning content, and a sanitized budget error. **Live tests used command-only overrides `LEMMI_LLM_REASONING_EFFORT=low LEMMI_LLM_MAX_TOKENS=512`**; private/deployed configuration was not changed. Model metadata confirmed low is supported and reasoning mandatory.
- Base-model live run: STT 670 ms, combined two LLM calls 2,600 ms, TTS 369 ms. Small-model run: STT 1,519 ms, combined LLM 1,903 ms, TTS 307 ms. Receipts were simulated consumption; these are synthetic observations, not human/20-turn benchmarks.
- English quality is still imperfect: first base probe 8/10. Same-waveform base/small five-phrase comparison later passed 20/20, but repeated garden probes yielded base 3/6 and small 5/6. Padding/beam-size changes did not reliably fix base. **Do not claim STT quality solved.**
- Added explicit optional multilingual small profile to assets/provisioner (`--stt-profile small`), pinned revision/hash; default remains base. Weights are ignored.

## Private setup and cleanup

Ignored worktree speech `.env` uses base on port 33325. Ignored `.env.small` selects STT-only small on 38107 and TTS at the base endpoint, proving independent endpoint selection. Both services were **stopped** for this pause (exit 0); each printed a Python resource_tracker warning about one leaked semaphore being cleaned up. Investigate that shutdown warning on resume; no speech listener was intentionally left running. The isolated PostgreSQL cluster at `/tmp/lemmi-voice-db-bfrqbzox/pgdata` (port 57225, database `lemmi_voice_test`) was also stopped. No deployed services were touched.

The ignored `.venv` symlinks the existing shared speech environment. The worktree's `.models` contains links to existing base/voice assets plus its own downloaded small model. Preserve these caches; never commit them. OpenRouter key stays in the shared ignored root `.env`; never print its contents. No Telegram notification was requested.

## Next when resumed

1. Read applicable AGENTS/specs and inspect this worktree's diff. Finish cancellation/timeout/security review; bound the smoke metadata clone read (currently `.json()`), and review output metadata consistency.
2. Run type/Svelte checks, full tests against a fresh/restarted isolated PostgreSQL `_test` DB, seven Python boundary tests, build, formatting, existing production fixture smokes and the new voice smoke. Use pinned Bun 1.4.4 at `/home/chaos/.npm/_npx/9ec17c29a94a501f/node_modules/@oven/bun-linux-x64/bin/bun`. Socket/network/build commands may need sandbox escalation.
3. Update **docs/backend_api.md**, integration contracts, task board/claim, setup/readme and build-plan observations; write Emilia/Kylie handoff with exact wire examples and explicit remaining limits.
4. Review/commit the complete feature on `anay/speech-pipeline`; keep deployment/main unchanged. No publish/merge has happened for this slice.
