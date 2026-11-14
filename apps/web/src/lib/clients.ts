import { createClients, createHttpTransport } from '@lemmi/contracts';
export const clients = createClients(createHttpTransport('mock'));
// To integrate real services, supply a live transport explicitly. No automatic fallback.
