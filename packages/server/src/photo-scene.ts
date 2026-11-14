import { readFile } from 'node:fs/promises';
import { fail, type SessionSnapshot } from '@lemmi/contracts';
import { controlResponse } from './control-config';
import type { PersistentData } from './data/service';
import { DataError } from './data/repository';
import type { SessionRegistry } from './session-registry';

type SceneInput = {
  operation: 'photo.scene.read';
  credential: string;
  assetId: 'photo-story-garden' | 'photo-story-park';
};
function sceneInput(raw: unknown): raw is SceneInput {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const input = raw as Record<string, unknown>;
  return (
    Object.keys(input).length === 3 &&
    input.operation === 'photo.scene.read' &&
    typeof input.credential === 'string' &&
    /^[A-Za-z0-9_-]{40,100}$/.test(input.credential) &&
    (input.assetId === 'photo-story-garden' || input.assetId === 'photo-story-park')
  );
}
const scenes = {
  'photo-story-garden': new URL('../../../apps/web/static/photo-story-garden.svg', import.meta.url),
  'photo-story-park': new URL('../../../apps/web/static/photo-story-park.svg', import.meta.url),
};
export const PHOTO_SCENE_HEADERS = {
  'Content-Type': 'image/svg+xml',
  'Cache-Control': 'no-store, private',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; sandbox",
};
function scope(snapshot: SessionSnapshot | null): string {
  return JSON.stringify(
    snapshot && {
      id: snapshot.id,
      profileId: snapshot.profileId,
      generation: snapshot.generation,
      leaseId: snapshot.leaseId,
      profileRevision: snapshot.profileRevision,
      privacyRevision: snapshot.privacyRevision,
      policyRevision: snapshot.policyRevision,
      activeEndpointId: snapshot.activeEndpointId,
    },
  );
}

// Called only after the gateway's private loopback/internal-token boundary.
// These authored illustrations are selected from a fixed map, never user paths.
export async function handlePhotoScene(
  raw: unknown,
  data: Pick<PersistentData, 'devices' | 'repository'>,
  sessions: Pick<SessionRegistry, 'forProfile'>,
): Promise<Response> {
  if (!sceneInput(raw)) return controlResponse(fail('NOT_FOUND', 'Approved photo scene not found'));
  const input = raw;
  try {
    const identity = await data.devices.authenticate(input.credential);
    if (!identity || identity.endpoint !== 'browser')
      return controlResponse(fail('UNAUTHORIZED', 'Current browser endpoint required'));
    const coordinator = sessions.forProfile(identity.profileId);
    const before = coordinator.snapshot();
    if (!before || !coordinator.photoAssetAllowed(input.assetId))
      return controlResponse(fail('NOT_FOUND', 'Current approved photo is unavailable'));
    const principal = {
      kind: 'participant' as const,
      profileId: identity.profileId,
      deviceId: identity.deviceId,
      credentialId: identity.credentialId,
      bootId: data.devices.bootId,
    };
    // Reuse the resource authorization check; the following locks keep profile,
    // credential and gateway revisions current through the bounded local read.
    await data.repository.profile(principal, identity.profileId);
    return await data.repository.sql.begin(async (tx) => {
      const profiles = await tx`SELECT revision,privacy_revision,policy_revision,is_demo
        FROM lemmi.profiles WHERE id=${identity.profileId} AND deletion_state='active' FOR SHARE`;
      const profile = profiles[0];
      if (
        !profile ||
        !profile.is_demo ||
        profile.revision !== before.profileRevision ||
        profile.privacy_revision !== before.privacyRevision ||
        profile.policy_revision !== before.policyRevision
      )
        return controlResponse(fail('REVISION_CONFLICT', 'Photo context changed'));
      const devices = await tx`SELECT 1 FROM lemmi.devices
        WHERE id=${identity.deviceId} AND profile_id=${identity.profileId}
          AND credential_id=${identity.credentialId}::uuid AND boot_id=${data.devices.bootId}::uuid
          AND endpoint='browser' AND revoked_at IS NULL
          AND (credential_persistent OR credential_expires_at>now()) FOR SHARE`;
      const gateways = await tx`SELECT 1 FROM lemmi.gateway_state
        WHERE singleton AND boot_id=${data.devices.bootId}::uuid FOR SHARE`;
      if (!devices.length || !gateways.length || !data.devices.current(identity))
        return controlResponse(fail('UNAUTHORIZED', 'Endpoint access has ended'));
      const bytes = await readFile(scenes[input.assetId]);
      if (bytes.byteLength > 65536)
        return controlResponse(fail('UNAVAILABLE', 'Photo scene is unavailable'));
      if (
        !data.devices.current(identity) ||
        scope(before) !== scope(coordinator.snapshot()) ||
        !coordinator.photoAssetAllowed(input.assetId)
      )
        return controlResponse(fail('REVISION_CONFLICT', 'Photo context changed'));
      return new Response(new Uint8Array(bytes), {
        headers: { ...PHOTO_SCENE_HEADERS, 'Content-Length': String(bytes.byteLength) },
      });
    });
  } catch (error) {
    return controlResponse(
      fail(
        error instanceof DataError ? error.code : 'UNAVAILABLE',
        'Approved photo scene is unavailable',
      ),
    );
  }
}
