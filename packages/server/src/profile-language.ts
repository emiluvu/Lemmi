import { IdSchema } from '@lemmi/contracts';

// Server-only pilot configuration. Evaluated once at startup: changes require restart,
// which ends existing sessions. Names and client requests never select a language.
export function createProfileLanguageResolver(raw = '') {
  const ids = raw
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  if (
    ids.length > 100 ||
    ids.some((id) => !IdSchema.safeParse(id).success || !/^profile-[A-Za-z0-9_-]+$/.test(id))
  )
    throw new Error('LEMMI_GERMAN_PROFILE_IDS must contain exact assigned profile IDs');
  const german = new Set(ids);
  return (profileId: string): 'en' | 'de' => (german.has(profileId) ? 'de' : 'en');
}
export const configuredProfileLanguage = createProfileLanguageResolver(
  process.env.LEMMI_GERMAN_PROFILE_IDS,
);
