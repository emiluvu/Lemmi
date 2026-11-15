import { z } from 'zod';
import { IdSchema } from './common';

export const HelpSnapshotSchema = z.strictObject({
  id: IdSchema,
  profileId: IdSchema,
  status: z.enum([
    'created',
    'sending',
    'accepted',
    'delivery_unknown',
    'delivered',
    'acknowledged',
    'failed',
    'no_response',
    'canceled',
    'expired',
    'resolved',
  ]),
  mode: z.enum(['simulation', 'real']),
  reason: z.enum(['manual', 'urgent_concern', 'concern']),
  message: z.string().max(200),
});

export const ConcernCategorySchema = z.enum([
  'none',
  'help_request',
  'urgent',
  'concern',
  'safeguarding',
  'departure',
  'contact_request',
  'human_support',
]);
export const HelpCreateBodySchema = z.strictObject({ commandId: IdSchema });
export const HelpHttpRequestSchema = z.discriminatedUnion('action', [
  z.strictObject({
    action: z.literal('create'),
    actor: z.string().min(1).max(200),
    profileId: IdSchema,
    commandId: IdSchema,
  }),
  z.strictObject({
    action: z.enum(['status', 'acknowledge', 'cancel', 'resolve']),
    actor: z.string().min(1).max(200),
    profileId: IdSchema,
    requestId: z.string().uuid(),
  }),
]);
