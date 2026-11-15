import { expect, test } from 'bun:test';
import { contactStatusText } from '../packages/server/src/contact/types';

// The same participant projection serves primary and safeguarding-safe routes.
// It must never tell an abuse reporter that the implicated caregiver was notified.
test('contact status keeps the recipient role neutral for safe-alternate routes in both languages', () => {
  for (const status of [
    'created',
    'sending',
    'accepted',
    'delivery_unknown',
    'acknowledged',
    'no_response',
    'expired',
    'canceled',
    'resolved',
    'failed',
  ] as const) {
    const english = contactStatusText(status, 'en');
    const german = contactStatusText(status, 'de');
    expect(english).not.toMatch(/caregiver|carer|family/i);
    expect(german).not.toMatch(/Betreuungsperson|Pflegeperson|Familie/i);
    expect(english.length).toBeLessThanOrEqual(200);
    expect(german.length).toBeLessThanOrEqual(200);
  }
});

test('provider acceptance wording stays distinct from delivery and human acknowledgment', () => {
  expect(contactStatusText('accepted', 'en')).toBe(
    "I've sent a notification to your trusted contact.",
  );
  expect(contactStatusText('accepted', 'en')).not.toMatch(/delivered|read|acknowledged|arriv/i);
  expect(contactStatusText('accepted', 'de')).not.toMatch(
    /zugestellt|gelesen|bestätigt|angekommen/i,
  );
  expect(contactStatusText('delivery_unknown', 'en')).toContain('uncertain');
  expect(contactStatusText('acknowledged', 'en')).toContain('acknowledged your request');
});
