import { z } from 'zod';
import { IdSchema } from './common';

export const PairDeviceInputSchema = z.strictObject({
  deviceId: IdSchema,
  profileId: IdSchema,
  commandId: IdSchema,
  // Explicit caregiver choice; database-backed gateways only.
  credentialMode: z.literal('persistent').optional(),
});
export const PairDeviceResultSchema = z.strictObject({
  pairingId: IdSchema,
  deviceId: IdSchema,
  profileId: IdSchema,
  code: z.string().length(24),
  expiresAt: z.string().datetime(),
});
export const ClaimDeviceInputSchema = z.strictObject({
  pairingId: IdSchema,
  code: z.string().length(24),
  // Firmware sends this only after an explicit local confirmation.
  localConfirmed: z.literal(true),
});
export const ClaimDeviceResultSchema = z.strictObject({
  deviceId: IdSchema,
  profileId: IdSchema,
  credential: z.string().min(40).max(100),
  // null means valid until explicitly revoked, not permission to start capture.
  expiresAt: z.string().datetime().nullable(),
});
export const RevokeDeviceInputSchema = z.strictObject({
  deviceId: IdSchema,
  commandId: IdSchema,
});
export const RevokeDeviceResultSchema = z.strictObject({ revoked: z.literal(true) });
export type PairDeviceInput = z.infer<typeof PairDeviceInputSchema>;
export type PairDeviceResult = z.infer<typeof PairDeviceResultSchema>;
export type ClaimDeviceInput = z.infer<typeof ClaimDeviceInputSchema>;
export type ClaimDeviceResult = z.infer<typeof ClaimDeviceResultSchema>;
export type RevokeDeviceInput = z.infer<typeof RevokeDeviceInputSchema>;
// Private authenticated loopback seam. Public handlers derive actor from verified identity.
export const PairDeviceAuthorityInputSchema = z.strictObject({
  actor: z.string().min(1).max(200),
  input: PairDeviceInputSchema,
});
export const RevokeDeviceAuthorityInputSchema = z.strictObject({
  actor: z.string().min(1).max(200),
  input: RevokeDeviceInputSchema,
});
