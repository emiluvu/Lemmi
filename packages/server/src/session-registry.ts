import type { ProfileDetail } from '@lemmi/contracts';
import { caregiverProfile } from '@lemmi/contracts/fixtures';
import type { ChatAdapter } from './adapters/types';
import type { SpeechAdapters } from './speech-turns';
import { SessionCoordinator } from './session-coordinator';

// One gateway authority, with isolated coordinator state per authorized profile.
export class SessionRegistry {
  private readonly entries = new Map<string, SessionCoordinator>();
  constructor(
    private readonly chat?: ChatAdapter,
    private readonly speech?: SpeechAdapters,
    private readonly now: () => number = Date.now,
    private readonly onFixedReply: () => void = () => {},
  ) {
    this.acceptPersistentProfile({
      ...structuredClone(caregiverProfile),
      privacyRevision: 0,
      policyRevision: 0,
      approvedFacts: [],
    });
  }
  forProfile(profileId: string) {
    const coordinator = this.entries.get(profileId);
    if (!coordinator) throw new Error('Profile is not assigned');
    return coordinator;
  }
  all() {
    return [...this.entries.values()];
  }
  acceptPersistentProfile(profile: ProfileDetail) {
    let coordinator = this.entries.get(profile.id);
    if (!coordinator) {
      if (this.entries.size >= 100) throw new Error('Profile session capacity reached');
      coordinator = new SessionCoordinator(
        'live',
        this.chat,
        this.speech,
        this.now,
        this.onFixedReply,
      );
      this.entries.set(profile.id, coordinator);
    }
    coordinator.acceptPersistentProfile(profile);
  }
  pauseForProfileUpdate(patch: Record<string, unknown>, profileId = 'profile-alex') {
    this.forProfile(profileId).pauseForProfileUpdate(patch);
  }
  persistenceSnapshot() {
    return this.forProfile('profile-alex').persistenceSnapshot();
  }
  disconnect() {
    for (const coordinator of this.entries.values()) coordinator.disconnect();
  }
}
