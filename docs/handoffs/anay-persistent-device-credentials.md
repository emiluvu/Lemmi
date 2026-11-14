# Persistent Stackchan device credentials

Branch: `anay/persistent-device-credentials`, based on `backend-deploy` at `618bec2`. **Not deployed.** Anay requested the backend change in a separate worktree while another agent owns the running backend redeployment. This branch does not change production configuration/services/database or firmware.

## Behavior and setup

The existing flow remains: authorized caregiver enrolls → Stackchan explicitly confirms/claims once → scoped credential authenticates HTTPS/WSS. To request a key valid until revoked, after the branch is merged/migrated/deployed run:

```sh
python3 scripts/pair-stackchan.py
```

The helper requests persistent enrollment by default. `--persistent` remains an explicit alias; `--short-lived` requests the original one-hour credential, and the two flags are mutually exclusive. The HTTP API default remains one hour when `credentialMode` is omitted.

The helper still uses caregiver login and the outer domain gate, prints only the private five-minute pairing details, leaves them unclaimed and saves no token/key. `--token` and `--env-file` retain their existing behavior. Never paste pairing details/credentials into source, chat, screenshots or logs.

The existing caregiver POST `/v1/devices/stackchan-alex/pairings` accepts:

```json
{"deviceId":"stackchan-alex","profileId":"profile-alex","commandId":"a-new-command-id","credentialMode":"persistent"}
```

Omit `credentialMode` for the original one-hour credential. Persistent mode requires PostgreSQL; without it, the gateway explicitly returns UNAVAILABLE. The five-minute/single-use pairing code and explicit local confirmation requirements remain unchanged. A claim cannot choose or upgrade mode. Its successful result has the existing credential field and `expiresAt:null` for persistent mode. The raw 32-byte random bearer secret is returned once; only its SHA-256 hash/ID/scope persists. A lost claim response requires explicit revoke/re-enrollment; there is no key-recovery endpoint.

`device.ready.credentialExpiresAt` is likewise `null` for a persistent key; finite timestamps retain their original meaning. The HTTP/WSS bearer header and independent `X-Lemmi-Access-Key` domain gate remain unchanged. This is one device key scoped to `stackchan-alex` and fictional Alex, not a caregiver/admin/provider credential. It cannot read caregiver guidance/journals or administer contacts/profiles. There is no new public endpoint, global master key, query credential or plaintext key storage.

## Restart, revocation and races

- Gateway startup retains only explicitly persistent, active keys, restores their hashes into its bounded authority, and assigns a new boot owner. Pending codes and short-lived keys are cleared. Existing active sessions are ended; no capture, playback, camera, command sequence or pending output is restored. A fresh connection authenticates but must explicitly Start; it starts muted/capture-off.
- Device reconnect can reuse the key, with fresh hello/sequence and normal local permissions. Credential persistence never authorizes microphone/camera use or restarts stopped work.
- Caregiver revocation immediately invalidates local access/output before any SQL wait, then atomically removes the key and records a durable retry receipt. Successful revoke cannot be undone by restart. Replaying its command ID after restart leaves a replacement key alone. New pairing always requires explicit revocation of an active key first.
- Enrollment/revocation serialize with profile membership and gateway ownership under database locks. Claim rechecks the enrolling caregiver's current assignment. Old gateway claims/pairings/revocations cannot replace current boot ownership or revoke a retained key. Reads recheck key ID/scope/boot/profile deletion; connected sockets use the existing database watchdog.
- Durable revoke receipts contain only profile/actor/command references and are capped at 256/profile. At capacity, enrollment stops while revocation remains available; reboot cannot clear that limit. Do not prune receipts automatically and revive old command IDs. In-memory command limits still apply too. A future administrative reset must deliberately reconcile enrollment/retry state.
- Missing/unavailable database, invalid profile/assignment or failed commit is an explicit failure. Failed revocation does not claim durable success: keep the interaction stopped and retry the caregiver operation once storage recovers. Offline application state cannot promise a durable database write.
- Profile deletion cascades keys and receipts; a later fictional bootstrap cannot revive a removed key. Private media, excerpts and contact workflows are unchanged. This adds no public deletion endpoint.

## Migration and deployment handoff

Apply only the normal discovered migrations using the existing private `bun run db:migrate` flow. `003_persistent_device_credentials.sql` adds `credential_persistent` with default false plus shape checks and a private `device_revocations` receipt table. It leaves `001`/`002` and existing one-hour credential semantics unchanged; it grants PUBLIC no new privileges. No historical full SQL proposal is applied.

Keep database logging/private-file/provider protections from the existing deployment. Deploy web/gateway/contracts together so nullable expiry is accepted end to end. Do not enable persistent enrollment on a client that rejects null expiry. The running backend agent owns the actual deployment/restart and private backup; this branch has not requested or performed it.

Rollback to pre-feature gateway code needs care: its restart code tries to clear every credential without clearing the new marker. Revoke persistent keys through the new implementation before downgrading, or perform a separately reviewed migration. The check constraint fails closed rather than silently treating a persistent key as short-lived. No automatic schema downgrade is supplied.

## Emilia handoff (firmware explicitly outside this task)

Anay confirmed Emilia will make the credential survive robot reboots. Handle nullable expiry in the claim result and `device.ready`, save the claimed device key privately alongside its assigned device/profile/origin and reconnect with the same bearer header. Keep the domain access key separate. Never retain the five-minute pairing code as the long-lived key. TLS verification, independent Stop/mute/watchdog, default capture-off and explicit Start/Resume remain required. Do not restore a session ID, capture grant or queued media on boot. Clear credential storage on explicit unpair/factory reset; coordinate caregiver revocation for a lost/replaced device. No firmware source, upload or hardware behavior was changed/tested here.

## Verification

The branch uses pinned Bun 1.4.4 and an isolated PostgreSQL 17 container on loopback port 55447, with dedicated runtime/schema-test databases. All data is fictional. The production database, public pairing and external providers were not used. Observed: **130 Bun tests / 2,533 expectations**, **five Python helper tests**, type/Svelte check, production build, formatting and whitespace checks passed. Production data smoke passed in default and `--persistent` modes with verified fixture TLS/identity; existing control/chat smoke passed too. Tests include an actual loopback gateway restart, same-key reconnect, capture-off/explicit-start state and active-socket revocation. A populated pre-feature schema upgrade preserves existing short-lived credential mode and foundation checksums. The full database suite retains transaction rollback checks. Python fixtures use ephemeral ports to avoid colliding with real login helpers on the shared host. Full observations are recorded in the build plan; local fixtures are not physical robot or live-provider acceptance.

To repeat production-route persistent enrollment checks, use the built app and an explicitly selected disposable database ending in `_test` via `LEMMI_TEST_DATABASE_URL`, then run `bun scripts/smoke-data.ts --persistent`. The smoke resets its selected fictional test data; never point it at the deployed/shared database. Its default mode continues to test one-hour credentials.

Helper-default follow-up: six Python fixtures pass after making persistent enrollment the CLI default, including `--short-lived`, compatibility of `--persistent`, conflicting-flag rejection and request-body checks. No live enrollment was performed.
