import type { RequestHandler } from './$types';
import { verifyConversationExit } from '#lib/server/conversation-exit.ts';
export const POST: RequestHandler = ({ request }) => verifyConversationExit(request);
