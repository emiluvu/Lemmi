import type { RequestHandler } from './$types';
import { startConversationLock } from '#lib/server/conversation-exit.ts';
export const POST: RequestHandler = ({ request }) => startConversationLock(request);
