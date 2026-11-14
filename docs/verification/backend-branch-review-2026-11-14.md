# Backend branch review — November 14, 2026

Historical review of the exact revisions below. The blocking spoken-concern defect was subsequently fixed by `3fb561d` and merged into main through `24e7fe2`; see [the speech pipeline handoff](../handoffs/anay-speech-pipeline.md). Preserve the failed observation as historical evidence, not a claim that the current main still has this defect.

Requested by Anay on `mobrob-Precision-3680`. Reviewed exact remote heads:

| Branch | Revision | Recommendation |
| --- | --- | --- |
| `anay/app-data-schema` | `cff855499d7173cf2705d16dd616381a841147ba` | Approve the storage-only increment. |
| `anay/speech-pipeline` | `151ebc3db06e8ea1ef6cc44df9c3fd8b5f8e13a4` | Request changes for the voice concern-response defect below. |

Comparison targets: `origin/main` at `be1e096a0691a82ff7a8d97c190af6eb0b6032cd` and the deployment checkout at `8172e17ac73416e7a97fed295d1bf2518fa0f143`. Three-way content checks found no conflicts for either branch against either target, or when combining the two feature branches. No merge or deployment was performed.

## Blocking finding: urgent voice guidance never reaches TTS

**P1 — `anay/speech-pipeline`, `packages/server/src/speech-turns.ts:312–315`.** When STT recognizes an urgent phrase such as “I cannot breathe”, `SessionCoordinator.submitTextInternal` correctly selects the fixed reply and pauses the session. Its `interrupt` cancels the speech owner and increments generation. `SpeechTurns.run` then takes the special return for a fixed paused response, before synthesis. The gateway can deliver `response.text`, but there is no TTS call or PCM output. A participant relying on the robot's spoken interface receives no audible urgent guidance. The same path also affects unwell/refusal replies.

This conflicts with the fixed urgent response requirement in safety-and-privacy section 5 and the preferred voice interface. This finding concerns an already recognized phrase, independently of recognition quality or the explicitly unavailable notification provider.

Reproduced using the existing coordinator and fixture adapters with one valid PCM frame and STT returning the reviewed urgent phrase. Result: successful fixed text result, phase `paused`, **0 TTS calls**, no speech output. An added review-only assertion expecting a synthesis call fails. Reproduction file: `/tmp/lemmi-review-speech/tests/review-regressions.test.ts`; log: `/tmp/lemmi-speech-review-regressions.log`.

Provide a separately authorized, current fixed-response output path after ordinary speech is canceled. Keep capture off and the interaction paused; preserve local/global Stop, disconnect, revocation and revision cancellation. Do not bypass the existing freshness checks to play the canceled turn. Add a gateway regression covering audible fixed guidance and interruption during its synthesis/playback before enabling voice.

## Checks actually performed

Pinned Bun **1.4.4**, existing frozen lockfile, independent worktrees under `/tmp`, and a separate disposable **PostgreSQL 17** container on loopback port 55437. Each suite had its own database; migration upgrade tests used separate schema-test databases. The deployment database and private configuration were not modified.

| Check | Data branch | Speech branch | Combined content tree |
| --- | --- | --- | --- |
| Frozen dependency install | Pass | Pass | Pass |
| Full Bun suite with PostgreSQL enabled | 97 passed / 875 expectations | 109 passed / 2,107 expectations | 115 passed / 2,149 expectations |
| Type/Svelte check | Pass | Pass | Pass |
| Production build | Pass | Pass | Pass |
| Source formatting | Pass | Pass | Not repeated |
| Production profile/media/authorization smoke | Pass | Pass | Not repeated |
| Python speech boundaries | Unchanged | 7 passed | Not repeated |
| Production TLS/control/chat fixture smoke | Not repeated | Pass | Not repeated |

The migration suite exercised a populated foundation upgrade, repeat application, checksum/data preservation, forced transactional rollback, cross-profile/type rejection, membership bounds, stable reordering and cascades. The broader SQL proposal remains outside active migration discovery; its journal/contact/privacy tables were not promoted or applied.

Speech-specific additional checks:

- Five fixture turns with six-second synthetic outputs passed through certificate-verified WSS and the four-chunk playback window. Playback receipts were simulated consumption.
- Three synthetic turns passed through a separately started copy of this host's installed local engines, the branch gateway and verified WSS. The LLM was a fixture. STT ran on **CPU**, not CUDA. STT times were 327/291/281 ms; TTS times were 50/85/80 ms. These observations establish transport/adapter operation, not recognition accuracy, human speech quality or physical playback.
- The isolated engine exited 0 without a semaphore warning. No microphone, speaker, camera, real notification or external LLM request was used for this review.
- The extra urgent-response regression failed as described above, despite the supplied suites passing.

Initial build/socket/database attempts were blocked by sandbox permissions. The necessary checks were rerun outside the sandbox and passed; those environment failures are not counted as branch defects.

Logs: `/tmp/lemmi-{data,speech,combined}-tests.log`, corresponding check/build logs, `/tmp/lemmi-data-smoke.log`, `/tmp/lemmi-speech-data-smoke.log`, `/tmp/lemmi-speech-control-smoke.log`, `/tmp/lemmi-speech-voice-smoke.log`, `/tmp/lemmi-speech-live-local.log`, and `/tmp/lemmi-speech-python.log`. Review worktrees and the combined source tree remain under `/tmp/lemmi-review-*` for inspection. The disposable PostgreSQL container/databases were removed after testing.

## Merge and deployment handoff

The data branch is ready for review/merge as a metadata foundation; catalog hosting and the deferred service workflows remain unfinished. Apply only the discovered migrations, never the historical full proposal, during a separately authorized deployment.

Hold the speech branch for the P1 correction and its regression tests. Voice remains opt-in; neither software fixtures nor these synthetic CPU checks establish K151 controls, physical sound, human recognition quality, CUDA operation or demo-network acceptance. Existing documented STT quality concerns remain unresolved. Counterpart firmware/UI review is still required before integrated voice deployment.

The shared checkout stayed on `backend-deploy`. Existing uncommitted pairing-helper work was preserved. No production service was restarted, no live device was paired/revoked, and no production session was created. This review adds documentation only; deployed status and API implementation are unchanged.
