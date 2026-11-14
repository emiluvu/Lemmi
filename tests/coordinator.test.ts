import { describe, test, expect } from 'bun:test';
import { MockCoordinator, localMockRequestAllowed } from '@lemmi/server';
import {
  SessionSnapshotSchema,
  ActivityViewSchema,
  ParticipantProfileSchema,
  JournalSchema,
  type Result,
} from '@lemmi/contracts';
const profileId = 'profile-alex';
function data(result: Result<unknown>): any {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.code);
  return result.data;
}
function start(c: MockCoordinator) {
  return SessionSnapshotSchema.parse(
    data(c.handle('session.start', { profileId, commandId: 'start', endpoint: 'browser' })),
  );
}
function music(c: MockCoordinator, sessionId: string) {
  return ActivityViewSchema.parse(
    data(
      c.handle('activities.start', {
        sessionId,
        commandId: 'music',
        activityId: 'music_playlist',
        packId: 'music-demo',
        packVersion: 1,
      }),
    ),
  );
}
describe('single mock authority', () => {
  test('journal keeps interruption reasons, deduplicates retries and does not invent playback', () => {
    const c = new MockCoordinator();
    let s = start(c);
    music(c, s.id);
    const pause = {
      sessionId: s.id,
      commandId: 'pause-once',
      expectedGeneration: s.generation,
      action: { type: 'pause' },
    };
    s = data(c.handle('session.command', pause));
    c.handle('session.command', pause);
    s = data(
      c.handle('session.command', {
        sessionId: s.id,
        commandId: 'resume-once',
        expectedGeneration: s.generation,
        action: { type: 'resume' },
      }),
    );
    c.disconnect();
    s = data(c.handle('session.get', { sessionId: s.id }));
    s = data(
      c.handle('session.command', {
        sessionId: s.id,
        commandId: 'resume-again',
        expectedGeneration: s.generation,
        action: { type: 'resume' },
      }),
    );
    data(c.handle('help.create', { profileId, commandId: 'help-once', mode: 'simulation' }));
    const journal = JournalSchema.parse(data(c.handle('journal.load', { profileId })));
    const events = journal.sessions[0]!.events;
    expect(events.filter((event) => event.type === 'activity_paused')).toEqual([
      { type: 'activity_paused', reason: 'participant', source: 'measured_event' },
      { type: 'activity_paused', reason: 'disconnect', source: 'measured_event' },
      { type: 'activity_paused', reason: 'help', source: 'measured_event' },
    ]);
    expect(events.filter((event) => event.type === 'activity_resumed')).toHaveLength(2);
    expect(events.some((event) => event.type === 'track_played')).toBe(false);
  });
  test('preview and unassigned IDs cannot access Alex operations', () => {
    const c = new MockCoordinator();
    for (const op of ['profile.load', 'journal.load', 'preferences.load', 'overview.load'])
      expect(c.handle(op, { profileId: 'preview-sam' }).ok).toBe(false);
    expect(data(c.handle('profile.previews', {}))).toHaveLength(2);
  });
  test('participant profile excludes private source/guidance', () => {
    const c = new MockCoordinator();
    const profile = data(c.handle('profile.load', { profileId }));
    expect(ParticipantProfileSchema.safeParse(profile).success).toBe(true);
    expect(JSON.stringify(profile)).not.toContain('Guidance');
  });
  test('one open session and command-ID body integrity', () => {
    const c = new MockCoordinator();
    const s = start(c);
    expect(
      data(c.handle('session.start', { profileId, commandId: 'start', endpoint: 'browser' })).id,
    ).toBe(s.id);
    expect(
      c.handle('session.start', { profileId, commandId: 'other', endpoint: 'browser' }).ok,
    ).toBe(false);
    expect(c.handle('session.start', { profileId, commandId: 'start', endpoint: 'robot' }).ok).toBe(
      false,
    );
  });
  test('duplicate music commands increment once; no playback receipt is invented', () => {
    const c = new MockCoordinator();
    const s = start(c);
    const view = music(c, s.id);
    const command = {
      sessionId: s.id,
      instanceId: view.instanceId,
      commandId: 'play',
      expectedRevision: view.revision,
      action: { type: 'track.play' },
    };
    const first = data(c.handle('activities.submit', command));
    expect(data(c.handle('activities.submit', command))).toEqual(first);
    expect(first.revision).toBe(1);
    expect(first.playback).toBe('requested');
    const journal = JournalSchema.parse(data(c.handle('journal.load', { profileId })));
    expect(
      journal.sessions[0]?.events.filter((e) => e.type === 'track_play_requested'),
    ).toHaveLength(1);
    expect(JSON.stringify(journal)).not.toContain('track_played');
  });
  test('pause blocks progression; resume preserves position without effects; stop is terminal', () => {
    const c = new MockCoordinator();
    let s = start(c);
    const view = music(c, s.id);
    s = data(
      c.handle('session.command', {
        sessionId: s.id,
        commandId: 'pause',
        expectedGeneration: s.generation,
        action: { type: 'pause' },
      }),
    );
    expect(
      c.handle('activities.submit', {
        sessionId: s.id,
        instanceId: view.instanceId,
        commandId: 'late-play',
        expectedRevision: view.revision,
        action: { type: 'track.play' },
      }).ok,
    ).toBe(false);
    s = data(
      c.handle('session.command', {
        sessionId: s.id,
        commandId: 'resume',
        expectedGeneration: s.generation,
        action: { type: 'resume' },
      }),
    );
    expect(s.phase).toBe('ready');
    expect(s.captureGrant).toBeNull();
    const fresh = data(
      c.handle('activities.view', { sessionId: s.id, instanceId: view.instanceId }),
    );
    expect(fresh.playback).toBe('stopped');
    expect(fresh.currentTrackId).toBe('garden-track');
    s = data(
      c.handle('session.command', {
        sessionId: s.id,
        commandId: 'stop',
        expectedGeneration: s.generation,
        action: { type: 'stop' },
      }),
    );
    expect(
      c.handle('session.command', {
        sessionId: s.id,
        commandId: 'restart',
        expectedGeneration: s.generation,
        action: { type: 'resume' },
      }).ok,
    ).toBe(false);
  });
  test('unmute and speech requests never start capture in starter', () => {
    const c = new MockCoordinator();
    let s = start(c);
    s = data(
      c.handle('session.command', {
        sessionId: s.id,
        commandId: 'unmute',
        expectedGeneration: 0,
        action: { type: 'mute', muted: false },
      }),
    );
    expect(s.captureGrant).toBeNull();
    expect(s.phase).toBe('ready');
    expect(
      c.handle('session.command', {
        sessionId: s.id,
        commandId: 'speak',
        expectedGeneration: s.generation,
        action: { type: 'speak' },
      }).ok,
    ).toBe(false);
  });
  test('mic mute preserves unrelated music request', () => {
    const c = new MockCoordinator();
    const s = start(c);
    const a = music(c, s.id);
    c.handle('activities.submit', {
      sessionId: s.id,
      instanceId: a.instanceId,
      commandId: 'play',
      expectedRevision: 0,
      action: { type: 'track.play' },
    });
    c.handle('session.command', {
      sessionId: s.id,
      commandId: 'mute',
      expectedGeneration: 0,
      action: { type: 'mute', muted: true },
    });
    expect(
      data(c.handle('activities.view', { sessionId: s.id, instanceId: a.instanceId })).playback,
    ).toBe('requested');
  });
  test('disconnect pauses and invalidates generation without automatic capture', () => {
    const c = new MockCoordinator();
    const s = start(c);
    c.disconnect();
    const now = c.snapshot();
    expect(now?.generation).toBeGreaterThan(s.generation);
    expect(now?.phase).toBe('paused');
    expect(now?.captureGrant).toBeNull();
    expect(
      c.handle('session.command', {
        sessionId: s.id,
        commandId: 'old',
        expectedGeneration: 0,
        action: { type: 'resume' },
      }).ok,
    ).toBe(false);
  });
  test('real help/camera/memory fail explicitly and simulation survives stop', () => {
    const c = new MockCoordinator();
    const s = start(c);
    expect(c.handle('help.create', { profileId, commandId: 'real', mode: 'real' }).ok).toBe(false);
    expect(
      c.handle('checkIn.request', { profileId, deviceId: 'fake-stackchan', commandId: 'camera' })
        .ok,
    ).toBe(false);
    expect(
      c.handle('preferences.update', { profileId, expectedRevision: 0, rememberingEnabled: true })
        .ok,
    ).toBe(false);
    const help = data(c.handle('help.create', { profileId, commandId: 'sim', mode: 'simulation' }));
    expect(help.mode).toBe('simulation');
    const generation = c.snapshot()!.generation;
    c.handle('session.command', {
      sessionId: s.id,
      commandId: 'stop',
      expectedGeneration: generation,
      action: { type: 'stop' },
    });
    expect(data(c.handle('help.status', { requestId: help.id })).status).toBe('created');
  });
  test('profile save checks revisions and does not enable retention', () => {
    const c = new MockCoordinator();
    const p = data(c.handle('profile.loadCaregiver', { profileId }));
    expect(
      c.handle('profile.save', { profile: { ...p, rememberingEnabled: true }, expectedRevision: 0 })
        .ok,
    ).toBe(false);
    expect(c.handle('profile.save', { profile: p, expectedRevision: 4 }).ok).toBe(false);
  });
  test('mock request rejects remote peers, DNS rebinding and foreign origins', () => {
    expect(localMockRequestAllowed(new Request('http://127.0.0.1:3001/'), '127.0.0.1')).toBe(true);
    expect(
      localMockRequestAllowed(
        new Request('http://127.0.0.1:3001/', { headers: { origin: 'https://evil.invalid' } }),
        '127.0.0.1',
      ),
    ).toBe(false);
    expect(localMockRequestAllowed(new Request('http://evil.invalid/'), '127.0.0.1')).toBe(false);
    expect(localMockRequestAllowed(new Request('http://127.0.0.1/'), '192.168.1.2')).toBe(false);
  });
});
