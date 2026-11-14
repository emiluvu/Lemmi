import { assertMockMode } from '@lemmi/server';
assertMockMode();
console.info('Lemmi worker seam only: no jobs, providers or durable delivery configured.');
// Anay: implement PostgreSQL outbox/leases, bounded retries and deletion before any real send.
