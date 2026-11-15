import type { ProfileDetail } from '@lemmi/contracts';
import { publicPhotoStoryPack } from '@lemmi/activities';
import { caregiverProfile } from '@lemmi/contracts/fixtures';
import type { ChatAdapter } from './adapters/types';
import type { ConversationDecisionAdapter } from './adapters/conversation-decisions';
import type { SpeechAdapters } from './speech-turns';
import { SessionCoordinator } from './session-coordinator';

// One gateway authority, with isolated coordinator state per authorized profile.
export class SessionRegistry {
  private readonly retired = new Set<string>();
  private readonly entries = new Map<string, SessionCoordinator>();
  constructor(
    private readonly chat?: ChatAdapter,
    private readonly speech?: SpeechAdapters,
    private readonly now: () => number = Date.now,
    private readonly changed: () => void = () => {},
    private readonly publicPhotoStory = false,
    private readonly decisions?: ConversationDecisionAdapter,
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
  authorizePhotoDemoProfile(profileId: string, enabled: boolean) {
    this.forProfile(profileId).authorizePublicPhotoDemo(this.publicPhotoStory && enabled);
  }
  removeProfile(profileId: string) {
    this.entries.get(profileId)?.disconnect();
    this.retired.add(profileId);
  }
  all() {
    return [...this.entries]
      .filter(([id]) => !this.retired.has(id))
      .map(([, coordinator]) => coordinator);
  }
  acceptPersistentProfile(profile: ProfileDetail, contextChanged?: boolean) {
    this.retired.delete(profile.id);
    let coordinator = this.entries.get(profile.id);
    if (!coordinator) {
      if (this.entries.size >= 100) throw new Error('Profile session capacity reached');
      coordinator = new SessionCoordinator(
        'live',
        this.chat,
        this.speech,
        this.now,
        this.changed,
        this.publicPhotoStory
          ? {
              publicDemo: true,
              profileId: profile.id,
              pack: publicPhotoStoryPack,
              availableAssetIds: ['photo-story-garden', 'photo-story-park'],
            }
          : undefined,
        this.decisions,
      );
      this.entries.set(profile.id, coordinator);
    }
    coordinator.acceptPersistentProfile(profile, contextChanged);
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
