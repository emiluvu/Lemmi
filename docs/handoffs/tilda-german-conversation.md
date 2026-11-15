# German conversation for Tilda

Implement German text and spoken conversation for one explicitly created fictional profile named **Tilda**. Keep Alex and every other existing profile on their current behavior. This handoff is an implementation task list; writing it does not create Tilda or enable German in the deployment.

## Scope and ownership

Anay owns backend contracts, profile configuration, authorization, speech provisioning and deployment. Kylie owns browser language propagation, participant wording and error states. Emilia owns robot language propagation and physical controls. Lukas reviews any activity-language boundary. An agent assigned only frontend work must hand backend changes to Anay rather than implement them independently. The request to publish this document does not authorize redeploying the shared backend.

First deliver ordinary German conversation in the browser. Robot acceptance is a separate gate. German activities are outside this increment: show an honest German unavailable message instead of entering English Teach Lemmi or Photo Story. Do not add a global language switch or translate the whole caregiver app for this task.

Use Tilda as a fictional demo identity only. Do not infer a real person's biography, health, preferences, contacts or consent. New context starts empty; remembering and excerpt permissions retain their existing defaults.

## Read before implementing

Read `AGENTS.md`, `docs/team-start.md`, `docs/integration-contracts.md`, the relevant owner brief in `docs/build-and-demo-plan.md`, and the current product, experience, safety/privacy and technical specifications. Then inspect:

- `docs/backend-status.md`, `docs/backend_api.md`, `docs/host-setup.md`
- `docs/handoffs/anay-multi-profile-endpoints.md`
- `services/local-speech/README.md`, `.env.example`, `assets.json`, `prepare_models.py`, `server.py`
- `packages/server/src/adapters/{companion-prompt,input-routing,openrouter,local-speech,reply-policy}.ts`
- `packages/server/src/session-coordinator.ts`, `speech-turns.ts`
- `packages/contracts/src/{conversation,speech,profile-assets}.ts`
- `apps/web/src/lib/voice-client.ts`, `features/browser-audio.ts`, `features/LiveParticipant.svelte`

Inspect the actual branch, manifests and dirty files before editing. Reuse Bun 1.4.4, existing clients and the single session authority. Preserve ongoing work, migrations, credentials and profile data. On the lab host, keep `/home/anayn/project/Lemmi` on `backend-deploy`.

## Starting evidence

Repository inspection on November 14, 2026 found:

| Layer | Observed implementation or deployment record | Remaining gap |
| --- | --- | --- |
| STT | faster-whisper 1.2.1, multilingual Whisper base, CPU/int8 in deployment records | Real German recognition and latency acceptance |
| Reply model | Last documented selection `z-ai/glm-5.3-flash` through OpenRouter, low reasoning and 512 tokens | Verify running selection and test actual German replies |
| TTS | Piper 1.8.0 with `en_US-hfc_female-medium`; optional `LEMMI_SPEECH_VOICE_DE` exists | Provision and validate a German voice |
| Browser | Text and capture entry points hardcode `language: 'en'` | Propagate Tilda's German setting |
| Routing | Several German Stop/Pause/Help/refusal phrases and German fixed replies exist | German coverage is partial; activity selection and teaching are English-specific |

The evaluator could not resolve `mobrob-Precision-3680` over SSH from Kylie's computer. No local root `.env` was present, so no live German model or speech call was made. Eleven existing adapter/routing tests passed with 101 expectations; these are fixture checks, not German audio acceptance.

## TODOs in implementation order

### 1 Verify the running configuration and enroll Tilda

- [ ] **Anay:** Inspect active web/gateway/speech revisions and effective nonsecret model settings on the backend host. Report only model IDs, language capabilities, engine versions and numeric limits; never dump private environment files or process environments.
- [ ] Confirm the actual LLM model ID, STT multilingual model rather than an English-only `.en` variant, ready STT/TTS workers, and whether private speech health advertises German TTS.
- [ ] Create one new fictional Tilda through the existing authorized creation flow. Record the returned stable profile ID in private deployment configuration or the appropriate operational record. Do not assume `profile-tilda` is an existing ID or select by display name.
- [ ] Explicitly enroll Tilda's browser endpoint. Use a separate browser context for comparison with Alex. Maintain scoped credentials, isolated context/assets/sessions and one active audio endpoint per profile; use explicit handoff for a robot.

### 2 Resolve German per profile and preserve existing defaults

- [ ] **Anay:** Inspect current profile fields before proposing a change. Resolve `de` for the exact enrolled Tilda ID on the server; retain current English defaults for existing profiles. Prefer an existing validated profile-language field if one exists. Otherwise add the smallest reviewed typed configuration/storage seam, with an explicit English compatibility default. A protected exact-ID configuration for this pilot is acceptable if documented; avoid display-name checks and arbitrary client-selected profile mappings.
- [ ] Publish the safe effective language through the existing authorized participant setup/profile seam. Coordinate any schema/client/migration change with Kylie and Emilia. Do not expose private caregiver context.
- [ ] Use the same resolved language for text, capture grants, STT, ordinary model prompt, fixed replies and TTS. Validate mismatched/stale requests at the authority boundary. Keep `en` and `de` as the supported set; this task does not add automatic language detection or mid-session language switching.
- [ ] **Kylie:** Replace hardcoded English at Tilda's active text/capture entry points with that resolved language. Inspect alternate participant/voice routes as well as `voice-client.ts`. A reload, reconnect or endpoint handoff must recover Tilda's language without carrying it to another profile.

### 3 Provision and test German speech

- [ ] **Anay:** Keep multilingual Whisper base for the first baseline and send `de` for Tilda. Measure recognition on short ordinary German phrases, umlauts, compound words, pauses and natural speech. Compare a larger local multilingual model only if baseline measurements justify the extra latency/resources.
- [ ] Select a German Piper voice with a reviewed model card, source/license and adult tone. Candidate: `de_DE-thorsten-medium`, 22,050 Hz. Review listening samples before final selection; this candidate is not pre-approved by the user.
- [ ] Pin the German voice revision, files, size/hash and attribution alongside existing model provisioning metadata. Extend the existing provisioning path instead of downloading weights during requests. Keep weights and private configuration out of Git.
- [ ] Configure `LEMMI_SPEECH_VOICE_DE` on the authorized host while retaining the English voice. Verify private health readiness for both languages and gateway/wrapper worker-count agreement.
- [ ] Missing or failed German synthesis must produce an explicit German unavailable state and capture-off waiting/paused behavior. Never synthesize German through the English voice or label a failed live request as success.
- [ ] Preserve bounded PCM, negotiated sample rates, playback credit, no capture during output, local cancellation, no raw audio/transcript retention and current provider privacy flags.

### 4 Review German replies and participant controls

- [ ] **Anay:** Exercise the actual configured model through the production adapter/prompt using fictional German inputs. Review fluent German, short adult wording, one question at most, approved-fact grounding and correct Conversational/Guided/Quiet behavior. The returned `language: 'de'` metadata alone does not prove the text is German.
- [ ] Review deterministic German controls and refusal/sensitive-topic routes, including `Stopp`, `Hör auf`, `Pause bitte`, `Ich brauche Hilfe`, `Darüber möchte ich nicht sprechen` and requests not to save. Cover quoted, negated and incidental mentions without turning them into commands. Keep manual Stop/Help independent of the model and journal writes.
- [ ] Review German fixed responses for privacy, uncertainty, unavailable contact, provider failure, pause/stop and unavailable activities. Do not claim contact delivery, emergency detection or help arrival. Do not expand clinical claims.
- [ ] **Kylie:** Show Tilda's essential participant controls and listening/thinking/speaking/waiting/errors in clear German, including `Sprechen`, `Fertig gesprochen`, `Pause`, `Stopp`, `Hilfe holen` and an explicit microphone-mute label. Keep safety controls visible in dialogs and keyboard accessible. Review wording with a fluent German speaker.
- [ ] **Anay/Lukas:** Reject German activity entry explicitly until reviewed German packs and transitions exist. Do not silently enter English teaching, translate an activity ad hoc with the LLM, or duplicate activity rules in components.
- [ ] **Emilia, if robot enabled:** Consume the resolved profile language using the agreed contract and verify Tilda-to-Alex handoff, Stop, mute, unmute, disconnect and watchdog behavior on actual K151 hardware. Unmute never starts capture.

## Acceptance checklist

- [ ] **Isolation:** Tilda has a distinct created profile ID and enrollment. Requests cannot access Alex's context/assets/session. Tilda produces German and Alex retains English, including when used concurrently and after reload/reconnect/handoff. Preview-only cards remain previews.
- [ ] **Real browser round trip:** Actual German microphone input reaches local STT, the configured external model replies in German, and local German Piper output is audibly intelligible. Verify pronunciation such as `Gärten`, `schön`, `Frühstück` and `Straße`. Test ordinary room noise and pauses; record results without saving microphone audio or transcripts.
- [ ] **Language review:** A fluent German speaker reviews several ordinary turns and the essential fixed/control/error wording. Include `Guten Morgen`, `Ich möchte über Blumen sprechen`, `Bitte sprich Deutsch`, a repeated question, refusal and uncertainty. Do not seed Tilda with an invented gardening preference merely to run these tests.
- [ ] **Safe lifecycle:** Stop during STT, model work and TTS prevents late output; Pause/disconnect/restart/handoff/profile-revision changes invalidate pending work. Mute cancels capture/pending input without unrelated playback cancellation; unmute keeps capture off. Quiet returns to capture-off waiting after speech.
- [ ] **Failures:** Missing German voice, STT/model timeout, invalid language, busy engine and disconnected output show honest errors with safe capture state. No English fallback, overlapping capture/playback or invented activity/contact success.
- [ ] **Regression:** Meaningful automated checks cover profile-language isolation, stale revisions/cancellation and German routing. Run the existing appropriate Bun checks/tests/build and Python speech tests when that service changes. Do not report fixture STT/TTS or synthetic playback receipts as human microphone/speaker acceptance.
- [ ] **Hardware:** Record robot checks separately as passed, failed or unrun. Browser success alone does not establish robot readiness.

## Handoff and deployment record

- [ ] Anay reviews server/data/access changes; Kylie reviews the browser flow; Lukas reviews activity boundaries; Emilia reviews hardware controls when relevant. Complete isolated implementation and checks before shared integration.
- [ ] The authorized deployment owner updates `docs/backend-status.md` and `docs/backend_api.md` together when backend configuration/contracts/availability change, and records actual acceptance in `docs/build-and-demo-plan.md`. Include exact running revisions, selected German voice, observed timings, failures and remaining limits without credentials, private paths or dialogue.
- [ ] Stage and validate before deployment. Preserve existing profiles, enrollment keys, data and migrations; prepare rollback of source/config/voice selection. Never reset/reseed the shared database to add Tilda.
- [ ] Report implementation, deployment, human browser acceptance and robot acceptance separately. If German acceptance fails, keep Tilda's speech unavailable with a clear message until corrected.

## References for model support

- [Whisper language list includes German](https://github.com/openai/whisper/blob/main/whisper/tokenizer.py)
- [Documented GLM model listing](https://openrouter.ai/z-ai/glm-5.3-flash) — verify real German responses rather than assuming fluency from the listing.
- [German Thorsten Piper model card](https://huggingface.co/rhasspy/piper-voices/blob/main/de/de_DE/thorsten/medium/MODEL_CARD) — candidate source; pin the reviewed revision when provisioning.
