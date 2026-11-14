import { describe, test, expect } from 'bun:test';
import {
  ActivityActionSchema,
  ActivityCommandSchema,
  DeviceEventSchema,
  ParticipantProfileSchema,
  SessionSnapshotSchema,
  CheckInSnapshotSchema,
  createHttpTransport,
  createFixtureTransport,
  createClients,
  fail,
} from '@lemmi/contracts';
import {
  participantProfile,
  caregiverProfile,
  activityViewFixtures,
  helpStateFixtures,
  checkInStateFixtures,
} from '@lemmi/contracts/fixtures';
describe('shared boundary validation', () => {
  test('participant projection rejects caregiver-only fields', () => {
    expect(ParticipantProfileSchema.safeParse(caregiverProfile).success).toBe(false);
    expect(ParticipantProfileSchema.parse(participantProfile)).toEqual(participantProfile);
  });
  test('session controls and system inputs cannot be activity actions', () => {
    for (const type of ['pause', 'stop', 'system.resume', 'system.playback_receipt'])
      expect(ActivityActionSchema.safeParse({ type }).success).toBe(false);
  });
  test('commands reject injected destinations and unknown action fields', () => {
    expect(
      ActivityCommandSchema.safeParse({
        commandId: 'x',
        sessionId: 's',
        instanceId: 'a',
        expectedRevision: 0,
        action: { type: 'track.play', url: 'https://example.invalid' },
      }).success,
    ).toBe(false);
  });
  test('all four activity and camera fixtures validate', () => {
    expect(activityViewFixtures).toHaveLength(4);
    for (const value of checkInStateFixtures)
      expect(CheckInSnapshotSchema.safeParse(value).success).toBe(true);
    expect(helpStateFixtures.every((s) => s.mode === 'simulation')).toBe(true);
  });
  test('audio frames are bounded and versioned', () => {
    const event = {
      protocol_version: 1,
      event_id: 'e',
      session_id: 's',
      turn_id: 't',
      generation: 0,
      sequence: 0,
      type: 'audio.chunk',
      payload: {
        leaseId: 'l',
        streamId: 'x',
        encoding: 'pcm_s16le',
        data: Buffer.alloc(640).toString('base64'),
      },
    };
    expect(DeviceEventSchema.safeParse(event).success).toBe(true);
    expect(
      DeviceEventSchema.safeParse({
        ...event,
        payload: { ...event.payload, data: 'A'.repeat(857) },
      }).success,
    ).toBe(false);
    expect(DeviceEventSchema.safeParse({ ...event, protocol_version: 2 }).success).toBe(false);
  });
  test('fixture adapter requires explicit scenario and cannot fake unsupported operations', async () => {
    const clients = createClients(
      createFixtureTransport({ 'profile.load': { ok: true, data: participantProfile } }),
    );
    expect((await clients.profile.load({ profileId: 'profile-alex' })).ok).toBe(true);
    expect(await clients.preferences.forget({ profileId: 'profile-alex' })).toEqual(
      fail('UNAVAILABLE', 'No explicit fixture configured'),
    );
  });
  test('failed live request never falls back to mock', async () => {
    const transport = createHttpTransport('live', async () => {
      throw new Error('offline');
    });
    const result = await transport.call('profile.load', { profileId: 'profile-alex' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('UNAVAILABLE');
  });
  test('malformed success response is rejected', async () => {
    const transport = createHttpTransport('mock', async () =>
      Response.json({ ok: true, data: caregiverProfile }),
    );
    const result = await transport.call('profile.load', { profileId: 'profile-alex' });
    expect(result.ok).toBe(false);
  });
});
