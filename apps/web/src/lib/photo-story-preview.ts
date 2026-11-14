// Temporary browser-only presentation files, not session/activity or server media state.
// Context is owned by +layout and never written to localStorage, disk, or a backend.
export const photoStoryPreviewKey = Symbol('photo-story-preview');
export type PreviewPhoto = { id: string; profileId: string; url: string; caption: string };
export interface PhotoStoryPreviewContext {
  readonly photos: readonly PreviewPhoto[];
  add: (profileId: string, file: File, caption: string) => string | null;
  remove: (profileId: string, id: string) => void;
}
