// Page-visit appearance only; not an authenticated account or session store.
export const caregiverAppearanceKey = Symbol('caregiver-appearance');
export interface CaregiverAppearance {
  readonly photo: string | null;
  setPhoto(file: File | null): void;
}
