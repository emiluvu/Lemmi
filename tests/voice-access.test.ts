import { expect, test } from 'bun:test';
import { voiceAccessSettings } from '../apps/web/voice-access';
const credential = 'fixture-device-credential-'.repeat(3);
const fixture = {
  backendUrl: 'https://backend.invalid',
  websocketUrl: 'wss://backend.invalid/v1/device-stream',
  deviceId: 'stackchan-alex',
  profileId: 'profile-alex',
  credential,
  headers: {
    Authorization: `Bearer ${credential}`,
    'X-Lemmi-Access-Key': 'fixture-access-key-'.repeat(3),
  },
};
test('private access file maps only the scoped endpoint settings and rejects other profiles/destinations', () => {
  const mapped = voiceAccessSettings({ ...fixture, unrelatedAdminSecret: 'must-not-propagate' });
  expect(Object.keys(mapped).sort()).toEqual([
    'LEMMI_ACCESS_KEY',
    'LEMMI_DEVICE_CREDENTIAL',
    'LEMMI_PUBLIC_ORIGIN',
  ]);
  expect(JSON.stringify(mapped)).not.toContain('must-not-propagate');
  for (const changed of [
    { profileId: 'preview-sam' },
    { deviceId: 'other-device' },
    { backendUrl: 'http://backend.invalid' },
    { websocketUrl: 'wss://other.invalid/v1/device-stream' },
    { headers: { ...fixture.headers, Authorization: 'Bearer different' } },
    { credential: 'secret\r\nheader' },
  ])
    expect(() => voiceAccessSettings({ ...fixture, ...changed })).toThrow();
});
